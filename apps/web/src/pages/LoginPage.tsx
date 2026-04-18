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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 px-3 sm:px-4 py-8">
        <div className="max-w-md w-full">
          <div className="fixed top-3 sm:top-4 right-3 sm:right-4 rtl:right-auto rtl:left-3 rtl:sm:left-4 z-50">
            <LanguageSwitcher />
          </div>

          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 px-2">
              <span className="inline-block">🍷</span> {t('app.title')}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 px-2">{t('app.tagline')}</p>
          </div>

          <div className="card space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold text-gray-900">{t('auth.login.title')}</h2>
              <p className="text-sm text-gray-600">{t('auth.login.googleOnlySubtitle')}</p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
              <span className="text-sm sm:text-base">{t('auth.login.googleSignIn')}</span>
            </button>
          </div>

          <div className="mt-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span>© {new Date().getFullYear()} Sommi</span>
              <span>•</span>
              <a
                href="/privacy"
                className="underline hover:opacity-70 transition-opacity"
                style={{ color: 'var(--wine-600)' }}
              >
                Privacy Policy
              </a>
              <span>•</span>
              <a
                href="/terms"
                className="underline hover:opacity-70 transition-opacity"
                style={{ color: 'var(--wine-600)' }}
              >
                Terms &amp; Conditions
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
