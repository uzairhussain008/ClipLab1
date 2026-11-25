import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import { HOW_IT_WORKS_FAQS, HOW_IT_WORKS_STEPS } from '../data/faqs';

const SHORTCUTS = [
  { key: 'Space', action: 'Play or pause video preview' },
  { key: 'I', action: 'Set trim In point to current playhead' },
  { key: 'O', action: 'Set trim Out point to current playhead' },
  { key: 'Left Arrow', action: 'Step backward 1 frame (1/30s)' },
  { key: 'Right Arrow', action: 'Step forward 1 frame (1/30s)' },
];

export function HowItWorksPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#9aa7b8]">
        <Link to="/" className="hover:text-[#eef2f6]">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[#eef2f6]">How It Works</span>
      </nav>

      <header className="border-b border-[#2a3544] pb-5 space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#eef2f6]">
          How {APP_CONFIG.appName} Works
        </h1>
        <p className="text-sm sm:text-base text-[#c2cbd6] leading-relaxed">
          {APP_CONFIG.ENABLE_AUTO_CAPTIONS
            ? `${APP_CONFIG.appName} runs local WebAssembly FFmpeg, Web Workers, and optional on-device Whisper Tiny captions inside your browser tab so MP4, MOV, and WebM recordings never leave your device.`
            : `${APP_CONFIG.appName} runs local WebAssembly FFmpeg and Web Workers inside your browser tab so MP4, MOV, and WebM recordings never leave your device.`}
        </p>
      </header>

      {/* 5-step HowTo matching visible HowTo JSON-LD */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold text-[#eef2f6]">
          How to Trim &amp; Export a Clip in 5 Steps
        </h2>
        <ol className="space-y-3">
          {HOW_IT_WORKS_STEPS.map((step, idx) => (
            <li
              key={step.name}
              className="rounded-md border border-[#2a3544] bg-[#151b22] p-4 flex items-start gap-3.5"
            >
              <span className="font-mono-num text-xs font-bold px-2.5 py-1 rounded bg-[#e59a24] text-[#0e1217] shrink-0">
                0{idx + 1}
              </span>
              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-[#eef2f6]">{step.name}</h3>
                <p className="text-sm text-[#9aa7b8] leading-relaxed">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold text-[#eef2f6]">Keyboard Shortcuts</h2>
        <div className="rounded-md border border-[#2a3544] bg-[#151b22] divide-y divide-[#2a3544]">
          {SHORTCUTS.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="text-[#9aa7b8]">{item.action}</span>
              <kbd className="font-mono-num text-xs px-2.5 py-1 rounded border border-[#39475a] bg-[#0e1217] text-[#e59a24]">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </section>

      {/* Answer-first visible FAQs matching FAQPage schema verbatim */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold text-[#eef2f6]">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {HOW_IT_WORKS_FAQS.map((item) => (
            <div key={item.q} className="rounded-md border border-[#2a3544] bg-[#151b22] p-5 space-y-2">
              <h3 className="font-display text-xl font-bold text-[#eef2f6]">{item.q}</h3>
              <p className="text-sm text-[#9aa7b8] leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Link
          to="/editor"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] font-semibold text-sm"
        >
          <span>Launch Clip Editor</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to="/guides"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-[#2a3544] bg-[#151b22] hover:border-[#39475a] text-sm font-medium text-[#eef2f6]"
        >
          <BookOpen className="w-4 h-4 text-[#e59a24]" />
          <span>Read Step-by-Step Guides</span>
        </Link>
        <Link
          to="/guides/download-your-own-videos"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-[#2a3544] bg-[#151b22] hover:border-[#39475a] text-sm font-medium text-[#eef2f6]"
        >
          <span>Download Your Own Videos Guide</span>
        </Link>
        <Link
          to="/watermark-maker"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-[#2a3544] bg-[#151b22] hover:border-[#39475a] text-sm font-medium text-[#eef2f6]"
        >
          <span>Open Watermark Maker</span>
        </Link>
      </div>
    </div>
  );
}
