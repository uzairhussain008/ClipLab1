import React, { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LOOK_TEMPLATES, type LookTemplate } from '../config/templates';

const LazyShowcaseLivePreview = React.lazy(() => import('./ShowcaseLivePreview'));

function ShowcasePreviewFallback({ template }: { template: LookTemplate }) {
  const isQuickCut = template.id === 'quick-cut';
  return (
    <div className="grid grid-cols-12 gap-3 items-center" aria-hidden="true">
      <div className={isQuickCut ? 'col-span-6 space-y-1' : 'col-span-7 space-y-1'}>
        <div className="text-[11px] text-[#9aa7b8]">Before (16:9)</div>
        <div className="w-full aspect-video rounded border border-[#2a3544] bg-[#0e1217]" />
      </div>
      <div className={isQuickCut ? 'col-span-6 space-y-1' : 'col-span-5 space-y-1'}>
        <div className="text-[11px] text-[#e59a24]">{isQuickCut ? 'After (Trimmed)' : 'After (9:16)'}</div>
        <div
          className={`mx-auto rounded border border-[#2a3544] bg-[#0e1217] ${
            isQuickCut ? 'w-full aspect-video' : 'w-full max-w-[146px] aspect-[9/16]'
          }`}
        />
      </div>
    </div>
  );
}

export function HomeShowcaseSection() {
  return (
    <section
      id="what-you-can-make"
      aria-labelledby="showcase-heading"
      className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-2 space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#2a3544] pb-5">
        <div>
          <h2 id="showcase-heading" className="font-display text-3xl font-bold text-[#eef2f6]">
            What you can make
          </h2>
          <p className="text-sm text-[#9aa7b8] mt-1 max-w-2xl">
            Four built-in Looks you can apply to your own video or test immediately with an
            original browser-generated sample scene.
          </p>
        </div>
        <Link
          to="/templates"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#e59a24] hover:text-[#f0ab3c] whitespace-nowrap shrink-0"
        >
          <span>Explore all templates</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {LOOK_TEMPLATES.map((template) => (
          <article
            key={template.id}
            className="rounded-md border border-[#2a3544] bg-[#151b22] p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl font-bold text-[#eef2f6]">
                    {template.name}
                  </h3>
                  <p className="text-xs text-[#e59a24] mt-0.5">{template.tagline}</p>
                </div>
                <Link
                  to={`/editor?template=${template.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                >
                  <span>Try this look</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <Suspense fallback={<ShowcasePreviewFallback template={template} />}>
                <LazyShowcaseLivePreview template={template} />
              </Suspense>

              <p className="text-sm text-[#9aa7b8] leading-relaxed">{template.description}</p>
            </div>

            <p className="text-[11px] text-[#6c7a8c] border-t border-[#2a3544] pt-2.5">
              Live preview from a sample scene. Your result depends on your video.
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
