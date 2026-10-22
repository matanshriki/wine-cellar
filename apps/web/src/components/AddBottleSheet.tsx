/**
 * Add Bottle Options Sheet
 * 
 * Premium bottom sheet showing options for adding a bottle:
 * - Take/Upload photo (camera or gallery) - PRIMARY - includes AI label extraction
 * - Manual entry - SECONDARY
 */

import { useState, useEffect, useRef } from 'react';
import { Bookmark, Camera, ChevronRight, PenLine } from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { WineLoader } from './WineLoader';
import { toast } from '../lib/toast';

type ScanningState = 'idle' | 'scanning' | 'complete' | 'error';

interface AddBottleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  scanningState?: ScanningState; // Current scanning state
  scanningMessage?: string; // Message to show during scanning/error
  onUploadPhoto?: () => void; // Legacy - optional for backwards compatibility
  onManualEntry: () => void;
  onMultiBottleImport?: () => void; // Legacy - optional for backwards compatibility
  onPhotoSelected?: (file: File) => void; // Legacy - optional for backwards compatibility
  onSmartScan?: (file: File) => void; // New unified scan handler
  onPhotoSelectedForWishlist?: (file: File) => void; // Wishlist feature (feature-flagged)
  onRetry?: () => void; // Retry button for error state
  showWishlistOption?: boolean; // Wishlist feature (feature-flagged) - controlled by parent
  showMultiBottleOption?: boolean; // DEPRECATED - Smart scan replaces this
}

