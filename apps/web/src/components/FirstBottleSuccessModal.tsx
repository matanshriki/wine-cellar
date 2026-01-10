/**
 * First Bottle Success Modal - Onboarding v1 – value first
 * 
 * Celebrates when user adds their first bottle.
 * Closes the value loop and encourages continued engagement.
 * 
 * DEV MODE ONLY
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface FirstBottleSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottleName?: string;
}

export function FirstBottleSuccessModal({
  isOpen,
  onClose,
  bottleName = 'your wine',
}: FirstBottleSuccessModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

  // Onboarding v1 – value first: Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Onboarding v1 – value first: Auto-dismiss after 3 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

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
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 30 }}
            transition={{
              type: 'spring',
              damping: 20,
              stiffness: 300,
            }}
            className="luxury-card relative max-w-md w-full p-6 sm:p-8 shadow-xl text-center"
          >
            {/* Success icon with animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: 'spring',
                damping: 10,
                stiffness: 200,
                delay: 0.1,
              }}
              className="mx-auto w-20 h-20 rounded-full mb-6 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                boxShadow: '0 8px 24px rgba(139, 21, 56, 0.3)',
              }}
            >
              <motion.div
                initial={{ rotate: -180, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="text-4xl"
              >
                ✓
              </motion.div>
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="text-2xl sm:text-3xl font-bold mb-3"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 'var(--font-bold)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('onboarding.firstBottle.title')}
            </motion.h2>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="text-base mb-6"
              style={{
                color: 'var(--text-secondary)',
                lineHeight: '1.6',
              }}
            >
              {t('onboarding.firstBottle.message')}
            </motion.p>

            {/* Close button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              onClick={onClose}
              className="w-full py-4 px-6 rounded-xl font-semibold text-base sm:text-lg transition-all min-h-[52px] sm:min-h-[56px]"
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
              {t('onboarding.firstBottle.button')}
            </motion.button>

            {/* Auto-dismiss indicator */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              className="mt-4 text-xs"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('onboarding.firstBottle.closing')}
            </motion.p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

