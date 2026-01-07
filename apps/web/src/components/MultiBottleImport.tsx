// Feedback iteration (dev only)
/**
 * Multi-Bottle Import Component (DEV ONLY)
 * 
 * Allows uploading one photo with multiple bottles and reviewing/editing
 * each detected bottle before adding to cellar.
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../lib/toast';
import { WineLoader } from './WineLoader';
import type { ExtractedBottleData } from '../services/multiBottleService';
import { scanMultipleBottles, checkForDuplicate } from '../services/multiBottleService';
import * as bottleService from '../services/bottleService';
import { trackBottle } from '../services/analytics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingBottles: bottleService.BottleWithWineInfo[];
}

interface ReviewBottle extends ExtractedBottleData {
  id: string;
  selected: boolean;
  isDuplicate: boolean;
  editing: boolean;
}

export function MultiBottleImport({ isOpen, onClose, onSuccess, existingBottles }: Props) {
  const { t } = useTranslation();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review' | 'saving'>('upload');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [bottles, setBottles] = useState<ReviewBottle[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    setStep('analyzing');
    console.log('[MultiBottleImport] Starting scan of:', file.name);

    try {
      const result = await scanMultipleBottles(file);
      
      if (!result.success || result.bottles.length === 0) {
        toast.error(t('cellar.multiBottle.noBottles'));
        setStep('upload');
        return;
      }

      console.log('[MultiBottleImport] Detected bottles:', result.bottles.length);
      setImageUrl(result.imageUrl);

      // Convert to review bottles with auto-selection logic
      const reviewBottles: ReviewBottle[] = result.bottles.map((bottle, index) => {
        const isDuplicate = checkForDuplicate(bottle, existingBottles);
        const isHighConfidence = bottle.confidence >= 0.65;
        const hasRequiredFields = !!bottle.producer && !!bottle.wineName;
        
        return {
          ...bottle,
          id: `bottle-${index}`,
          selected: isHighConfidence && hasRequiredFields && !isDuplicate,
          isDuplicate,
          editing: false,
        };
      });

      setBottles(reviewBottles);
      setStep('review');
      
    } catch (error: any) {
      console.error('[MultiBottleImport] Error:', error);
      toast.error(`Failed to process image: ${error.message}`);
      setStep('upload');
    }
  };

  const handleSave = async () => {
    const selectedBottles = bottles.filter(b => b.selected);
    
    if (selectedBottles.length === 0) {
      toast.warning(t('cellar.multiBottle.selectOne'));
      return;
    }

    setStep('saving');
    setProgress({ current: 0, total: selectedBottles.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < selectedBottles.length; i++) {
      const bottle = selectedBottles[i];
      setProgress({ current: i + 1, total: selectedBottles.length });

      try {
        await bottleService.createBottle({
          producer: bottle.producer,
          wine_name: bottle.wineName,
          vintage: bottle.vintage || null,
          region: bottle.region || null,
          grapes: bottle.grapes ? bottle.grapes.split(',').map(g => g.trim()) : null,
          color: bottle.color,
          country: null,
          appellation: null,
          vivino_wine_id: null,
          rating: null,
          vivino_url: null,
          wine_notes: bottle.notes || null,
          quantity: 1,
          purchase_date: null,
          purchase_price: null,
          purchase_price_currency: null,
          purchase_location: null,
          storage_location: null,
          bottle_size_ml: 750,
          notes: `Imported from multi-bottle photo (confidence: ${Math.round(bottle.confidence * 100)}%)`,
          image_url: imageUrl,
          tags: null,
        });
        
        successCount++;
        trackBottle.addManual();
      } catch (error: any) {
        console.error('[MultiBottleImport] Failed to add bottle:', bottle, error);
        errorCount++;
      }
    }

    if (successCount > 0 && errorCount === 0) {
      toast.success(t('cellar.multiBottle.success', { count: successCount }));
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(t('cellar.multiBottle.partialSuccess', { success: successCount, error: errorCount }));
    } else if (errorCount > 0) {
      toast.error(t('cellar.multiBottle.partialSuccess', { success: 0, error: errorCount }));
    }

    onSuccess();
    handleClose();
  };

  const handleClose = () => {
    setStep('upload');
    setBottles([]);
    setImageUrl('');
    setProgress({ current: 0, total: 0 });
    onClose();
  };

  const toggleBottleSelection = (id: string) => {
    setBottles(prev => prev.map(b => 
      b.id === id ? { ...b, selected: !b.selected } : b
    ));
  };

  const updateBottle = (id: string, updates: Partial<ExtractedBottleData>) => {
    setBottles(prev => prev.map(b => 
      b.id === id ? { ...b, ...updates } : b
    ));
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'var(--bg-overlay)',
        backdropFilter: 'var(--blur-medium)',
        WebkitBackdropFilter: 'var(--blur-medium)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal-luxury w-full max-h-mobile-modal"
        style={{
          maxWidth: 'min(90vw, 64rem)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div 
          className="px-6 py-4"
          style={{ 
            flexShrink: 0,
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 
                className="text-xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('cellar.multiBottle.title')}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {t('cellar.multiBottle.subtitle')}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={step === 'analyzing' || step === 'saving'}
              className="text-2xl opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-primary)' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div 
          className="p-6 luxury-scrollbar"
          style={{
            flex: '1 1 0%',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <AnimatePresence mode="wait">
            {/* Upload Step */}
            {step === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center py-12 px-4"
              >
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {t('cellar.multiBottle.uploadTitle')}
                </h3>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  {t('cellar.multiBottle.uploadSubtitle')}
                </p>
                
                {/* Hidden file input - iOS will show camera/gallery picker */}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                />
                
                {/* Single Action Button */}
                <div className="flex flex-col gap-3 max-w-sm mx-auto">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      galleryInputRef.current?.click();
                    }}
                    className="btn-luxury-primary px-8 py-4 w-full text-lg"
                  >
                    📸 {t('cellar.multiBottle.uploadPhoto')}
                  </button>
                </div>
                
                <div className="mt-8 p-4 rounded-lg" style={{ background: 'var(--bg-muted)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('cellar.multiBottle.tips')}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Analyzing Step */}
            {step === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-12"
              >
                <WineLoader size={80} variant="default" />
                <h3 className="text-lg font-semibold mt-6" style={{ color: 'var(--text-primary)' }}>
                  {t('cellar.multiBottle.analyzing')}
                </h3>
                <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                  {t('cellar.multiBottle.analyzingSubtitle')}
                </p>
              </motion.div>
            )}

            {/* Review Step */}
            {step === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="mb-4">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t('cellar.multiBottle.review')} {t('cellar.multiBottle.reviewCount', { count: bottles.filter(b => b.selected).length })}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('cellar.multiBottle.reviewSubtitle')}
                  </p>
                </div>

                <div className="space-y-3">
                  {bottles.map((bottle) => (
                    <div
                      key={bottle.id}
                      className="p-4 rounded-lg border-2 transition-all"
                      style={{
                        borderColor: bottle.selected 
                          ? 'var(--color-wine-300)' 
                          : 'var(--border-base)',
                        background: bottle.selected 
                          ? 'var(--wine-50)' 
                          : 'var(--bg-surface)',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={bottle.selected}
                          onChange={() => toggleBottleSelection(bottle.id)}
                          className="mt-1 w-5 h-5 cursor-pointer"
                          style={{ accentColor: 'var(--color-wine-500)' }}
                        />
                        
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={bottle.producer}
                              onChange={(e) => updateBottle(bottle.id, { producer: e.target.value })}
                              placeholder={t('cellar.multiBottle.producer')}
                              className="input-luxury text-sm"
                            />
                            <input
                              type="text"
                              value={bottle.wineName}
                              onChange={(e) => updateBottle(bottle.id, { wineName: e.target.value })}
                              placeholder={t('cellar.multiBottle.wineName')}
                              className="input-luxury text-sm"
                            />
                            <input
                              type="number"
                              value={bottle.vintage || ''}
                              onChange={(e) => updateBottle(bottle.id, { vintage: parseInt(e.target.value) || undefined })}
                              placeholder={t('cellar.multiBottle.vintage')}
                              className="input-luxury text-sm"
                            />
                            <select
                              value={bottle.color}
                              onChange={(e) => updateBottle(bottle.id, { color: e.target.value as any })}
                              className="input-luxury text-sm"
                            >
                              <option value="red">{t('cellar.wineStyles.red')}</option>
                              <option value="white">{t('cellar.wineStyles.white')}</option>
                              <option value="rose">{t('cellar.wineStyles.rose')}</option>
                              <option value="sparkling">{t('cellar.wineStyles.sparkling')}</option>
                            </select>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs">
                            <span 
                              className="px-2 py-1 rounded"
                              style={{
                                background: bottle.confidence >= 0.7 
                                  ? 'var(--color-emerald-100)' 
                                  : 'var(--color-amber-100)',
                                color: bottle.confidence >= 0.7 
                                  ? 'var(--color-emerald-700)' 
                                  : 'var(--color-amber-700)',
                              }}
                            >
                              {t('cellar.multiBottle.confidence', { percent: Math.round(bottle.confidence * 100) })}
                            </span>
                            
                            {bottle.isDuplicate && (
                              <span 
                                className="px-2 py-1 rounded"
                                style={{
                                  background: 'var(--color-orange-100)',
                                  color: 'var(--color-orange-700)',
                                }}
                              >
                                ⚠️ {t('cellar.multiBottle.duplicate')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Saving Step */}
            {step === 'saving' && (
              <motion.div
                key="saving"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-12"
              >
                <WineLoader size={80} variant="default" />
                <h3 className="text-lg font-semibold mt-6" style={{ color: 'var(--text-primary)' }}>
                  {t('cellar.multiBottle.saving')}
                </h3>
                <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                  {t('cellar.multiBottle.savingProgress', { current: progress.current, total: progress.total })}
                </p>
                <div 
                  className="mt-4 mx-auto h-2 rounded-full overflow-hidden"
                  style={{ 
                    width: '200px',
                    background: 'var(--bg-muted)',
                  }}
                >
                  <div 
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`,
                      background: 'var(--color-wine-500)',
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {(step === 'review') && (
          <div 
            className="px-6 py-4"
            style={{
              flexShrink: 0,
              borderTop: '1px solid var(--border-light)',
            }}
          >
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 btn-luxury-secondary"
              >
                {t('cellar.multiBottle.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={bottles.filter(b => b.selected).length === 0}
                className="flex-1 btn-luxury-primary"
              >
                {bottles.filter(b => b.selected).length === 1 
                  ? t('cellar.multiBottle.addBottle')
                  : t('cellar.multiBottle.addBottles', { count: bottles.filter(b => b.selected).length })}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

