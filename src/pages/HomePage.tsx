import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  Film,
  Layers,
  Lock,
  MessageSquareText,
  Scissors,
  Sparkles,
  Stamp,
  Upload,
} from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import { useClipLab } from '../context/ClipLabContext';
import { CitySkylineBackdrop } from '../components/CitySkylineHero';
import { AdSlot } from '../components/AdSlot';
import { HomeShowcaseSection } from '../components/HomeShowcaseSection';
import { PasteVideoLink } from '../components/PasteVideoLink';
import { validateVideoFile } from '../utils/deviceCheck';

export function HomePage() {
  const navigate = useNavigate();
  const { setSourceVideo } = useClipLab();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const acceptFile = (file: File) => {
    const check = validateVideoFile(file);
    if (!check.valid) {
      setErrorMsg(check.error || 'Unsupported file.');
      return;
    }
    setErrorMsg(null);
    setSourceVideo(file, check.warnings);
    navigate('/editor');
  };

  const handleFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (file) acceptFile(file);
  };

  const handleDrop = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    setDragActive(false);
    const file = ev.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  };

  const handleScrollToShowcase = (ev: React.MouseEvent<HTMLAnchorElement>) => {
    ev.preventDefault();
    const target = document.getElementById('what-you-can-make');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div>
      {/* Hero with 4-scene rotating original night-city skyline */}
      <section className="relative overflow-hidden border-b border-[#2a3544]">
        <CitySkylineBackdrop />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b0f14]/92 via-[#0b0f14]/68 to-[#0b0f14]/45"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-7 space-y-5">
              <p className="text-xs font-medium tracking-wider uppercase text-[#e59a24]">
                Client-Side Video Studio · Zero Uploads
              </p>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#eef2f6] leading-[1.05] text-balance">
                Clip it. Cut it. Post it. Free.
              </h1>

              <p className="text-base sm:text-lg text-[#c2cbd6] max-w-2xl leading-relaxed">
                Turn raw widescreen gameplay and stream captures into 9:16 YouTube Shorts, TikToks,
                Instagram Reels and Facebook Reels right inside your browser. Fast stream-copy
                trimming when you only need a cut, or full H.264 reframing with blurred
                backgrounds, captions, and PNG watermarks.
              </p>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#c2cbd6] pt-1">
                <span className="inline-flex items-center gap-1.5 text-[#eef2f6]">
                  <Lock className="w-3.5 h-3.5 text-[#e59a24]" />
                  Your video never leaves your device
                </span>
                <span aria-hidden="true">·</span>
                <span>MP4, MOV, WebM</span>
                <span aria-hidden="true">·</span>
                <span>No accounts or forced watermarks</span>
              </div>
            </div>

            {/* Primary Upload Card */}
            <div className="lg:col-span-5">
              <div
                onDragOver={(ev) => {
                  ev.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`rounded-md border p-6 sm:p-7 bg-[#151b22]/95 backdrop-blur-sm transition-colors ${
                  dragActive
                    ? 'border-[#e59a24] bg-[#1c242e]'
                    : 'border-[#39475a]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
                  onChange={handleFileChange}
                  className="sr-only"
                  aria-label="Upload video file"
                />

                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-md border border-[#39475a] bg-[#0e1217] flex items-center justify-center text-[#e59a24]">
                    <Upload className="w-6 h-6" />
                  </div>

                  <div>
                    <h2 className="font-display text-2xl font-bold text-[#eef2f6]">
                      Drop a video to start clipping
                    </h2>
                    <p className="text-xs text-[#9aa7b8] mt-1">
                      MP4, MOV, or WebM · Processed locally in browser memory
                    </p>
                  </div>

                  <div className="w-full pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] font-semibold text-sm transition-colors cursor-pointer"
                    >
                      <Film className="w-4 h-4" />
                      <span>Choose Video File</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-[#6c7a8c] leading-relaxed">
                    Tip: Keep clips under {APP_CONFIG.largeFileWarningMB} MB on desktop (or shorter
                    clips on mobile) for smooth in-browser encoding.{' '}
                    {APP_CONFIG.ENABLE_AUTO_CAPTIONS
                      ? 'Optional Auto Captions downloads an on-device speech model once; your video never leaves your device.'
                      : 'Everything runs locally in your browser; your video never leaves your device.'}
                  </p>

                  <PasteVideoLink
                    onVideoLoaded={(file, warnings) => {
                      setErrorMsg(null);
                      setSourceVideo(file, warnings);
                      navigate('/editor');
                    }}
                  />

                  <p className="w-full text-left text-[11px] text-[#6c7a8c] leading-relaxed pt-1">
                    {APP_CONFIG.ownershipNotice} {APP_CONFIG.platformDisclaimer}
                  </p>
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="mt-4 rounded border border-[#dc3545]/50 bg-[#dc3545]/10 px-3 py-2 text-xs text-[#f8d7da] flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-[#dc3545] shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 text-center">
                <a
                  href="#what-you-can-make"
                  onClick={handleScrollToShowcase}
                  className="text-xs text-[#c2cbd6] hover:text-[#e59a24] underline underline-offset-4 transition-colors"
                >
                  No video handy? See what you can make
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What you can make: 4 live template previews */}
      <HomeShowcaseSection />

      {/* Core Capabilities */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#2a3544] pb-5">
          <div>
            <h2 className="font-display text-3xl font-bold text-[#eef2f6]">
              Built for fast turnaround, not subscriptions
            </h2>
            <p className="text-sm text-[#9aa7b8] mt-1 max-w-2xl">
              {APP_CONFIG.ENABLE_AUTO_CAPTIONS
                ? 'Single-threaded WebAssembly FFmpeg, Web Workers, and optional local speech captions load only when you open the editor.'
                : 'Single-threaded WebAssembly FFmpeg and analysis Web Workers load only when you open the editor.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
            <Link to="/guides" className="text-[#9aa7b8] hover:text-[#eef2f6] whitespace-nowrap">
              Creator guides →
            </Link>
            <Link to="/how-it-works" className="text-[#e59a24] hover:text-[#f0ab3c] whitespace-nowrap">
              Technical FAQ →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* 01 Fast Copy vs Re-Encode */}
          <div className="md:col-span-6 rounded-md border border-[#2a3544] bg-[#151b22] p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[#e59a24]">
              <Scissors className="w-4 h-4" />
              <span>01. Fast Mode &amp; Full Re-Encode</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-[#eef2f6]">
              Stream-copy trims in seconds or H.264 9:16 exports
            </h3>
            <p className="text-sm text-[#9aa7b8] leading-relaxed">
              Cutting original 16:9 clips without overlays runs{' '}
              <code className="font-mono-num text-xs text-[#eef2f6] bg-[#0e1217] px-1.5 py-0.5 rounded">
                -c copy
              </code>{' '}
              in seconds. Switch to 9:16, 1:1, or 4:5, add captions, stamp a PNG watermark, or adjust
              speed/volume and {APP_CONFIG.appName} runs single-pass H.264 + AAC{' '}
              <code className="font-mono-num text-xs text-[#eef2f6] bg-[#0e1217] px-1.5 py-0.5 rounded">
                veryfast
              </code>{' '}
              re-encoding locally.
            </p>
          </div>

          {/* 02 Smart Moments + Auto Clip + ZIP */}
          <div className="md:col-span-6 rounded-md border border-[#2a3544] bg-[#151b22] p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[#e59a24]">
              <Sparkles className="w-4 h-4" />
              <span>02. Smart Moments &amp; Auto Clip Everything</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-[#eef2f6]">
              Audio, motion &amp; speech-keyword highlight queue
            </h3>
            <p className="text-sm text-[#9aa7b8] leading-relaxed">
              Scan 8 kHz audio RMS spikes, 192px frame motion, scene cuts, and editable spoken
              keywords in a Web Worker. Review every clip in one screen, tweak editable Hook
              candidates, and download individual MP4s or a single{' '}
              <span className="inline-flex items-center gap-1 text-[#eef2f6] font-medium">
                <Archive className="w-3.5 h-3.5 text-[#e59a24]" />
                .ZIP bundle
              </span>
              .
            </p>
          </div>

          {/* 03 Smart Follow & Split Layout */}
          <div className="md:col-span-4 rounded-md border border-[#2a3544] bg-[#151b22] p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[#e59a24]">
              <Layers className="w-4 h-4" />
              <span>03. Smart Reframe &amp; Split Layout</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-[#eef2f6]">
              Follow action or stack Gameplay + Facecam
            </h3>
            <p className="text-sm text-[#9aa7b8] leading-relaxed">
              Track horizontal motion with Smart follow (ignoring outer HUD corners), scale a
              blurred-background fill (100–140%), or drag Gameplay and Facecam boxes into a 9:16
              stacked layout with punch-in zoom.
            </p>
          </div>

          {/* 04 Styled Captions / On-Device Auto Captions */}
          <div className="md:col-span-4 rounded-md border border-[#2a3544] bg-[#151b22] p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[#e59a24]">
              <MessageSquareText className="w-4 h-4" />
              <span>
                {APP_CONFIG.ENABLE_AUTO_CAPTIONS
                  ? '04. On-Device Auto Captions'
                  : '04. Styled Captions & SRT/VTT'}
              </span>
            </div>
            <h3 className="font-display text-2xl font-bold text-[#eef2f6]">
              {APP_CONFIG.ENABLE_AUTO_CAPTIONS
                ? 'Whisper Tiny captions, 8 styles & Auto mix'
                : 'Styled captions with 8 presets, Auto mix & SRT/VTT'}
            </h3>
            <p className="text-sm text-[#9aa7b8] leading-relaxed">
              {APP_CONFIG.ENABLE_AUTO_CAPTIONS ? (
                <>
                  After explicit consent (~{APP_CONFIG.captions.estimatedModelSizeMB} MB Light CPU
                  default or ~{APP_CONFIG.captions.estimatedGpuModelSizeMB} MB Fast GPU option),
                  transcribe locally via WASM CPU or optional WebGPU. Pick Classic, Bold Pop, Boxed,
                  Minimal, Hype Pop, Neon Glow, Comic Burst, Sticker Box, or deterministic Auto mix,
                  and import/export <code className="font-mono-num text-xs text-[#eef2f6]">.srt</code>{' '}
                  / <code className="font-mono-num text-xs text-[#eef2f6]">.vtt</code>.
                </>
              ) : (
                <>
                  Add manual caption lines or import an{' '}
                  <code className="font-mono-num text-xs text-[#eef2f6]">.srt</code> file, edit
                  timing inline, export{' '}
                  <code className="font-mono-num text-xs text-[#eef2f6]">.srt</code> /{' '}
                  <code className="font-mono-num text-xs text-[#eef2f6]">.vtt</code>, and burn in 8
                  styles (including Hype Pop, Neon Glow, Comic Burst, Sticker Box) or Auto mix.
                </>
              )}
            </p>
          </div>

          {/* 05 Presets, Watermark Maker, GIF/PNG */}
          <div className="md:col-span-4 rounded-md border border-[#2a3544] bg-[#151b22] p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[#e59a24]">
              <Stamp className="w-4 h-4" />
              <span>05. Platform Presets &amp; Watermark Maker</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-[#eef2f6]">
              Shorts, TikTok, Reels, PNG stamps &amp; GIFs
            </h3>
            <p className="text-sm text-[#9aa7b8] leading-relaxed">
              Apply 1080×1920 presets for YouTube Shorts, TikTok, Instagram Reels, and Facebook
              Reels, design transparent PNG stamps in{' '}
              <Link to="/watermark-maker" className="text-[#e59a24] underline">
                Watermark Maker
              </Link>
              , export compact GIFs, or save a PNG frame thumbnail.
            </p>
          </div>
        </div>

        {/* Honest "What it can't do" Disclosure */}
        <section
          aria-label={`What ${APP_CONFIG.appName} does not do`}
          className="rounded-md border border-[#39475a] bg-[#151b22] p-6 space-y-3"
        >
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">
            Honest limits: what {APP_CONFIG.appName} doesn&apos;t do
          </h2>
          <p className="text-sm text-[#9aa7b8] leading-relaxed">
            {APP_CONFIG.appName} is a focused browser utility, not a cloud SaaS or full desktop
            suite. Before starting a large project, keep these real boundaries in mind:
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs sm:text-sm text-[#9aa7b8]">
            <li>
              • <strong className="text-[#eef2f6]">No platform downloads:</strong> Cannot download
              clips from YouTube, Instagram, Facebook, TikTok, Twitch, or Kick links — use each
              platform&apos;s official download option for your own uploads (
              <Link to="/guides/download-your-own-videos" className="text-[#e59a24] underline">
                how-to guide
              </Link>
              ) and drop local MP4, MOV, or WebM files.
            </li>
            <li>
              • <strong className="text-[#eef2f6]">No fake &ldquo;viral scores&rdquo;:</strong> Smart
              Moments ranks segments strictly by audio loudness, frame motion, and spoken keywords.
            </li>
            <li>
              • <strong className="text-[#eef2f6]">Browser RAM limits (~1–2 GB):</strong> Long 4K
              captures over {APP_CONFIG.largeFileWarningMB} MB can run out of WebAssembly heap during
              re-encode; pre-cut in Fast Mode first.
            </li>
            <li>
              • <strong className="text-[#eef2f6]">No cloud storage or sync:</strong> Nothing is
              saved to accounts or servers — export your clips or .ZIP before closing the tab.
            </li>
          </ul>
        </section>

        <AdSlot placement="below-editor" />
      </section>
    </div>
  );
}
