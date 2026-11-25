import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(process.cwd());
const distDir = path.join(rootDir, 'dist');
const ssrDir = path.join(rootDir, 'dist-ssr');
const templatePath = path.join(distDir, 'index.html');

function resolveEntryServer() {
  const candidates = ['entry-server.js', 'entry-server.mjs'];
  for (const name of candidates) {
    const fullPath = path.join(ssrDir, name);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  throw new Error(`Could not find SSR bundle inside ${ssrDir}`);
}

function writeRouteHtml(templateHtml, routePath, headHtml, appHtml) {
  let html = templateHtml.replace(
    /<!--cliplab-head-start-->[\s\S]*?<!--cliplab-head-end-->/,
    `<!--cliplab-head-start-->\n    ${headHtml}\n    <!--cliplab-head-end-->`
  );
  html = html.replace('<!--cliplab-ssr-outlet-->', appHtml);

  if (routePath === '/') {
    fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');
    return;
  }
  if (routePath === '/404') {
    fs.writeFileSync(path.join(distDir, '404.html'), html, 'utf8');
    return;
  }

  const cleanRel = routePath.replace(/^\/+/, '');
  const outDir = path.join(distDir, cleanRel);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
}

function buildSitemapXml(siteUrl, routes) {
  const today = new Date().toISOString().split('T')[0];
  const entries = routes
    .map((route) => {
      const loc = route === '/' ? `${siteUrl}/` : `${siteUrl}${route}`;
      const priority =
        route === '/'
          ? '1.0'
          : route === '/editor' || route === '/guides' || route === '/templates'
            ? '0.9'
            : route.startsWith('/guides/') || route === '/how-it-works' || route === '/watermark-maker'
              ? '0.8'
              : '0.5';
      const changefreq = route === '/' || route === '/guides' ? 'weekly' : 'monthly';
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function buildRobotsTxt(siteUrl, allowAiCrawlers, appName) {
  const aiRule = allowAiCrawlers ? 'Allow: /' : 'Disallow: /';
  return [
    `# ${appName} robots.txt (${siteUrl})`,
    'User-agent: *',
    'Allow: /',
    'Allow: /assets/',
    'Allow: /ffmpeg/',
    'Allow: /fonts/',
    '',
    '# AI Answer Engine Crawlers (toggled via VITE_ALLOW_AI_CRAWLERS)',
    'User-agent: GPTBot',
    aiRule,
    '',
    'User-agent: ClaudeBot',
    aiRule,
    '',
    'User-agent: PerplexityBot',
    aiRule,
    '',
    'User-agent: Google-Extended',
    aiRule,
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

function buildLlmsTxt(siteUrl, siteConfig, guides) {
  const guideLines = guides.map(
    (g) => `- [${g.h1}](${siteUrl}/guides/${g.slug}): ${g.metaDescription}`
  );
  return [
    `# ${siteConfig.appName}`,
    '',
    `> ${siteConfig.entitySentence}`,
    '',
    '## Core Capabilities',
    '- Fast Mode stream-copy trimming (`-c copy`) for near-instant 16:9 cuts with zero quality loss',
    '- H.264 + AAC (`veryfast`) re-encoding when resizing to 9:16, 1:1, 4:5, adding overlays, or changing speed',
    '- Smart Moments (8 kHz audio RMS spikes + 192px 3 fps motion + scene change analysis inside a Web Worker)',
    siteConfig.enableAutoCaptions
      ? '- Auto clip everything pipeline with editable speech boost keywords, reason tags (`loud`, `motion`, `speech`, `keyword`), editable Hook candidates, and batch `.ZIP` export (`fflate`)'
      : '- Auto clip everything pipeline with Smart Moments audio/motion ranking, editable Hook candidates, and batch `.ZIP` export (`fflate`)',
    '- Smart follow vertical tracking (with optional outer HUD edge masking), Blurred Background fill (100–140% scale), and Gameplay + Facecam split layout (`vstack`)',
    siteConfig.enableAutoCaptions
      ? '- Optional on-device Whisper Tiny auto captions (`onnx-community/whisper-tiny_timestamped`, Light CPU ~45 MB default or Fast GPU ~156 MB if chosen with automatic CPU fallback, one-time cached download) alongside Manual lines and `.srt` import, 8 burn-in styles (`Classic`, `Bold Pop`, `Boxed`, `Minimal`, `Hype Pop`, `Neon Glow`, `Comic Burst`, `Sticker Box`), deterministic `Auto mix`, and `.srt` / `.vtt` export'
      : '- Manual caption editor and `.srt` import with 8 burn-in styles (`Classic`, `Bold Pop`, `Boxed`, `Minimal`, `Hype Pop`, `Neon Glow`, `Comic Burst`, `Sticker Box`), deterministic `Auto mix`, safe-zone guide, and `.srt` / `.vtt` export',
    '- Built-in transparent PNG Watermark Maker, 3-second hook templates, animated GIF export, and PNG frame capture',
    '- One-click presets for YouTube Shorts, TikTok, Instagram Reels, and Facebook Reels',
    '',
    '## Honest Limitations & Permissions',
    '- Local MP4, MOV, and WebM files (never downloads from YouTube, Instagram, Facebook, TikTok, Twitch, or Kick; direct `.mp4`/`.webm`/`.mov` links work only when the host allows browser CORS requests, and that host sees the request)',
    `- Users are responsible for having the rights or permission to edit and share any video they load; ${siteConfig.platformDisclaimer}`,
    '- 32-bit browser WebAssembly memory limits (~1–2 GB total per tab; warning shown above 300 MB)',
    '- Face-aware mode only activates in browsers supporting the native `FaceDetector` API and falls back to motion tracking otherwise',
    '',
    '## Main Pages',
    `- [Home](${siteUrl}/): Upload a local video or explore built-in Looks`,
    `- [Clip Editor](${siteUrl}/editor): Trim, reframe 9:16, captions, Smart Moments, and batch .ZIP export`,
    `- [Templates & Looks](${siteUrl}/templates): 4 one-click framing and caption presets (Blur Fill Classic, Action Follow, Gameplay + Facecam, Quick Cut)`,
    `- [Watermark Maker](${siteUrl}/watermark-maker): Design transparent PNG channel stamps`,
    `- [How It Works & FAQ](${siteUrl}/how-it-works): Technical guide, shortcuts, and ${siteConfig.faqCount ?? 10} FAQs`,
    `- [Guides](${siteUrl}/guides): Practical short-form clipping workflows`,
    `- [About](${siteUrl}/about): Architecture, verified features, and operator contact`,
    '',
    '## Creator Guides',
    ...guideLines,
    '',
  ].join('\n');
}

async function runPrerender() {
  if (!fs.existsSync(templatePath)) {
    throw new Error('dist/index.html missing. Run `vite build` before prerender.');
  }
  const templateHtml = fs.readFileSync(templatePath, 'utf8');
  const ssrEntry = resolveEntryServer();
  const ssrModule = await import(pathToFileURL(ssrEntry).href);

  // Import compiled config & route helpers cleanly through SSR bundle or source helper via tsx?
  // Entry-server already imports seo.ts & appConfig.ts, let's expose them cleanly from entry-server!
  const { renderRoute, getIndexableRoutes, siteConfig, guidesList } = ssrModule;
  const routes = getIndexableRoutes();
  const siteUrl = siteConfig.SITE_URL;

  // Render every indexable route plus /404
  for (const route of [...routes, '/404']) {
    const { appHtml, headHtml } = renderRoute(route);
    writeRouteHtml(templateHtml, route, headHtml, appHtml);
  }

  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), buildSitemapXml(siteUrl, routes), 'utf8');
  fs.writeFileSync(
    path.join(distDir, 'robots.txt'),
    buildRobotsTxt(siteUrl, siteConfig.allowAiCrawlers, siteConfig.appName),
    'utf8'
  );
  fs.writeFileSync(
    path.join(distDir, 'llms.txt'),
    buildLlmsTxt(siteUrl, siteConfig, guidesList),
    'utf8'
  );

  // Optional IndexNow key verification file if configured (ignore empty/placeholder/none)
  const rawIndexNow = (siteConfig.indexNowKey ?? '').trim();
  const lowerIndexNow = rawIndexNow.toLowerCase();
  if (
    rawIndexNow &&
    lowerIndexNow !== 'placeholder' &&
    lowerIndexNow !== 'none' &&
    /^[a-zA-Z0-9-]+$/.test(rawIndexNow)
  ) {
    fs.writeFileSync(
      path.join(distDir, `${rawIndexNow}.txt`),
      rawIndexNow,
      'utf8'
    );
  }

  // Clean up temporary SSR build folder
  fs.rmSync(ssrDir, { recursive: true, force: true });

  console.log(
    `[prerender] Rendered ${routes.length} routes + 404.html, sitemap.xml, robots.txt, and llms.txt (${siteUrl})`
  );
}

await runPrerender();
