# ClipLab1

100% client-side, zero-upload video clipping web tool built for gamers and short-form creators. All trimming, framing, caption rendering, watermarking, and MP4/GIF/ZIP exporting run locally inside the user's browser using the single-threaded `@ffmpeg/ffmpeg` (`0.12.x`) WebAssembly core.

## Local Development & Build

### Prerequisites
- Node.js 20+ and npm

### Setup & Run
```bash
npm install
npm run dev
```

`npm install` automatically runs `postinstall` (`node scripts/copy-assets.mjs`), which:
1. Copies `ffmpeg-core.js` and `ffmpeg-core.wasm` from `node_modules/@ffmpeg/core/dist/esm` into `public/ffmpeg/`.
2. Copies 7 open-license `.ttf` fonts into `public/fonts/` for both live preview (`@font-face`) and FFmpeg `libass` / `drawtext` caption burn-in:
   - `caption-sans-bold.ttf` — **Liberation Sans Bold** (SIL Open Font License 1.1, system font path)
   - `caption-display-bold.ttf` — **DejaVu Sans Bold** (Bitstream Vera / DejaVu Free License, system font path)
   - `caption-mono-bold.ttf` — **JetBrains Mono Bold** (SIL Open Font License 1.1, system font path)
   - `caption-bangers.ttf` — **Bangers** via `@expo-google-fonts/bangers` (OFL-1.1 / MIT wrapper)
   - `caption-luckiest-guy.ttf` — **Luckiest Guy** via `@expo-google-fonts/luckiest-guy` (Apache-2.0 / MIT wrapper)
   - `caption-anton.ttf` — **Anton** via `@expo-google-fonts/anton` (OFL-1.1 / MIT wrapper)
   - `caption-montserrat-extrabold.ttf` — **Montserrat ExtraBold** via `@expo-google-fonts/montserrat` (OFL-1.1 / MIT wrapper)

### Note on `.ttf` fonts for FFmpeg `drawtext` and `libass`
`scripts/copy-assets.mjs` copies the 4 `@expo-google-fonts/*` packages directly from `node_modules` on all OSes and copies Liberation Sans / DejaVu Sans / JetBrains Mono from standard Linux system font paths. On Windows or minimal containers where system font paths differ, download open-license Liberation Sans, DejaVu Sans, and JetBrains Mono `.ttf` files and place them at `public/fonts/caption-sans-bold.ttf`, `public/fonts/caption-display-bold.ttf`, and `public/fonts/caption-mono-bold.ttf`.

### Scripts
- `npm run dev` — Start Vite dev server on `http://localhost:3000`
- `npm run assets` — Generate `favicon.ico`, PNG favicons, Apple Touch icon, PWA icons, and `public/og-image.png` (`1200×630`) from `public/brand/logo-mark.svg`
- `npm run build` — Run `prebuild` (`npm run assets`), build Vite client bundle + SSR bundle (`src/entry-server.tsx`), statically pre-render all 17 routes + `404.html`, generate `sitemap.xml`, `robots.txt`, and `llms.txt`, and run `scripts/postbuild-check.mjs`
- `npm run lint` — Run TypeScript type check (`tsc --noEmit`)
- `npm test` — Run Node unit tests (`src/utils/*.test.ts`)

## Brand, Hero & Monetization Configuration

