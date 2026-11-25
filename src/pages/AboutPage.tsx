import { Link } from 'react-router-dom';
import { Cpu, Lock, ShieldAlert, Wrench } from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="border-b border-[#2a3544] pb-5 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-[#e59a24]">
          About {APP_CONFIG.appName}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#eef2f6]">
          Free, Browser-Only Video Clipping Without Uploads
        </h1>
        <p className="text-sm text-[#9aa7b8] leading-relaxed max-w-2xl">
          {APP_CONFIG.entitySentence} Built for gamers, streamers, and short-form creators who want
          fast trims, 9:16 reframing, and captions without uploading raw footage to cloud servers or
          paying per-minute exports.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md border border-[#2a3544] bg-[#151b22] p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#e59a24]">
            <Lock className="w-4 h-4" />
            <span>Zero-Upload Architecture</span>
          </div>
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">
            Why everything runs inside your browser
          </h2>
          <p className="text-sm text-[#9aa7b8] leading-relaxed">
            Video files never leave your computer or phone. Trimming, aspect cropping, split layouts,
            PNG watermarking, and MP4/GIF exports run through a self-hosted single-threaded{' '}
            <code className="font-mono-num text-xs text-[#eef2f6]">@ffmpeg/ffmpeg</code> WebAssembly
            core inside local tab memory.
          </p>
        </div>

        <div className="rounded-md border border-[#2a3544] bg-[#151b22] p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#e59a24]">
            <Cpu className="w-4 h-4" />
            <span>On-Device Smart Tools</span>
          </div>
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">
            Transparent audio &amp; motion heuristics
          </h2>
          <p className="text-sm text-[#9aa7b8] leading-relaxed">
            Smart Moments and Smart Follow measure 8 kHz audio RMS spikes, low-resolution frame
            motion, and optional keyword hits from{' '}
            {APP_CONFIG.ENABLE_AUTO_CAPTIONS
              ? 'local Whisper Tiny captions'
              : 'manual or imported .srt captions'}{' '}
            inside a Web Worker. Clips are ranked by measurable audio and visual activity — never
            fake &ldquo;viral scores&rdquo;.
          </p>
        </div>
      </section>

      <section className="rounded-md border border-[#2a3544] bg-[#151b22] p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#e59a24]">
          <Wrench className="w-4 h-4" />
          <span>What {APP_CONFIG.appName} Does Today</span>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-[#9aa7b8]">
          <li>• Fast Mode stream-copy (<code className="font-mono-num text-xs text-[#eef2f6]">-c copy</code>) trims in seconds</li>
          <li>• 9:16, 1:1, 4:5, and 16:9 presets for Shorts, TikTok, Instagram &amp; Facebook Reels</li>
          <li>• Smart Moments, Smart Follow reframing, and Gameplay + Facecam split layout</li>
          <li>• Auto clip everything review queue with batch .ZIP or sequential MP4 download</li>
          <li>
            {APP_CONFIG.ENABLE_AUTO_CAPTIONS
              ? '• On-device Whisper Tiny auto captions, manual lines & .SRT import (8 styles + Auto mix, SRT/VTT export)'
              : '• Styled caption editor (8 presets + Auto mix, manual lines, SRT import, SRT/VTT export & burn-in)'}
          </li>
          <li>• Built-in transparent PNG Watermark Maker, GIF export, and PNG frame grab</li>
        </ul>
      </section>

      <section className="rounded-md border border-[#39475a] bg-[#151b22] p-6 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#e59a24]">
          <ShieldAlert className="w-4 h-4" />
          <span>Honest Browser Limitations</span>
        </div>
        <ul className="space-y-2 text-sm text-[#9aa7b8] leading-relaxed">
          <li>
            <strong className="text-[#eef2f6]">No platform downloading:</strong> {APP_CONFIG.appName}{' '}
            cannot pull clips from YouTube, Instagram, Facebook, TikTok, Twitch, or Kick links. Load
            a local MP4, MOV, or WebM file from your device (see our{' '}
            <Link to="/guides/download-your-own-videos" className="text-[#e59a24] underline">
              official account export guide
            </Link>
            ), or paste a direct .mp4/.webm/.mov file URL if its host permits browser CORS requests.
          </li>
          <li>
            <strong className="text-[#eef2f6]">32-bit WebAssembly RAM ceiling:</strong> Browser tabs
            typically cap WebAssembly memory around 1–2 GB. Source files over{' '}
            {APP_CONFIG.largeFileWarningMB} MB or 4K captures should be trimmed into shorter pieces
            first or cut in Fast Mode.
          </li>
          <li>
            <strong className="text-[#eef2f6]">Single-threaded encode speed:</strong> To stay
            compatible with static hosts and ads without COOP/COEP headers, H.264 re-encoding runs
            single-threaded and is slower than desktop GPU software.
          </li>
          <li>
            <strong className="text-[#eef2f6]">Experimental face detection:</strong> Face-aware
            framing only activates in browsers supporting the native{' '}
            <code className="font-mono-num text-xs text-[#eef2f6]">FaceDetector</code> API and falls
            back to motion tracking everywhere else.
          </li>
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/editor"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] font-semibold text-sm"
        >
          Open Clip Editor
        </Link>
        <Link
          to="/guides"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-md border border-[#2a3544] bg-[#151b22] hover:border-[#39475a] text-[#eef2f6] text-sm font-medium"
        >
          Browse Clipping Guides
        </Link>
        <Link
          to="/contact"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-md border border-[#2a3544] bg-[#151b22] hover:border-[#39475a] text-[#eef2f6] text-sm font-medium"
        >
          Contact Operator
        </Link>
      </div>
    </div>
  );
}
