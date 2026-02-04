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
  readiness_status?: 'TooYoung' | 'Approaching' | 'InWindow' | 'Peak' | 'PastPeak' | 'Unknown';
}

interface MuseumViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottle: MuseumViewBottle;
}

export function MuseumViewModal({ isOpen, onClose, bottle }: MuseumViewModalProps) {
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

  // Get readiness label
  const getReadinessLabel = (status?: string) => {
    switch (status) {
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

  const readiness = getReadinessLabel(bottle.readiness_status);

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={reduceMotion ? false : { opacity: 1 }}
        exit={reduceMotion ? false : { opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{
          background: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        onClick={onClose}
      >
        {/* Close Button (Top Right) */}
        <motion.button
          initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
          animate={reduceMotion ? false : { opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          onClick={onClose}
          className="absolute top-4 right-4 w-12 h-12 rounded-full flex items-center justify-center z-10 safe-area-inset-top"
          style={{
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

        {/* Content Container */}
        <div
          className="relative w-full max-w-4xl max-h-full flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hero Image */}
          <motion.div
            initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
            animate={reduceMotion ? false : { scale: 1, opacity: 1 }}
            exit={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative flex items-center justify-center"
            style={{ maxHeight: '70vh' }}
          >
            {bottle.label_image_url ? (
              <img
                src={bottle.label_image_url}
                alt={bottle.name}
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
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

          {/* Info Overlay (Bottom) */}
          <motion.div
            initial={reduceMotion ? false : { y: 30, opacity: 0 }}
            animate={reduceMotion ? false : { y: 0, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', damping: 25 }}
            className="mt-8 text-center safe-area-inset-bottom"
          >
            {/* Name & Producer */}
            <h2
              className="text-3xl md:text-4xl font-bold text-white mb-2"
              style={{
                fontFamily: 'var(--font-display)',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
              }}
            >
              {bottle.name}
            </h2>

            {bottle.producer && (
              <p
                className="text-xl md:text-2xl text-gray-300 mb-4"
                style={{
                  textShadow: '0 1px 5px rgba(0, 0, 0, 0.5)',
                }}
              >
                {bottle.producer}
              </p>
            )}

            {/* Chips */}
            <div className="flex justify-center gap-2 flex-wrap mt-6">
              {/* Vintage */}
              {bottle.vintage && (
                <span
                  className="px-4 py-2 rounded-full text-sm font-medium"
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

              {/* Readiness Status */}
              {readiness && (
                <span
                  className={`px-4 py-2 rounded-full text-sm font-medium ${readiness.color}`}
                  style={{
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  {readiness.text}
                </span>
              )}

              {/* Region */}
              {bottle.region && (
                <span
                  className="px-4 py-2 rounded-full text-sm font-medium"
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

              {/* Grape */}
              {bottle.grapes && (
                <span
                  className="px-4 py-2 rounded-full text-sm font-medium"
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

              {/* Rating */}
              {bottle.rating && bottle.rating > 0 && (
                <span
                  className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1"
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
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
