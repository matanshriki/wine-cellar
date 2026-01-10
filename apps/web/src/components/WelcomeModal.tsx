/**
 * Welcome Modal - Onboarding v1 – production
 * 
 * First-time user welcome screen.
 * Offers to show demo or skip to empty cellar.
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface WelcomeModalProps {
  isOpen: boolean;
  onShowDemo: () => void;
  onSkip: () => void;
}

export function WelcomeModal({ isOpen, onShowDemo, onSkip }: WelcomeModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

  // Onboarding v1 – value first: Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onSkip();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onSkip]);

  // Onboarding v1 – value first: Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      firstElement?.focus();

      function handleTab(e: KeyboardEvent) {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement?.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement?.focus();
            e.preventDefault();
          }
        }
      }

      document.addEventListener('keydown', handleTab);
      return () => document.removeEventListener('keydown', handleTab);
    }
  }, [isOpen]);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-[1070] ios-modal-scroll"
          style={{
            height: '100dvh',
            background: 'var(--bg-overlay)',
            backdropFilter: 'var(--blur-lg)',
            WebkitBackdropFilter: 'var(--blur-lg)',
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            onClick={onSkip}
          />

          {/* Modal Content */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="luxury-card relative max-w-md w-full p-6 sm:p-8 shadow-xl touch-scroll safe-area-inset-bottom max-h-mobile-modal overflow-y-auto"
            style={{
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* Icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-center mb-6"
            >
              <div className="text-6xl mb-4">🍷</div>
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="text-2xl sm:text-3xl font-bold text-center mb-3"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 'var(--font-bold)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('onboarding.welcome.title')}
            </motion.h2>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="text-center text-base mb-8"
              style={{
                color: 'var(--text-secondary)',
                lineHeight: '1.6',
              }}
            >
              {t('onboarding.welcome.subtitle')}
            </motion.p>

            {/* Primary CTA */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              onClick={onShowDemo}
              className="w-full py-4 px-6 rounded-xl font-semibold text-base sm:text-lg mb-3 transition-all min-h-[52px] sm:min-h-[56px]"
              style={{
                background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                color: 'var(--text-inverse)',
                border: '1px solid var(--wine-700)',
                boxShadow: 'var(--shadow-lg)',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }}
            >
              {t('onboarding.welcome.showDemo')}
            </motion.button>

            {/* Secondary CTA */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              onClick={onSkip}
              className="w-full py-3 px-6 rounded-xl font-medium text-base transition-all min-h-[48px]"
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-base)',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.borderColor = 'var(--wine-200)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border-base)';
              }}
            >
            {t('onboarding.welcome.skip')}
          </motion.button>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