All brand strings, domain URLs, large-file thresholds, hero overrides, feature flags, and ad toggles live in `src/config/appConfig.ts` (and `.env`):
- `appName`: Change `'ClipLab1'` in one place to rebrand.
- `ENABLE_AUTO_CAPTIONS` (`VITE_ENABLE_AUTO_CAPTIONS`): Defaults to `true`. Set `VITE_ENABLE_AUTO_CAPTIONS=false` (or `0`) as an instant kill switch to hide the Auto (on-device) speech tab, consent dialogs, and auto-caption copy while keeping Manual captions, `.srt` import, `.srt`/`.vtt` export, all 8 caption styles, Auto mix, and burn-in active.
- `SITE_URL` (`VITE_SITE_URL`): Canonical origin used in canonical links, Open Graph URLs, `sitemap.xml`, `robots.txt`, `llms.txt`, and JSON-LD (defaults to `https://cliplab1.ai.studio`).
- `FFMPEG_CORE_BASE_URL` (`VITE_FFMPEG_CORE_BASE_URL`): Base path/origin for `ffmpeg-core.js` and `ffmpeg-core.wasm` (defaults to `/ffmpeg`).
- `MODEL_BASE_URL` (`VITE_MODEL_BASE_URL`): Origin host for optional on-device Whisper speech model weights (defaults to `https://huggingface.co`). Disclosed on `/privacy` and inside the first-use consent modal.
- `HERO_IMAGES`: Optional array of self-hosted or CC0 image descriptors (`/public/hero/...`) if you want photo backgrounds instead of the 4-scene rotating SVG city skyline.
- `SHOWCASE_VIDEOS`: Empty array by default (`src/config/appConfig.ts`). When empty, the Home **"What you can make"** cards render a live 24 fps preview of original browser-generated scenes in a lazy-loaded canvas chunk. If you later add muted looping `<video preload="none" playsinline>` files under `/public/showcase`, **only footage the site owner created or holds explicit rights/permission to publish may be used** (no game footage, no other people's videos, and human faces only with documented consent).
- `src/config/templates.ts`: Single config defining the 4 built-in **Looks** (`Blur Fill Classic`, `Action Follow`, `Gameplay + Facecam`, and `Quick Cut`). Template URLs like `/editor?template=action-follow` load an original browser-generated sample scene (plus `"Sample caption"` preview lines) and set canonical URLs back to `/editor` without indexing query variants.
- `platformLimits.facebookReelMaxDurationSec`: Target duration (`90`s) for the Facebook Reel preset.
- `adsEnabled`: Controlled by `VITE_ADS_ENABLED` (defaults to `false`). When disabled, no ad scripts load and `AdSlot` reserves container dimensions to avoid layout shift.
- `public/ads.txt`: Placeholder file ready to replace with your authorized seller entries.
- Legal templates (`/privacy`, `/terms`, and the cookie banner placeholder) must be reviewed and adapted by the site operator for their jurisdiction before launch.

### Brand Assets Guide
1. Source SVGs live in `public/brand/logo.svg`, `public/brand/logo-mark.svg`, and `public/favicon.svg`, mirrored inline by `src/components/Logo.tsx` (`<Logo />` and `<LogoMark />`).
2. Editing `public/brand/logo-mark.svg` and running `npm run assets` (or `npm run build`) automatically regenerates `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, and `public/og-image.png`.

## Free Static Deployment & Deployment Size Notes

ClipLab1 requires **no COOP/COEP headers** because it uses the single-threaded FFmpeg core, so third-party ad scripts work out of the box.

### Measured `dist/` Largest Files & Cloudflare Pages 25 MiB Limit
Running `npm run build` prints the top 10 largest `dist/` files via `scripts/postbuild-check.mjs`:
- `ffmpeg/ffmpeg-core.wasm`: **30.74 MiB** *(exceeds Cloudflare Pages' 25 MiB single-file cap)*
- `assets/index-*.js`: **~0.8 MiB**
- `fonts/caption-display-bold.ttf`: **0.68 MiB** (all 7 `.ttf` fonts total ~1.7 MiB combined)

**Deployment options:**
1. **Cloudflare Pages (with R2 / CORS host for large WASMs):** Set `VITE_FFMPEG_CORE_BASE_URL` to a CORS-enabled R2/CDN folder holding `ffmpeg-core.js` + `ffmpeg-core.wasm`. `public/_headers` works automatically on Cloudflare Pages.
2. **GitHub Pages / Netlify / Static VPS / Object Storage:** Works out of the box with all routes pre-rendered under `dist/<route>/index.html` and `dist/404.html`. Note that **GitHub Pages ignores `public/_headers`**; caching and security headers must come from Cloudflare/CDN proxy if desired.

## Smart Tools & Captions (100% Client-Side)

All smart clipping features are configured via `src/config/appConfig.ts` (`smartFeatures` and `captions`) and run locally inside Web Workers without uploading your video:

1. **Smart Moments & `Auto clip everything`**
   - Extracts 8 kHz mono PCM via `ffmpeg.wasm` (`-ac 1 -ar 8000 -f f32le`) and samples low-resolution offscreen frames (`192px` wide at ~`3 fps`) so full-resolution frames are never decoded into memory.
   - Scores 0.5s audio RMS spikes vs. local baseline, inter-frame pixel motion, sudden scene changes, plus optional spoken/caption keyword matches.
   - Displays transparent reason tags (`loud`, `motion`, `speech`, `keyword`) and an editable **Hook candidate** button (`Use Hook` / `Apply Hook` — never auto-applied).
   - `Auto clip everything` runs Smart Moments + optional on-device Whisper captions + Smart follow framing and opens an interactive **Review modal** with clip rename, Start/End trim edits, single export, `Export Separate MP4s`, and lazy-loaded `fflate` **`Export All (.ZIP)`** (with Cancel + automatic sequential download fallback if ZIP packaging fails).
   - Limits: Videos over 10 minutes show a warning and allow scanning only the active trim range. Silent/static clips report `"No strong moments found"`.

2. **Smart Reframe, Split Layout & Zoom**
   - **Smart follow** computes a smoothed, speed-limited crop path around the weighted motion centroid (with optional outer HUD edge ignoring) and exports via FFmpeg piecewise-linear `crop` expressions in a single re-encode pass.
   - **Face-aware** checks the experimental browser `FaceDetector` API when available and falls back cleanly to motion-based `Smart follow` when unsupported.
   - **Split layout (`Gameplay + Facecam`)** provides draggable/resizable Gameplay and Facecam source boxes, height ratio slider (`50–80%`), and Fit + Blur or Fill Crop stacking via FFmpeg `vstack`.
   - **Blurred background fill** supports a `Foreground size` slider (`100–140%`) over a brighter blurred backdrop.
   - **Zoom** supports `Punch-in zoom` (`1.0×–1.5×`), `Slow zoom in`, and `Pulse on loud peaks` via `zoompan`.

3. **On-Device Auto Captions, Manual Lines & `.SRT` Workflow**
   - **3-Way Input Selector:** Pick **Auto (on-device)** (`onnx-community/whisper-tiny_timestamped`, or `whisper-tiny.en_timestamped` for English; Light CPU ~45 MB default or Fast GPU ~156 MB optional one-time cached download from `MODEL_BASE_URL` with explicit consent), **Manual (add lines)**, or **Import .SRT** — all feeding the same shared inline editor (split/merge, seek, start/end timing, `.srt`/`.vtt` export).
   - **Burn-in vs. Sidecar Toggle:** **`Burn captions into video`** controls whether captions are permanently burned into frames (`libass` ASS single pass with `drawtext` fallback) or omitted from the video so you can download `.SRT`/`.VTT` sidecar files instead.
   - **WebGPU Reliability & Fallbacks:** Defaults to Light (`CPU`, ~45 MB) and uses GPU (~156 MB) only if the user explicitly picks Fast (`GPU`), remembers the choice in `localStorage`, separates download/init/transcribe stages honestly, falls back automatically to CPU WASM q8 in a fresh Worker reusing cached weights if GPU fails, remembers GPU failures, and falls back proportionally if word timestamps are unavailable (`"Word timing is approximate"`).
   - **8 Caption Styles + Deterministic `Auto mix`:**
     - Core 4: `Classic`, `Bold Pop`, `Boxed`, `Minimal`
     - Funky 4: `Hype Pop` (word-by-word color-cycling `#FFB800` / `#00E5FF` / `#FF2E93` overshoot pop + tilt), `Neon Glow` (2-layer cyan halo glow + brighter active word), `Comic Burst` (`Bangers` yellow fill + heavy black outline/shadow + tilt + word pop), `Sticker Box` (`Luckiest Guy` text on color-cycling solid boxes `#E59A24` / `#00B4D8` / `#E11D8B` / `#16A34A`)
     - **`Style: Auto mix`** (`Calm` / `Balanced` / `Hype`): deterministically keeps calm lines simple (`Classic` / `Minimal`) and switches energetic lines (`audio RMS spike`, `!`, `ALL-CAPS`, `<=3` words, keyword matches) to funky styles, with per-line `<select>` overrides and `"Lock all"` reset.
   - **Preview vs. Burn-In Note:** Both preview and ASS burn-in share the exact same `layoutCaptionRows` word-wrap + safe-margin math so lines never overlap. Live preview CSS approximates tilt, neon halo blur, scale pop, and sticker box cycling, while MP4 export renders exact keyframed `libass` ASS override animations (`\t`, `\fscx`/`\fscy`, `\frz`, `\blur`, `\3c`) in one pass (or clean static styling if FFmpeg falls back to `drawtext`).

## SEO & Pre-Rendering Checklist

- [x] Static pre-rendering (`dist/*/index.html` + `dist/404.html` with `noindex, nofollow`)
- [x] Per-route `<title>` (`<=60` chars), `<meta name="description">` (`<=160` chars), canonical URLs, Open Graph + Twitter `og-image.png` (`1200×630` PNG)
- [x] JSON-LD (`WebSite`, `Organization`, `WebApplication` on `/`; `FAQPage` + `HowTo` + `BreadcrumbList` on `/how-it-works`; `Article` + `FAQPage` + `BreadcrumbList` on `/guides/*`)
- [x] `dist/sitemap.xml` (`lastmod`), `dist/robots.txt` (`VITE_ALLOW_AI_CRAWLERS`), `dist/llms.txt`
- [x] `VITE_GSC_VERIFICATION`, `VITE_BING_VERIFICATION`, `VITE_INDEXNOW_KEY` env placeholders (empty, `"placeholder"`, or `"none"` omit meta tags and IndexNow `.txt` files)
- [x] Zero heavy WASM/FFmpeg/fflate loaded on `/`

## Post-Launch Checklist

1. Set `VITE_SITE_URL` in production environment (e.g. `https://yourdomain.com`), run `npm run build`, and verify canonical tags and `sitemap.xml` match your production origin.
2. Add your Google Search Console (`VITE_GSC_VERIFICATION`), Bing Webmaster (`VITE_BING_VERIFICATION`), and optional IndexNow key (`VITE_INDEXNOW_KEY`) if using meta/file verification, then rebuild and deploy.
3. Submit `<SITE_URL>/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
4. Test `/`, `/how-it-works`, and `/guides/<slug>` in Google Rich Results Test and social card validators (`og-image.png`).
5. Review legal templates (`/privacy`, `/terms`), cookie notice, and `public/ads.txt` before flipping `VITE_ADS_ENABLED="true"`.

## Known Limitations
- **Browser memory limits:** 32-bit WebAssembly tab memory is bounded (~1–2 GB). Long 4K captures or files over 300 MB may fail with out-of-memory errors during re-encoding; Fast Mode (`-c copy`) or shorter clips avoid this.
- **Single-threaded speed:** Single-threaded WASM avoids COOP/COEP header restrictions so third-party ads work, which makes H.264 re-encoding (especially `zoompan` + `libass` + `split-layout`) slower than native desktop FFmpeg.
- **No platform URL downloading:** ClipLab1 never downloads videos from YouTube, Instagram, Facebook, TikTok, Twitch, or Kick. Pasting links from those domains in the upload card shows a friendly message linking to `/guides/download-your-own-videos` (official YouTube Studio, Instagram, and Facebook export steps). Optional direct `.mp4`/`.webm`/`.mov` URLs load in-browser only when the file's host permits CORS (with progress bar, Cancel, 300 MB warning, and host-request privacy notice on `/privacy`); CORS-blocked or non-video responses fall back cleanly with a local-download prompt. Live third-party CORS host fetching across external CDNs is **not verified** in headless CI.

## Manual Test Checklist
- [ ] **Home hero & zero-upload flow:** On `/`, verify `Choose Video File` is the single primary button on the upload card (no `Try Sample Clip` button on the home hero), `"No video handy? See what you can make"` scrolls to `#what-you-can-make`, `"your video never leaves your device"` is shown, and zero `/ffmpeg/` or `fflate` files load on `/`.
- [ ] **Home Showcase ("What you can make") & Templates page:** Scroll to `#what-you-can-make` on `/`, verify all 4 live before/after canvas cards pause off-screen/on hidden tabs, cap smoothly, render static still frames under `prefers-reduced-motion`, test responsive cards on mobile (`390×844`), and inspect `/templates` (`CollectionPage` schema + canonical links).
- [ ] **Looks / Templates in `/editor`:** Test `/editor?template=blur-fill-classic`, `/editor?template=action-follow`, `/editor?template=gameplay-facecam`, and `/editor?template=quick-cut` (plus an invalid `?template=unknown` graceful message); apply each Look onto both the generated sample and a real local video, verify trim handles / segments / logo stay untouched, verify `"Sample caption"` lines are never added to user videos, review the change summary (including editable Hook `"Wait for it..."`), and test `Reset`.
- [ ] **Large file warning:** Select a >300 MB file and verify the warning banner appears.
- [ ] **Trim & shortcuts:** In `/editor`, drag In/Out handles, step frames with `-1f`/`+1f` and `ArrowLeft`/`ArrowRight`, press `Space` to play/pause, and `I`/`O` to set In/Out (plus `/editor` empty-state `Try Sample Clip` button).
- [ ] **Fast Mode export:** Export a trimmed segment with `Original (Fast Copy)` (or `Quick Cut` Look) and verify `"Fast Mode (-c copy)"` is shown and downloads cleanly.
- [ ] **Platform presets:** Test `YouTube Shorts`, `TikTok`, `Instagram Reel`, and `Facebook Reel` (`9:16`, `1080×1920`, target duration reminder).
- [ ] **Smart Moments & `Auto clip everything`:** Click `Auto clip everything`, verify speech consent options (`Moments Only` vs `Download Model & Auto Clip`), inspect reason chips (`loud`, `motion`, `speech`, `keyword`), rename/trim in Review modal, and export via `Export All (.ZIP)` (and Cancel).
- [ ] **Captions 3-way input, Light/Fast consent, 8 styles & `Auto mix`:** Verify `"Burn captions into video"` toggle + help text, test `Auto (on-device)` consent modal (`Light (CPU, about 45 MB)` default vs `Fast (GPU, about 156 MB, only if WebGPU works)`), `Manual (add lines)`, and `Import .SRT`, preview all 8 styles (`Classic`..`Sticker Box`), toggle `Style: Auto mix` (`Calm`/`Balanced`/`Hype`), override a single line via dropdown, and verify exported MP4 burned-in captions show clean line wrapping with zero overlapping glyphs.
- [ ] **Kill switch (`VITE_ENABLE_AUTO_CAPTIONS=false`):** Build with `VITE_ENABLE_AUTO_CAPTIONS=false` and verify Auto (on-device) tab, Whisper consent modal, and auto-caption SEO/guide references stay hidden while Manual + `.SRT` + 8 styles + Auto mix keep working.
- [ ] **Watermark Maker:** Create a PNG stamp on `/watermark-maker`, click `Send to Editor`, and export with corner stamp.
- [ ] **SEO / Pre-rendered HTML & routes:** Inspect `/templates`, `/guides`, `/guides/<slug>`, `/about`, `/how-it-works`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, and `/404.html`.
- [ ] **Mobile view:** Verify responsive layout at 390×844 with zero horizontal overflow or overlapping controls.
