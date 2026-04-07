/**
 * PurchaseSuccessModal
 *
 * A full-screen luxury overlay shown after a successful Paddle checkout.
 * Does NOT auto-dismiss — user must press the CTA button.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface Props {
  /** Whether the modal is visible */
  open: boolean;
  /** Credits purchased in this transaction */
  credits: number;
  /** Price paid in USD */
  price: number;
  /** Current effective balance after the purchase (null while the webhook is still processing) */
  newBalance: number | null;
  /** Called when the user dismisses the modal */
  onClose: () => void;
}

export function PurchaseSuccessModal({ open, credits, price, newBalance, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[9999]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ background: 'rgba(5,4,14,0.85)', backdropFilter: 'blur(12px)' }}
          />

          {/* Card */}
          <motion.div
            key="card"
            className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
            initial={{ opacity: 0, scale: 0.88, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28, mass: 0.9 }}
            // Prevent clicks on the backdrop from closing (user must press button)
          >
            <div
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border p-8 text-center"
              style={{
                background: 'linear-gradient(160deg, #16142a 0%, #0e0c1b 100%)',
                borderColor: 'rgba(255,255,255,0.08)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
              }}
            >
              {/* Ambient glow */}
              <div
                className="pointer-events-none absolute -top-16 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full opacity-40"
                style={{ background: 'radial-gradient(ellipse, #F59E0B 0%, transparent 70%)' }}
              />

              {/* Icon */}
              <div className="relative mb-5 flex justify-center">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.1) 100%)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    boxShadow: '0 0 24px rgba(245,158,11,0.25)',
                  }}
                >
                  ✦
                </div>
              </div>

              {/* Title */}
              <h2
                className="mb-1 text-xl font-bold tracking-tight text-white"
                style={{ fontFamily: 'var(--font-display, inherit)' }}
              >
                {t('purchaseSuccess.title')}
              </h2>
              <p className="mb-6 text-sm text-white/45">
                {t('purchaseSuccess.subtitle', { credits, price })}
              </p>

              {/* Credits badge */}
              <div
                className="mx-auto mb-6 inline-flex flex-col items-center rounded-2xl px-8 py-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.06) 100%)',
                  border: '1px solid rgba(245,158,11,0.2)',
                }}
              >
                <span
                  className="text-5xl font-bold tabular-nums"
                  style={{ color: '#F59E0B' }}
                >
                  +{credits}
                </span>
                <span className="mt-1 text-xs font-medium uppercase tracking-widest text-white/40">
                  {t('purchaseSuccess.creditsLabel')}
                </span>
              </div>

              {/* New balance */}
              <p className="mb-8 text-sm text-white/40">
                {newBalance !== null
                  ? t('purchaseSuccess.newBalance', { balance: newBalance })
                  : t('purchaseSuccess.balanceUpdating')}
              </p>

              {/* CTA */}
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl py-3 text-sm font-semibold tracking-wide text-white transition-all active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
                }}
              >
                {t('purchaseSuccess.cta')}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
