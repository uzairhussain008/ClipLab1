# ClipLab SEO, AEO & Pre-Rendering Plan

## 1. Keyword Map & Search Intent

All titles, headings, metadata, and structured data follow strict brand safety rules (zero game trademarks such as GTA or Rockstar in titles, H1s, meta descriptions, OG tags, schemas, alt text, or hero artwork). Brand name `ClipLab` and public origin `SITE_URL` are centralized in `src/config/appConfig.ts`.

| Route | Primary Target Intent | Page Title (<=60 chars) | Main Schema Types |
| :--- | :--- | :--- | :--- |
| `/` | Browser video clipper, no-upload 9:16 short-form cutter | `ClipLab — Free Browser Video Clipper (No Uploads)` | `WebSite`, `Organization`, `WebApplication` |
| `/editor` | Online MP4/MOV/WebM trimmer, Smart follow, captions, ZIP export | `Video Clip Editor — Trim, 9:16 & Captions \| ClipLab` | `BreadcrumbList` |
| `/watermark-maker` | Free transparent PNG watermark maker for gameplay/video clips | `Free PNG Watermark Maker for Video Clips \| ClipLab` | `BreadcrumbList`, `HowTo` |
| `/guides` | Creator handbook for vertical short-form clipping workflows | `Short-Form Video Clipping & Framing Guides \| ClipLab` | `BreadcrumbList`, `CollectionPage` |
| `/how-it-works` | Browser WebAssembly processing FAQ, shortcuts, limits | `How ClipLab Works & Technical FAQ` | `BreadcrumbList`, `HowTo`, `FAQPage` |
| `/about` | Independent zero-upload architecture & honest browser limits | `About ClipLab — Private Browser Video Clipper` | `BreadcrumbList` |
| `/privacy` | Local browser processing & cookie notice policy | `Privacy Policy \| ClipLab` | `BreadcrumbList` |
| `/terms` | Client-side tool usage terms & trademark disclaimer | `Terms of Use \| ClipLab` | `BreadcrumbList` |
| `/contact` | Operator contact & codec feedback draft form | `Contact \| ClipLab` | `BreadcrumbList` |

### Guide Pages (`/guides/<slug>`)
1. `/guides/cut-16-9-gameplay-into-9-16-shorts` — Smart follow vs center crop vs blurred background (`Article`, `FAQPage`, `BreadcrumbList`)
2. `/guides/fast-copy-trimming-vs-reencoding` — `-c copy` Fast Mode vs H.264 `veryfast` (`Article`, `FAQPage`, `BreadcrumbList`)
3. `/guides/split-screen-gameplay-and-facecam-reels` — Interactive 9:16 Gameplay + Facecam `vstack` (`Article`, `FAQPage`, `BreadcrumbList`)
4. `/guides/on-device-auto-captions-and-srt-workflow` — Whisper Tiny WebGPU/WASM + 4 presets + SRT/VTT (`Article`, `FAQPage`, `BreadcrumbList`)
5. `/guides/auto-clip-smart-moments-batch-export` — Audio/motion/keyword scoring + Review modal + `.ZIP` (`Article`, `FAQPage`, `BreadcrumbList`)
6. `/guides/custom-png-watermarks-and-hook-titles` — Transparent PNG watermark & 3s Hook safe zones (`Article`, `FAQPage`, `BreadcrumbList`)
7. `/guides/browser-wasm-memory-limits-large-captures` — 32-bit WebAssembly ~1–2 GB limits & Fast Copy pre-slice (`Article`, `FAQPage`, `BreadcrumbList`)

## 2. Technical SEO & AEO Architecture

- **Static Pre-Rendering**: `npm run build` runs Vite client build, Vite SSR bundle (`src/entry-server.tsx`), and `scripts/prerender.mjs` to generate static HTML with full DOM content, canonical `<link>`, Open Graph/Twitter (`public/og-image.png` 1200×630 PNG), verification tags, and JSON-LD in every route directory (`dist/*/index.html`) plus `dist/404.html` (`noindex, nofollow`).
- **Dynamic Client Head Sync**: `RouteSeoManager` (`src/context/HeadContext.tsx`) updates `<title>`, `<meta>`, `<link rel="canonical">`, and JSON-LD cleanly on client-side SPA navigation without duplicating tags.
- **Crawler & Answer Engine Files**:
  - `dist/sitemap.xml` generated at build time from `getAllIndexableRoutes()` with ISO `lastmod`.
  - `dist/robots.txt` allows `/assets/`, `/ffmpeg/`, `/fonts/`, references `Sitemap`, and toggles `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended` via `VITE_ALLOW_AI_CRAWLERS`.
  - `dist/llms.txt` provides structured summaries and direct links for answer engines.
- **Zero Home Weight Creep**: FFmpeg (`@ffmpeg/ffmpeg`), Whisper (`@huggingface/transformers`), and ZIP (`fflate`) are strictly lazy-loaded on editor action, never on `/`.
- **No COOP/COEP & No CSP**: `public/_headers` omits COOP/COEP and CSP so single-threaded WASM, Whisper model fetches, and optional ad scripts run cleanly.
