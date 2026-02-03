/**
 * Camera Fallback Sheet
 * 
 * Luxury bottom sheet shown when:
 * - User cancels camera
 * - Camera permission denied
 * - Camera not available
 * 
 * Provides elegant fallback options:
 * - Try camera again
 * - Choose from photos (file picker)
 * - Enter manually
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useRef, useEffect } from 'react';

type FallbackReason = 'cancelled' | 'permission-denied' | 'not-available' | 'error';

interface CameraFallbackSheetProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: FallbackReason;
  onTryCamera: () => void;
  onChoosePhoto: (file: File) => void;
  onManualEntry: () => void;
}

export function CameraFallbackSheet({
  isOpen,
  onClose,
  reason = 'cancelled',
  onTryCamera,
  onChoosePhoto,
  onManualEntry,
}: CameraFallbackSheetProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Log when fallback sheet opens
  useEffect(() => {
    if (isOpen) {
      console.log('[CameraFallbackSheet] Opened with reason:', reason);
    }
  }, [isOpen, reason]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('[CameraFallbackSheet] Photo selected from library:', file.name);
      onChoosePhoto(file);
      // Reset input
      e.target.value = '';
    }
  };

  // Hint message based on reason
  const getHintMessage = () => {
    switch (reason) {
      case 'permission-denied':
        return t('cellar.camera.permissionDenied', 'Camera access is blocked. You can allow it in Settings or choose a photo.');
      case 'not-available':
        return t('cellar.camera.notAvailable', 'Camera is not available. You can choose a photo from your library.');
      case 'error':
        return t('cellar.camera.error', 'Unable to open camera. Please try again or choose a photo.');
      default:
        return null;
    }
  };

  const hintMessage = getHintMessage();

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60]"
            style={{
              background: 'var(--bg-overlay)',
              backdropFilter: 'var(--blur-medium)',
              WebkitBackdropFilter: 'var(--blur-medium)',
            }}
            onClick={onClose}
          />

          {/* Bottom Sheet - Luxury Pill */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ 
              type: 'spring', 
              damping: 30, 
              stiffness: 300,
              mass: 0.8,
            }}
            onClick={(e) => e.stopPropagation()}
            className="fixed left-0 right-0 z-[70] bottom-above-nav md:bottom-0"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              boxShadow: '0 -4px 32px rgba(0, 0, 0, 0.12), 0 -2px 16px rgba(0, 0, 0, 0.08)',
              borderTopLeftRadius: 'var(--radius-2xl)',
              borderTopRightRadius: 'var(--radius-2xl)',
              borderBottom: 'none',
              maxHeight: '60vh',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div 
                className="w-12 h-1 rounded-full"
                style={{ backgroundColor: 'var(--border-medium)' }}
              />
            </div>

            {/* Content */}
            <div className="px-6 pb-6 safe-area-inset-bottom">
              {/* Title */}
              <h3 
                className="text-xl font-bold mb-2 text-center"
                style={{ 
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {t('cellar.camera.fallbackTitle', 'Add a Bottle')}
              </h3>

              {/* Hint (if permission issue or error) */}
              {hintMessage && (
                <p 
                  className="text-sm mb-6 text-center px-4"
                  style={{ 
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5',
                  }}
                >
                  {hintMessage}
                </p>
              )}

              {/* Options */}
              <div className="space-y-3 mt-6">
                {/* Try Camera (primary) */}
                <motion.button
                  onClick={() => {
                    console.log('[CameraFallbackSheet] User selected: Scan Bottles (try camera again)');
                    onTryCamera();
                  }}
                  className="w-full p-4 rounded-xl flex items-center gap-4"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                    border: '1px solid var(--wine-700)',
                    color: 'var(--text-inverse)',
                    boxShadow: 'var(--shadow-sm)',
                    minHeight: '56px',
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <svg className="w-7 h-7 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="flex-1 text-start">
                    <div className="font-semibold text-lg">
                      {t('cellar.camera.scanBottles', 'Scan Bottles')}
                    </div>
                  </div>
                  <svg className="w-5 h-5 flex-shrink-0 flip-rtl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>

                {/* Choose from Photos (secondary, only if permission issue or cancelled) */}
                <label
                  className="w-full p-4 rounded-xl flex items-center gap-4 cursor-pointer"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    boxShadow: 'var(--shadow-xs)',
                    minHeight: '56px',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-label={t('cellar.camera.choosePhoto', 'Choose from Photos')}
                  />
                  <svg className="w-7 h-7 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="flex-1 text-start">
                    <div className="font-semibold">
                      {t('cellar.camera.choosePhoto', 'Choose from Photos')}
                    </div>
                  </div>
                  <svg className="w-5 h-5 flex-shrink-0 flip-rtl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </label>

                {/* Manual Entry */}
                <motion.button
                  onClick={() => {
                    console.log('[CameraFallbackSheet] User selected: Enter Manually');
                    onManualEntry();
                  }}
                  className="w-full p-4 rounded-xl flex items-center gap-4"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    boxShadow: 'var(--shadow-xs)',
                    minHeight: '56px',
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <svg className="w-7 h-7 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <div className="flex-1 text-start">
                    <div className="font-semibold">
                      {t('cellar.addBottle.manualEntry', 'Enter Manually')}
                    </div>
                  </div>
                  <svg className="w-5 h-5 flex-shrink-0 flip-rtl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>
              </div>

              {/* Cancel */}
              <button
                onClick={onClose}
                className="w-full text-center text-sm mt-6 py-3"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
