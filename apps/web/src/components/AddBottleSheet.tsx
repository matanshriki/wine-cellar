/**
 * Add Bottle Options Sheet
 * 
 * Premium bottom sheet showing options for adding a bottle:
 * - Take/Upload photo (camera or gallery) - PRIMARY - includes AI label extraction
 * - Manual entry - SECONDARY
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface AddBottleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadPhoto: () => void;
  onManualEntry: () => void;
  onPhotoSelected?: (file: File) => void;
  onPhotoSelectedForWishlist?: (file: File) => void; // Wishlist feature (feature-flagged)
  showWishlistOption?: boolean; // Wishlist feature (feature-flagged) - controlled by parent
}

export function AddBottleSheet({
  isOpen,
  onClose,
  onUploadPhoto,
  onManualEntry,
  onPhotoSelected,
  onPhotoSelectedForWishlist, // Wishlist feature (feature-flagged)
  showWishlistOption = false, // Wishlist feature (feature-flagged)
}: AddBottleSheetProps) {
  const { t } = useTranslation();
  const [allowBackdropClose, setAllowBackdropClose] = useState(false);
  
  // Handle direct photo selection (bypasses LabelCapture modal)
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, source: 'camera' | 'library') {
    const file = e.target.files?.[0];
    if (file && onPhotoSelected) {
      onPhotoSelected(file);
      onClose();
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }

  // Wishlist feature (dev only) - Handle photo selection for wishlist
  function handleFileSelectForWishlist(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onPhotoSelectedForWishlist) {
      onPhotoSelectedForWishlist(file);
      onClose();
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }

  // Prevent backdrop from closing sheet immediately after opening
  // (the opening click would otherwise propagate to backdrop)
  useEffect(() => {
    if (isOpen) {
      setAllowBackdropClose(false);
      // Allow backdrop clicks after a brief delay
      const timer = setTimeout(() => {
        setAllowBackdropClose(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{
              background: 'var(--bg-overlay)',
              backdropFilter: 'var(--blur-medium)',
              WebkitBackdropFilter: 'var(--blur-medium)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (allowBackdropClose) {
                onClose();
              }
            }}
          />

          {/* Bottom Sheet - Light Luxury */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="fixed left-0 right-0 z-50 ios-modal-scroll bottom-above-nav md:bottom-0"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-xl)',
              maxHeight: 'calc(80dvh - var(--app-bottom-nav-total))',
              borderTopLeftRadius: 'var(--radius-2xl)',
              borderTopRightRadius: 'var(--radius-2xl)',
              borderBottom: 'none',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div 
                className="w-12 h-1 rounded-full"
                style={{ backgroundColor: 'var(--border-medium)' }}
              />
            </div>

            {/* Content - scrollable with safe area */}
            <div className="px-6 pb-6 overflow-y-auto touch-scroll safe-area-inset-bottom luxury-scrollbar">
              {/* Title */}
              <h2 
                className="text-2xl font-bold mb-6 text-center"
                style={{ 
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 'var(--font-bold)',
                }}
              >
                {t('cellar.addBottle.title')}
              </h2>

              {/* Options */}
              <div className="space-y-3">
                {/* PRIMARY: Add Photo (Camera or Gallery) - Single unified option */}
                {/* Mobile hardening (wishlist): Added capture="environment" for mobile camera */}
                <label
                  className="w-full p-4 sm:p-5 rounded-xl transition-all flex items-center gap-3 sm:gap-4 min-h-[56px] sm:min-h-[60px] cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                    border: '1px solid var(--wine-700)',
                    color: 'var(--text-inverse)',
                    boxShadow: 'var(--shadow-sm)',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileSelect(e, 'library')}
                    className="hidden"
                    aria-label={t('cellar.addBottle.uploadPhoto')}
                  />
                  {/* Camera Icon */}
                  <div className="relative w-8 h-8 flex-shrink-0">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                </label>

                {/* SECONDARY: Manual Entry */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onManualEntry();
                  }}
                  className="w-full p-4 sm:p-5 rounded-xl transition-all flex items-center gap-3 sm:gap-4 min-h-[56px] sm:min-h-[60px]"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    boxShadow: 'var(--shadow-xs)',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
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

                {/* Wishlist feature (feature-flagged) - Add to Wishlist option */}
                {/* Mobile hardening (wishlist): Added capture="environment" for mobile camera */}
                {showWishlistOption && onPhotoSelectedForWishlist && (
                  <label
                    className="w-full p-4 sm:p-5 rounded-xl transition-all flex items-center gap-3 sm:gap-4 min-h-[56px] sm:min-h-[60px] cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-amber-500), var(--color-amber-600))',
                      border: '1px solid var(--color-amber-600)',
                      color: 'white',
                      boxShadow: 'var(--shadow-sm)',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileSelectForWishlist}
                      className="hidden"
                      aria-label={t('cellar.addBottle.addToWishlist')}
                    />
                    {/* Bookmark Icon */}
                    <div className="relative w-8 h-8 flex-shrink-0">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </div>
                    <div className="flex-1 text-start">
                      <div className="font-semibold text-lg">
                        {t('cellar.addBottle.addToWishlist')} {/* "Add to Wishlist" */}
                      </div>
                      <div className="text-sm opacity-90 mt-0.5">
                        {t('cellar.addBottle.addToWishlistDesc')} {/* "Save wines to buy later" */}
                      </div>
                    </div>
                    <svg className="w-5 h-5 flex-shrink-0 flip-rtl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </label>
                )}
              </div>

              {/* Cancel */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                className="btn-luxury-ghost w-full mt-6"
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

