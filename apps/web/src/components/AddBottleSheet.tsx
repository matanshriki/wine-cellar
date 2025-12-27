/**
 * Add Bottle Options Sheet
 * 
 * Premium bottom sheet showing options for adding a bottle:
 * - Take/Upload photo (camera or gallery) - PRIMARY - includes AI label extraction
 * - Manual entry - SECONDARY
 */

import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface AddBottleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadPhoto: () => void;
  onManualEntry: () => void;
}

export function AddBottleSheet({
  isOpen,
  onClose,
  onUploadPhoto,
  onManualEntry,
}: AddBottleSheetProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />

          {/* Bottom Sheet - iOS optimized */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl ios-modal-scroll"
            style={{
              maxHeight: '80dvh',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div 
                className="w-12 h-1 rounded-full"
                style={{ backgroundColor: 'var(--color-stone-300)' }}
              />
            </div>

            {/* Content - scrollable with safe area */}
            <div className="px-6 pb-6 overflow-y-auto touch-scroll safe-area-inset-bottom">
              {/* Title */}
              <h2 
                className="text-2xl font-bold mb-6 text-center"
                style={{ 
                  color: 'var(--color-stone-900)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {t('cellar.addBottle.title')}
              </h2>

              {/* Options */}
              <div className="space-y-3">
                {/* PRIMARY: Take/Upload Photo (Camera + Gallery) */}
                <button
                  onClick={onUploadPhoto}
                  className="w-full p-5 rounded-xl transition-all flex items-center gap-4 min-h-[60px]"
                  style={{
                    backgroundColor: 'var(--color-wine-500)',
                    color: 'white',
                    boxShadow: 'var(--glow-wine)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-wine-600)';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-wine-500)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {/* Camera + Image Icon */}
                  <div className="relative w-8 h-8 flex-shrink-0">
                    <svg className="w-8 h-8 absolute" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-start">
                    <div className="font-semibold text-lg">
                      {t('cellar.addBottle.uploadPhoto')}
                    </div>
                    <div className="text-sm opacity-90 mt-0.5">
                      {t('cellar.addBottle.uploadPhotoDescNew')}
                    </div>
                  </div>
                  <svg className="w-5 h-5 flex-shrink-0 flip-rtl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* SECONDARY: Manual Entry */}
                <button
                  onClick={onManualEntry}
                  className="w-full p-5 rounded-xl transition-all flex items-center gap-4 min-h-[60px]"
                  style={{
                    backgroundColor: 'var(--color-stone-100)',
                    color: 'var(--color-stone-800)',
                    border: '2px solid var(--color-stone-200)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-stone-200)';
                    e.currentTarget.style.borderColor = 'var(--color-stone-300)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-stone-100)';
                    e.currentTarget.style.borderColor = 'var(--color-stone-200)';
                  }}
                >
                  <svg className="w-7 h-7 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <div className="flex-1 text-start">
                    <div className="font-semibold">
                      {t('cellar.addBottle.manualEntry')}
                    </div>
                    <div className="text-sm opacity-70 mt-0.5">
                      {t('cellar.addBottle.manualEntryDesc')}
                    </div>
                  </div>
                  <svg className="w-5 h-5 flex-shrink-0 flip-rtl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Cancel */}
              <button
                onClick={onClose}
                className="w-full mt-6 py-3 rounded-lg font-medium transition-colors"
                style={{
                  color: 'var(--color-stone-600)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-stone-100)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

