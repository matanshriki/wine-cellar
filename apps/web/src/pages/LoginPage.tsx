import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { toast } from '../lib/toast';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { trackAuth } from '../services/analytics';
import { MetaHead } from '../components/MetaHead';

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle } = useAuth();
  const { t } = useTranslation();

  async function handleGoogleSignIn() {
    try {
      setLoading(true);
      await signInWithGoogle();
      trackAuth.login();
      // OAuth redirect — user leaves this page
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google sign-in failed';
      toast.error(message);
      setLoading(false);
    }
  }

  return (
    <>
      <MetaHead
        title="Sign In"
        description="Sign in to Sommi — your AI sommelier for your cellar, pairings, and what to open next."
        url="/login"
        noIndex
      />
      <div className="app-login-hero relative min-h-[100dvh] overflow-hidden flex flex-col">
        <img
          src="/assets/app/login-welcome.jpg"
          alt=""
          aria-hidden
          className="app-login-art hidden lg:block"
        />
        <div className="app-login-wash pointer-events-none absolute inset-0 hidden lg:block" aria-hidden />

        <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6">
          <a href="/" className="rounded-full">
            <bdi
              className="text-2xl font-semibold tracking-tight"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-text)' }}
            >
              Sommi.
            </bdi>
          </a>
          <LanguageSwitcher variant="pill" />
        </header>

        <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-10 sm:px-6 lg:py-16">
          <div className="w-full max-w-md">
            <p className="app-eyebrow mb-3">{t('auth.login.eyebrow')}</p>
            <h1 className="app-display text-4xl sm:text-5xl">{t('auth.login.heroTitle')}</h1>
            <p className="mt-4 text-base sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t('auth.login.heroBody')}
            </p>

            <div className="app-card mt-8 space-y-4 p-6 sm:p-7">
              <div className="space-y-1">
                <h2 className="app-section-title">{t('auth.login.title')}</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('auth.login.googleOnlySubtitle')}
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                aria-busy={loading}
                className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-full min-h-[48px] font-medium transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-heading)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-sm sm:text-base">
                  {loading ? t('auth.login.signingIn') : t('auth.login.googleSignIn')}
                </span>
              </button>

              <p className="text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('auth.login.reassurance')}
              </p>
            </div>

            <nav
              className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <span>
                © {new Date().getFullYear()} <bdi>Sommi</bdi>
              </span>
              <span aria-hidden>·</span>
              <a href="/privacy" className="app-link">
                {t('auth.login.privacy')}
              </a>
              <span aria-hidden>·</span>
              <a href="/terms" className="app-link">
                {t('auth.login.terms')}
              </a>
            </nav>
          </div>
        </main>

        <img
          src="/assets/app/login-welcome.jpg"
          alt=""
          aria-hidden
          className="app-login-art lg:hidden"
        />
      </div>
    </>
  );
}
