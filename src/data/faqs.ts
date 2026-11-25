import { APP_CONFIG } from '../config/appConfig';

export interface FaqEntry {
  q: string;
  a: string;
}

export interface HowToStepEntry {
  name: string;
  text: string;
}

export const HOW_IT_WORKS_STEPS: HowToStepEntry[] = [
  {
    name: 'Open a local video file',
    text: `Drop an MP4, MOV, or WebM recording onto ${APP_CONFIG.appName} or pick a sample Look from our templates or inside the editor. The video stays in browser memory and is never uploaded.`,
  },
  {
    name: 'Pick a trim range or scan Smart Moments',
    text: 'Drag the In/Out handles, press I and O during playback, or run Find best moments (or Auto clip everything) to detect audio loudness spikes, frame motion, and optional spoken keyword matches.',
  },
  {
    name: 'Choose Fast Mode or 9:16 framing',
    text: 'Leave Original framing selected for near-instant -c copy stream trims, or apply Shorts, TikTok, Instagram Reel, or Facebook Reel 9:16 presets with Smart follow, blurred backgrounds, or Gameplay + Facecam split layout.',
  },
  {
    name: 'Optionally add captions, hook text, or PNG logo',
    text: APP_CONFIG.ENABLE_AUTO_CAPTIONS
      ? `Use Auto (on-device Whisper Tiny with consent for ~${APP_CONFIG.captions.estimatedModelSizeMB} MB Light CPU default or ~${APP_CONFIG.captions.estimatedGpuModelSizeMB} MB Fast GPU option), Manual (add lines), or Import .SRT, pick from 8 caption styles or Auto mix, add a 3-second hook title, and position a transparent PNG watermark.`
      : 'Add manual caption lines or import an .srt file, pick one of 8 caption styles or Auto mix, export .srt or .vtt subtitles, add a 3-second hook title, and position a transparent PNG watermark.',
  },
  {
    name: 'Export MP4, GIF, PNG frame, or batch .ZIP',
    text: 'Export individual clips, download multiple clips sequentially, or package all queued clips into a single .ZIP archive locally inside your browser.',
  },
];

export const HOW_IT_WORKS_FAQS: FaqEntry[] = [
  {
    q: `Does ${APP_CONFIG.appName} upload my video to a server?`,
    a: `No. ${APP_CONFIG.appName} never uploads your video files anywhere. All trimming, 9:16 cropping, split-layout rendering, watermark compositing, and audio/motion analysis execute inside your browser tab using self-hosted single-threaded FFmpeg WebAssembly and Web Workers, keeping your source media strictly on your device.`,
  },
  {
    q: 'What is the difference between Fast Mode and Re-encode?',
    a: 'Fast Mode uses FFmpeg stream copy (-c copy) to slice your original video track without decoding or re-encoding frames, finishing short trims in seconds. Re-encoding (H.264 + AAC, veryfast preset) activates only when you resize/crop aspect ratios, add blurred backgrounds, burn captions or hook text, stamp a logo, adjust speed/volume, or export GIF.',
  },
  {
    q: 'Why does single-threaded FFmpeg run instead of multi-threaded WebAssembly?',
    a: 'Multi-threaded FFmpeg WASM requires SharedArrayBuffer with strict COOP/COEP HTTP headers, which break third-party embeds, monetization tags, and many free static hosts. Using the self-hosted single-threaded core keeps compatibility high across browsers and hosts while trading raw speed on heavy re-encodes.',
  },
  {
    q: `How do Smart Moments and Auto clip everything find highlights in ${APP_CONFIG.appName}?`,
    a: APP_CONFIG.ENABLE_AUTO_CAPTIONS
      ? 'Smart Moments extracts 8 kHz mono audio to find RMS loudness spikes, samples 192px frames at roughly 3 fps for visual motion and scene cuts, and optionally boosts segments containing spoken keywords or exclamations. Clips are ranked by measurable audio/motion/speech activity — never a fake viral score.'
      : 'Smart Moments extracts 8 kHz mono audio to find RMS loudness spikes, samples 192px frames at roughly 3 fps for visual motion and scene cuts, and can boost segments matching keywords in manual or imported .srt caption lines. Clips are ranked by measurable audio and motion activity — never a fake viral score.',
  },
  {
    q: 'How does Smart follow reframing track horizontal gameplay in 9:16?',
    a: 'Smart follow calculates the weighted motion centroid across sampled low-resolution frames (with an option to ignore outer HUD corners) and smooths horizontal crop movement into a speed-limited piecewise-linear FFmpeg crop expression. In browsers supporting experimental FaceDetector, Face-aware mode tries face tracking and falls back cleanly to motion otherwise.',
  },
  ...(APP_CONFIG.ENABLE_AUTO_CAPTIONS
    ? [
        {
          q: 'How do on-device Auto Captions work without cloud transcription?',
          a: `When you click Generate captions or Auto clip everything and approve the one-time download, you choose Light (CPU, about ${APP_CONFIG.captions.estimatedModelSizeMB} MB, default) or Fast (GPU, about ${APP_CONFIG.captions.estimatedGpuModelSizeMB} MB, only if WebGPU works). Your browser fetches the timestamped Whisper Tiny model (${APP_CONFIG.captions.MODEL_ID}) from ${APP_CONFIG.captions.MODEL_BASE_URL} and caches it locally, remembering your mode choice and automatically falling back to CPU if WebGPU fails.`,
        },
      ]
    : []),
  {
    q: 'Can I batch export multiple clips as a single download?',
    a: 'Yes. After queuing multiple segments manually or reviewing candidates in Auto clip everything, click Export All (.ZIP) to package every rendered MP4 in browser memory using client-side ZIP compression (fflate) with live progress and Cancel. If ZIP packaging fails on a constrained device, sequential MP4 downloads run automatically.',
  },
  {
    q: 'Why does a 300 MB file warning appear when opening large recordings?',
    a: '32-bit WebAssembly inside a browser tab usually caps total addressable memory around 1–2 GB. Long 4K recordings or files above 300 MB can run out of memory during H.264 filtergraph encoding. Cutting raw highlights in Fast Mode first or picking the 720p Small file preset prevents crashes.',
  },
  {
    q: 'Can I paste a YouTube, Instagram, Facebook, or TikTok link into the editor?',
    a: `No. ${APP_CONFIG.appName} has zero backend servers and never downloads videos from YouTube, Instagram, Facebook, TikTok, Twitch, or Kick. If it is your own video, export it from your account using the platform's official option (see our Download Your Own Videos guide) and drop the local MP4, MOV, or WebM file into the editor. Only edit videos you own or have permission to use. Optionally, direct .mp4, .webm, or .mov file URLs can load if the file's host allows browser CORS requests (note that the host sees that browser request).`,
  },
  {
    q: 'Which short-form platform presets are built into the editor?',
    a: `One-click presets include YouTube Shorts (9:16, 60s target), TikTok (9:16, 60s quick hook), Instagram Reel (9:16, 90s target), and Facebook Reel (9:16, ${APP_CONFIG.platformLimits.facebookReelMaxDurationSec}s target — check Facebook's current limit). You can also switch manually between 9:16, 1:1, 4:5, 16:9, or Original.`,
  },
  {
    q: 'How does the built-in Watermark Maker work with the video editor?',
    a: 'Watermark Maker renders crisp transparent PNG text stamps using condensed, stencil, or monospace typography with configurable outline width, letter spacing, and drop shadow on an HTML5 canvas. Export the transparent PNG directly or click Send to Editor to load it straight into your clip overlay.',
  },
];
