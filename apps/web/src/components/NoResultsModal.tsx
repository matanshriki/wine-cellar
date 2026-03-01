/**
 * NoResultsModal Component
 * 
 * A luxury modal for displaying "no results" messages.
 * Used when recommendation filters return no matching wines.
 * 
 * Features:
 * - Elegant wine-themed design
 * - Animated entrance
 * - Accessible (focus trap, ESC key, click outside)
 * - i18n support
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Wine, Search, ArrowLeft } from 'lucide-react';

interface NoResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  suggestion?: string;
  icon?: 'wine' | 'search';
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function NoResultsModal({
  isOpen,
  onClose,
  title,
  message,
  suggestion,
  icon = 'wine',
  primaryAction,
  secondaryAction,
}: NoResultsModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  // Focus trap
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

  const IconComponent = icon === 'wine' ? Wine : Search;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-results-title"
          aria-describedby="no-results-description"
          style={{ height: '100dvh' }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-3xl shadow-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, var(--color-stone-50) 0%, white 100%)',
                border: '1px solid var(--color-stone-200)',
              }}
            >
              {/* Top decorative bar */}
              <div
                className="h-1.5"
                style={{
                  background: 'linear-gradient(90deg, var(--color-wine-400), var(--color-wine-600), var(--color-wine-400))',
                }}
              />

              <div className="p-6 sm:p-8">
                {/* Icon */}
                <div className="flex justify-center mb-5">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-wine-50) 0%, var(--color-wine-100) 100%)',
                      border: '1px solid var(--color-wine-200)',
                    }}
                  >
                    <IconComponent
                      className="w-8 h-8"
                      strokeWidth={1.5}
                      style={{ color: 'var(--color-wine-500)' }}
                    />
                  </div>
                </div>

                {/* Title */}
                <h2
                  id="no-results-title"
                  className="text-xl sm:text-2xl font-bold text-center mb-3"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: 'var(--color-stone-900)',
                  }}
                >
                  {title || t('recommendation.noResults.title', 'No Matches Found')}
                </h2>

                {/* Message */}
                <p
                  id="no-results-description"
                  className="text-center text-sm sm:text-base mb-4"
                  style={{ color: 'var(--color-stone-600)' }}
                >
                  {message || t('recommendation.noResults.message', "We couldn't find wines matching your preferences.")}
                </p>

                {/* Suggestion */}
                {suggestion && (
                  <div
                    className="text-center text-sm px-4 py-3 rounded-xl mb-6"
                    style={{
                      backgroundColor: 'var(--color-wine-50)',
                      color: 'var(--color-wine-700)',
                      border: '1px solid var(--color-wine-100)',
                    }}
                  >
                    💡 {suggestion}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 mt-6">
                  {primaryAction && (
                    <button
                      onClick={primaryAction.onClick}
                      className="w-full py-3.5 px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, var(--color-wine-500) 0%, var(--color-wine-600) 100%)',
                        boxShadow: '0 4px 14px rgba(139, 35, 50, 0.25)',
                      }}
                    >
                      {primaryAction.label}
                    </button>
                  )}
                  
                  {secondaryAction && (
                    <button
                      onClick={secondaryAction.onClick}
                      className="w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2"
                      style={{
                        color: 'var(--color-stone-600)',
                        backgroundColor: 'var(--color-stone-100)',
                        border: '1px solid var(--color-stone-200)',
                      }}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {secondaryAction.label}
                    </button>
                  )}

                  {!primaryAction && !secondaryAction && (
                    <button
                      onClick={onClose}
                      className="w-full py-3.5 px-6 rounded-xl font-semibold text-white transition-all duration-200"
                      style={{
                        background: 'linear-gradient(135deg, var(--color-wine-500) 0%, var(--color-wine-600) 100%)',
                        boxShadow: '0 4px 14px rgba(139, 35, 50, 0.25)',
                      }}
                    >
                      {t('common.gotIt', 'Got It')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
