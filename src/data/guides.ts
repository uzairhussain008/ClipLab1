import { APP_CONFIG } from '../config/appConfig';

export interface GuideSection {
  question: string;
  answer: string;
  bullets?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
}

export interface GuideFaqItem {
  q: string;
  a: string;
}

export interface GuideArticle {
  slug: string;
  title: string;
  h1: string;
  metaDescription: string;
  category: string;
  readTimeMinutes: number;
  publishedAt: string;
  updatedAt: string;
  quickAnswer: string;
  keyTakeaways: string[];
  sections: GuideSection[];
  faqs?: GuideFaqItem[];
  relatedSlugs: string[];
  ctaLabel: string;
  ctaPath: string;
  includeLegalDisclaimer?: boolean;
}

const LAST_UPDATED = '2025-05-15';

export const GUIDES: GuideArticle[] = [
  {
    slug: 'cut-16-9-gameplay-into-9-16-shorts',
    title: 'Cut 16:9 Gameplay Into 9:16 Vertical Shorts',
    h1: 'How to Cut 16:9 Gameplay Into 9:16 Vertical Shorts Without Losing the Action',
    metaDescription:
      'Turn widescreen 16:9 gameplay into 9:16 YouTube Shorts, TikToks, and Reels in your browser using Smart follow tracking, HUD edge ignoring, or blur fill.',
    category: 'Vertical Framing',
    readTimeMinutes: 5,
    publishedAt: LAST_UPDATED,
    updatedAt: LAST_UPDATED,
    quickAnswer:
      'Converting a 16:9 recording to 9:16 vertical cuts off roughly two-thirds of the horizontal frame. Instead of leaving a static center crop on empty scenery, use Smart follow motion tracking with outer HUD edge ignoring, or switch to a 100–140% blurred-background layout when minimaps and scoreboards matter.',
    keyTakeaways: [
      'A 1080×1920 vertical frame keeps only ~31.6% of a 1920×1080 widescreen frame when cropped cleanly to fill.',
      'Smart follow tracks weighted motion horizontally and ignores static outer HUD bars when enabled.',
      'Blurred background fill preserves full widescreen gameplay context with a 100%–140% adjustable foreground zoom.',
      'One-click presets automatically set 9:16 dimensions and duration reminders for Shorts, TikTok, and Reels.',
    ],
    sections: [
      {
        question: 'Why does a fixed center crop ruin most widescreen gaming highlights?',
        answer:
          'Standard 16:9 captures from OBS, ShadowPlay, or console capture cards spread key visual information across 1920 horizontal pixels. Players strafe left and right, vehicles sweep toward corners, and kill feeds sit along the top or bottom margins. A fixed center crop locks a narrow 607×1080 slice dead in the middle, leaving enemies or targets just outside the frame while displaying mostly empty sky or floor.\n\nTo fix that without opening a heavy desktop timeline and keyframing every half-second by hand, you need either dynamic horizontal tracking or a layered vertical canvas that shows the wider playfield cleanly.',
        bullets: [
          'Center crop removes 68% of horizontal screen width on 16:9 footage.',
          'Blurred fill retains 100% of horizontal action while still outputting a true 1080×1920 MP4.',
          'Manual drag locking lets you hold a static left or right zone whenever the camera barely moves.',
        ],
      },
      {
        question: 'Which 9:16 framing mode should you pick for your clip?',
        answer:
          `Each short-form clip calls for a slightly different framing approach depending on how fast the camera pans and whether corner HUD elements tell part of the story. ${APP_CONFIG.appName} gives you four distinct modes inside the Framing tab so you never have to force one template onto every clip.`,
        table: {
          headers: ['Framing Mode', 'Best Use Case', 'What Stays Visible', 'Render Speed'],
          rows: [
            [
              'Smart follow (Fill Crop)',
              'Arena shooters, racing chases, 1v1 duels',
              'Full-screen vertical action following motion peaks',
              'Single H.264 re-encode pass',
            ],
            [
              'Manual Fill Crop',
              'Menu reveals, stationary sniping, tight POVs',
              'Locked X/Y crop window dragged on preview',
              'Single H.264 re-encode pass',
            ],
            [
              'Blurred Background Fill',
              'Wide team fights, minimap/scoreboard moments',
              'Entire 16:9 width + adjustable 100–140% zoom',
              'Slightly heavier filtergraph',
            ],
            [
              'Gameplay + Facecam Split',
              'Streamer reactions with webcam corner overlay',
              'Top gameplay box + bottom facecam stack',
              'Dual crop + vstack re-encode',
            ],
          ],
        },
      },
      {
        question: 'How does Smart follow avoid chasing flickering HUD numbers?',
        answer:
          'Game HUDs constantly flash ammo counters, mini-map pings, chat tickers, and FPS overlays near the outer edges of the screen. If a naive motion tracker treats every pixel equally, your 9:16 crop window jitters toward the edge every time a timer ticks.\n\nEnabling Ignore outer HUD edges inside the Smart Moments panel masks the perimeter during low-resolution (192px wide, 3 fps) frame-difference sampling inside the Web Worker. That focuses weight on central character movement and explosion/action clusters. The resulting path is smoothed and speed-limited before generating an FFmpeg piecewise-linear crop expression, so pans feel steady instead of jerky.',
      },
      {
        question: 'How do you dial in blurred-background foreground scale and safe zones?',
        answer:
          'When you pick Blurred Background under 9:16 Vertical, widescreen footage can sometimes feel small in the center third of a phone screen. Adjusting the Foreground size slider between 110% and 125% crops just slightly into the sides while making HUD text and character silhouettes substantially easier to read on mobile.\n\nAlways preview the clip with the Caption safe-zone overlay toggled on before exporting. YouTube Shorts, TikTok, Instagram Reels, and Facebook Reels all place Like/Comment buttons on the lower-right column and titles along the bottom fifth. Keeping hook banners in the top 15% and captions above the lower margin ensures nothing important gets covered.',
        bullets: [
          'Keep action and hook text inside the middle 65% vertical band for cross-platform safety.',
          'Apply Shorts, TikTok, Instagram Reel, or Facebook Reel one-click presets to check target lengths.',
          'Enable Punch-in zoom (1.1×–1.25×) only when extra closeness helps a tight melee or clutch moment.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Does Smart follow work without an internet connection or cloud GPU?',
        a: 'Yes. Motion sampling and crop-path smoothing run inside a local browser Web Worker at low resolution, and FFmpeg WebAssembly encodes the final 1080×1920 MP4 entirely on your device.',
      },
      {
        q: 'Why does Blurred Background look brighter than the old dim blur style?',
        a: `${APP_CONFIG.appName} keeps the blurred backdrop cleaner and higher contrast so dark night-time gameplay does not turn into muddy compression blocks on phone screens.`,
      },
      {
        q: 'What resolution do the Shorts, TikTok, and Reels presets export?',
        a: 'All four vertical platform presets target 1080×1920 H.264 + AAC MP4 output when Quality Preset is set to Shorts/Reels, or 720p when you choose Small file.',
      },
    ],
    relatedSlugs: [
      'download-your-own-videos',
      'split-screen-gameplay-and-facecam-reels',
      'fast-copy-trimming-vs-reencoding',
      'auto-clip-smart-moments-batch-export',
    ],
    ctaLabel: 'Open Framing in Editor',
    ctaPath: '/editor',
  },
  {
    slug: 'fast-copy-trimming-vs-reencoding',
    title: 'Fast Copy Trimming vs H.264 Re-Encoding Explained',
    h1: 'Fast Copy Trimming (-c copy) vs H.264 Re-Encoding: When Each Mode Runs',
    metaDescription:
      'Learn why Fast Mode (-c copy) cuts clips in seconds with zero quality loss and which editor features automatically trigger local H.264 re-encoding.',
    category: 'Performance & Codecs',
    readTimeMinutes: 5,
    publishedAt: LAST_UPDATED,
    updatedAt: LAST_UPDATED,
    quickAnswer:
      `Fast Mode uses FFmpeg stream copy (-c copy) to slice compressed video and audio packets straight into a new file without decoding frames, finishing in seconds. Whenever you change aspect ratio to 9:16, add captions, overlay a PNG logo, zoom, or change speed, ${APP_CONFIG.appName} switches to single-pass H.264 + AAC veryfast re-encoding.`,
    keyTakeaways: [
      'Fast Mode keeps Original framing with zero overlays, preserving 100% of source bitrate and codec quality.',
      'Fast Copy keeps .webm for WebM sources and .mp4 for MP4/MOV sources so container remuxing succeeds cleanly.',
      'Re-encoding runs a single combined FFmpeg filtergraph so multiple edits never suffer double compression.',
      'Use Fast Mode first to slice a 20-minute recording down to 60 seconds before heavy vertical styling.',
    ],
    sections: [
      {
        question: 'How does Fast Mode (-c copy) export clips in just a few seconds?',
        answer:
          'Video files store full picture keyframes (I-frames) every one to four seconds alongside smaller delta frames in between. Re-encoding has to decompress every single frame into raw pixels, run filters, and run the x264 encoder from scratch — which takes noticeable CPU time inside single-threaded WebAssembly.\n\nStream copy skips decoding completely. FFmpeg seeks to the nearest packet boundary around your In/Out range and writes the existing compressed video and audio bitstreams into the output container. A 30-second cut from a 200 MB capture often finishes in two to five seconds with identical visual quality.',
        bullets: [
          'Zero generational quality loss because pixels are never re-compressed.',
          'Low RAM pressure because uncompressed 1080p/4K frame buffers are not allocated.',
          'Ideal for archiving raw highlights or trimming a long session before vertical editing.',
        ],
      },
      {
        question: 'Which edits automatically switch the exporter to H.264 Re-encode?',
        answer:
          `${APP_CONFIG.appName} checks your current settings and updates the Export panel badge in real time so you always know whether Fast Mode (-c copy) or Re-encode (H.264 + AAC) will run. Any pixel-level or timing modification requires decoding frames once.`,
        table: {
          headers: ['Editor Setting', 'Processing Mode', 'Reason'],
          rows: [
            ['Original framing, no overlays/speed/GIF', 'Fast Mode (-c copy)', 'Bitstream packets copied unmodified'],
            ['9:16, 1:1, 4:5, or 16:9 aspect change', 'Re-encode (H.264 + AAC)', 'Frames must be cropped, padded, or scaled'],
            ['Smart follow, Split layout, or Zoom', 'Re-encode (H.264 + AAC)', 'Dynamic crop expressions & zoompan filters'],
            [
              APP_CONFIG.ENABLE_AUTO_CAPTIONS
                ? 'Auto captions or Hook title text'
                : 'Captions or Hook title text',
              'Re-encode (H.264 + AAC)',
              'Subtitles/text rendered onto video frames',
            ],
            ['PNG Watermark or Speed / Volume edit', 'Re-encode (H.264 + AAC)', 'Alpha compositing or audio/PTS resampling'],
            ['Animated GIF export', 'Re-encode (GIF palette)', 'Requires palettegen + paletteuse frames'],
          ],
        },
      },
      {
        question: `Why does ${APP_CONFIG.appName} run a single-pass filtergraph instead of chaining exports?`,
        answer:
          `Even if you stack Smart follow cropping, blurred background fill, punch-in zoom, ${
            APP_CONFIG.ENABLE_AUTO_CAPTIONS ? 'Whisper ASS captions' : 'ASS burned-in captions'
          }, a 3-second hook banner, and a corner PNG logo at once, ${APP_CONFIG.appName} compiles them into one unified -filter_complex command. That avoids exporting intermediate files inside browser memory and prevents repeated H.264 compression artifacts.\n\nWhen working on a 45-to-90-second vertical clip on an older laptop, switching Quality Preset from Shorts (1080×1920) to Small file (CRF 28 · 720p) roughly halves encoding time and memory footprint while still looking clean on phone screens.`,
      },
      {
        question: 'What is the two-step workflow for huge 10-minute captures?',
        answer:
          `Because 32-bit browser WebAssembly tabs cap memory around 1–2 GB, loading a 600 MB recording and running Smart follow + captions directly can feel sluggish. The fastest pattern is two quick passes:\n\nFirst, keep Original (Fast Copy) active, mark your best 40-second highlight on the timeline, and export it in seconds. Second, drop that fresh 40-second file back into ${APP_CONFIG.appName} and apply 9:16 Smart follow, captions, and your PNG watermark with ample memory headroom.`,
      },
    ],
    faqs: [
      {
        q: 'Why can a Fast Copy cut start half a second early or late?',
        a: 'Stream copy trims near compressed keyframe boundaries. If exact frame accuracy down to 1/30s is critical, enabling any re-encode preset re-times the exact cut point.',
      },
      {
        q: 'Does Fast Copy convert a WebM capture into an MP4 file?',
        a: 'No. VP8/VP9 video packets inside WebM cannot simply be stream-copied into an MP4 container without transcoding, so Fast Copy keeps .webm for WebM sources and .mp4 for MP4/MOV.',
      },
      {
        q: 'Why are edits never blocked behind COOP/COEP headers?',
        a: 'Using single-threaded FFmpeg WASM avoids SharedArrayBuffer requirements, meaning static hosts and third-party scripts work without special server headers.',
      },
    ],
    relatedSlugs: [
      'browser-wasm-memory-limits-large-captures',
      'cut-16-9-gameplay-into-9-16-shorts',
      'auto-clip-smart-moments-batch-export',
    ],
    ctaLabel: 'Test Fast Mode in Editor',
    ctaPath: '/editor',
  },
  {
    slug: 'split-screen-gameplay-and-facecam-reels',
    title: 'Split-Screen Gameplay + Facecam Layout Guide',
    h1: 'How to Build a 9:16 Gameplay + Facecam Split Layout for TikTok and Reels',
    metaDescription:
      'Convert dual-layer OBS recordings with corner webcams into stacked 9:16 TikTok, Shorts, and Reels clips using interactive Gameplay and Facecam source boxes.',
    category: 'Creator Layouts',
    readTimeMinutes: 5,
    publishedAt: LAST_UPDATED,
    updatedAt: LAST_UPDATED,
    quickAnswer:
      'When your 16:9 stream recording already has your webcam baked into a corner, standard vertical cropping cuts your face out completely. Switch Reframe Mode to Split layout (Gameplay + Facecam), drag the amber Gameplay box and teal Facecam box over your source video, set the split height slider (50%–80%), and export a clean stacked 1080×1920 MP4.',
    keyTakeaways: [
      'Interactive preview handles let you drag and resize both Gameplay and Facecam crop rectangles directly.',
      'The Gameplay height slider splits the 9:16 canvas between 50% and 80% for top gameplay and bottom facecam.',
      'Choose Fit + Blur to preserve wide gameplay on top or Fill Crop for edge-to-edge vertical immersion.',
      'Turn on the Caption safe-zone guide so subtitles sit comfortably between the split seam and bottom UI.',
    ],
    sections: [
      {
        question: 'Why does corner-cam stream footage need a dedicated split layout?',
        answer:
          'Streamers on Twitch, YouTube, and Kick almost always record composite 1920×1080 scenes where the facecam sits cleanly in the bottom-right, bottom-left, or top-left corner. Cropping straight down the middle deletes your reaction completely, while zooming out with blurred bars leaves your face thumbnail-sized.\n\nStacking gameplay on the upper pane and your webcam on the lower pane (or 65% / 35% vertical balance) solves both problems at once inside a single FFmpeg vstack filtergraph.',
        bullets: [
          'Keeps facial expressions large enough to read on 6-inch mobile screens.',
          'Separates the game HUD from your camera overlay cleanly.',
          'Works directly on already-recorded composite MP4 or WebM VODs with zero OBS scene re-recording.',
        ],
      },
      {
        question: 'How do you position the Gameplay and Facecam boxes accurately?',
        answer:
          `Select any 9:16 aspect ratio (or click Shorts, TikTok, Instagram Reel, or Facebook Reel), then choose Split layout (Gameplay + Facecam) under Reframe Mode. On the video preview, ${APP_CONFIG.appName} draws two interactive source boxes:\n\nDrag and resize the amber Gameplay box over the main center action, avoiding the webcam corner itself so your face does not appear twice. Next, drag and resize the Facecam box tightly around your head and shoulders.`,
        table: {
          headers: ['Split Setting', 'Recommended Value', 'Visual Result'],
          rows: [
            ['Gameplay Height 65%', 'Default balanced split', '1248px top gameplay + 672px bottom facecam'],
            ['Gameplay Height 75%', 'Wide FPS / racing focus', '1440px top gameplay + 480px reaction bar'],
            ['Gameplay Height 55%', 'Commentary / reaction heavy', 'Large upper-body facecam + gameplay context'],
            ['Fit + Blur mode', 'Wide UI / full squad view', 'Whole gameplay width preserved over soft blur'],
            ['Fill Crop mode', 'Close combat / tight framing', 'Edge-to-edge zoom inside both stacked panes'],
          ],
        },
      },
      {
        question: 'Where should captions and PNG logos sit on a split-screen vertical video?',
        answer:
          'Placing captions along the very bottom of a split layout puts text over your chin or behind the TikTok/Reels caption description block. Instead, nudge the Caption Y offset upward toward the seam between the gameplay pane and the facecam pane (around 58%–68% height), or use the top safe area for a crisp 3-second hook banner.\n\nIf you include a channel PNG logo from Watermark Maker, Top Left or Top Right keeps it neatly tucked inside the upper gameplay corner without colliding with platform follow buttons.',
      },
    ],
    faqs: [
      {
        q: 'Can I preview the stacked Gameplay + Facecam split before exporting?',
        a: 'Yes. You adjust the source boxes interactively on the source frame and switch between source box setup and live split framing preview before clicking Export.',
      },
      {
        q: 'Does Split layout keep audio synchronized with my facecam reaction?',
        a: 'Yes. Both video panes come from the same timestamped source segment, so your voice and reaction stay frame-accurate with the audio track.',
      },
      {
        q: 'Why is Split layout only available on 9:16 exports?',
        a: 'Top-and-bottom vstack layouts are specifically designed for tall 9:16 vertical feeds; 1:1, 4:5, and 16:9 exports use standard crop or blur-fill framing.',
      },
    ],
    relatedSlugs: [
      'cut-16-9-gameplay-into-9-16-shorts',
      ...(APP_CONFIG.ENABLE_AUTO_CAPTIONS ? ['on-device-auto-captions-and-srt-workflow'] : []),
      'custom-png-watermarks-and-hook-titles',
    ],
    ctaLabel: 'Try Split Layout in Editor',
    ctaPath: '/editor',
  },
  ...(APP_CONFIG.ENABLE_AUTO_CAPTIONS
    ? [
        {
          slug: 'on-device-auto-captions-and-srt-workflow',
          title: 'On-Device Auto Captions & SRT Workflow',
    h1: 'How to Add On-Device Captions to Gaming Clips Without Uploading Video',
    metaDescription:
      'Generate local Whisper Tiny captions in your browser, pick Bold Pop or Boxed caption styles, edit lines inline, and import or export SRT and VTT subtitles.',
    category: 'Captions & Accessibility',
    readTimeMinutes: 6,
    publishedAt: LAST_UPDATED,
    updatedAt: LAST_UPDATED,
    quickAnswer:
      `Many mobile viewers watch Reels and Shorts muted. ${APP_CONFIG.appName} runs the open-source Whisper Tiny speech model (~${APP_CONFIG.captions.estimatedModelSizeMB} MB Light CPU default or ~${APP_CONFIG.captions.estimatedGpuModelSizeMB} MB Fast GPU option) inside a local Web Worker using single-threaded WASM or optional WebGPU, letting you combine Auto (on-device), Manual lines, or .SRT import in one shared editor, apply 8 styles or deterministic Auto mix, and burn captions in or export .SRT/.VTT files.`,
    keyTakeaways: [
      `Audio stays on your device; you approve a one-time ~${APP_CONFIG.captions.estimatedModelSizeMB} MB Light (CPU) or ~${APP_CONFIG.captions.estimatedGpuModelSizeMB} MB Fast (GPU) Whisper download before transcription begins.`,
      'Eight built-in presets (Classic, Bold Pop, Boxed, Minimal, Hype Pop, Neon Glow, Comic Burst, Sticker Box) plus deterministic Auto mix (Calm / Balanced / Hype).',
      'Import existing .srt files or type manual lines anytime, and download clean .srt and .vtt sidecar transcripts.',
      'ASS subtitle burn-in renders per-line styles locally with automatic drawtext fallback if needed.',
    ],
    sections: [
      {
        question: 'How does browser-based Whisper captioning work without a server?',
        answer:
          `Unlike websites that upload your clip to a cloud API or rely on the flaky browser SpeechRecognition microphone API, ${APP_CONFIG.appName} uses @huggingface/transformers inside a dedicated Web Worker. When you pick Auto (on-device), click Generate captions, and confirm the consent dialog, FFmpeg extracts 16 kHz mono PCM audio locally and feeds 30-second windows into ${APP_CONFIG.captions.MODEL_ID}.\n\nLight (CPU, about ${APP_CONFIG.captions.estimatedModelSizeMB} MB) is selected by default so every browser works reliably on single-threaded WebAssembly without COOP/COEP headers. If you pick Fast (GPU, about ${APP_CONFIG.captions.estimatedGpuModelSizeMB} MB, only if WebGPU works), transcription runs in fp32 on WebGPU and automatically retries on CPU WASM in a fresh Worker if GPU initialization or inference fails.`,
        bullets: [
          'English audio provides the strongest out-of-the-box accuracy (plus an English-only whisper-tiny.en_timestamped option); 11 additional languages and auto-detect are selectable.',
          'You can cancel transcription mid-run or switch to Manual (add lines) or Import .SRT without downloading any model.',
          'Your Light or Fast choice is remembered locally, and cached model weights from the configured host are reused on later clips.',
        ],
      },
      {
        question: 'Which of the 8 caption styles or Auto mix fits short-form clips best?',
        answer:
          'Inside the Captions tab you can lock your video to any of eight bundled styles — or enable Style: Auto mix (Calm, Balanced, or Hype) to keep calm lines clean with Classic/Minimal while switching energetic lines (loud audio spikes, exclamation marks, ALL-CAPS words, short <=3-word punches, or keyword matches) to Hype Pop, Neon Glow, or Comic Burst. Every line also exposes a per-line style dropdown.',
        table: {
          headers: ['Caption Preset', 'Visual Styling', 'Best Context'],
          rows: [
            ['Classic / Minimal', 'Clean white bold or subtle lower-third line', 'Calm explanations, tutorials, VOD recaps'],
            ['Bold Pop / Boxed', 'Amber active-word pop or dark contrast backdrop', 'General gaming callouts and bright snow/sky maps'],
            ['Hype Pop', 'Montserrat ExtraBold color-cycling overshoot + slight tilt', 'Reactions, rapid comebacks, loud punchlines'],
            ['Neon Glow', 'Anton cyan halo glow with brighter active-word flash', 'Night scenes, cyberpunk/neon montage edits'],
            ['Comic Burst', 'Bangers comic yellow fill + heavy black outline/shadow', 'Funny fails, arcade action, meme highlights'],
            ['Sticker Box', 'Luckiest Guy text inside cycling solid sticker boxes', 'Punchy hooks and emphasis phrases'],
          ],
        },
      },
      {
        question: 'How should you fix callout slang or game terms after transcription?',
        answer:
          `Compact speech models occasionally mishear gaming callouts, player handles, or background music overlays. ${APP_CONFIG.appName} exposes every generated caption segment in an inline editor right under the Captions tab so you can fix typos in seconds.\n\nYou can edit words directly, adjust start/end timestamps, split a long sentence into two punchier lines, override the caption style per line, or merge brief fragments together. If you want speech-aware highlight detection in Smart Moments too, those updated caption lines immediately feed keyword matching when you re-run or update keywords.`,
      },
      {
        question: 'When should you turn "Burn captions into video" on vs export .SRT or .VTT?',
        answer:
          'Turning "Burn captions into video" on renders stylized text permanently onto the exported frames via ASS (libass), guaranteeing viewers see your fonts, Auto mix styles, and colors identically across Shorts, TikTok, Instagram, and Facebook. However, burned-in captions require H.264 re-encoding.\n\nIf you turn "Burn captions into video" off, the exported MP4 has no captions, and you can download clean .SRT or .VTT subtitle files alongside a Fast Mode (-c copy) clip for native platform caption tracks.',
      },
    ],
    faqs: [
      {
        q: 'Can I choose where the Whisper model weights download from?',
        a: 'Yes. Site operators can point VITE_MODEL_BASE_URL in config/env to a self-hosted mirror instead of the default HuggingFace origin.',
      },
      {
        q: 'What happens if libass fails on an unusual font or character?',
        a: `${APP_CONFIG.appName} automatically retries caption rendering using an FFmpeg drawtext filter fallback so your export completes instead of aborting.`,
      },
      {
        q: 'Does Whisper Tiny transcribe music-only gameplay clips well?',
        a: 'No. Speech models expect audible voice commentary. For montage clips over heavy music, skip Auto Captions or add manual hook/caption lines.',
      },
    ],
    relatedSlugs: [
      'auto-clip-smart-moments-batch-export',
      'custom-png-watermarks-and-hook-titles',
      'fast-copy-trimming-vs-reencoding',
    ],
    ctaLabel: 'Open Captions in Editor',
    ctaPath: '/editor',
  },
      ]
    : []),
  {
    slug: 'auto-clip-smart-moments-batch-export',
    title: 'Auto Clip Everything & Smart Moments Workflow',
    h1: APP_CONFIG.ENABLE_AUTO_CAPTIONS
      ? 'How to Find Best Moments Using Audio, Motion & Speech Keywords (and Batch Export ZIP)'
      : 'How to Find Best Moments Using Audio, Motion & .SRT Keywords (and Batch Export ZIP)',
    metaDescription: APP_CONFIG.ENABLE_AUTO_CAPTIONS
      ? `Use ${APP_CONFIG.appName} Auto clip everything to detect loud comms, high motion, and spoken keywords, review candidate clips, optionally apply hook lines, and export a .ZIP.`
      : `Use ${APP_CONFIG.appName} Auto clip everything to detect loud audio peaks and high motion, apply Smart follow framing, review candidate clips, and export a .ZIP.`,
    category: 'Smart Workflows',
    readTimeMinutes: 5,
    publishedAt: LAST_UPDATED,
    updatedAt: LAST_UPDATED,
    quickAnswer: APP_CONFIG.ENABLE_AUTO_CAPTIONS
      ? 'Auto clip everything chains Smart Moments audio/motion scanning with optional local Whisper speech transcription to find your most active highlights in one pass. You can boost segments containing editable spoken keywords (like "no way" or "clutch"), inspect reason chips, trim every candidate on the Review screen, and download a single .ZIP archive.'
      : 'Auto clip everything chains Smart Moments audio loudness and 192px motion scanning with Smart follow 9:16 reframing to line up your strongest gameplay highlights in one pass. If you import an .srt file or add manual captions, matching keywords also boost segment scores before you review trims and download a single .ZIP archive.',
    keyTakeaways: [
      APP_CONFIG.ENABLE_AUTO_CAPTIONS
        ? 'Reason tags clearly show why a clip ranked high: loud (audio RMS spike), motion, speech density, or keyword match.'
        : 'Reason tags clearly show why a clip ranked high: loud (audio RMS spike), motion, scene cut, or matched .srt/manual keyword.',
      APP_CONFIG.ENABLE_AUTO_CAPTIONS
        ? 'Editable Speech boost keywords and intense spoken lines surface editable hook suggestions you apply manually.'
        : 'Editable boost keywords and exclamation lines from imported .srt or manual captions surface editable hook suggestions you apply manually.',
      'Every auto-generated clip opens in an editable Review screen before exporting so you keep editorial control.',
      'Export All (.ZIP) packages all rendered MP4s in browser memory via fflate, with automatic sequential fallback.',
    ],
    sections: [
      {
        question: `How does ${APP_CONFIG.appName} score candidate clips honestly without "AI virality" guesses?`,
        answer: APP_CONFIG.ENABLE_AUTO_CAPTIONS
          ? `Cloud platforms often advertise opaque "virality percentages" that cannot actually predict social reach. ${APP_CONFIG.appName} takes a transparent, heuristic approach inside your browser: it extracts 8 kHz mono audio to measure RMS loudness bursts above the local baseline, computes 192px pixel differences and scene cuts at 3 fps, and optionally checks local caption lines.\n\nIf you include captions (or click Moments Only to skip the ~${APP_CONFIG.captions.estimatedModelSizeMB} MB Light CPU / ~${APP_CONFIG.captions.estimatedGpuModelSizeMB} MB Fast GPU Whisper download), segments packed with rapid commentary, exclamation marks, or your custom keywords receive a transparent score boost and visible reason tags like loud, motion, speech, and keyword.`
          : `Cloud platforms often advertise opaque "virality percentages" that cannot actually predict social reach. ${APP_CONFIG.appName} takes a transparent, heuristic approach inside your browser: it extracts 8 kHz mono audio via WebAssembly FFmpeg to measure RMS loudness bursts above the local baseline, samples 192px frames at 3 fps for pixel motion and scene cuts, and optionally checks any .srt or manual caption lines loaded in the editor.\n\nSegments with sharp audio reactions, high visual movement, or caption lines containing exclamation marks and your custom keywords receive a clear score boost and visible reason tags so you always know why each moment was selected.`,
        bullets: [
          'Transparent reason chips tell you at a glance whether a clip spiked on yelling, screen action, or a callout.',
          'Videos longer than 10 minutes display a warning and let you scan only the active trim range.',
          'Silent, static recordings honestly report "No strong moments found" instead of inventing clips.',
        ],
      },
      {
        question: 'How do keyword boosts and editable Hook suggestions work?',
        answer: APP_CONFIG.ENABLE_AUTO_CAPTIONS
          ? `Before clicking Find best moments or Auto clip everything, enter comma-separated trigger words in Speech boost keywords — defaults start with "no way, clutch, watch this", and you can add your own squad slang, round callouts, or reaction phrases.\n\nWhen local captions find an intense or keyword-matched line inside a candidate moment, ${APP_CONFIG.appName} displays it as a suggested Hook candidate. Hook text is never forced onto your export automatically: click Use Hook or Apply Hook in the review modal to preview, edit the wording, and place a clean 3-second top banner.`
          : `Before clicking Find best moments or Auto clip everything, enter comma-separated trigger words in the boost keywords field — defaults start with "no way, clutch, watch this", and you can add your own squad slang, round callouts, or reaction phrases.\n\nWhenever you have imported an .srt subtitle track or typed manual caption lines in the Captions tab, ${APP_CONFIG.appName} matches those words inside candidate windows and displays intense lines as suggested Hook candidates. Hook text is never forced onto your export automatically: click Use Hook or Apply Hook in the review modal to preview, edit the wording, and place a clean 3-second top banner.`,
        table: {
          headers: ['Reason Tag', 'What Triggered It', 'Best Editor Follow-Up'],
          rows: [
            ['loud', '0.5s audio RMS burst above local baseline', 'Check volume balance and preview 1–2s before spike'],
            ['motion', 'Sustained 192px pixel movement or scene cut', 'Enable Smart follow crop so 9:16 tracks action'],
            [
              'speech',
              APP_CONFIG.ENABLE_AUTO_CAPTIONS
                ? 'High spoken word rate or exclamation cues'
                : 'Dense or exclamation-marked caption lines in window',
              'Turn on Bold Pop captions for muted mobile viewers',
            ],
            ['keyword', 'Matched your custom boost keywords', 'Review the Hook candidate and apply if useful'],
          ],
        },
      },
      {
        question: 'What happens inside the Auto Clip Review modal and .ZIP exporter?',
        answer:
          `Once Auto clip everything finishes scanning, the Review modal opens with every detected segment lined up for quick inspection. You can rename files cleanly, nudge Start/End seconds, jump the video preview to any clip, remove weak picks, or edit a hook suggestion before committing CPU time to rendering.\n\nClicking Export All (.ZIP) renders each clip sequentially via FFmpeg WASM and bundles them in browser memory using lazy-loaded fflate with a live Cancel button. On lower-memory mobile devices where large multi-clip ZIP buffers might strain RAM, ${APP_CONFIG.appName} catches memory issues and automatically triggers clean individual MP4 downloads instead so your rendered clips are never lost.`,
        bullets: [
          'Always verify Start and End handles on at least the first two segments before starting a batch export.',
          'Use Small file (CRF 28 · 720p) when exporting five or more vertical clips in a single ZIP archive.',
          'Cancel Export stops both multi-clip rendering and ZIP packaging immediately with zero broken temporary state.',
        ],
      },
    ],
    faqs: [
      ...(APP_CONFIG.ENABLE_AUTO_CAPTIONS
        ? [
            {
              q: 'Can I run Auto clip everything without downloading the Whisper speech model?',
              a: 'Yes. The consent dialog includes a "Moments Only (Skip Model)" button that scans audio loudness and frame motion immediately with zero model download.',
            },
            {
              q: 'Are fflate and Whisper loaded when I visit the home page?',
              a: 'No. Both Whisper (@huggingface/transformers) and the ZIP packager (fflate) are lazy-loaded only when you trigger captions or ZIP export inside the editor.',
            },
          ]
        : [
            {
              q: 'Do Smart Moments or Auto clip everything upload my gameplay video?',
              a: 'No. Audio extraction, 192px frame sampling, Smart follow crop smoothing, and batch ZIP packaging all run locally inside your browser tab with zero server uploads.',
            },
            {
              q: 'Is the fflate ZIP packager loaded when I visit the home page?',
              a: 'No. Both FFmpeg WebAssembly and the ZIP packager (fflate) are lazy-loaded only when you open the editor or trigger batch ZIP export.',
            },
          ]),
      {
        q: 'Can I cancel a long batch export halfway through?',
        a: 'Yes. Clicking Cancel Export aborts the queue cleanly without leaving corrupted partial downloads.',
      },
    ],
    relatedSlugs: [
      ...(APP_CONFIG.ENABLE_AUTO_CAPTIONS ? ['on-device-auto-captions-and-srt-workflow'] : []),
      'cut-16-9-gameplay-into-9-16-shorts',
      'browser-wasm-memory-limits-large-captures',
    ],
    ctaLabel: 'Try Auto Clip Everything',
    ctaPath: '/editor',
  },
  {
    slug: 'custom-png-watermarks-and-hook-titles',
    title: 'PNG Watermarks & 3-Second Hook Titles Guide',
    h1: 'How to Brand Vertical Clips With Transparent PNG Watermarks and 3-Second Hooks',
    metaDescription:
      'Design crisp condensed or stencil channel stamps in the built-in Watermark Maker, send them straight to the editor, and avoid mobile safe-zone overlap.',
    category: 'Branding & Overlays',
    readTimeMinutes: 5,
    publishedAt: LAST_UPDATED,
    updatedAt: LAST_UPDATED,
    quickAnswer:
      `Consistent channel branding helps viewers recognize re-shared highlights even without checking the uploader name. Use ${APP_CONFIG.appName}’s built-in Watermark Maker to render a crisp transparent PNG tag with condensed or stencil typography and drop shadow, send it straight into the editor’s Logo tab, and pair it with a 3-second top hook title.`,
    keyTakeaways: [
      'Watermark Maker renders transparent PNG stamps locally on HTML5 canvas with zero background box artifacts.',
      'Choose Condensed, Stencil, or Mono typography with adjustable font size, outline width, shadow, and spacing.',
      'Send to Editor transfers your PNG directly into memory — or download the PNG file for OBS and other tools.',
      'Pair subtle 60–80% opacity Top Left/Top Right logos with a 3-second Hook title banner for clear context.',
    ],
    sections: [
      {
        question: 'Why design a custom PNG watermark instead of baking text directly every time?',
        answer:
          `Typing your handle as plain video text on every clip takes repeated styling tweaks and lacks a consistent silhouette. Exporting a pre-trimmed transparent PNG watermark once gives you an instant visual stamp you can toggle across every Short, TikTok, Instagram Reel, and Facebook Reel — plus use directly in OBS Studio overlays.\n\n${APP_CONFIG.appName}’s Watermark Maker automatically trims extra transparent margins around the canvas before saving so the corner size slider in the video editor scales predictably.`,
        bullets: [
          'Condensed and Stencil presets mimic sharp broadcast and urban title cards.',
          'Adjustable dark stroke outline keeps white or amber text readable across bright explosions and snow maps.',
          'Optional soft drop shadow separates the stamp cleanly from busy game HUDs.',
        ],
      },
      {
        question: 'Where should you position logos and hook banners inside 9:16 mobile frames?',
        answer:
          'Every short-form platform overlays interface icons around the bottom 25% and right-side vertical rail (like, comment, bookmark, share, and audio disc). Placing a logo in Bottom Right almost always gets hidden behind UI buttons.',
        table: {
          headers: ['Corner / Zone', 'Visibility Rating', 'Recommended Pairing'],
          rows: [
            ['Top Left (8–12% margin)', 'High — clear on all 4 platforms', 'Primary channel handle PNG at 70–85% opacity'],
            ['Top Right (8–12% margin)', 'High — clear of right action rail', 'Secondary tag or alternate corner placement'],
            ['Top 12% Center Band', 'High during opening 3 seconds', '3-second Hook title banner ("HOW DID THIS HAPPEN?!")'],
            ['Bottom Left / Right', 'Low — crowded by caption/buttons', 'Avoid unless exporting 16:9 widescreen'],
          ],
        },
      },
      {
        question: 'How should 3-second Hook titles complement captions without visual clutter?',
        answer:
          'Open the Hook tab inside the editor to drop a short context line (such as a built-in template or an edited speech-derived Hook suggestion from Smart Moments) that displays strictly for the first 3 seconds of the clip. Keeping hook text at the top while animated captions stay in the lower-middle safe zone creates clear visual hierarchy: the viewer reads the premise at the top, watches the action in the center, and follows spoken dialogue below.\n\nPair that with one-click Grab PNG Frame after pausing on your peak action frame so you immediately walk away with a matching static cover image for YouTube Shorts or Instagram Reels.',
        bullets: [
          'Keep hook text under 6–8 words so it fits inside two crisp uppercase lines on narrow mobile screens.',
          'Avoid duplicating the exact opening caption word-for-word; use the hook to frame the stakes or map round.',
          'Preview both the 00:01 hook timestamp and the 00:05 caption timestamp before starting H.264 re-encoding.',
        ],
      },
    ],
    faqs: [
      {
        q: `Does ${APP_CONFIG.appName} force its own watermark onto free exports?`,
        a: 'No. Every MP4, GIF, and PNG export is 100% unbranded unless you deliberately add your own PNG logo in the Logo tab.',
      },
      {
        q: 'Can I upload my own channel badge PNG created in another app?',
        a: 'Yes. The Logo tab in the editor accepts any PNG image upload directly from your device in addition to Watermark Maker transfers.',
      },
      {
        q: 'Can I grab a matching still thumbnail PNG from the clip?',
        a: 'Yes. Scrub to your cleanest action frame on the timeline and click Grab PNG Frame to save a full-resolution PNG snapshot.',
      },
    ],
    relatedSlugs: [
      ...(APP_CONFIG.ENABLE_AUTO_CAPTIONS ? ['on-device-auto-captions-and-srt-workflow'] : []),
      'split-screen-gameplay-and-facecam-reels',
      'cut-16-9-gameplay-into-9-16-shorts',
    ],
    ctaLabel: 'Open Watermark Maker',
    ctaPath: '/watermark-maker',
  },
  {
    slug: 'browser-wasm-memory-limits-large-captures',
    title: 'Clipping Large Recordings in Browser Memory',
    h1: 'How to Clip Large 1080p and 4K Captures Safely Inside Browser WebAssembly Limits',
    metaDescription:
      'Understand why browser FFmpeg warns above 300 MB and 10 minutes, and learn the Fast Copy pre-slice workflow to edit large gameplay VODs without crashes.',
    category: 'Performance & Reliability',
    readTimeMinutes: 5,
    publishedAt: LAST_UPDATED,
    updatedAt: LAST_UPDATED,
    quickAnswer:
      'Because single-threaded FFmpeg runs inside a 32-bit browser WebAssembly heap (capped around 1–2 GB), dropping an entire 2 GB 4K recording and triggering H.264 re-encoding can exhaust tab memory. Keep files under ~300 MB when possible, or use Fast Mode (-c copy) first to carve out 30–90s clips in seconds.',
    keyTakeaways: [
      'Browser tabs isolate WebAssembly to 32-bit memory limits even on desktops with 32 GB+ system RAM.',
      'Smart Moments warns above 10 minutes and lets you scan only your active trim range instead of the full VOD.',
      'The 2-step Fast Copy pre-trim trick handles multi-hundred-megabyte source captures reliably.',
      'Selecting Small file (CRF 28 · 720p) cuts encode time and peak filtergraph memory on older laptops and phones.',
    ],
    sections: [
      {
        question: 'Why does a 32-bit browser tab warn at 300 MB when my PC has plenty of RAM?',
        answer:
          'Even on a modern workstation with 32 GB or 64 GB of physical RAM, WebAssembly compiled to 32-bit address space (`wasm32`) is capped by the browser sandbox — practically between 1 GB and 2 GB total per tab depending on Chrome, Safari, or mobile OS rules.\n\nInside that ceiling, FFmpeg has to hold the entire virtual input file in MEMFS alongside decoded frame buffers, scaled blur layers, subtitle fonts, and output bytes. A 500 MB MP4 file plus multi-frame H.264 filter buffers can push past the heap limit during heavy re-encoding.',
        bullets: [
          'Native `<video>` scrubbing works even on huge files because browsers stream-decode from disk.',
          'Heavy memory usage starts only when copying the file into FFmpeg’s virtual memory or allocating multi-filter frames.',
          'Low-resolution Smart Moments analysis deliberately samples at 192px wide so it never loads full HD frames into JS memory.',
        ],
      },
      {
        question: 'What is the safest workflow for 15-minute to 1-hour OBS recordings?',
        answer:
          'Instead of pushing an entire 25-minute capture straight into 9:16 H.264 re-encoding, break the job into two fast local steps. Even better, set OBS replay buffer to save 60-to-120-second instant replays so every capture starts at an ideal size.',
        table: {
          headers: ['Source Recording Size', 'Recommended Strategy', 'Expected Stability'],
          rows: [
            ['Under 150 MB (30s–3 min)', 'Direct Smart Moments, Auto clip, or 9:16 re-encode', 'Smooth on desktop & modern mobile'],
            ['150–300 MB (3–10 min)', 'Trim range or run Smart Moments on active range', 'Smooth on desktop; use 720p Small on mobile'],
            ['300 MB–800 MB (10+ min)', 'Step 1: Fast Mode (-c copy) cut → Step 2: 9:16 edit', 'Reliable via stream-copy pre-slice'],
            ['4K60 Multi-GB VODs', 'Pre-trim with desktop lossless cut or OBS Replay Buffer', 'Avoid loading full multi-GB blob in tab RAM'],
          ],
        },
      },
      {
        question: 'How do mobile browsers handle H.264 re-encoding vs desktop?',
        answer:
          `Phones and tablets share system memory aggressively between apps and background tabs, often terminating a heavy WebAssembly tab much earlier than desktop Chrome or Firefox. When ${APP_CONFIG.appName} detects a mobile or lower-memory device, it displays a proactive banner recommending clips under 120 MB and shorter 9:16 exports.\n\nIf you want fast turnaround on a phone, stick to Original (Fast Copy) cuts, pick Small file (CRF 28 · 720p), or ${
            APP_CONFIG.ENABLE_AUTO_CAPTIONS
              ? `run Smart Moments without downloading the ~${APP_CONFIG.captions.estimatedModelSizeMB} MB Light CPU (or ~${APP_CONFIG.captions.estimatedGpuModelSizeMB} MB Fast GPU) Whisper model`
              : 'run Smart Moments audio and motion analysis on your active trim range'
          }. Closing unused browser tabs before rendering also frees contiguous memory blocks for FFmpeg WASM.`,
        bullets: [
          'Prefer 1080p60 or 1080p30 H.264 MP4 captures over variable-framerate 4K HEVC screen recordings.',
          'Split long sessions into multiple shorter clips rather than stacking six heavy filters on a 3-minute export.',
          'Use Cancel Export anytime if a filter combination feels too slow on battery-powered devices.',
        ],
      },
    ],
    faqs: [
      {
        q: `Why does ${APP_CONFIG.appName} ask before scanning videos longer than 10 minutes?`,
        a: 'Frame sampling a 20-minute video takes noticeably longer inside a browser tab. Warning at 10 minutes lets you set a tighter In/Out window and click Scan Trim Range instead.',
      },
      {
        q: 'What does Quality Preset "Small file (CRF 28 · 720p)" change?',
        a: 'It scales vertical output to 720×1280 and uses CRF 28, significantly lowering pixel count, encode duration, and final MP4 megabytes while remaining sharp on phones.',
      },
      {
        q: 'Which video formats decode most reliably in browser previews?',
        a: 'Standard 8-bit H.264 MP4 and VP8/VP9 WebM files preview reliably across Chrome, Edge, Firefox, and Safari. High-bit-depth HEVC or Apple ProRes MOV files may not decode in all browsers.',
      },
    ],
    relatedSlugs: [
      'download-your-own-videos',
      'fast-copy-trimming-vs-reencoding',
      'auto-clip-smart-moments-batch-export',
      'cut-16-9-gameplay-into-9-16-shorts',
    ],
    ctaLabel: 'Open Clip Editor',
    ctaPath: '/editor',
  },
  {
    slug: 'download-your-own-videos',
    title: 'Export Your Own Videos via Official Platform Tools',
    h1: 'How to Download Your Own Videos Using Official Platform Options',
    metaDescription:
      `Save MP4 copies of your own uploads using official YouTube Studio, Instagram, and Facebook account options before editing locally in ${APP_CONFIG.appName}.`,
    category: 'Account Exports & Prep',
    readTimeMinutes: 5,
    publishedAt: LAST_UPDATED,
    updatedAt: LAST_UPDATED,
    quickAnswer:
      `${APP_CONFIG.appName} runs strictly in your browser and never pulls videos from YouTube, Instagram, Facebook, TikTok, Twitch, or Kick links. Whenever you need to re-edit or repurpose your own uploaded video and no longer have the original recording file, sign in to your account and use each platform’s built-in official export or account data archive option, then drop the saved MP4 into ${APP_CONFIG.appName}.`,
    keyTakeaways: [
      'Always keep your original OBS, ShadowPlay, console capture, or phone camera roll files whenever possible—they preserve higher quality than re-compressed social exports.',
      'Menu labels, icons, and exact paths vary between desktop web and mobile apps and may change as platforms update their interfaces.',
      'Only download and edit videos you created, own, or have explicit permission to use.',
      'Avoid unverified third-party downloader websites or browser extensions that ask for account access.',
    ],
    sections: [
      {
        question: `Why does ${APP_CONFIG.appName} ask for local files instead of social platform links?`,
        answer:
          `${APP_CONFIG.appName} has zero backend servers and processes every video locally inside browser WebAssembly so your footage never gets uploaded to anyone else’s server. Streaming and social platforms serve web pages and protected media streams rather than direct, browser-accessible MP4 files.\n\nIf you created the video yourself, exporting a clean MP4 directly through your own creator dashboard or account data export keeps you in control of your files and avoids third-party tools. You can also load a direct .mp4, .webm, or .mov file link if it sits on your own storage or a host that allows browser CORS requests—keeping in mind that the file host will see that browser request.`,
      },
      {
        question: 'How to save your own upload from YouTube Studio',
        answer:
          'YouTube Studio includes a built-in download option for videos and archived streams uploaded to your own channel. Exact menu placement can vary between creator updates, so look for the Content list inside your channel dashboard:',
        bullets: [
          'Sign in to the Google account that owns the channel and open YouTube Studio on desktop web.',
          'Select Content from the left sidebar (switch to the Live tab if you are looking for past livestreams).',
          'Hover over the video row you want to save, click the three-dot Options menu, and choose Download.',
          `Wait for YouTube Studio to save the MP4 file to your computer, then drop it into ${APP_CONFIG.appName}.`,
          'Need multiple videos at once? Google’s official Google Takeout service lets you request an archive of your own YouTube channel uploads in original or packaged format.',
        ],
      },
      {
        question: 'How to save your own videos from Instagram',
        answer:
          'Instagram offers built-in ways inside the official mobile app and Accounts Center to keep or export videos you posted to your own account. Because Instagram updates app navigation frequently across iOS and Android, exact wording may shift slightly:',
        bullets: [
          'Before posting new Reels or Stories, check your Instagram app archiving and saving settings (such as saving original photos/videos or saving Stories to your archive or camera roll) so full-quality copies stay on your phone automatically.',
          'For an individual Reel or video you already posted, open your own post menu inside the Instagram app to see whether an official Save or Download option is available for your account and region.',
          'For a bulk copy of videos you shared, open Settings and activity → Accounts Center → Your information and permissions → Download your information, select your Instagram profile, and request your posts or videos archive.',
        ],
      },
      {
        question: 'How to save your own videos from Facebook',
        answer:
          'Facebook provides both per-post download options for your own videos and an official account archive export through Accounts Center. Depending on whether the video lives on a personal profile or a creator Page, menu names may change slightly:',
        bullets: [
          'For an individual video on your personal profile on desktop web, open the video post, click the three-dot menu on the post or video viewer, and choose Download video when shown for your own upload.',
          'If you manage a creator or gaming Page, check Meta Business Suite under Content to manage and export published video assets you uploaded.',
          'To export all videos from your account at once, open Settings & privacy → Settings → Accounts Center → Your information and permissions → Download your information and choose your Posts or Videos archive.',
        ],
      },
      {
        question: 'Best practices before cutting and reframing exported clips',
        answer:
          'Social platforms re-encode uploads aggressively, which means an MP4 downloaded back from an online dashboard will usually be smaller and slightly softer than the master file straight out of OBS Studio, NVIDIA App, or your phone camera.',
        table: {
          headers: ['Source Copy', 'Visual Quality', `Best ${APP_CONFIG.appName} Workflow`],
          rows: [
            [
              'Original local capture (OBS / Camera Roll)',
              'Highest (native bitrate & FPS)',
              'Smart Moments + 9:16 Smart follow + Bold Pop captions',
            ],
            [
              'Official account dashboard MP4',
              'Good for single-generation edits',
              'Fast Mode (-c copy) trim or clean 9:16 reframe',
            ],
            [
              'Official account archive export',
              'Useful backup if original drive was cleared',
              'Pre-trim long VODs in Fast Mode before heavy filters',
            ],
          ],
        },
      },
    ],
    faqs: [
      {
        q: 'Can I paste a direct .mp4, .webm, or .mov URL instead of picking a local file?',
        a: `Yes, if the link points directly to a .mp4, .webm, or .mov file on a host you control or one that permits browser CORS requests. Your browser requests that file directly from the host, so the file host sees that request. If the host blocks browser loading, download the file locally and drop it into ${APP_CONFIG.appName}.`,
      },
      {
        q: 'Why do menu names in YouTube Studio, Instagram, or Facebook sometimes differ from these steps?',
        a: 'Platforms regularly update dashboards, settings menus, and creator studio layouts across desktop browsers, iOS, and Android. Look for official Content lists, per-post three-dot menus, or Accounts Center information-export tools inside your signed-in account.',
      },
      {
        q: `Who is responsible for permissions when editing clips in ${APP_CONFIG.appName}?`,
        a: `You are solely responsible for ensuring you own or have permission to edit and publish any video you open or load into ${APP_CONFIG.appName}.`,
      },
    ],
    relatedSlugs: [
      'fast-copy-trimming-vs-reencoding',
      'cut-16-9-gameplay-into-9-16-shorts',
      'browser-wasm-memory-limits-large-captures',
    ],
    ctaLabel: 'Open Clip Editor',
    ctaPath: '/editor',
  },
];

export function getGuideBySlug(slug: string): GuideArticle | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
