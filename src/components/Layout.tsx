import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import { useClipLab } from '../context/ClipLabContext';
import { AdSlot } from './AdSlot';
import { Logo } from './Logo';

const NAV_ITEMS = [
  { to: '/editor', label: 'Editor' },
  { to: '/watermark-maker', label: 'Watermark Maker' },
  { to: '/guides', label: 'Guides' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/about', label: 'About' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { cookieConsent, setCookieConsent, reopenCookieBanner } = useClipLab();

  return (
    <div className="min-h-screen flex flex-col bg-[#0e1217] text-[#eef2f6]">
      {/* Top Bar Contract: [Brand logo] — [nav links] — [1 primary CTA] */}
      <header className="sticky top-0 z-40 h-14 border-b border-[#2a3544] bg-[#0e1217]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-6">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={`${APP_CONFIG.appName} Home`}
            className="text-[#eef2f6] hover:text-[#e59a24] transition-colors whitespace-nowrap shrink-0"
          >
            <Logo />
          </Link>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm font-medium whitespace-nowrap shrink-0 transition-colors border-b-2 py-1 ${
                    isActive
                      ? 'text-[#e59a24] border-[#e59a24]'
                      : 'text-[#9aa7b8] border-transparent hover:text-[#eef2f6] hover:border-[#39475a]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/editor"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] text-sm font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              Open Editor
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md border border-[#2a3544] bg-[#151b22] text-[#eef2f6] hover:border-[#39475a]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden border-b border-[#2a3544] bg-[#151b22] px-4 py-3 flex flex-col gap-2"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-md text-sm font-medium ${
                    isActive
                      ? 'bg-[#232d3a] text-[#e59a24]'
                      : 'text-[#9aa7b8] hover:bg-[#1c242e] hover:text-[#eef2f6]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/editor"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-1 inline-flex items-center justify-center px-4 py-2.5 rounded-md bg-[#e59a24] text-[#0e1217] text-sm font-semibold"
            >
              Open Editor
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Cookie / Consent Banner Placeholder (in-flow above footer so it never covers Export/Download controls) */}
      {cookieConsent === 'pending' && (
        <div
          role="region"
          aria-label="Cookie and privacy consent"
          className="border-t border-[#39475a] bg-[#151b22] px-4 sm:px-6 py-3 mt-8"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-[#eef2f6] leading-relaxed">
              <strong className="font-semibold">Cookie Notice (Placeholder):</strong> Video editing
              runs locally with zero uploads. When ads are enabled, third-party ad partners may
              store cookies. Review{' '}
              <Link to="/privacy" className="text-[#e59a24] underline">
                Privacy
              </Link>{' '}
              for your jurisdiction.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCookieConsent('essential')}
                className="px-3 py-1.5 rounded border border-[#39475a] text-xs font-medium text-[#9aa7b8] hover:text-[#eef2f6] hover:border-[#6c7a8c] whitespace-nowrap cursor-pointer"
              >
                Essential Only
              </button>
              <button
                type="button"
                onClick={() => setCookieConsent('accepted')}
                className="px-3 py-1.5 rounded bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-[#2a3544] bg-[#0b0f14] py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <AdSlot placement="footer" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Link to="/" aria-label={`${APP_CONFIG.appName} Home`} className="text-[#eef2f6] hover:text-[#e59a24] transition-colors">
                <Logo size="sm" />
              </Link>
              <p className="text-xs text-[#9aa7b8] mt-1">
                100% browser-side video clipping. Files never leave your device.
              </p>
            </div>

            <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#9aa7b8]">
              <Link to="/editor" className="hover:text-[#eef2f6] whitespace-nowrap">
                Editor
              </Link>
              <Link to="/templates" className="hover:text-[#eef2f6] whitespace-nowrap">
                Templates
              </Link>
              <Link to="/watermark-maker" className="hover:text-[#eef2f6] whitespace-nowrap">
                Watermark Maker
              </Link>
              <Link to="/guides" className="hover:text-[#eef2f6] whitespace-nowrap">
                Guides
              </Link>
              <Link to="/how-it-works" className="hover:text-[#eef2f6] whitespace-nowrap">
                How It Works
              </Link>
              <Link to="/about" className="hover:text-[#eef2f6] whitespace-nowrap">
                About
              </Link>
              <Link to="/privacy" className="hover:text-[#eef2f6] whitespace-nowrap">
                Privacy
              </Link>
              <Link to="/terms" className="hover:text-[#eef2f6] whitespace-nowrap">
                Terms
              </Link>
              <Link to="/contact" className="hover:text-[#eef2f6] whitespace-nowrap">
                Contact
              </Link>
              <button
                type="button"
                onClick={reopenCookieBanner}
                className="text-left hover:text-[#eef2f6] underline underline-offset-2 whitespace-nowrap cursor-pointer"
              >
                Cookie Settings
              </button>
            </nav>
          </div>

          <div className="border-t border-[#1c242e] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#6c7a8c]">
            <p>{APP_CONFIG.platformDisclaimer}</p>
            <p>© 2026 {APP_CONFIG.appName}. Client-side WebAssembly tool.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
