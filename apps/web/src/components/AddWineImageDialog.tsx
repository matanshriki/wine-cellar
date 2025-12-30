/**
 * Add Wine Image Dialog
 * 
 * Allows users to add/update wine image by pasting Vivino image URL
 * ToS-Compliant: User-driven, no scraping
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface AddWineImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageUrl: string) => Promise<void>;
  currentImageUrl?: string | null;
  wineName: string;
}

export function AddWineImageDialog({ 
  isOpen, 
  onClose, 
  onSave, 
  currentImageUrl,
  wineName 
}: AddWineImageDialogProps) {
  const { t } = useTranslation();
  const [imageUrl, setImageUrl] = useState(currentImageUrl || '');
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState(false);

  const validateImageUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    
    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return false;
    }

    // Check if it's an image URL (jpg, jpeg, png, webp, gif)
    const imageExtensions = /\.(jpg|jpeg|png|webp|gif)$/i;
    const urlWithoutQuery = url.split('?')[0];
    
    return imageExtensions.test(urlWithoutQuery) || url.includes('vivino.com');
  };

  const handlePreview = () => {
    setError('');
    setImageError(false);
    
    if (!validateImageUrl(imageUrl)) {
      setError(t('wineImage.invalidUrl', 'Please enter a valid image URL (jpg, png, webp)'));
      return;
    }

    setPreviewUrl(imageUrl);
  };

  const handleSave = async () => {
    if (!validateImageUrl(imageUrl)) {
      setError(t('wineImage.invalidUrl', 'Please enter a valid image URL'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onSave(imageUrl.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || t('wineImage.saveFailed', 'Failed to save image'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    setIsLoading(true);
    setError('');

    try {
      await onSave(''); // Empty string removes the image
      onClose();
    } catch (err: any) {
      setError(err.message || t('wineImage.removeFailed', 'Failed to remove image'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            style={{ backdropFilter: 'blur(4px)' }}
          />

          {/* Dialog Container */}
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="luxury-card w-full max-w-lg flex flex-col"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxHeight: 'min(90vh, calc(100dvh - 2rem))',
                minHeight: 0,
              }}
            >
              {/* Header - Fixed */}
              <div 
                className="flex-shrink-0 p-6 pb-4 border-b" 
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                      {currentImageUrl 
                        ? t('wineImage.updateTitle', 'Update Wine Image')
                        : t('wineImage.addTitle', 'Add Wine Image')
                      }
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {wineName}
                    </p>
                  </div>
                  
                  <button
                    onClick={onClose}
                    className="flex-shrink-0 w-10 h-10 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-muted)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content - Scrollable */}
              <div 
                className="flex-1 px-4 py-4 sm:px-6 sm:py-6 space-y-3 sm:space-y-4 overflow-y-auto"
                style={{
                  minHeight: 0,
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                }}
              >
                {/* Instructions - Collapsible on mobile */}
                <div className="p-3 sm:p-4 rounded-lg" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <h3 className="text-xs sm:text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    {t('wineImage.howToTitle', 'How to add an image')}
                  </h3>
                  <ol className="text-xs sm:text-sm space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                    <li>{t('wineImage.step1', 'Open the Vivino page for this wine')}</li>
                    <li>{t('wineImage.step2', 'Right-click on the wine bottle image')}</li>
                    <li>{t('wineImage.step3', 'Select "Copy image address" or "Copy image URL"')}</li>
                    <li>{t('wineImage.step4', 'Paste the URL below')}</li>
                  </ol>
                  <p className="text-xs mt-2 italic" style={{ color: 'var(--text-tertiary)' }}>
                    {t('wineImage.disclaimer', 'Note: Images are user-provided. We do not scrape or store Vivino content.')}
                  </p>
                </div>

                {/* URL Input */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    {t('wineImage.imageUrl', 'Image URL')}
                  </label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/wine-image.jpg"
                    className="input w-full"
                    style={{ minHeight: '44px' }}
                  />
                </div>

                {/* Preview Button */}
                <button
                  onClick={handlePreview}
                  className="btn-luxury-secondary w-full"
                  disabled={!imageUrl.trim()}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {t('wineImage.preview', 'Preview Image')}
                </button>

                {/* Preview */}
                {previewUrl && !imageError && (
                  <div 
                    className="p-4 rounded-lg" 
                    style={{ 
                      background: 'var(--bg-surface)', 
                      border: '1px solid var(--border-base)',
                      maxHeight: '240px',
                      overflow: 'hidden',
                    }}
                  >
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
                      {t('wineImage.previewLabel', 'Preview')}
                    </p>
                    <div 
                      className="flex items-center justify-center"
                      style={{ maxHeight: '200px', overflow: 'hidden' }}
                    >
                      <img 
                        src={previewUrl}
                        alt="Preview"
                        className="max-w-full h-auto mx-auto object-contain rounded"
                        style={{ maxHeight: '200px' }}
                        onError={() => {
                          setImageError(true);
                          setError(t('wineImage.previewFailed', 'Failed to load image. Please check the URL.'));
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
                    <p className="text-sm" style={{ color: 'rgb(220, 38, 38)' }}>
                      {error}
                    </p>
                  </div>
                )}
                
                {/* Spacer to ensure content can scroll above footer */}
                <div style={{ height: '1px', minHeight: '1px' }} />
              </div>

              {/* Footer Actions - Fixed */}
              <div 
                className="flex-shrink-0 p-6 pt-4 border-t flex gap-3" 
                style={{ 
                  borderColor: 'var(--border-subtle)',
                  paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom) + 1rem)',
                }}
              >
                {currentImageUrl && (
                  <button
                    onClick={handleRemove}
                    disabled={isLoading}
                    className="btn-ghost flex-1"
                    style={{ 
                      minHeight: '44px',
                      touchAction: 'manipulation',
                    }}
                  >
                    {t('wineImage.remove', 'Remove Image')}
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={isLoading || !imageUrl.trim() || imageError}
                  className="btn-luxury flex-1"
                  style={{ 
                    minHeight: '44px',
                    touchAction: 'manipulation',
                  }}
                >
                  {isLoading ? t('wineImage.saving', 'Saving...') : t('wineImage.save', 'Save Image')}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}



