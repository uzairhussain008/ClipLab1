import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Lock, Sparkles } from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import { LOOK_TEMPLATES, type LookTemplateId } from '../config/templates';

const TEMPLATE_GUIDES: Record<LookTemplateId, { slug: string; label: string }> = {
  'blur-fill-classic': {
    slug: 'cut-16-9-gameplay-into-9-16-shorts',
    label: '16:9 to 9:16 framing guide',
  },
  'action-follow': {
    slug: 'cut-16-9-gameplay-into-9-16-shorts',
    label: 'Smart follow & framing guide',
  },
  'gameplay-facecam': {
    slug: 'split-screen-gameplay-and-facecam-reels',
    label: 'Split Gameplay + Facecam guide',
  },
  'quick-cut': {
    slug: 'fast-copy-trimming-vs-reencoding',
    label: 'Fast Copy vs Re-encode guide',
  },
};

export function TemplatesPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <header className="border-b border-[#2a3544] pb-6 space-y-3">
        <p className="text-xs font-medium tracking-wider uppercase text-[#e59a24]">
          Built-In Editor Looks · Client-Side
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#eef2f6]">
          Video Clip Templates &amp; Looks
        </h1>
        <p className="text-sm sm:text-base text-[#9aa7b8] max-w-3xl leading-relaxed">
          Start with a one-click framing and caption configuration inside {APP_CONFIG.appName}.
          Every Look runs strictly inside your browser with WebAssembly FFmpeg, keeps your source
          file on your device, and can be customized or reset in one click. Your final result depends
          on your own recording resolution, audio levels, and captions.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {LOOK_TEMPLATES.map((template) => {
          const guideRef = TEMPLATE_GUIDES[template.id];
          return (
            <article
              key={template.id}
              className="rounded-md border border-[#2a3544] bg-[#151b22] p-6 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#eef2f6]">
                    {template.name}
                  </h2>
                  <p className="text-xs text-[#e59a24] mt-0.5">{template.tagline}</p>
                </div>

                <p className="text-sm text-[#9aa7b8] leading-relaxed">{template.description}</p>

                <ul className="space-y-1.5 text-xs text-[#c2cbd6] border-t border-[#2a3544] pt-3">
                  {template.summaryNotes.map((note) => (
                    <li key={note}>• {note}</li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2a3544] pt-3">
                <Link
                  to={`/guides/${guideRef.slug}`}
                  className="inline-flex items-center gap-1.5 text-xs text-[#9aa7b8] hover:text-[#eef2f6]"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#e59a24]" />
                  <span>{guideRef.label}</span>
                </Link>

                <Link
                  to={`/editor?template=${template.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] text-xs font-semibold whitespace-nowrap transition-colors"
                >
                  <span>Open in Editor</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <section className="rounded-md border border-[#39475a] bg-[#151b22] p-6 space-y-3">
        <h2 className="font-display text-xl font-bold text-[#eef2f6]">
          How Looks behave on your own video vs. a sample scene
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm text-[#9aa7b8] leading-relaxed">
          <div className="space-y-1.5">
            <h3 className="font-semibold text-[#eef2f6] inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#e59a24]" />
              <span>Your uploaded clips</span>
            </h3>
            <p>
              Applying a Look in the editor updates only styling and framing settings (aspect,
              reframe mode, zoom, caption preset, and optional hook title). It never replaces your
              video, trim handles, clip segments, or watermark logo, and never inserts demo caption
              lines into your transcript.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-semibold text-[#eef2f6] inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#e59a24]" />
              <span>Captions &amp; Hook titles</span>
            </h3>
            <p>
              When you open a template link, {APP_CONFIG.appName} generates an original browser
              sample scene with sample captions so you can inspect the Look immediately. On your own
              clips, add lines manually, import an <code className="font-mono-num">.srt</code> file
              {APP_CONFIG.ENABLE_AUTO_CAPTIONS ? (
                <>
                  , or use{' '}
                  <Link
                    to="/guides/on-device-auto-captions-and-srt-workflow"
                    className="text-[#e59a24] underline"
                  >
                    on-device auto captions
                  </Link>
                </>
              ) : null}
              . Any prefilled Hook text (such as &ldquo;Wait for it...&rdquo;) is clearly listed and
              editable in the Hook tab.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
