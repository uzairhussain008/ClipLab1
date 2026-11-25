import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import { getGuideBySlug, GUIDES } from '../data/guides';
import { NotFoundPage } from './NotFoundPage';

export function GuideDetailPage({ forcedSlug }: { forcedSlug?: string }) {
  const params = useParams<{ slug: string }>();
  const slug = forcedSlug || params.slug || '';
  const guide = getGuideBySlug(slug);

  if (!guide) {
    return <NotFoundPage />;
  }

  const related = guide.relatedSlugs
    .map((relSlug) => GUIDES.find((g) => g.slug === relSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[#9aa7b8]">
        <Link to="/" className="hover:text-[#eef2f6]">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link to="/guides" className="hover:text-[#eef2f6]">
          Guides
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[#eef2f6] truncate">{guide.h1}</span>
      </nav>

      <header className="border-b border-[#2a3544] pb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#9aa7b8]">
          <span className="font-semibold uppercase tracking-wider text-[#e59a24]">
            {guide.category}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 font-mono-num">
            <Clock className="w-3.5 h-3.5" />
            {guide.readTimeMinutes} min read
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">Updated {guide.updatedAt}</span>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#eef2f6] leading-tight">
          {guide.h1}
        </h1>

        <p className="text-base text-[#c2cbd6] leading-relaxed">{guide.quickAnswer}</p>
      </header>

      {/* TL;DR Quick Answer Box for AEO */}
      <aside
        aria-label="Quick answer summary"
        className="rounded-md border border-[#e59a24]/50 bg-[#151b22] p-5 space-y-3"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-[#e59a24]">
          Quick Answer (TL;DR)
        </p>
        <ul className="space-y-2">
          {guide.keyTakeaways.map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm text-[#eef2f6] leading-relaxed">
              <CheckCircle2 className="w-4 h-4 text-[#2ea043] shrink-0 mt-0.5" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Body Sections */}
      <div className="space-y-8">
        {guide.sections.map((section) => (
          <section key={section.question} className="space-y-3">
            <h2 className="font-display text-2xl font-bold text-[#eef2f6]">{section.question}</h2>
            <p className="text-sm sm:text-base text-[#c2cbd6] leading-relaxed whitespace-pre-line">
              {section.answer}
            </p>

            {section.bullets && section.bullets.length > 0 && (
              <ul className="space-y-1.5 pl-4 text-sm text-[#9aa7b8] list-disc">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="leading-relaxed">
                    {bullet}
                  </li>
                ))}
              </ul>
            )}

            {section.table && (
              <div className="overflow-x-auto rounded-md border border-[#2a3544]">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead className="bg-[#1c242e] text-[#eef2f6]">
                    <tr>
                      {section.table.headers.map((header) => (
                        <th key={header} className="px-3.5 py-2.5 font-semibold border-b border-[#2a3544]">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a3544] bg-[#151b22] text-[#9aa7b8]">
                    {section.table.rows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-3.5 py-2.5 align-top">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>

      {guide.faqs && guide.faqs.length > 0 && (
        <section className="space-y-4 border-t border-[#2a3544] pt-6">
          <h2 className="font-display text-2xl font-bold text-[#eef2f6]">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {guide.faqs.map((faq) => (
              <div key={faq.q} className="rounded-md border border-[#2a3544] bg-[#151b22] p-4 space-y-1.5">
                <h3 className="font-display text-lg font-bold text-[#eef2f6]">{faq.q}</h3>
                <p className="text-sm text-[#9aa7b8] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {guide.includeLegalDisclaimer && (
        <p className="text-xs text-[#6c7a8c] border-t border-[#2a3544] pt-4">
          {APP_CONFIG.legalDisclaimer}
        </p>
      )}

      {/* CTA Box */}
      <div className="rounded-md border border-[#39475a] bg-[#151b22] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">
            Try this workflow in {APP_CONFIG.appName}
          </h2>
          <p className="text-xs text-[#9aa7b8]">
            Runs locally in your browser — your recordings never leave your device.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/how-it-works"
            className="px-4 py-2 rounded-md border border-[#2a3544] text-xs font-medium text-[#eef2f6] hover:border-[#39475a]"
          >
            Read FAQ
          </Link>
          <Link
            to={guide.ctaPath}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-xs font-semibold text-[#0e1217]"
          >
            <span>{guide.ctaLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {related.length > 0 && (
        <section className="space-y-3 border-t border-[#2a3544] pt-6">
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">Related Guides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {related.map((rel) => (
              <Link
                key={rel.slug}
                to={`/guides/${rel.slug}`}
                className="rounded-md border border-[#2a3544] bg-[#151b22] p-4 hover:border-[#e59a24] transition-colors space-y-1"
              >
                <div className="text-[11px] font-semibold uppercase text-[#e59a24]">
                  {rel.category}
                </div>
                <div className="text-sm font-semibold text-[#eef2f6]">{rel.h1}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div>
        <Link
          to="/guides"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9aa7b8] hover:text-[#eef2f6]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to all guides</span>
        </Link>
      </div>
    </article>
  );
}
