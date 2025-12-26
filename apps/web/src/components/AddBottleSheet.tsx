/**
 * Add Bottle Options Sheet
 * 
 * Premium bottom sheet showing options for adding a bottle:
 * - Scan label (camera) - PRIMARY
 * - Upload photo - FALLBACK
 * - Manual entry - FALLBACK
 */

import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface AddBottleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onScanLabel: () => void;
  onUploadPhoto: () => void;
  onManualEntry: () => void;
}

export function AddBottleSheet({
  isOpen,
  onClose,
  onScanLabel,
  onUploadPhoto,
  onManualEntry,
}: AddBottleSheetProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl"
            style={{
              maxHeight: '80vh',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div 
                className="w-12 h-1 rounded-full"
                style={{ backgroundColor: 'var(--color-stone-300)' }}
              />
            </div>

            {/* Content */}
            <div className="px-6 pb-6">
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
                {/* PRIMARY: Scan Label */}
                <button
                  onClick={onScanLabel}
                  className="w-full p-5 rounded-xl transition-all flex items-center gap-4"
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
                  <svg className="w-7 h-7 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-lg">
                      {t('cellar.addBottle.scanLabel')}
                    </div>
                    <div className="text-sm opacity-90">
                      {t('cellar.addBottle.scanLabelDesc')}
                    </div>
                  </div>
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* FALLBACK: Upload Photo */}
                <button
                  onClick={onUploadPhoto}
                  className="w-full p-5 rounded-xl transition-all flex items-center gap-4"
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="flex-1 text-left">
                    <div className="font-semibold">
                      {t('cellar.addBottle.uploadPhoto')}
                    </div>
                    <div className="text-sm opacity-70">
                      {t('cellar.addBottle.uploadPhotoDesc')}
                    </div>
                  </div>
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* FALLBACK: Manual Entry */}
                <button
                  onClick={onManualEntry}
                  className="w-full p-5 rounded-xl transition-all flex items-center gap-4"
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
                  <div className="flex-1 text-left">
                    <div className="font-semibold">
                      {t('cellar.addBottle.manualEntry')}
                    </div>
                    <div className="text-sm opacity-70">
                      {t('cellar.addBottle.manualEntryDesc')}
                    </div>
                  </div>
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