export function AddBottleSheet({
  isOpen,
  onClose,
  scanningState = 'idle',
  scanningMessage,
  onUploadPhoto, // Legacy - kept for backwards compatibility
  onManualEntry,
  onMultiBottleImport, // Legacy - kept for backwards compatibility
  onPhotoSelected, // Legacy - kept for backwards compatibility
  onSmartScan, // New unified scan handler
  onPhotoSelectedForWishlist, // Wishlist feature (feature-flagged)
  onRetry,
  showWishlistOption = false, // Wishlist feature (feature-flagged)
  showMultiBottleOption = false, // DEPRECATED - Smart scan replaces this
}: AddBottleSheetProps) {
  const { t} = useTranslation();
  const [allowBackdropClose, setAllowBackdropClose] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialogA11y(sheetRef, isOpen, () => {
    if (scanningState !== 'scanning') onClose();
  });
  
  // Detect if we're on a mobile device for better camera handling
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isSamsung = /Samsung/i.test(navigator.userAgent) || /SamsungBrowser/i.test(navigator.userAgent);
  // Detect if running as PWA (standalone mode)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://');
  
  // Handle direct photo selection
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, source: 'camera' | 'library') {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // CRITICAL for iOS: Don't clear input immediately
    // On iOS, clearing the input can invalidate the file reference before async operations complete
    
    // Call photo selected handler
    if (onPhotoSelected) {
      onPhotoSelected(file);
    } else if (onSmartScan) {
      onSmartScan(file);
    } else {
      // Safety fallback: No scan handler provided (should not happen in production)
      console.error('[AddBottleSheet] No scan handler provided!');
      onClose();
      
      // Show luxury error toast with actions
      const toastId = toast.error('Scan is temporarily unavailable', {
        description: 'Please try again or enter bottle details manually.',
        duration: 5000,
        action: {
          label: 'Enter Manually',
          onClick: () => {
            if (onManualEntry) {
              onManualEntry();
            }
          },
        },
      });
      
      return;
    }
    
    // Reset input so same file can be selected again
    // Delay this to ensure file data is fully captured first (especially on iOS)
    setTimeout(() => {
      e.target.value = '';
    }, 500);
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
            ref={sheetRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="add-bottle-sheet fixed start-0 end-0 z-50 ios-modal-scroll flex flex-col focus:outline-none"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-modal)',
              bottom: 'max(0px, var(--safe-bottom))',
              maxHeight: 'calc(80dvh - max(0px, var(--safe-bottom)))',
              borderTopLeftRadius: 'var(--radius-2xl)',
              borderTopRightRadius: 'var(--radius-2xl)',
              borderBottom: 'none',
              pointerEvents: 'auto', // Fix: Ensure interactions work during animation
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-bottle-title"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div 
                className="w-12 h-1 rounded-full"
                style={{ backgroundColor: 'var(--border-medium)' }}
              />
            </div>

            {/* Content - scrollable with safe area */}
            <div className="min-h-0 flex-1 px-5 sm:px-6 pb-6 overflow-y-auto touch-scroll safe-area-inset-bottom luxury-scrollbar">
              {scanningState === 'scanning' ? (
                /* SCANNING STATE: Show wine-glass loader */
                <div className="py-12">
                  <WineLoader 
                    variant="default" 
                    size="lg"
                    message={scanningMessage || t('cellar.addBottle.reading')}
                  />
                  <p 
                    className="text-center mt-4 text-sm"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('cellar.addBottle.identifying')}
                  </p>
                </div>
              ) : scanningState === 'error' ? (
                /* ERROR STATE: Show error with retry options */
                <div className="py-8 px-4 text-center">
                  <div 
                    className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--bg-error-subtle)' }}
                  >
                    <svg 
                      className="w-10 h-10" 
                      fill="none" 
                      stroke="var(--text-error)"
                      aria-hidden
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  
                  <h3 
                    className="text-2xl font-bold mb-3"
                    style={{ 
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {t('cellar.addBottle.scanFailedTitle')}
                  </h3>
                  
                  <p 
                    className="text-sm mb-8 leading-relaxed"
                    style={{ 
                      color: 'var(--text-secondary)',
                      maxWidth: '320px',
                      margin: '0 auto 2rem',
                    }}
                  >
                    {scanningMessage || t('cellar.addBottle.scanFailedBody')}
                  </p>
                  
                  <div className="space-y-3 max-w-md mx-auto">
                    {/* Retry Button - Primary (wine gradient) */}
                    <label
                      className="btn-luxury-primary w-full cursor-pointer flex items-center justify-center focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[var(--accent-text)]"
                      style={{ 
                        minHeight: '52px',
                        display: 'flex',
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        {...(isMobile && !isSamsung && !isPWA ? { capture: 'environment' as const } : {})}
                        onChange={(e) => handleFileSelect(e, 'library')}
                        className="sr-only"
                        aria-label={t('a11y.retryScan')}
                      />
                      <span className="text-center">{t('cellar.addBottle.tryAnotherPhoto')}</span>
                    </label>
                    
                    {/* Manual Entry - Secondary */}
                    <button
                      onClick={() => {
                        onClose();
                        onManualEntry();
                      }}
                      className="btn-luxury-secondary w-full flex items-center justify-center"
                      style={{ 
                        minHeight: '52px',
                        display: 'flex',
                      }}
                    >
                      <span className="text-center">{t('cellar.addBottle.manualEntry')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* IDLE STATE: Show options */
                <>
                  {/* Title */}
                  <h2 
                    id="add-bottle-title"
                    className="text-2xl font-bold mb-2 text-center"
                    style={{ 
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 'var(--font-bold)',
                    }}
                  >
                    {t('cellar.addBottle.title')}
                  </h2>

                  {/* Onboarding v1 – production: Helper text */}
                  <p
                    className="text-sm mb-6 text-center"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('cellar.addBottle.subtitle')}
                  </p>

                  {/* Options */}
                  <div className="space-y-3" role="group" aria-labelledby="add-bottle-title">
                    {/* PRIMARY: Scan (auto-detects one or several bottles) */}
                    <label
                      className="add-choice add-choice-primary focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[var(--accent-text)]"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        {...(isMobile && !isSamsung && !isPWA ? { capture: 'environment' as const } : {})}
                        onChange={(e) => handleFileSelect(e, 'library')}
                        className="sr-only"
                        aria-describedby="add-choice-scan-desc"
                      />
                      <span className="add-choice-icon" aria-hidden>
                        <Camera className="h-6 w-6" strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 min-w-0 text-start">
                        <span className="block font-semibold text-base sm:text-lg">{t('cellar.addBottle.smartScan')}</span>
                        <span id="add-choice-scan-desc" className="block text-sm mt-0.5 opacity-90">
                          {t('cellar.addBottle.smartScanDesc')}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 flex-shrink-0 flip-rtl" strokeWidth={1.75} aria-hidden />
                    </label>

                    {/* SECONDARY: Manual entry */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onManualEntry();
                      }}
                      className="add-choice add-choice-secondary"
                      aria-describedby="add-choice-manual-desc"
                    >
                      <span className="add-choice-icon" aria-hidden>
                        <PenLine className="h-6 w-6" strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 min-w-0 text-start">
                        <span className="block font-semibold text-base sm:text-lg">{t('cellar.addBottle.manualEntry')}</span>
                        <span id="add-choice-manual-desc" className="block text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {t('cellar.addBottle.manualEntryDesc')}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 flex-shrink-0 flip-rtl" strokeWidth={1.75} aria-hidden />
                    </button>

                    {/* Wishlist (feature-flagged). No capture attr so mobile shows Camera/Library choice. */}
                    {showWishlistOption && onPhotoSelectedForWishlist && (
                      <label className="add-choice add-choice-secondary focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[var(--accent-text)]">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelectForWishlist}
                          className="sr-only"
                          aria-describedby="add-choice-wishlist-desc"
                        />
                        <span className="add-choice-icon add-choice-icon-gold" aria-hidden>
                          <Bookmark className="h-6 w-6" strokeWidth={1.75} />
                        </span>
                        <span className="flex-1 min-w-0 text-start">
                          <span className="block font-semibold text-base sm:text-lg">{t('cellar.addBottle.addToWishlist')}</span>
                          <span id="add-choice-wishlist-desc" className="block text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {t('cellar.addBottle.addToWishlistDesc')}
                          </span>
                        </span>
                        <ChevronRight className="h-5 w-5 flex-shrink-0 flip-rtl" strokeWidth={1.75} aria-hidden />
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
                    style={{ pointerEvents: 'auto' }} // Fix: Ensure button is immediately clickable
                  >
                    {t('common.cancel')}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

