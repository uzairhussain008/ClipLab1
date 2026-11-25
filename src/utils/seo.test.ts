import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  APP_CONFIG,
  DEFAULT_SITE_URL,
  ENABLE_AUTO_CAPTIONS,
  isValidIndexNowKey,
  resolveEnableAutoCaptions,
  resolveFfmpegCoreBaseUrl,
  resolveSiteUrl,
  resolveVerificationToken,
} from '../config/appConfig';
import { HOW_IT_WORKS_FAQS, HOW_IT_WORKS_STEPS } from '../data/faqs';
import { GUIDES } from '../data/guides';
import {
  buildAbsoluteUrl,
  getAllIndexableRoutes,
  getHomeFeatureList,
  getSeoForRoute,
  renderHeadTagsHtml,
} from './seo';

function countGuideWords(guideIndex: number): number {
  const g = GUIDES[guideIndex];
  const parts = [
    g.h1,
    g.quickAnswer,
    ...g.keyTakeaways,
    ...g.sections.flatMap((s) => [
      s.question,
      s.answer,
      ...(s.bullets ?? []),
      ...(s.table ? [...s.table.headers, ...s.table.rows.flat()] : []),
    ]),
    ...(g.faqs ?? []).flatMap((f) => [f.q, f.a]),
  ];
  return parts.join(' ').trim().split(/\s+/).length;
}

