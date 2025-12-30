/**
 * Cookie Consent Banner
 * 
 * GDPR & CCPA compliant cookie consent
 * - Shows on first visit
 * - Luxury design matching wine app aesthetic
 * - Mobile-first, responsive
 * - Stores consent in database + localStorage
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { supabase } from '../lib/supabase';
import { initializeAnalytics } from '../services/analytics';

export function CookieConsent() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkConsentStatus();
  }, [user]);

  async function checkConsentStatus() {
    if (!user) {
      // For non-logged-in users, check localStorage
      const localConsent = localStorage.getItem('cookie_consent');
      if (!localConsent) {
        setShowBanner(true);
      }
      return;
    }

    // For logged-in users, check database
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('cookie_consent_given')
        .eq('id', user.id)
        .single();

      // If consent hasn't been given/rejected yet (NULL), show banner
      if (profile && profile.cookie_consent_given === null) {
        setShowBanner(true);
      }
    } catch (error) {
      console.error('[CookieConsent] Error checking consent:', error);
      // Show banner if we can't determine status
      setShowBanner(true);
    }
  }

  async function handleAccept() {
    setIsLoading(true);
    
    try {
      const consentData = {
        cookie_consent_given: true,
        cookie_consent_date: new Date().toISOString(),
        analytics_enabled: true,
      };

      // Save to localStorage for quick access
      localStorage.setItem('cookie_consent', 'accepted');
      localStorage.setItem('analytics_enabled', 'true');

      // Save to database if user is logged in
      if (user) {
        await supabase
          .from('profiles')
          .update(consentData)
          .eq('id', user.id);
      }

      // Initialize analytics now that consent is given
      initializeAnalytics();

      setShowBanner(false);
    } catch (error) {
      console.error('[CookieConsent] Error saving consent:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReject() {
    setIsLoading(true);
    
    try {
      const consentData = {
        cookie_consent_given: false,
        cookie_consent_date: new Date().toISOString(),
        analytics_enabled: false,
      };

      // Save to localStorage
      localStorage.setItem('cookie_consent', 'rejected');
      localStorage.setItem('analytics_enabled', 'false');

      // Save to database if user is logged in
      if (user) {
        await supabase
          .from('profiles')
          .update(consentData)
          .eq('id', user.id);
      }

      setShowBanner(false);
    } catch (error) {
      console.error('[CookieConsent] Error saving rejection:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 pb-safe"
          style={{
            paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 1rem))',
          }}
        >
          <div
            className="luxury-card max-w-2xl mx-auto"
            style={{
              background: 'linear-gradient(135deg, var(--color-wine-50) 0%, var(--color-stone-50) 100%)',
              border: '2px solid var(--color-wine-200)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            {/* Header with Icon */}
            <div className="flex items-start gap-3 sm:gap-4 mb-4">
              <div
                className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, var(--color-wine-500) 0%, var(--color-wine-600) 100%)',
                  boxShadow: '0 4px 6px -1px rgba(139, 58, 71, 0.3)',
                }}
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 5a1 1 0 012 0v4a1 1 0 11-2 0V5zm1 8a1 1 0 100-2 1 1 0 000 2z" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <h3 
                  className="text-base sm:text-lg font-bold mb-2"
                  style={{ 
                    fontFamily: 'var(--font-display)',
                    color: 'var(--color-stone-900)'
                  }}
                >
                  {t('cookieConsent.title', '🍷 We Value Your Privacy')}
                </h3>
                <p 
                  className="text-sm sm:text-base leading-relaxed mb-3"
                  style={{ color: 'var(--color-stone-700)' }}
                >
                  {t('cookieConsent.description', 'We use cookies and analytics to improve your wine cellar experience. Your data helps us make the app better for everyone.')}
                </p>

                {/* What We Track */}
                <div 
                  className="p-3 rounded-lg mb-3"
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.7)',
                    border: '1px solid var(--color-wine-200)',
                  }}
                >
                  <p className="text-xs sm:text-sm font-medium mb-2" style={{ color: 'var(--color-stone-900)' }}>
                    {t('cookieConsent.whatWeTrack', 'What we track:')}
                  </p>
                  <ul className="text-xs sm:text-sm space-y-1" style={{ color: 'var(--color-stone-600)' }}>
                    <li className="flex items-start gap-2">
                      <span style={{ color: 'var(--color-wine-500)' }}>✓</span>
                      <span>{t('cookieConsent.track1', 'How you use the app (page views, features clicked)')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span style={{ color: 'var(--color-wine-500)' }}>✓</span>
                      <span>{t('cookieConsent.track2', 'Performance and errors (to fix issues faster)')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span style={{ color: 'var(--color-wine-500)' }}>✗</span>
                      <span className="font-medium">{t('cookieConsent.noTrack', 'We NEVER track: emails, wine names, tasting notes, or personal data')}</span>
                    </li>
                  </ul>
                </div>

                {/* Privacy Policy Link */}
                <p className="text-xs" style={{ color: 'var(--color-stone-500)' }}>
                  {t('cookieConsent.learnMore', 'Learn more in our')}{' '}
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                    style={{ color: 'var(--color-wine-600)' }}
                  >
                    {t('cookieConsent.privacyPolicy', 'Privacy Policy')}
                  </a>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleReject}
                disabled={isLoading}
                className="flex-1 px-4 py-3 rounded-lg font-medium text-sm sm:text-base transition-all"
                style={{
                  background: 'white',
                  color: 'var(--color-stone-700)',
                  border: '1px solid var(--color-stone-300)',
                  minHeight: '44px',
                  touchAction: 'manipulation',
                }}
              >
                {t('cookieConsent.reject', 'No Thanks')}
              </button>
              <button
                onClick={handleAccept}
                disabled={isLoading}
                className="flex-1 px-4 py-3 rounded-lg font-medium text-sm sm:text-base transition-all"
                style={{
                  background: 'linear-gradient(135deg, var(--color-wine-500) 0%, var(--color-wine-600) 100%)',
                  color: 'white',
                  border: 'none',
                  minHeight: '44px',
                  touchAction: 'manipulation',
                  boxShadow: '0 4px 6px -1px rgba(139, 58, 71, 0.3)',
                }}
              >
                {isLoading ? (
                  t('common.loading', 'Loading...')
                ) : (
                  <>
                    <span className="mr-2">✓</span>
                    {t('cookieConsent.accept', 'Accept & Continue')}
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

