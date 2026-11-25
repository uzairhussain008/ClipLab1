import { APP_CONFIG } from '../config/appConfig';

export function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="border-b border-[#2a3544] pb-5 space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#eef2f6]">
          Terms of Use (Template)
        </h1>
        <p className="text-xs text-[#e59a24]">
          Site owner notice: Review and adapt these terms for your operating jurisdiction before
          public launch.
        </p>
      </div>

      <div className="space-y-5 text-sm text-[#9aa7b8] leading-relaxed">
        <section className="space-y-2">
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">1. Local Tool Usage &amp; Content Rights</h2>
          <p>
            {APP_CONFIG.appName} is provided free of charge for trimming, reframing, and exporting
            personal or licensed video captures inside your browser. {APP_CONFIG.ownershipNotice}{' '}
            You are solely responsible for the media you process, import via direct file URL, and
            publish.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">2. No Warranty</h2>
          <p>
            Because processing depends on your browser engine, available RAM, and video codecs,{' '}
            {APP_CONFIG.appName} is provided &ldquo;as is&rdquo; without warranties of uninterrupted
            performance. Always keep backups of your original source recordings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">3. Trademarks &amp; Non-Affiliation</h2>
          <p>
            All third-party platform names and marks remain the property of their respective owners.{' '}
            {APP_CONFIG.platformDisclaimer} {APP_CONFIG.legalDisclaimer}
          </p>
        </section>
      </div>
    </div>
  );
}
