import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock } from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import { GUIDES } from '../data/guides';

export function GuidesIndexPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="border-b border-[#2a3544] pb-5 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-[#e59a24]">
          Creator Handbook
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#eef2f6]">
          Short-Form Video Clipping &amp; Vertical Framing Guides
        </h1>
        <p className="text-sm text-[#9aa7b8] leading-relaxed max-w-2xl">
          Practical workflows for turning 16:9 gameplay recordings into 9:16 YouTube Shorts,
          TikToks, Instagram Reels, and Facebook Reels inside {APP_CONFIG.appName} without cloud
          uploads.
        </p>
      </div>

      {GUIDES.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {GUIDES.map((guide) => (
            <article
              key={guide.slug}
              className="rounded-md border border-[#2a3544] bg-[#151b22] p-5 flex flex-col justify-between gap-4 hover:border-[#39475a] transition-colors"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs text-[#9aa7b8]">
                  <span className="font-semibold uppercase tracking-wider text-[#e59a24]">
                    {guide.category}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono-num">
                    <Clock className="w-3.5 h-3.5" />
                    {guide.readTimeMinutes} min read
                  </span>
                </div>

                <h2 className="font-display text-2xl font-bold text-[#eef2f6] leading-snug">
                  <Link to={`/guides/${guide.slug}`} className="hover:text-[#e59a24] transition-colors">
                    {guide.h1}
                  </Link>
                </h2>

                <p className="text-sm text-[#9aa7b8] leading-relaxed">{guide.quickAnswer}</p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#2a3544]">
                <span className="text-[11px] font-mono-num text-[#6c7a8c]">
                  Updated {guide.updatedAt}
                </span>
                <Link
                  to={`/guides/${guide.slug}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#e59a24] hover:text-[#f0ab3c]"
                >
                  <span>Read guide</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-[#2a3544] bg-[#151b22] p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#eef2f6]">
            <BookOpen className="w-4 h-4 text-[#e59a24]" />
            <span>Guides loading...</span>
          </div>
          <p className="text-sm text-[#9aa7b8]">
            Explore{' '}
            <Link to="/how-it-works" className="text-[#e59a24] underline">
              How It Works &amp; FAQ
            </Link>{' '}
            or jump straight into the{' '}
            <Link to="/editor" className="text-[#e59a24] underline">
              Clip Editor
            </Link>
            .
          </p>
        </div>
      )}

      <section className="rounded-md border border-[#2a3544] bg-[#151b22] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">
            Ready to cut your next clip?
          </h2>
          <p className="text-xs text-[#9aa7b8]">
            Open the browser editor or read our technical FAQ on Fast Mode vs H.264 re-encoding.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            to="/how-it-works"
            className="px-4 py-2 rounded-md border border-[#39475a] bg-[#0e1217] text-xs font-medium text-[#eef2f6] hover:border-[#6c7a8c]"
          >
            How It Works
          </Link>
          <Link
            to="/editor"
            className="px-4 py-2 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-xs font-semibold text-[#0e1217]"
          >
            Open Editor
          </Link>
        </div>
      </section>
    </div>
  );
}
