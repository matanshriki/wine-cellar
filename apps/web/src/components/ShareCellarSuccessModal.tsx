/**
 * Centered confirmation after Share Cellar copies a link.
 */

import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { useDialogA11y } from '../hooks/useDialogA11y';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  shareLink: string;
  onPreview?: () => void;
}

export function ShareCellarSuccessModal({
  isOpen,
  onClose,
  shareLink,
  onPreview,
}: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useDialogA11y(dialogRef, isOpen, onClose, { initialFocusRef: closeRef });

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-cellar-success-title"
          style={{
            background: 'var(--bg-overlay)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-sm rounded-[1.5rem] p-6 sm:p-7 text-center shadow-[var(--shadow-modal)]"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}
              aria-hidden
            >
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2
              id="share-cellar-success-title"
              className="text-xl sm:text-2xl font-semibold mb-2"
              style={{
                color: 'var(--text-heading)',
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('cellar.shareCellar.linkCopiedTitle')}
            </h2>

            <p className="text-sm sm:text-base mb-5" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {t('cellar.shareCellar.linkCopiedDetail')}
            </p>

            <p
              className="mb-6 rounded-xl px-3 py-2.5 text-xs font-mono break-all text-start"
              style={{
                background: 'var(--bg-muted)',
                color: 'var(--text-tertiary)',
                border: '1px solid var(--border-subtle)',
              }}
              dir="ltr"
            >
              {shareLink}
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="w-full btn-luxury-primary min-h-[48px]"
              >
                {t('cellar.shareCellar.done')}
              </button>
              {onPreview && (
                <button
                  type="button"
                  onClick={onPreview}
                  className="w-full btn-luxury-secondary min-h-[48px]"
                >
                  {t('cellar.shareCellar.preview')}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
