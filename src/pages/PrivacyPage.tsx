import { APP_CONFIG } from '../config/appConfig';

export function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="border-b border-[#2a3544] pb-5 space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#eef2f6]">
          Privacy Policy (Template)
        </h1>
        <p className="text-xs text-[#e59a24]">
          Site owner notice: Review and customize this template to satisfy GDPR, CCPA/CPRA, ePrivacy,
          or local privacy laws in your jurisdiction before enabling ads or analytics.
        </p>
      </div>

      <div className="space-y-5 text-sm text-[#9aa7b8] leading-relaxed">
        <section className="space-y-2">
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">1. Video & Image Processing</h2>
          <p>
            {APP_CONFIG.appName} processes video files, audio tracks, PNG watermarks, and frame
            captures strictly on your device using client-side browser APIs and WebAssembly. Your
            media files are never uploaded to our servers or third-party cloud storage.
          </p>
          {APP_CONFIG.ENABLE_AUTO_CAPTIONS && (
            <p>
              If you choose to run optional Auto Captions, your browser downloads an open-source
              speech recognition model once from{' '}
              <span className="font-mono-num text-[#eef2f6]">
                {APP_CONFIG.captions.MODEL_BASE_URL}
              </span>{' '}
              (about {APP_CONFIG.captions.estimatedModelSizeMB} MB in Light CPU mode by default, or
              about {APP_CONFIG.captions.estimatedGpuModelSizeMB} MB if you pick Fast GPU mode) and
              caches it locally. Audio stays on your device during transcription.
            </p>
          )}
          <p>
            {APP_CONFIG.appName} never downloads videos from YouTube, Instagram, Facebook, TikTok,
            or other social platforms. If you paste a direct{' '}
            <code className="font-mono-num text-xs text-[#eef2f6]">.mp4</code>,{' '}
            <code className="font-mono-num text-xs text-[#eef2f6]">.webm</code>, or{' '}
            <code className="font-mono-num text-xs text-[#eef2f6]">.mov</code> URL into the link
            input, your browser sends a direct request to that file&apos;s host—so that host sees
            your request and network address (subject to the host&apos;s own privacy policy and CORS
            rules).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">2. Cookies & Local Storage</h2>
          <p>
            We store minimal preference flags in browser localStorage to remember your cookie banner
            selection{APP_CONFIG.ENABLE_AUTO_CAPTIONS ? ' and your Light/Fast speech mode choice' : ''}.
            No user accounts, login credentials, or cloud project databases exist.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">3. Advertising (When Enabled)</h2>
          <p>
            If advertising is enabled by the site operator, third-party ad networks (such as Google
            AdSense or Adsterra) may set cookies or use device identifiers to serve and measure ads.
            You can revisit your preference anytime via Cookie Settings in the footer.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">4. Contact</h2>
          <p>
            For privacy questions or removal requests, contact{' '}
            <span className="text-[#eef2f6] font-mono-num">{APP_CONFIG.contactEmail}</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
