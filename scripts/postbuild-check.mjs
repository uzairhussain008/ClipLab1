import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const CLOUDFLARE_LIMIT_BYTES = 25 * 1024 * 1024; // 25 MiB

function walkFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, results);
    } else if (entry.isFile()) {
      results.push({
        relPath: path.relative(distDir, fullPath).replace(/\\/g, '/'),
        sizeBytes: fs.statSync(fullPath).size,
      });
    }
  }
  return results;
}

function formatMiB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function checkDeploymentSizes() {
  if (!fs.existsSync(distDir)) {
    console.warn('[postbuild] dist/ directory not found.');
    return;
  }

  const allFiles = walkFiles(distDir).sort((a, b) => b.sizeBytes - a.sizeBytes);
  const top10 = allFiles.slice(0, 10);
  const totalBytes = allFiles.reduce((acc, f) => acc + f.sizeBytes, 0);

  console.log(`\n[postbuild] Top 10 largest files in dist/ (total ${formatMiB(totalBytes)}):`);
  for (const file of top10) {
    const flag = file.sizeBytes > CLOUDFLARE_LIMIT_BYTES ? ' [> 25 MiB Cloudflare limit]' : '';
    console.log(`  - ${file.relPath.padEnd(42)} ${formatMiB(file.sizeBytes)}${flag}`);
  }

  const oversized = allFiles.filter((f) => f.sizeBytes > CLOUDFLARE_LIMIT_BYTES);
  if (oversized.length > 0) {
    console.warn(
      `\n[postbuild] WARNING: ${oversized.length} file(s) exceed Cloudflare Pages' 25 MiB per-file cap:`
    );
    for (const file of oversized) {
      console.warn(`  * ${file.relPath} (${formatMiB(file.sizeBytes)})`);
    }
    console.warn(
      `[postbuild] Tip: Host large ffmpeg-core.wasm (~31 MiB) on an R2/CDN origin with CORS enabled and set VITE_FFMPEG_CORE_BASE_URL (in .env) when deploying to Cloudflare Pages, or deploy cleanly to GitHub Pages / a host with larger asset limits.\n`
    );
  }
}

function isVerificationHtml(relPath) {
  return /^google[a-z0-9]+\.html$/i.test(relPath) || relPath.startsWith('assets/');
}

function checkPreRenderedHtml() {
  const allHtmlFiles = walkFiles(distDir).filter((f) => f.relPath.endsWith('.html'));
  const verificationHtmlFiles = allHtmlFiles.filter((f) => /^google[a-z0-9]+\.html$/i.test(f.relPath));
  const htmlFiles = allHtmlFiles.filter((f) => !isVerificationHtml(f.relPath));
  let errors = 0;

  for (const vf of verificationHtmlFiles) {
    const content = fs.readFileSync(path.join(distDir, vf.relPath), 'utf8').trim();
    if (!content.startsWith('google-site-verification:')) {
      console.error(`[seo-audit] Invalid Google verification file ${vf.relPath}`);
      errors++;
    }
  }

  const knownStaticTargets = new Set(
    htmlFiles
      .filter((f) => f.relPath !== '404.html')
      .map((f) => {
        if (f.relPath === 'index.html') return '/';
        return '/' + f.relPath.replace(/\/index\.html$/, '');
      })
  );

  for (const file of htmlFiles) {
    const fullPath = path.join(distDir, file.relPath);
    const html = fs.readFileSync(fullPath, 'utf8');
    const is404 = file.relPath === '404.html';

    if (!/<title>[^<]+<\/title>/.test(html)) {
      console.error(`[seo-audit] Missing <title> in ${file.relPath}`);
      errors++;
    }
    if (!/<meta name="description" content="[^"]+"/.test(html)) {
      console.error(`[seo-audit] Missing meta description in ${file.relPath}`);
      errors++;
    }
    if (!/<link rel="canonical" href="https?:\/\/[^"]+"/.test(html)) {
      console.error(`[seo-audit] Missing absolute canonical URL in ${file.relPath}`);
      errors++;
    }
    if (!is404 && /content="noindex/i.test(html)) {
      console.error(`[seo-audit] Unexpected noindex tag in ${file.relPath}`);
      errors++;
    }
    const h1Count = (html.match(/<h1[\s>]/g) || []).length;
    if (h1Count !== 1) {
      console.error(`[seo-audit] Expected exactly 1 <h1> in ${file.relPath}, found ${h1Count}`);
      errors++;
    }
    if (html.includes('<!--cliplab-ssr-outlet-->')) {
      console.error(`[seo-audit] Unreplaced SSR outlet placeholder in ${file.relPath}`);
      errors++;
    }

    // Internal link audit across rendered <a> hrefs
    const hrefMatches = html.matchAll(/<a[^>]+href="(\/[^"#?]*)"/g);
    for (const match of hrefMatches) {
      const target = match[1];
      if (knownStaticTargets.has(target)) continue;
      const diskCandidate = path.join(distDir, target.replace(/^\/+/, ''));
      if (!fs.existsSync(diskCandidate)) {
        console.error(`[link-audit] Broken internal link "${target}" found in ${file.relPath}`);
        errors++;
      }
    }
  }

  if (errors > 0) {
    throw new Error(`[seo-audit] Failed with ${errors} HTML verification issue(s).`);
  }
  console.log(`[seo-audit] Verified ${htmlFiles.length} pre-rendered HTML files and internal links cleanly.`);
}

checkDeploymentSizes();
checkPreRenderedHtml();
