/**
 * Museum View Modal
 * 
 * Premium full-screen bottle viewing experience.
 * Focus on the label image with elegant details overlay.
 * 
 * Features:
 * - Full-screen hero image
 * - Minimal info overlay (name, producer, vintage, chips)
 * - Close with X, Esc, or tap outside
 * - Smooth fade/scale animations
 * - Keyboard accessible
 * - Respects prefers-reduced-motion
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';

interface MuseumViewBottle {
  id: string;
  name: string;
  producer?: string;
  vintage?: number;
  style: 'red' | 'white' | 'rose' | 'sparkling';
  rating?: number;
  region?: string;
  grapes?: string;
  label_image_url?: string;
  /** AI-generated readiness label — takes priority over readiness_status when present */
  readiness_label?: 'READY' | 'HOLD' | 'PEAK_SOON';
  readiness_status?: 'TooYoung' | 'Approaching' | 'InWindow' | 'Peak' | 'PastPeak' | 'Unknown';
}

interface MuseumViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottle: MuseumViewBottle;
  onShowDetails?: () => void;
}

export function MuseumViewModal({ isOpen, onClose, bottle, onShowDetails }: MuseumViewModalProps) {
  const { t } = useTranslation();
  const reduceMotion = shouldReduceMotion();

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Lock body scroll
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Determine the readiness chip to show.
  // Priority: AI readiness_label > DB readiness_status.
  // This ensures the museum view always agrees with the card grid and the
  // full details modal, which both use the AI label when available.
  const getReadinessChip = (): { text: string; color: string } | null => {
    // AI label takes priority — use the same i18n keys as SommelierNotes/BottleCard
    if (bottle.readiness_label) {
      switch (bottle.readiness_label) {
        case 'READY':
          return { text: t('cellar.sommelier.status.ready', 'Ready to Drink'), color: 'bg-green-500/30 text-green-100' };
        case 'PEAK_SOON':
          return { text: t('cellar.sommelier.status.peak_soon', 'Peak Soon'), color: 'bg-yellow-500/30 text-yellow-100' };
        case 'HOLD':
          return { text: t('cellar.sommelier.status.hold', 'Hold for Aging'), color: 'bg-blue-500/30 text-blue-100' };
        default:
          return null;
      }
    }
    // Fall back to DB-computed readiness_status (no AI analysis yet)
    switch (bottle.readiness_status) {
      case 'InWindow':
      case 'Peak':
        return { text: t('readiness.readyNow', 'Ready Now'), color: 'bg-green-500/30 text-green-100' };
      case 'Approaching':
        return { text: t('readiness.peakSoon', 'Peak Soon'), color: 'bg-yellow-500/30 text-yellow-100' };
      case 'TooYoung':
        return { text: t('readiness.hold', 'Hold'), color: 'bg-blue-500/30 text-blue-100' };
      case 'PastPeak':
        return { text: t('readiness.pastPeak', 'Past Peak'), color: 'bg-orange-500/30 text-orange-100' };
      default:
        return null;
    }
  };

  const readiness = getReadinessChip();

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={reduceMotion ? false : { opacity: 1 }}
        exit={reduceMotion ? false : { opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[200]"
        style={{
          background: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          // Use dvh so the overlay covers the true visible area on iOS PWA
          height: '100dvh',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={bottle.name}
        onClick={onClose}
      >
        {/* Close Button (Top Right) */}
        <motion.button
          initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
          animate={reduceMotion ? false : { opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          onClick={onClose}
          className="absolute right-4 w-12 h-12 rounded-full flex items-center justify-center z-20"
          style={{
            top: 'max(16px, env(safe-area-inset-top, 16px))',
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
          aria-label={t('common.close', 'Close')}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>

        {/* Scrollable content — scrolls inside the modal, not the page */}
        <div
          className="h-full flex flex-col"
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
            paddingTop: 'max(72px, calc(env(safe-area-inset-top, 0px) + 64px))',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          } as React.CSSProperties}
          onClick={onClose}
        >
          {/* Hero Image — flex-1 so it fills remaining height naturally */}
          <motion.div
            initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
            animate={reduceMotion ? false : { scale: 1, opacity: 1 }}
            exit={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex-1 flex items-center justify-center px-4"
            style={{ minHeight: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {bottle.label_image_url ? (
              <img
                src={bottle.label_image_url}
                alt={bottle.name}
                className="max-h-full max-w-full object-contain rounded-lg"
                style={{
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
                }}
              />
            ) : (
              <div
                className="w-64 h-96 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
                }}
              >
                <svg className="w-32 h-32 text-white opacity-50" fill="none" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M6 2h12v2H6V2zm0 18c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6H6v14zM8 8h8v12H8V8z"
                  />
                </svg>
              </div>
            )}
          </motion.div>

          {/* Info section — fixed size, never pushes image off screen */}
          <motion.div
            initial={reduceMotion ? false : { y: 30, opacity: 0 }}
            animate={reduceMotion ? false : { y: 0, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', damping: 25 }}
            className="flex-shrink-0 px-4 pt-5 pb-2 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Name & Producer */}
            <h2
              className="text-2xl md:text-4xl font-bold text-white mb-1"
              style={{
                fontFamily: 'var(--font-display)',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
              }}
            >
              {bottle.name}
            </h2>

            {bottle.producer && (
              <p
                className="text-base md:text-2xl text-gray-300 mb-2"
                style={{
                  textShadow: '0 1px 5px rgba(0, 0, 0, 0.5)',
                }}
              >
                {bottle.producer}
              </p>
            )}

            {/* Chips */}
            <div className="flex justify-center gap-2 flex-wrap mt-3">
              {bottle.vintage && (
                <span
                  className="px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }}
                >
                  {bottle.vintage}
                </span>
              )}

              {readiness && (
                <span
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${readiness.color}`}
                  style={{
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  {readiness.text}
                </span>
              )}

              {bottle.region && (
                <span
                  className="px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  {bottle.region}
                </span>
              )}

              {bottle.grapes && (
                <span
                  className="px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  {bottle.grapes}
                </span>
              )}

              {bottle.rating && bottle.rating > 0 && (
                <span
                  className="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1"
                  style={{
                    background: 'rgba(212, 175, 55, 0.25)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: 'rgb(251, 191, 36)',
                    border: '1px solid rgba(212, 175, 55, 0.4)',
                  }}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {bottle.rating.toFixed(1)}
                </span>
              )}
            </div>
          </motion.div>

          {/* View Full Details Button */}
          {onShowDetails && (
            <motion.div
              initial={reduceMotion ? false : { y: 20, opacity: 0 }}
              animate={reduceMotion ? false : { y: 0, opacity: 1 }}
              transition={{ delay: 0.25, type: 'spring', damping: 25 }}
              className="flex-shrink-0 flex justify-center pt-3 pb-2 px-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  onShowDetails();
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {t('cellar.bottle.viewFullDetails', 'View Full Details')}
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
