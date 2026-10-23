/**
 * Minimal chrome for public, indexable pages (landing, about, legal).
 * No cellar FAB, camera, or logged-in-only UI — keeps crawlers and guests focused.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { APP_ICON_URL } from '../constants/brandAssets';
import { trackPageView } from '../lib/metaPixel';

export function PublicMarketingLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isLanding = pathname === '/';
  const landingStickyClearance = isLanding;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    void trackPageView();
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div
      className={`min-h-screen ${isLanding ? 'landing-page' : ''}`}
      style={{ position: 'relative', overflow: 'visible' }}
    >
      {!isLanding ? <div className="luxury-background" aria-hidden="true" /> : null}
      <nav
        className={`sticky top-0 z-40 safe-area-top border-b ${isLanding ? 'landing-marketing-nav' : ''}`}
        style={
          isLanding
            ? undefined
            : {
                background: 'var(--bg-nav, rgba(255, 255, 255, 0.95))',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderColor: 'var(--border-subtle)',
              }
        }
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between min-h-[3.5rem] gap-3">
          <Link
            to="/"
            className={`flex items-center gap-2 ${isLanding ? 'lp-brand' : 'app-wordmark'}`}
            style={isLanding ? undefined : { color: 'var(--wine-700)' }}
          >
            <img
              src={APP_ICON_URL}
              alt=""
              width={28}
              height={28}
              className="w-7 h-7 flex-shrink-0 rounded-lg object-cover"
              aria-hidden="true"
              loading="eager"
              decoding="async"
            />
            Sommi
          </Link>

          <div className="hidden md:flex items-center gap-3 lg:gap-5 text-sm">
            {isLanding ? (
              <>
                <a href="#how-it-works" className="font-medium" style={{ color: 'var(--lp-stone)' }}>
                  {t('landing.navHow')}
                </a>
                <a href="#app-video" className="font-medium" style={{ color: 'var(--lp-stone)' }}>
                  {t('landing.navDemo')}
                </a>
                <a href="#faq" className="font-medium" style={{ color: 'var(--lp-stone)' }}>
                  {t('landing.navFaq')}
                </a>
              </>
            ) : (
              <Link to="/about" className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('nav.about')}
              </Link>
            )}
            <Link
              to="/privacy"
              className="font-medium hidden lg:inline"
              style={{ color: isLanding ? 'var(--lp-stone)' : 'var(--text-secondary)' }}
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="font-medium hidden lg:inline"
              style={{ color: isLanding ? 'var(--lp-stone)' : 'var(--text-secondary)' }}
            >
              Terms
            </Link>
            <LanguageSwitcher />
            <Link
              to="/login"
              className={isLanding ? 'lp-cta-primary !min-h-[40px] !py-2 !px-4 !text-sm' : ''}
              style={
                isLanding
                  ? undefined
                  : {
                      padding: '0.375rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#fff',
                      background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                    }
              }
            >
              {t('auth.login.signIn')}
            </Link>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border"
              style={{
                borderColor: 'rgba(74, 23, 34, 0.15)',
                color: isLanding ? 'var(--lp-burgundy)' : 'var(--wine-700)',
              }}
              aria-expanded={mobileOpen}
              aria-controls="marketing-mobile-menu"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((o) => !o)}
            >
              <span className="sr-only">{mobileOpen ? 'Close' : 'Menu'}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                {mobileOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div
            id="marketing-mobile-menu"
            className="md:hidden border-t px-4 py-3 flex flex-col gap-1"
            style={{
              borderColor: 'rgba(74, 23, 34, 0.08)',
              background: isLanding ? 'rgba(247, 241, 232, 0.98)' : 'var(--bg-nav, #fff)',
            }}
          >
            {isLanding ? (
              <>
                <a
                  href="#how-it-works"
                  className="py-3 font-medium"
                  style={{ color: 'var(--lp-ink)' }}
                  onClick={() => setMobileOpen(false)}
                >
                  {t('landing.navHow')}
                </a>
                <a
                  href="#app-video"
                  className="py-3 font-medium"
                  style={{ color: 'var(--lp-ink)' }}
                  onClick={() => setMobileOpen(false)}
                >
                  {t('landing.navDemo')}
                </a>
                <a
                  href="#faq"
                  className="py-3 font-medium"
                  style={{ color: 'var(--lp-ink)' }}
                  onClick={() => setMobileOpen(false)}
                >
                  {t('landing.navFaq')}
                </a>
              </>
            ) : (
              <Link to="/about" className="py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                {t('nav.about')}
              </Link>
            )}
            <Link to="/privacy" className="py-3 font-medium" style={{ color: isLanding ? 'var(--lp-ink)' : 'var(--text-primary)' }}>
              Privacy
            </Link>
            <Link to="/terms" className="py-3 font-medium" style={{ color: isLanding ? 'var(--lp-ink)' : 'var(--text-primary)' }}>
              Terms
            </Link>
            <Link
              to="/login"
              className={`mt-2 text-center ${isLanding ? 'lp-cta-primary' : ''}`}
              style={
                isLanding
                  ? undefined
                  : {
                      padding: '0.75rem',
                      borderRadius: '9999px',
                      fontWeight: 600,
                      color: '#fff',
                      background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                    }
              }
              onClick={() => setMobileOpen(false)}
            >
              {t('auth.login.signIn')}
            </Link>
          </div>
        ) : null}
      </nav>

      {children}

      <footer
        className={`border-t mt-auto px-4 pt-8 ${landingStickyClearance ? 'pb-28 md:pb-8' : 'pb-8'}`}
        style={{
          borderColor: isLanding ? 'rgba(74, 23, 34, 0.1)' : 'var(--border-subtle)',
          background: isLanding ? 'var(--lp-ivory-deep)' : undefined,
          color: isLanding ? 'var(--lp-stone-muted)' : 'var(--text-tertiary)',
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-4 justify-between items-center text-sm">
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
          </div>
        </div>
        <div className="sr-only">
          <a href="/llms.txt">AI index</a>
          <a href="/sitemap.xml">Sitemap</a>
        </div>
      </footer>
    </div>
  );
}