test('all indexable routes meet title, description, canonical, and brand-safety rules', () => {
  const routes = getAllIndexableRoutes();
  assert.ok(routes.length >= 16);

  const forbiddenTitleTerms = /\b(gta|rockstar|take-two|grand theft)\b/i;

  for (const route of routes) {
    const meta = getSeoForRoute(route);
    assert.ok(meta.title.length > 10 && meta.title.length <= 60, `Title length for ${route}: ${meta.title.length}`);
    assert.ok(
      meta.description.length > 50 && meta.description.length <= 160,
      `Description length for ${route}: ${meta.description.length}`
    );
    assert.match(meta.canonicalUrl, /^https?:\/\//);
    assert.equal(meta.robots, 'index, follow');

    assert.equal(forbiddenTitleTerms.test(meta.title), false, `Forbidden term in title for ${route}`);
    assert.equal(
      forbiddenTitleTerms.test(meta.description),
      false,
      `Forbidden term in description for ${route}`
    );

    const headHtml = renderHeadTagsHtml(meta);
    assert.ok(headHtml.includes('<link rel="canonical"'));
    assert.ok(headHtml.includes('og-image.png'));
  }
});

test('home, how-it-works, and 404 schemas stay accurate and synchronized', () => {
  const home = getSeoForRoute('/');
  const homeTypes = home.schemas.map((s) => s['@type']);
  assert.deepEqual(homeTypes, ['WebSite', 'Organization', 'WebApplication']);

  const howItWorks = getSeoForRoute('/how-it-works');
  const faqSchema = howItWorks.schemas.find((s) => s['@type'] === 'FAQPage') as
    | { mainEntity: unknown[] }
    | undefined;
  assert.ok(faqSchema);
  assert.equal(faqSchema.mainEntity.length, HOW_IT_WORKS_FAQS.length);

  const notFound = getSeoForRoute('/missing-page');
  assert.equal(notFound.robots, 'noindex, nofollow');
});

test('all creator guides have 600+ words and valid internal relatedSlugs', () => {
  assert.ok(GUIDES.length >= 6 && GUIDES.length <= 9);
  const slugSet = new Set(GUIDES.map((g) => g.slug));
  assert.ok(slugSet.has('download-your-own-videos'), 'Missing /guides/download-your-own-videos');

  const forbiddenDownloaderTerms =
    /\b(youtube downloader|download instagram reels|tiktok downloader|facebook downloader)\b/i;

  GUIDES.forEach((guide, idx) => {
    const words = countGuideWords(idx);
    assert.ok(words >= 600, `Guide "${guide.slug}" only has ${words} words (need >= 600)`);
    assert.equal(/\b(gta|rockstar|take-two)\b/i.test(guide.h1), false);
    assert.equal(forbiddenDownloaderTerms.test(guide.title), false);
    assert.equal(forbiddenDownloaderTerms.test(guide.metaDescription), false);
    assert.equal(forbiddenDownloaderTerms.test(guide.h1), false);
    for (const rel of guide.relatedSlugs) {
      assert.ok(slugSet.has(rel), `Invalid relatedSlug "${rel}" in ${guide.slug}`);
    }
  });
});

function walkSourceFiles(dir: string, results: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, results);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

test('no hard-coded ClipLab product name outside src/config/appConfig.ts', () => {
  const rootDir = process.cwd();
  const srcDir = path.join(rootDir, 'src');
  const files = walkSourceFiles(srcDir);

  for (const filePath of files) {
    const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
    if (rel === 'src/config/appConfig.ts') continue;

    // Strip allowed internal symbol names & DOM data attributes before scanning
    const content = fs
      .readFileSync(filePath, 'utf8')
      .replace(/\b(ClipLabContext|ClipLabProvider|useClipLab)\b/g, '')
      .replace(/data-cliplab-seo|cliplab-head-|cliplab-ssr-outlet|cliplab_whisper_/g, '');

    assert.equal(
      /\bClipLab1?\b/.test(content),
      false,
      `Found hard-coded ClipLab/ClipLab1 name in ${rel} — use APP_CONFIG.appName instead`
    );
  }

  // Also ensure static non-TS assets/docs don't contain the old "ClipLab" brand without "1"
  const staticChecks = [
    'index.html',
    'public/manifest.webmanifest',
    'public/brand/logo.svg',
    'public/ads.txt',
    'scripts/prerender.mjs',
    'scripts/generate-brand-assets.mjs',
    'README.md',
  ];
  for (const rel of staticChecks) {
    const raw = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    assert.equal(/\bClipLab\b/.test(raw), false, `Found old "ClipLab" name in ${rel}`);
  }
});

test('SITE_URL and FFMPEG_CORE_BASE_URL fall back cleanly without trailing slashes', () => {
  assert.equal(DEFAULT_SITE_URL, 'https://cliplab1.ai.studio');
  assert.equal(APP_CONFIG.SITE_URL, 'https://cliplab1.ai.studio');
  assert.equal(resolveSiteUrl(undefined), 'https://cliplab1.ai.studio');
  assert.equal(resolveSiteUrl(''), 'https://cliplab1.ai.studio');
  assert.equal(resolveSiteUrl('   '), 'https://cliplab1.ai.studio');
  assert.equal(resolveSiteUrl('/'), 'https://cliplab1.ai.studio');
  assert.equal(resolveSiteUrl('https://clips.example.com///'), 'https://clips.example.com');

  assert.equal(buildAbsoluteUrl('/'), 'https://cliplab1.ai.studio/');
  assert.equal(buildAbsoluteUrl('/editor'), 'https://cliplab1.ai.studio/editor');

  const homeSeo = getSeoForRoute('/');
  assert.equal(homeSeo.canonicalUrl, 'https://cliplab1.ai.studio/');
  assert.equal(homeSeo.ogImage, 'https://cliplab1.ai.studio/og-image.png');
  assert.ok(homeSeo.title.includes(APP_CONFIG.appName));
  assert.equal(
    (homeSeo.schemas[2] as { description?: string }).description,
    APP_CONFIG.entitySentence
  );

  assert.equal(APP_CONFIG.FFMPEG_CORE_BASE_URL, '/ffmpeg');
  assert.equal(resolveFfmpegCoreBaseUrl(undefined), '/ffmpeg');
  assert.equal(resolveFfmpegCoreBaseUrl(''), '/ffmpeg');
  assert.equal(resolveFfmpegCoreBaseUrl('   '), '/ffmpeg');
  assert.equal(resolveFfmpegCoreBaseUrl('https://cdn.example.com/ffmpeg/'), 'https://cdn.example.com/ffmpeg');
});

test('verification tokens ignore empty, placeholder, and none values', () => {
  const ignoredValues = [undefined, '', '   ', 'none', 'NONE', 'None', 'placeholder', 'PLACEHOLDER'];
  for (const val of ignoredValues) {
    assert.equal(resolveVerificationToken(val), '', `Expected empty token for "${String(val)}"`);
    assert.equal(isValidIndexNowKey(val), false, `Expected invalid IndexNow key for "${String(val)}"`);
  }

  assert.equal(resolveVerificationToken('  abc-123  '), 'abc-123');
  assert.equal(isValidIndexNowKey('abc123-key'), true);

  const meta = getSeoForRoute('/');
  const htmlIgnored = renderHeadTagsHtml(meta, {
    google: 'none',
    bing: 'PLACEHOLDER',
  });
  assert.equal(htmlIgnored.includes('google-site-verification'), false);
  assert.equal(htmlIgnored.includes('msvalidate.01'), false);

  const htmlValid = renderHeadTagsHtml(meta, {
    google: 'gsc-real-token',
    bing: 'bing-real-token',
  });
  assert.ok(htmlValid.includes('<meta name="google-site-verification" content="gsc-real-token"'));
  assert.ok(htmlValid.includes('<meta name="msvalidate.01" content="bing-real-token"'));
});

test('ENABLE_AUTO_CAPTIONS defaults to true, supports false/0 kill switch, and syncs guides, schema, and docs', () => {
  assert.equal(ENABLE_AUTO_CAPTIONS, true);
  assert.equal(APP_CONFIG.ENABLE_AUTO_CAPTIONS, true);
  assert.equal(APP_CONFIG.captions.enabled, true);

  assert.equal(resolveEnableAutoCaptions(undefined), true);
  assert.equal(resolveEnableAutoCaptions(''), true);
  assert.equal(resolveEnableAutoCaptions('  '), true);
  assert.equal(resolveEnableAutoCaptions('true'), true);
  assert.equal(resolveEnableAutoCaptions('false'), false);
  assert.equal(resolveEnableAutoCaptions('FALSE'), false);
  assert.equal(resolveEnableAutoCaptions('0'), false);
  assert.equal(resolveEnableAutoCaptions(' false '), false);

  const disabledFeatures = getHomeFeatureList(false);
  const enabledFeatures = getHomeFeatureList(true);
  assert.ok(disabledFeatures.some((f) => f.includes('Manual & .SRT captions') && f.includes('8 burn-in styles')));
  assert.equal(
    disabledFeatures.some((f) => /auto[- ]?caption|whisper/i.test(f)),
    false,
    'Disabled featureList must not mention auto captions or Whisper'
  );
  assert.ok(enabledFeatures.some((f) => /whisper tiny auto captions.*8 styles.*auto mix/i.test(f)));

  assert.ok(
    GUIDES.some((g) => g.slug === 'on-device-auto-captions-and-srt-workflow'),
    'Auto captions guide must be included when ENABLE_AUTO_CAPTIONS is true'
  );
  assert.ok(HOW_IT_WORKS_FAQS.some((faq) => /on-device Auto Captions/i.test(faq.q)));
  assert.ok(HOW_IT_WORKS_STEPS.some((step) => /Auto \(on-device/i.test(step.text)));

  const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8');
  assert.match(readme, /VITE_ENABLE_AUTO_CAPTIONS=false/);
  assert.match(readme, /Hype Pop/);
  assert.match(readme, /Auto mix/);
  assert.match(readme, /OFL-1\.1/);
  assert.match(readme, /Apache-2\.0/);
});

function walkAllRepoTextFiles(dir: string, results: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAllRepoTextFiles(full, results);
    } else if (/\.(ts|tsx|js|mjs|md|html|webmanifest|json)$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

test('whisper model sizes are consistently 45 MB (Light CPU) or 156 MB (Fast GPU) with no legacy 75 MB remaining', () => {
  assert.equal(APP_CONFIG.captions.estimatedModelSizeMB, 45);
  assert.equal(APP_CONFIG.captions.estimatedGpuModelSizeMB, 156);

  const rootDir = process.cwd();
  const files = walkAllRepoTextFiles(rootDir);
  for (const filePath of files) {
    const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
    if (rel === 'src/utils/seo.test.ts') continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    assert.equal(
      /\b75\s*MB\b/i.test(raw),
      false,
      `Found legacy 75 MB Whisper model size in ${rel}`
    );
  }

  // Verify consent dialogs offer the exact Light/Fast options
  const captionsPanel = fs.readFileSync(path.join(rootDir, 'src/components/CaptionsPanel.tsx'), 'utf8');
  const editorPage = fs.readFileSync(path.join(rootDir, 'src/pages/EditorPage.tsx'), 'utf8');
  for (const [name, src] of [
    ['CaptionsPanel.tsx', captionsPanel],
    ['EditorPage.tsx', editorPage],
  ]) {
    assert.match(src, /Light \(CPU, about \{APP_CONFIG\.captions\.estimatedModelSizeMB\} MB\)/, name);
    assert.match(
      src,
      /Fast \(GPU, about \{APP_CONFIG\.captions\.estimatedGpuModelSizeMB\} MB, only if\s+WebGPU works\)/,
      name
    );
  }

  // Verify Privacy, HomePage, FAQ, Guides, prerender llms.txt, and README mention 45 MB & 156 MB consistently
  const privacy = fs.readFileSync(path.join(rootDir, 'src/pages/PrivacyPage.tsx'), 'utf8');
  const prerender = fs.readFileSync(path.join(rootDir, 'scripts/prerender.mjs'), 'utf8');
  const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
  assert.match(privacy, /estimatedModelSizeMB/);
  assert.match(privacy, /estimatedGpuModelSizeMB/);
  assert.match(prerender, /45 MB/);
  assert.match(prerender, /156 MB/);
  assert.match(readme, /45 MB/);
  assert.match(readme, /156 MB/);

  const autoCapFaq = HOW_IT_WORKS_FAQS.find((f) => /Auto Captions/i.test(f.q));
  assert.ok(autoCapFaq);
  assert.match(autoCapFaq.a, /45 MB/);
  assert.match(autoCapFaq.a, /156 MB/);

  const autoCapGuide = GUIDES.find((g) => g.slug === 'on-device-auto-captions-and-srt-workflow');
  assert.ok(autoCapGuide);
  assert.match(autoCapGuide.quickAnswer, /45 MB/);
  assert.match(autoCapGuide.quickAnswer, /156 MB/);
});

test('/templates is indexable with CollectionPage + BreadcrumbList schema and ?template= URLs canonicalize to /editor', () => {
  const routes = getAllIndexableRoutes();
  assert.ok(routes.includes('/templates'), '/templates must be included in indexable routes');
  assert.equal(
    routes.some((r) => r.includes('?template=')),
    false,
    'Query URLs (?template=) must never appear in sitemap/indexable routes'
  );

  const templatesSeo = getSeoForRoute('/templates');
  assert.equal(templatesSeo.canonicalUrl, 'https://cliplab1.ai.studio/templates');
  assert.equal(templatesSeo.robots, 'index, follow');
  const schemaTypes = templatesSeo.schemas.map((s) => s['@type']);
  assert.ok(schemaTypes.includes('CollectionPage'));
  assert.ok(schemaTypes.includes('BreadcrumbList'));

  const editorTplSeo = getSeoForRoute('/editor?template=action-follow');
  assert.equal(editorTplSeo.canonicalUrl, 'https://cliplab1.ai.studio/editor');
  const serializedSchemas = JSON.stringify(editorTplSeo.schemas);
  assert.equal(serializedSchemas.includes('?template='), false);
});

test('HomePage removes Try Sample Clip CTA in favor of #what-you-can-make while EditorPage retains Try Sample Clip', () => {
  const rootDir = process.cwd();
  const homePage = fs.readFileSync(path.join(rootDir, 'src/pages/HomePage.tsx'), 'utf8');
  const editorPage = fs.readFileSync(path.join(rootDir, 'src/pages/EditorPage.tsx'), 'utf8');

  assert.equal(/Try Sample Clip/i.test(homePage), false, 'Home hero must not have Try Sample Clip');
  assert.match(homePage, /No video handy\? See what you can make/);
  assert.match(homePage, /#what-you-can-make/);
  assert.match(editorPage, /Try Sample Clip/);
});

test('index.html includes the popunder before </head> and Social Bar before </body> once each', () => {
  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const popunderTag =
    '<script data-cfasync="false" src="https://abscloud.org/1/6a40d565a042a63b916a2daffac2d4e6"></script>';
  assert.equal(indexHtml.split(popunderTag).length - 1, 1, 'Popunder script must appear once');
  assert.match(
    indexHtml,
    /<script data-cfasync="false" src="https:\/\/abscloud\.org\/1\/6a40d565a042a63b916a2daffac2d4e6"><\/script>\s*<\/head>/
  );

  const socialBarTag =
    '<script data-cfasync="false" src="https://bauval.org/14/a66b0375291a89c1da883d4d85555727"></script>';
  assert.equal(indexHtml.split(socialBarTag).length - 1, 1, 'Social Bar script must appear once');
  assert.match(
    indexHtml,
    /<script data-cfasync="false" src="https:\/\/bauval\.org\/14\/a66b0375291a89c1da883d4d85555727"><\/script>\s*<\/body>/
  );
});
