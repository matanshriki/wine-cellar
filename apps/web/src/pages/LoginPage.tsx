import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { toast } from '../lib/toast';
import { Footer } from '../components/Footer';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { trackAuth } from '../services/analytics';

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
        trackAuth.login(); // Track successful login
        toast.success(t('auth.welcome'));
      } else {
        // Ensure name is provided for signup
        if (!name.trim()) {
          toast.error(t('profile.complete.nameRequired'));
          setLoading(false);
          return;
        }
        await signUp(email, password, name.trim());
        trackAuth.signUp(); // Track successful signup
        toast.success(t('auth.accountCreated'));
      }
      navigate('/cellar');
    } catch (error: any) {
      toast.error(error.message || t('auth.authFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      await signInWithGoogle();
      trackAuth.login(); // Track Google sign-in (treated as login)
      // User will be redirected to Google, then back to the app
    } catch (error: any) {
      toast.error(error.message || 'Google sign-in failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 px-3 sm:px-4 py-8">
      <div className="max-w-md w-full">
        {/**
         * Language Switcher - Mobile Optimized
         * 
         * - Positioned absolutely in top corner
         * - Responsive positioning (top-3 on mobile, top-4 on desktop)
         * - RTL-aware (right-3 for LTR, left-3 for RTL via rtl: utilities)
         * - Above scrollable content on mobile
         */}
        <div className="fixed top-3 sm:top-4 right-3 sm:right-4 rtl:right-auto rtl:left-3 rtl:sm:left-4 z-50">
          <LanguageSwitcher />
        </div>

        {/**
         * Header - Mobile Responsive
         * 
         * - Responsive text sizes (text-3xl on mobile, text-4xl on desktop)
         * - Adequate spacing for mobile readability
         * - Maintains hierarchy on small screens
         */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 px-2">
            <span className="inline-block">🍷</span> {t('app.title')}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 px-2">{t('app.tagline')}</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.login.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
                placeholder={t('auth.login.emailPlaceholder')}
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.login.name')} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder={t('auth.login.namePlaceholder')}
                  required={!isLogin}
                  minLength={1}
                  maxLength={100}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.login.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
                placeholder={t('auth.login.passwordPlaceholder')}
                minLength={6}
              />
            </div>

            <button type="submit" disabled={loading} className="w-full btn btn-primary">
              {loading ? t('common.pleaseWait') : isLogin ? t('auth.login.signIn') : t('auth.login.createAccount')}
            </button>
          </form>

          {/**
           * Divider - "OR" separator
           * 
           * - Visual separation between login methods
           * - Clean, minimal design
           * - Responsive margins
           */}
          <div className="relative my-4 sm:my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">{t('auth.login.or')}</span>
            </div>
          </div>

          {/**
           * Google Sign-In Button
           * 
           * - Full width on mobile
           * - Minimum 44x44px touch target
           * - Google brand colors
           * - Icon + text layout
           * - RTL-aware spacing
           */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Google Logo SVG */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {isLogin ? t('auth.login.noAccount') : t('auth.login.hasAccount')}
            </button>
          </div>
        </div>
      </div>
      
      {/* Footer with Privacy Policy Link */}
      <Footer />
    </div>
  );
}

