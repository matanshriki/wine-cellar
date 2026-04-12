/**
 * Minimal chrome for public, indexable pages (landing, about, legal).
 * No cellar FAB, camera, or logged-in-only UI — keeps crawlers and guests focused.
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

export function PublicMarketingLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen" style={{ position: 'relative', overflow: 'visible' }}>
      <div className="luxury-background" aria-hidden="true" />
      <nav
        className="sticky top-0 z-40 safe-area-top border-b"
        style={{
          background: 'var(--bg-nav, rgba(255, 255, 255, 0.95))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between min-h-[3.5rem] gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold tracking-wide text-lg"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--wine-700)' }}
          >
            <svg
              className="w-7 h-7 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M6.5 3h11L16 11a4 4 0 01-8 0L6.5 3z" />
              <line x1="12" y1="15" x2="12" y2="20" />
              <path d="M9 20h6" />
            </svg>
            Sommi
          </Link>

          <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end text-sm">
            <Link
              to="/about"
              className="font-medium hidden sm:inline"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('nav.about')}
            </Link>
            <Link to="/privacy" className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              Privacy
            </Link>
            <Link to="/terms" className="font-medium hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>
              Terms
            </Link>
            <LanguageSwitcher />
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-full text-sm font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
              }}
            >
              {t('auth.login.signIn')}
            </Link>
          </div>
        </div>
      </nav>

      {children}

      <footer className="border-t mt-auto py-8 px-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-4 justify-between items-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
          <p>© {new Date().getFullYear()} Sommi</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/about" className="hover:underline">
              {t('nav.about')}
            </Link>
            <Link to="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link to="/terms" className="hover:underline">
              Terms
            </Link>
            <a href="/llms.txt" className="hover:underline">
              AI index
            </a>
            <a href="/sitemap.xml" className="hover:underline">
              Sitemap
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
