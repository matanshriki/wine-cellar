/**
 * CelebrationModal Component
 * 
 * A polished modal with confetti animation for celebrating successful actions.
 * Used when marking a bottle as opened.
 * 
 * Features:
 * - Confetti animation (respects prefers-reduced-motion)
 * - i18n support (EN/HE)
 * - RTL-aware
 * - Accessible (focus trap, ESC key, click outside)
 * - Primary and secondary actions
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottleName: string;
  onViewHistory?: () => void;
}

export function CelebrationModal({
  isOpen,
  onClose,
  bottleName,
  onViewHistory,
}: CelebrationModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const confettiTriggered = useRef(false);

  /**
   * Trigger confetti animation
   * Respects prefers-reduced-motion for accessibility
   */
  const triggerConfetti = () => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
      // Skip animation if user prefers reduced motion
      return;
    }

    // Fire confetti from multiple angles for better effect
    const duration = 1500;
    const animationEnd = Date.now() + duration;
    const defaults = { 
      startVelocity: 30, 
      spread: 360, 
      ticks: 60, 
      zIndex: 9999,
      colors: ['#a24c68', '#883d56', '#e0b7c5', '#cd8ca1'] // Wine cellar theme colors
    };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Fire from left and right
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  /**
   * Trigger confetti when modal opens
   */
  useEffect(() => {
    if (isOpen && !confettiTriggered.current) {
      console.log('[CelebrationModal] Opening, will trigger confetti');
      // Small delay to let modal render first
      setTimeout(() => {
        triggerConfetti();
        confettiTriggered.current = true;
      }, 100);
    }

    // Reset when modal closes
    if (!isOpen) {
      confettiTriggered.current = false;
    }
  }, [isOpen]);

  /**
   * Handle ESC key and scroll lock
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      // Store original overflow before locking
      const originalOverflow = document.body.style.overflow;
      
      // Lock scroll
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);

      // Cleanup: ALWAYS restore scroll when modal closes or unmounts
      return () => {
        document.body.style.overflow = originalOverflow || '';
        document.removeEventListener('keydown', handleEscape);
      };
    }

    // No cleanup needed when modal is not open
  }, [isOpen, onClose]);

  /**
   * Focus trap - keep focus within modal
   */
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 ios-modal-scroll"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      aria-describedby="celebration-description"
      style={{
        height: '100vh',
        height: '100dvh',
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-fadeIn touch-scroll safe-area-inset-bottom"
        style={{
          maxHeight: 'calc(100vh - 2rem)',
          maxHeight: 'calc(100dvh - 2rem)',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2
          id="celebration-title"
          className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-3"
        >
          {t('celebration.title')} 🍷
        </h2>

        {/* Message */}
        <p
          id="celebration-description"
          className="text-center text-gray-600 mb-2 text-sm sm:text-base"
        >
          {t('celebration.message')}
        </p>

        {/* Bottle Name (not translated - actual wine name) */}
        <p className="text-center font-semibold text-gray-900 mb-6 text-base sm:text-lg">
          "{bottleName}"
        </p>

        {/* Encouragement Text */}
        <p className="text-center text-gray-500 text-sm mb-6">
          {t('celebration.enjoy')}
        </p>

        {/* Actions */}
        <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
          {onViewHistory && (
            <button
              onClick={onViewHistory}
              className="flex-1 btn btn-secondary text-sm sm:text-base"
              aria-label={t('celebration.viewHistory')}
            >
              {t('celebration.viewHistory')}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 btn btn-primary text-sm sm:text-base"
            aria-label={t('celebration.close')}
          >
            {t('celebration.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

