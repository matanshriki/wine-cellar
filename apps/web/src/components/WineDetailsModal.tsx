/**
 * Wine Details Modal
 * 
 * Displays comprehensive wine information in a beautiful bottle-themed modal
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { BottleWithWineInfo } from '../services/bottleService';
import * as bottleService from '../services/bottleService';
import * as labelArtService from '../services/labelArtService';
import { AddWineImageDialog } from './AddWineImageDialog';
import { toast } from '../lib/toast';

interface WineDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottle: BottleWithWineInfo | null;
  onMarkAsOpened?: (bottle: BottleWithWineInfo) => void;
  onRefresh?: () => void;
}

export function WineDetailsModal({ isOpen, onClose, bottle, onMarkAsOpened, onRefresh }: WineDetailsModalProps) {
  const { t } = useTranslation();
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userCanGenerateAI, setUserCanGenerateAI] = useState(false);

  // Check if user has AI label art enabled (per-user flag)
  useEffect(() => {
    const checkUserAccess = async () => {
      const enabled = await labelArtService.isLabelArtEnabledForUser();
      setUserCanGenerateAI(enabled);
    };
    
    if (isOpen && bottle) {
      checkUserAccess();
    }
  }, [isOpen, bottle]);

  // Early return AFTER all hooks
  if (!bottle) return null;

  const wine = bottle.wine;

  // Get display image with priority: user > generated > placeholder
  const displayImage = labelArtService.getWineDisplayImage(wine);

  const handleSaveImage = async (imageUrl: string) => {
    try {
      await bottleService.updateWineImage(wine.id, imageUrl || null);
      toast.success(
        imageUrl 
          ? t('wineImage.updateSuccess', 'Wine image updated!')
          : t('wineImage.removeSuccess', 'Wine image removed')
      );
      
      // Refresh data if callback provided
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error updating wine image:', error);
      throw error; // Let dialog handle the error
    }
  };

  const handleGenerateLabelArt = async (style: labelArtService.LabelArtStyle) => {
    setIsGenerating(true);
    setShowGenerateDialog(false);
    
    try {
      const result = await labelArtService.generateLabelArt(bottle, style);
      
      if (result.cached) {
        toast.success(t('labelArt.cachedSuccess', 'Using existing generated label art'));
      } else {
        toast.success(t('labelArt.generateSuccess', 'Label art generated successfully!'));
      }
      
      // Refresh to show new image
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error generating label art:', error);
      toast.error(error.message || t('labelArt.generateFailed', 'Failed to generate label art'));
    } finally {
      setIsGenerating(false);
    }
  };

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

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="luxury-card w-full max-w-2xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div 
                className="sticky top-0 z-10 p-6 pb-4"
                style={{
                  background: 'linear-gradient(180deg, var(--bg-surface) 0%, rgba(255,255,255,0) 100%)',
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 pe-4">
                    <h2 
                      className="text-2xl sm:text-3xl font-bold mb-1 leading-tight"
                      style={{ 
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {wine.wine_name}
                    </h2>
                    {wine.producer && (
                      <p 
                        className="text-base sm:text-lg"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {wine.producer}
                      </p>
                    )}
                  </div>
                  
                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
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

              {/* Content */}
              <div className="px-4 sm:px-6 pb-6 space-y-6">
                {/* Wine Image & Quick Stats */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                  {/* Wine Bottle Image or Placeholder */}
                  <div className="flex-shrink-0 mx-auto sm:mx-0">
                    <div className="relative group">
                      {displayImage.imageUrl ? (
                        <div className="relative">
                          <img 
                            src={displayImage.imageUrl}
                            alt={wine.wine_name}
                            className="w-40 h-48 sm:w-40 sm:h-52 object-contain rounded-lg wine-image"
                            style={{
                              border: '2px solid var(--border-base)',
                              boxShadow: 'var(--shadow-lg)',
                            }}
                            onError={(e) => {
                              // Show placeholder on error
                              const placeholder = e.currentTarget.parentElement?.nextElementSibling;
                              if (placeholder) {
                                placeholder.classList.remove('hidden');
                              }
                              e.currentTarget.parentElement!.style.display = 'none';
                            }}
                          />
                          {/* AI Generated Badge */}
                          {displayImage.isGenerated && (
                            <div 
                              className="absolute top-2 end-2 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                              style={{
                                background: 'rgba(0, 0, 0, 0.6)',
                                color: 'white',
                                backdropFilter: 'blur(4px)',
                              }}
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                              </svg>
                              <span>AI</span>
                            </div>
                          )}
                        </div>
                      ) : null}
                      
                      {/* Premium Placeholder */}
                      <div 
                        className={`w-40 h-48 sm:w-40 sm:h-52 rounded-lg flex flex-col items-center justify-center ${displayImage.imageUrl ? 'hidden' : ''}`}
                        style={{
                          border: '2px dashed var(--border-base)',
                          background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-muted) 100%)',
                        }}
                      >
                        <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-tertiary)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xs text-center px-4" style={{ color: 'var(--text-tertiary)' }}>
                          No image
                        </p>
                      </div>
                    </div>

                    {/* Image Management Buttons */}
                    <div className="mt-2 space-y-2">
                      {/* Add/Update User Image */}
                      <button
                        onClick={() => setShowImageDialog(true)}
                        className="w-full py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center gap-2"
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-base)',
                          color: 'var(--text-secondary)',
                          minHeight: '36px',
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {wine.image_url 
                          ? t('wineImage.updateButton', 'Update Image')
                          : t('wineImage.addButton', 'Add Image')
                        }
                      </button>

                      {/* Generate Label Art Button */}
                      {userCanGenerateAI && !wine.image_url && (
                        <button
                          onClick={() => setShowGenerateDialog(true)}
                          disabled={isGenerating}
                          className="w-full py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center gap-2"
                          style={{
                            background: isGenerating ? 'var(--bg-muted)' : 'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
                            border: '1px solid var(--gold-600)',
                            color: 'white',
                            minHeight: '36px',
                            opacity: isGenerating ? 0.6 : 1,
                          }}
                        >
                          {isGenerating ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>{t('labelArt.generating', 'Generating...')}</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                              </svg>
                              <span>{t('labelArt.generate', 'Generate Label Art')}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex-1 flex flex-wrap gap-4 sm:gap-6">
                    {/* Vintage */}
                    {wine.vintage && (
                      <div className="flex-shrink-0">
                        <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          {t('cellar.bottle.vintage')}
                        </div>
                        <div className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {wine.vintage}
                        </div>
                      </div>
                    )}

                    {/* Wine Type */}
                    <div className="flex-shrink-0">
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('cellar.bottle.type')}
                      </div>
                      <span className="badge-luxury badge-luxury-wine text-xs">
                        {t(`cellar.wineStyles.${wine.color}`)}
                      </span>
                    </div>

                    {/* Quantity */}
                    <div className="flex-shrink-0">
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('cellar.bottle.quantity')}
                      </div>
                      <div className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                        ×{bottle.quantity}
                      </div>
                    </div>

                    {/* Rating */}
                    {wine.rating && (
                      <div className="flex-shrink-0">
                        <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          Vivino Rating
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--wine-500)' }}>
                            ★
                          </span>
                          <span className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {wine.rating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid var(--border-subtle)' }} />

                {/* Location Info */}
                {(wine.region || wine.country || (wine as any).regional_wine_style) && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>📍</span>
                      {t('cellar.bottle.origin')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {wine.region && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Region</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{wine.region}</div>
                        </div>
                      )}
                      {wine.country && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Country</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{wine.country}</div>
                        </div>
                      )}
                      {(wine as any).regional_wine_style && (
                        <div className="col-span-1 sm:col-span-2">
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Regional Wine Style</div>
                          <div className="text-sm font-medium" style={{ color: 'var(--wine-600)' }}>
                            {(wine as any).regional_wine_style}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Grapes */}
                {wine.grapes && wine.grapes.length > 0 && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>🍇</span>
                      {t('cellar.bottle.grapes')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {wine.grapes.map((grape, idx) => (
                        <span 
                          key={idx}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{
                            backgroundColor: 'var(--wine-50)',
                            color: 'var(--wine-700)',
                            border: '1px solid var(--wine-200)',
                          }}
                        >
                          {grape}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Storage Info */}
                {(bottle.storage_location || bottle.purchase_date || bottle.purchase_price) && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>📦</span>
                      {t('cellar.bottle.storage')}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {bottle.storage_location && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Location</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{bottle.storage_location}</div>
                        </div>
                      )}
                      {bottle.purchase_date && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Purchased</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {new Date(bottle.purchase_date).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                      {bottle.purchase_price && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Price Paid</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            ${bottle.purchase_price.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Analysis */}
                {bottle.readiness_status && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>🔬</span>
                      {t('cellar.bottle.analysis')}
                    </h3>
                    <div 
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor: 'var(--wine-50)',
                        border: '1px solid var(--wine-200)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: 'var(--wine-600)',
                            color: 'white',
                          }}
                        >
                          {bottle.readiness_status}
                        </span>
                      </div>
                      {bottle.tasting_notes && (
                        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                          {bottle.tasting_notes}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {bottle.notes && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>📝</span>
                      {t('cellar.bottle.notes')}
                    </h3>
                    <p 
                      className="text-sm p-4 rounded-lg"
                      style={{
                        backgroundColor: 'var(--bg-muted)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {bottle.notes}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                {(onMarkAsOpened || wine.vivino_url) && (
                  <div className="pt-4 border-t mt-6" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="space-y-3 mt-4">
                      {/* Mark as Opened Button */}
                      {onMarkAsOpened && (
                        <button
                          onClick={() => {
                            onMarkAsOpened(bottle);
                            onClose();
                          }}
                          className="mark-opened-button flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg font-medium transition-all duration-200"
                          style={{
                            background: 'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
                            color: 'white',
                            minHeight: '44px',
                            boxShadow: '0 2px 8px rgba(212, 175, 55, 0.2)',
                            border: '1px solid var(--gold-600)',
                            WebkitTapHighlightColor: 'transparent',
                            touchAction: 'manipulation',
                          }}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{t('cellar.bottle.markOpened')}</span>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                      )}

                      {/* Vivino Link */}
                      {wine.vivino_url && (
                        <a
                          href={wine.vivino_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="vivino-button flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg font-medium transition-all duration-200"
                          style={{
                            background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                            color: 'white',
                            minHeight: '44px',
                            boxShadow: '0 2px 8px rgba(164, 77, 90, 0.2)',
                            border: '1px solid var(--wine-600)',
                            WebkitTapHighlightColor: 'transparent',
                            touchAction: 'manipulation',
                          }}
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                          </svg>
                          <span>{t('cellar.bottle.openVivino')}</span>
                          <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </a>
                      )}
                    </div>
                    
                    <style>{`
                      @media (hover: hover) and (pointer: fine) {
                        .vivino-button:hover, .mark-opened-button:hover {
                          transform: translateY(-1px);
                        }
                        .vivino-button:hover {
                          box-shadow: 0 4px 12px rgba(164, 77, 90, 0.3) !important;
                        }
                        .mark-opened-button:hover {
                          box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3) !important;
                        }
                      }
                      .vivino-button:active, .mark-opened-button:active {
                        transform: scale(0.98);
                      }
                    `}</style>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
      
      {/* Add/Update Wine Image Dialog */}
      {bottle && (
        <AddWineImageDialog 
          isOpen={showImageDialog}
          onClose={() => setShowImageDialog(false)}
          onSave={handleSaveImage}
          currentImageUrl={wine.image_url}
          wineName={wine.wine_name}
        />
      )}

      {/* Generate Label Art Style Selection Dialog */}
      {showGenerateDialog && bottle && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowGenerateDialog(false)}
            className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
            style={{ backdropFilter: 'blur(4px)' }}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="luxury-card w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                  {t('labelArt.selectStyle')}
                </h3>
                
                <div className="space-y-3 mb-4">
                  <button
                    onClick={() => handleGenerateLabelArt('classic')}
                    className="w-full p-4 rounded-lg text-left transition-all border-2"
                    style={{
                      borderColor: 'var(--border-base)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                      {t('labelArt.styleClassic')}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {t('labelArt.styleClassicDesc')}
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleGenerateLabelArt('modern')}
                    className="w-full p-4 rounded-lg text-left transition-all border-2"
                    style={{
                      borderColor: 'var(--border-base)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                      {t('labelArt.styleModern')}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {t('labelArt.styleModernDesc')}
                    </div>
                  </button>
                </div>

                <p className="text-xs text-center italic" style={{ color: 'var(--text-tertiary)' }}>
                  {t('labelArt.disclaimer')}
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

