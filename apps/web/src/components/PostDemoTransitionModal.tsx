import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface PostDemoTransitionModalProps {
  isOpen: boolean;
  onScanBottle: () => void;
  onAddManually: () => void;
  onSkip: () => void;
}

const FEATURE_ICONS = ['🧠', '🌙', '📊'] as const;

export function PostDemoTransitionModal({
  isOpen,
  onScanBottle,
  onAddManually,
  onSkip,
}: PostDemoTransitionModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onSkip]);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      const btn = modalRef.current.querySelector<HTMLElement>('button');
      btn?.focus();
    }
  }, [isOpen]);

  const featureKeys = ['ai', 'tonight', 'cellar'] as const;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-[1070] ios-modal-scroll"
          role="dialog"
          aria-modal="true"
          style={{
            height: '100dvh',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            onClick={onSkip}
          />

          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative max-w-md w-full shadow-2xl touch-scroll safe-area-inset-bottom max-h-mobile-modal overflow-y-auto rounded-2xl"
            style={{
              background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-secondary) 100%)',
              border: '1px solid var(--wine-200)',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* Decorative top accent */}
            <div
              style={{
                height: '4px',
                background: 'linear-gradient(90deg, var(--wine-400), var(--wine-600), var(--wine-400))',
                borderRadius: '2px 2px 0 0',
              }}
            />

            <div className="p-6 sm:p-8">
              {/* Wine glass with glow */}
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 12 }}
                className="text-center mb-5"
              >
                <div
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full text-5xl"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-100), var(--wine-200))',
                    boxShadow: '0 0 40px rgba(139, 21, 56, 0.15), 0 0 80px rgba(139, 21, 56, 0.08)',
                  }}
                >
                  🍷
                </div>
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="text-2xl sm:text-3xl font-bold text-center mb-2"
                style={{
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 'var(--font-bold)',
                  letterSpacing: '-0.02em',
                }}
              >
                {t('onboarding.postDemo.title')}
              </motion.h2>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-center text-base mb-6"
                style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}
              >
                {t('onboarding.postDemo.subtitle')}
              </motion.p>

              {/* Feature preview cards */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="space-y-2.5 mb-6"
              >
                {featureKeys.map((key, i) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.3 }}
                    className="flex items-center gap-3.5 p-3.5 rounded-xl"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-base)',
                    }}
                  >
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                      style={{
                        background: 'linear-gradient(135deg, var(--wine-50), var(--wine-100))',
                        border: '1px solid var(--wine-200)',
                      }}
                    >
                      {FEATURE_ICONS[i]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {t(`onboarding.postDemo.features.${key}.title`)}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {t(`onboarding.postDemo.features.${key}.desc`)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Primary CTA: Scan */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                onClick={onScanBottle}
                className="w-full py-4 px-6 rounded-xl font-semibold text-base sm:text-lg mb-3 transition-all min-h-[52px] sm:min-h-[56px] flex items-center justify-center gap-2.5"
                style={{
                  background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                  color: 'var(--text-inverse)',
                  border: '1px solid var(--wine-700)',
                  boxShadow: '0 8px 24px rgba(139, 21, 56, 0.25)',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(139, 21, 56, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(139, 21, 56, 0.25)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                {t('onboarding.postDemo.scanCta')}
              </motion.button>

              {/* Secondary CTA: Add manually */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.3 }}
                onClick={onAddManually}
                className="w-full py-3 px-6 rounded-xl font-medium text-sm sm:text-base mb-2 transition-all min-h-[48px]"
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
                {t('onboarding.postDemo.addManuallyCta')}
              </motion.button>

              {/* Skip link */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.3 }}
                onClick={onSkip}
                className="w-full py-2 text-xs transition-all"
                style={{
                  color: 'var(--text-tertiary)',
                  background: 'transparent',
                  border: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {t('onboarding.postDemo.skipLink')}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
