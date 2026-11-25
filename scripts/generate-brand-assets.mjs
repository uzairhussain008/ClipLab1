import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(process.cwd());
const publicDir = path.join(rootDir, 'public');
const markSvgPath = path.join(publicDir, 'brand', 'logo-mark.svg');
const appConfigPath = path.join(rootDir, 'src', 'config', 'appConfig.ts');

function readAppNameFromConfig() {
  try {
    const raw = fs.readFileSync(appConfigPath, 'utf8');
    const constMatch = raw.match(/const\s+APP_NAME\s*=\s*['"]([^'"]+)['"]/);
    if (constMatch?.[1]) return constMatch[1];
    const propMatch = raw.match(/appName:\s*['"]([^'"]+)['"]/);
    if (propMatch?.[1]) return propMatch[1];
  } catch {
    // Fallback below
  }
  return 'ClipLab1';
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildOgSvg(appName) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0b0f14"/>
      <stop offset="55%" stop-color="#141c26"/>
      <stop offset="100%" stop-color="#0e1217"/>
    </linearGradient>
    <radialGradient id="amberGlow" cx="72%" cy="85%" r="48%">
      <stop offset="0%" stop-color="#e59a24" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#e59a24" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#sky)"/>
  <rect width="1200" height="630" fill="url(#amberGlow)"/>

  <!-- Skyline silhouette -->
  <g fill="#090d12" stroke="#1d2733" stroke-width="1">
    <rect x="40" y="450" width="90" height="180"/>
    <rect x="145" y="390" width="110" height="240"/>
    <rect x="275" y="430" width="85" height="200"/>
    <rect x="380" y="340" width="130" height="290"/>
    <rect x="530" y="410" width="95" height="220"/>
    <rect x="645" y="320" width="125" height="310"/>
    <rect x="790" y="380" width="110" height="250"/>
    <rect x="920" y="300" width="140" height="330"/>
    <rect x="1080" y="410" width="90" height="220"/>
  </g>
  <g fill="#e59a24" opacity="0.65">
    <rect x="405" y="370" width="8" height="12"/>
    <rect x="435" y="405" width="8" height="12"/>
    <rect x="675" y="355" width="8" height="12"/>
    <rect x="710" y="385" width="8" height="12"/>
    <rect x="955" y="340" width="10" height="14"/>
    <rect x="995" y="390" width="10" height="14"/>
  </g>

  <!-- Bottom vignette over skyline -->
  <rect width="1200" height="630" fill="#0b0f14" opacity="0.58"/>
  <rect x="56" y="56" width="1088" height="518" rx="16" stroke="#2a3544" stroke-width="2" fill="none"/>

  <!-- Geometric Mark -->
  <g transform="translate(88, 128)">
    <rect width="96" height="96" rx="18" fill="#151b22" stroke="#39475a" stroke-width="2.5"/>
    <path d="M21 30h15v-7.5H21a6 6 0 0 0-6 6V45h6V30zm54 0v15h6V28.5a6 6 0 0 0-6-6H60V30h15zm0 36H60v7.5h15a6 6 0 0 0 6-6V51h-6v15zm-54 0V51h-6v16.5a6 6 0 0 0 6 6h15V66H21z" fill="#9aa7b8"/>
    <rect x="31.5" y="19.5" width="33" height="57" rx="4.5" stroke="#e59a24" stroke-width="5" fill="#0e1217"/>
    <path d="M43.5 38.25L58.5 48L43.5 57.75V38.25Z" fill="#e59a24"/>
  </g>

  <!-- Title & Copy -->
  <text x="212" y="196" fill="#eef2f6" font-family="Arial Narrow, Impact, sans-serif" font-size="76" font-weight="700" letter-spacing="1">${escapeXml(appName)}</text>
  <text x="88" y="294" fill="#e59a24" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="2">100% CLIENT-SIDE VIDEO CLIPPER · ZERO UPLOADS</text>
  <text x="88" y="362" fill="#eef2f6" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700">Trim, Reframe 9:16, Caption &amp; Export</text>
  <text x="88" y="416" fill="#c2cbd6" font-family="Arial, Helvetica, sans-serif" font-size="28">YouTube Shorts · TikTok · Instagram Reels · Facebook Reels</text>

  <!-- Feature chips line -->
  <rect x="88" y="468" width="230" height="44" rx="8" fill="#151b22" stroke="#39475a" stroke-width="1.5"/>
  <text x="203" y="497" text-anchor="middle" fill="#eef2f6" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600">Fast -c copy Trim</text>

  <rect x="336" y="468" width="272" height="44" rx="8" fill="#151b22" stroke="#39475a" stroke-width="1.5"/>
  <text x="472" y="497" text-anchor="middle" fill="#eef2f6" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600">Smart Follow &amp; Split</text>

  <rect x="626" y="468" width="268" height="44" rx="8" fill="#151b22" stroke="#39475a" stroke-width="1.5"/>
  <text x="760" y="497" text-anchor="middle" fill="#eef2f6" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600">On-Device Captions</text>

  <rect x="912" y="468" width="200" height="44" rx="8" fill="#e59a24"/>
  <text x="1012" y="497" text-anchor="middle" fill="#0e1217" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">Free · Browser</text>
</svg>`;
}

async function generateBrandAssets() {
  try {
    const [{ default: sharp }, { default: pngToIco }] = await Promise.all([
      import('sharp'),
      import('png-to-ico'),
    ]);

    if (!fs.existsSync(markSvgPath)) {
      console.warn('[assets] Skipping: logo-mark.svg not found at', markSvgPath);
      return;
    }

    const markSvg = fs.readFileSync(markSvgPath);

    // 1. Favicons (16, 32, multi-size .ico)
    const png16 = await sharp(markSvg).resize(16, 16).png().toBuffer();
    const png32 = await sharp(markSvg).resize(32, 32).png().toBuffer();
    fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), png16);
    fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), png32);

    const icoBuf = await pngToIco([png16, png32]);
    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuf);

    // 2. Apple Touch Icon (180x180 opaque dark background)
    const inner180 = await sharp(markSvg).resize(140, 140).png().toBuffer();
    await sharp({
      create: {
        width: 180,
        height: 180,
        channels: 4,
        background: { r: 14, g: 18, b: 23, alpha: 1 },
      },
    })
      .composite([{ input: inner180, gravity: 'center' }])
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));

    // 3. PWA Icons (192, 512, 512 maskable)
    await sharp(markSvg).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'));
    await sharp(markSvg).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'));

    const innerMaskable = await sharp(markSvg).resize(360, 360).png().toBuffer();
    await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 14, g: 18, b: 23, alpha: 1 },
      },
    })
      .composite([{ input: innerMaskable, gravity: 'center' }])
      .png()
      .toFile(path.join(publicDir, 'icon-512-maskable.png'));

    // 4. Open Graph social share PNG (1200x630)
    const appName = readAppNameFromConfig();
    const ogSvgBuffer = Buffer.from(buildOgSvg(appName), 'utf8');
    await sharp(ogSvgBuffer)
      .resize(1200, 630)
      .png({ compressionLevel: 9 })
      .toFile(path.join(publicDir, 'og-image.png'));

    console.log(`[assets] Generated favicons, PWA icons, and og-image.png (${appName}) in public/`);
  } catch (err) {
    console.warn(
      '[assets] Warning: Could not generate raster brand assets (keeping public/favicon.svg):',
      err instanceof Error ? err.message : err
    );
  }
}

await generateBrandAssets();
