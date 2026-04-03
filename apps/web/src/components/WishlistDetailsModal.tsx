/**
 * Wishlist Wine Details Modal
 * 
 * Displays comprehensive wine information for wishlist items in a beautiful modal
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { WishlistItem } from '../services/wishlistService';
import { AddWineImageDialog } from './AddWineImageDialog';
import * as storageImageService from '../services/storageImageService';

interface WishlistDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: WishlistItem | null;
  onMoveToCellar?: (item: WishlistItem) => void;
  onRemove?: (id: string) => void;
  /** Persist label image URL (empty string = remove). Same upload/URL flow as cellar wines. */
  onSaveWishlistImage?: (imageUrl: string) => Promise<void>;
}

export function WishlistDetailsModal({ 
  isOpen, 
  onClose, 
  item,
  onMoveToCellar,
  onRemove,
  onSaveWishlistImage,
}: WishlistDetailsModalProps) {
  const { t, i18n } = useTranslation();
  const [showImageDialog, setShowImageDialog] = useState(false);

  // Lock body scroll when modal is open (prevents iOS background scroll).
  // We save scrollY and restore it via window.scrollTo on close — without this,
  // iOS Safari jumps the page back to the top when position:fixed is removed.
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;

      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.style.overflow = originalOverflow || '';
        document.body.style.position = originalPosition || '';
        document.body.style.top = originalTop || '';
        document.body.style.width = originalWidth || '';
        // Restore scroll position that was lost when position:fixed was applied
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setShowImageDialog(false);
  }, [isOpen]);

  // Don't render anything if no item is available
  if (!item) return null;

  // Wine color emoji
  const getColorEmoji = (color: string | null) => {
    switch (color) {
      case 'red': return '🍷';
      case 'white': return '🥂';
      case 'rose': return '🌸';
      case 'sparkling': return '✨';
      default: return '🍷';
    }
  };

  // Format time ago
  function formatTimeAgo(createdAt: string): string {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('wishlist.today');
    if (diffDays === 1) return t('wishlist.yesterday');
    return t('wishlist.daysAgo', { count: diffDays });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={onClose}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-2xl sm:rounded-2xl rounded-t-3xl overflow-hidden shadow-2xl"
            style={{
              backgroundColor: 'var(--bg-surface)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header with Image */}
            <div className="relative">
              {/* Background Image */}
              {item.imageUrl && (
                <div className="h-48 sm:h-56 overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={`${item.producer} ${item.wineName}`}
                    className="w-full h-full object-cover"
                    style={{
                      filter: 'brightness(0.7)',
                    }}
                  />
                </div>
              )}
              
              {/* Gradient Overlay */}
              {item.imageUrl && (
                <div 
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6))',
                  }}
                />
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-sm"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                }}
                aria-label={t('common.close')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Wine Title - Overlaid on image if image exists */}
              <div 
                className={`${item.imageUrl ? 'absolute bottom-0 left-0 right-0' : 'relative'} p-6`}
                style={item.imageUrl ? {} : { 
                  background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">
                    {getColorEmoji(item.color)}
                  </div>
                  <div className="flex-1">
                    <h2 
                      className="text-xl sm:text-2xl font-bold mb-1"
                      style={{ 
                        color: item.imageUrl ? 'white' : 'var(--text-inverse)',
                        fontFamily: 'var(--font-display)',
                        textShadow: item.imageUrl ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                      }}
                    >
                      {item.producer}
                    </h2>
                    <p 
                      className="text-base sm:text-lg mb-1"
                      style={{ 
                        color: item.imageUrl ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.9)',
                        textShadow: item.imageUrl ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                      }}
                    >
                      {item.wineName}
                      {item.vintage && (
                        <span className="ml-2 font-semibold">{item.vintage}</span>
                      )}
                    </p>
                    <div 
                      className="text-xs"
                      style={{ 
                        color: item.imageUrl ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.7)',
                        textShadow: item.imageUrl ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                      }}
                    >
                      Added {formatTimeAgo(item.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div 
              className="flex-1 overflow-y-auto p-6 space-y-6"
              style={{
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              {/* Label image — add or change after saving (e.g. manual entry) */}
              {onSaveWishlistImage && (
                <div
                  className="pb-6"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <h3 
                    className="text-sm font-semibold mb-3 flex items-center gap-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span>🖼️</span>
                    {t('wishlist.labelPhoto', 'Label photo')}
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
                    <div className="flex-shrink-0 mx-auto sm:mx-0">
                      <div className="relative">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="w-28 h-36 sm:w-32 sm:h-40 object-cover rounded-lg"
                            style={{
                              border: '2px solid var(--border-base)',
                              boxShadow: 'var(--shadow-md)',
                            }}
                          />
                        ) : (
                          <div
                            className="w-28 h-36 sm:w-32 sm:h-40 rounded-lg flex flex-col items-center justify-center px-2"
                            style={{
                              border: '2px dashed var(--border-base)',
                              background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-muted) 100%)',
                            }}
                          >
                            <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-tertiary)' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                              {t('wishlist.noLabelPhotoYet', 'No photo yet')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                        {t('wishlist.labelPhotoHint', 'Upload a label shot or paste an image link — same as in your cellar.')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowImageDialog(true)}
                        className="w-full sm:w-auto py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 min-h-[44px]"
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-base)',
                          color: 'var(--text-secondary)',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>
                          {item.imageUrl
                            ? t('wineImage.updateButton', 'Update Image')
                            : t('wineImage.addButton', 'Add Image')}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              {(item.vintage || item.color) && (
                <div className="flex flex-wrap gap-6">
                  {item.vintage && (
                    <div className="flex-shrink-0">
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('cellar.bottle.vintage')}
                      </div>
                      <div className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {item.vintage}
                      </div>
                    </div>
                  )}

                  {item.color && (
                    <div className="flex-shrink-0">
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('cellar.bottle.type')}
                      </div>
                      <span className="badge-luxury badge-luxury-wine text-xs">
                        {t(`cellar.wineStyles.${item.color}`)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Divider */}
              {(item.vintage || item.color) && (
                <div style={{ borderTop: '1px solid var(--border-subtle)' }} />
              )}

              {/* Location Info */}
              {(item.region || item.country) && (
                <div>
                  <h3 
                    className="text-sm font-semibold mb-3 flex items-center gap-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span>📍</span>
                    {t('cellar.bottle.origin')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {item.region && (
                      <div>
                        <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          {t('form.region', 'Region')}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.region}</div>
                      </div>
                    )}
                    {item.country && (
                      <div>
                        <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          {t('wineDetails.country', 'Country')}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.country}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Grapes */}
              {item.grapes && (
                <div>
                  <h3 
                    className="text-sm font-semibold mb-3 flex items-center gap-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span>🍇</span>
                    {t('cellar.bottle.grapes')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {item.grapes.split(',').map((grape, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 rounded-full text-sm"
                        style={{
                          backgroundColor: 'var(--wine-50)',
                          color: 'var(--wine-700)',
                          border: '1px solid var(--wine-200)',
                        }}
                      >
                        {grape.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Restaurant Info */}
              {item.restaurantName && (
                <div>
                  <h3 
                    className="text-sm font-semibold mb-3 flex items-center gap-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span>🍽️</span>
                    {t('wishlist.restaurantInfo', 'Where You Found It')}
                  </h3>
                  <div 
                    className="p-3 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {item.restaurantName}
                  </div>
                </div>
              )}

              {/* Personal Note */}
              {item.note && (
                <div>
                  <h3 
                    className="text-sm font-semibold mb-3 flex items-center gap-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span>📝</span>
                    {t('wishlist.personalNote', 'Your Note')}
                  </h3>
                  <div 
                    className="p-4 rounded-lg text-sm italic"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      borderLeft: '3px solid var(--wine-500)',
                    }}
                  >
                    "{item.note}"
                  </div>
                </div>
              )}

              {/* Vivino Link */}
              {item.vivinoUrl && (
                <div>
                  <a
                    href={item.vivinoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--wine-600)',
                      border: '1px solid var(--border-soft)',
                    }}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                    View on Vivino
                  </a>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div 
              className="p-4 border-t flex gap-3"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-soft)',
              }}
            >
              <button
                onClick={() => {
                  if (onRemove) {
                    onRemove(item.id);
                    onClose();
                  }
                }}
                className="px-4 py-3 rounded-lg font-medium transition-colors flex-1 min-h-[44px]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-danger)',
                }}
              >
                {t('common.remove')}
              </button>
              <button
                onClick={() => {
                  if (onMoveToCellar) {
                    onMoveToCellar(item);
                    onClose();
                  }
                }}
                className="px-6 py-3 rounded-lg font-medium transition-all flex-1 min-h-[44px]"
                style={{
                  background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                  color: 'var(--text-inverse)',
                }}
              >
                {t('wishlist.moveToCellar')}
              </button>
            </div>
          </motion.div>

          {onSaveWishlistImage && (
            <AddWineImageDialog
              isOpen={showImageDialog}
              onClose={() => setShowImageDialog(false)}
              overlayZIndex={220}
              contentZIndex={221}
              wineName={`${item.producer} ${item.wineName}`.trim()}
              currentImageUrl={item.imageUrl ?? undefined}
              onSave={onSaveWishlistImage}
              onSaveStoragePath={async (path, bucket) => {
                const publicUrl = await storageImageService.getStorageImageUrl(bucket, path);
                if (!publicUrl) {
                  throw new Error('Could not resolve uploaded image URL');
                }
                storageImageService.clearImageCache(bucket, path);
                await onSaveWishlistImage(publicUrl);
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
