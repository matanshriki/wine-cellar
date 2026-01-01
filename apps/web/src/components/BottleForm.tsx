import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BottleWithWineInfo } from '../services/bottleService';
import * as bottleService from '../services/bottleService';
import { toast } from '../lib/toast';
import { trackBottle } from '../services/analytics';

interface Props {
  bottle: BottleWithWineInfo | null;
  onClose: () => void;
  onSuccess: () => void;
  prefillData?: {
    wine_name?: string;
    producer?: string;
    vintage?: number;
    region?: string;
    country?: string;
    grapes?: string;
    color?: string;
    label_image_url?: string;
    vivino_url?: string;
  };
}

export function BottleForm({ bottle, onClose, onSuccess, prefillData }: Props) {
  const { t } = useTranslation();
  
  // SIMPLIFIED: Just use prefillData/bottle data directly (no localStorage restoration)
  const getInitialFormData = () => {
    return {
      wine_name: prefillData?.wine_name || bottle?.wine.wine_name || '',
      producer: prefillData?.producer || bottle?.wine.producer || '',
      vintage: prefillData?.vintage?.toString() || bottle?.wine.vintage?.toString() || '',
      region: prefillData?.region || bottle?.wine.region || '',
      grapes: prefillData?.grapes || (bottle?.wine.grapes ? (Array.isArray(bottle.wine.grapes) ? bottle.wine.grapes.join(', ') : '') : ''),
      color: prefillData?.color || bottle?.wine.color || 'red',
      quantity: bottle?.quantity?.toString() || '1',
      purchase_price: bottle?.purchase_price?.toString() || '',
      notes: bottle?.notes || '',
      label_image_url: prefillData?.label_image_url || '',
      vivino_url: prefillData?.vivino_url || bottle?.wine.vivino_url || '',
    };
  };
  
  const [formData, setFormData] = useState(getInitialFormData());
  const [loading, setLoading] = useState(false);
  
  // Check if this is an AI-prefilled form
  const isAIPrefilled = !!prefillData && (
    !!prefillData.wine_name || 
    !!prefillData.producer || 
    !!prefillData.vintage || 
    !!prefillData.region
  );
  
  // Generate Vivino search URL from wine details
  function generateVivinoSearchUrl(): string {
    const searchTerms = [
      formData.producer,
      formData.wine_name,
      formData.vintage,
    ].filter(Boolean).join(' ');
    
    return `https://www.vivino.com/search/wines?q=${encodeURIComponent(searchTerms)}`;
  }
  
  async function handleSearchVivino() {
    const searchUrl = generateVivinoSearchUrl();
    
    console.log('[BottleForm] Generating Vivino search URL:', searchUrl);
    
    // ALWAYS copy to clipboard (safest for mobile & PWA)
    try {
      await navigator.clipboard.writeText(searchUrl);
      console.log('[BottleForm] ✅ Copied Vivino URL to clipboard successfully');
      
      // Skip the problematic toast entirely for now - just log success
      // The clipboard copy already worked, which is the main goal
      console.log('[BottleForm] ℹ️ URL is in clipboard. User can now open Safari and paste.');
      
      // Use alert as fallback (always works, no React rendering issues)
      alert('✓ Vivino search link copied!\n\nNext steps:\n1. Open Safari\n2. Paste in address bar\n3. Find your wine\n4. Copy wine URL\n5. Return here and paste');
      
    } catch (err) {
      // Fallback: show URL in alert if clipboard fails
      console.error('[BottleForm] ❌ Clipboard write failed:', err);
      alert(`Copy this Vivino search URL:\n\n${searchUrl}`);
    }
  }

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    console.log('[BottleForm] ========== SUBMIT STARTED ==========');
    console.log('[BottleForm] Form data:', formData);

    try {
      if (bottle) {
        console.log('[BottleForm] Updating existing bottle:', bottle.id);
        // For updates, we only update bottle-level fields
        const bottleUpdates = {
          quantity: parseInt(formData.quantity),
          purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
          notes: formData.notes || null,
        };
        
        await bottleService.updateBottle(bottle.id, bottleUpdates);
        trackBottle.edit(); // Track bottle edit
        toast.success(t('bottleForm.bottleUpdated'));
        console.log('[BottleForm] ✅ Bottle updated successfully');
      } else {
        console.log('[BottleForm] Creating new bottle...');
        // For creation, combine wine and bottle data into single object
        const createInput: bottleService.CreateBottleInput = {
          // Wine info
          wine_name: formData.wine_name,
          producer: formData.producer || 'Unknown',
          vintage: formData.vintage ? parseInt(formData.vintage) : null,
          region: formData.region || null,
          grapes: formData.grapes ? formData.grapes.split(',').map(g => g.trim()).filter(Boolean) : null,
          color: formData.color as 'red' | 'white' | 'rose' | 'sparkling',
          country: null,
          appellation: null,
          vivino_wine_id: null,
          vivino_url: formData.vivino_url || null,
          wine_notes: null,
          
          // Bottle info
          quantity: parseInt(formData.quantity) || 1,
          purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
          notes: formData.notes || null,
          purchase_date: null,
          purchase_location: null,
          storage_location: null,
          bottle_size_ml: 750,
          tags: null,
          // Use the uploaded label image as the wine's image
          image_url: formData.label_image_url || null,
        };
        
        console.log('[BottleForm] Create input:', JSON.stringify(createInput, null, 2));
        const result = await bottleService.createBottle(createInput);
        console.log('[BottleForm] ✅ Bottle created successfully:', result);
        trackBottle.addManual(); // Track manual bottle addition
        toast.success(t('bottleForm.bottleAdded'));
      }

      console.log('[BottleForm] Calling onSuccess callback...');
      onSuccess();
      console.log('[BottleForm] ✅ onSuccess callback completed');
    } catch (error: any) {
      console.error('[BottleForm] ❌ Error saving bottle:', error);
      console.error('[BottleForm] Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      toast.error(error.message || t('bottleForm.saveFailed'));
    } finally {
      setLoading(false);
      console.log('[BottleForm] ========== SUBMIT FINISHED ==========');
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.5rem',
        background: 'var(--bg-overlay)',
        backdropFilter: 'var(--blur-medium)',
        WebkitBackdropFilter: 'var(--blur-medium)',
      }}
    >
      <div 
        className="modal-luxury w-full max-h-mobile-modal"
        style={{
          maxWidth: 'min(90vw, 56rem)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header - Fixed at top */}
        <div 
          className="px-4 sm:px-6 py-2 sm:py-3"
          style={{ 
            flexShrink: 0,
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <h2 
            className="text-lg sm:text-xl font-bold"
            style={{ 
              color: 'var(--text-primary)',
              fontWeight: 'var(--font-bold)',
            }}
          >
            {bottle ? t('bottleForm.editTitle') : t('bottleForm.addTitle')}
          </h2>
        </div>

        {/* Scrollable Form Content */}
        <form 
          id="bottle-form" 
          onSubmit={handleSubmit} 
          className="p-4 sm:p-6 space-y-3 sm:space-y-4 luxury-scrollbar"
          style={{ 
            flex: '1 1 0%',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            minHeight: 0,
          }}
        >
          {/* AI Confirmation Banner */}
          {isAIPrefilled && (
            <div 
              className="p-4 rounded-lg mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.12) 100%)',
                border: '1px solid var(--color-amber-200)',
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">✨</span>
                <div className="flex-1">
                  <h4 
                    className="text-sm font-semibold mb-1"
                    style={{ 
                      color: 'var(--color-amber-800)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {t('bottleForm.aiConfirmTitle')}
                  </h4>
                  <p 
                    className="text-xs"
                    style={{ color: 'var(--color-amber-700)' }}
                  >
                    {t('bottleForm.aiConfirmMessage')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="md:col-span-2">
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('bottleForm.name')} *
              </label>
              <input
                type="text"
                value={formData.wine_name}
                onChange={(e) => handleChange('wine_name', e.target.value)}
                className="input-luxury w-full"
                required
                placeholder={t('bottleForm.namePlaceholder')}
              />
            </div>

            <div>
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('bottleForm.producer')}
              </label>
              <input
                type="text"
                value={formData.producer}
                onChange={(e) => handleChange('producer', e.target.value)}
                className="input-luxury w-full"
                placeholder={t('bottleForm.producerPlaceholder')}
              />
            </div>

            <div>
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('bottleForm.vintage')}
              </label>
              <input
                type="number"
                value={formData.vintage}
                onChange={(e) => handleChange('vintage', e.target.value)}
                className="input-luxury w-full"
                placeholder={t('bottleForm.vintagePlaceholder')}
                min="1800"
                max={new Date().getFullYear() + 1}
              />
            </div>

            <div>
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('bottleForm.style')} *
              </label>
              <select
                value={formData.color}
                onChange={(e) => handleChange('color', e.target.value)}
                className="input-luxury w-full"
                required
              >
                <option value="red">{t('bottleForm.styles.red')}</option>
                <option value="white">{t('bottleForm.styles.white')}</option>
                <option value="rose">{t('bottleForm.styles.rose')}</option>
                <option value="sparkling">{t('bottleForm.styles.sparkling')}</option>
              </select>
            </div>

            <div>
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('bottleForm.quantity')} *
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => handleChange('quantity', e.target.value)}
                className="input-luxury w-full"
                required
                min="0"
                placeholder="1"
              />
            </div>

            <div className="md:col-span-2">
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('bottleForm.region')}
              </label>
              <input
                type="text"
                value={formData.region}
                onChange={(e) => handleChange('region', e.target.value)}
                className="input-luxury w-full"
                placeholder={t('bottleForm.regionPlaceholder')}
              />
            </div>

            <div className="md:col-span-2">
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('bottleForm.grapes')}
              </label>
              <input
                type="text"
                value={formData.grapes}
                onChange={(e) => handleChange('grapes', e.target.value)}
                className="input-luxury w-full"
                placeholder={t('bottleForm.grapesPlaceholder')}
              />
            </div>

            {/* Vivino Integration */}
            <div className="md:col-span-2">
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('bottleForm.vivinoUrl')}
                <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)', fontWeight: 'normal' }}>
                  ({t('bottleForm.optional')})
                </span>
              </label>
              {/* Stack vertically on mobile, horizontal on desktop */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={formData.vivino_url}
                  onChange={(e) => handleChange('vivino_url', e.target.value)}
                  className="input-luxury w-full sm:flex-1"
                  placeholder={t('bottleForm.vivinoUrlPlaceholder')}
                />
                {(formData.wine_name || formData.producer) && (
                  <button
                    type="button"
                    onClick={handleSearchVivino}
                    className="btn-luxury-secondary text-sm w-full sm:w-auto"
                    style={{ minHeight: '44px' }}
                  >
                    🔍 {t('bottleForm.searchVivino')}
                  </button>
                )}
              </div>
              {isAIPrefilled && (
                <p 
                  className="text-xs mt-1"
                  style={{ color: 'var(--color-amber-700)' }}
                >
                  💡 {t('bottleForm.vivinoHint')}
                </p>
              )}
            </div>

            <div>
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('bottleForm.purchasePrice')}
              </label>
              <input
                type="number"
                value={formData.purchase_price}
                onChange={(e) => handleChange('purchase_price', e.target.value)}
                className="input-luxury w-full"
                placeholder={t('bottleForm.purchasePricePlaceholder')}
                min="0"
                step="0.01"
              />
            </div>

            <div className="md:col-span-2">
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('bottleForm.notes')}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="input-luxury w-full"
                rows={3}
                placeholder={t('bottleForm.notesPlaceholder')}
              />
            </div>
          </div>

        </form>

        {/* Footer - Sticky at bottom, always visible */}
        <div 
          className="px-4 sm:px-6 py-3 sm:py-4"
          style={{ 
            flexShrink: 0,
            borderTop: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-luxury-secondary text-sm sm:text-base"
              disabled={loading}
            >
              {t('bottleForm.cancel')}
            </button>
            <button
              type="submit"
              form="bottle-form"
              className="flex-1 btn-luxury-primary text-sm sm:text-base"
              disabled={loading}
            >
              {loading
                ? t('bottleForm.saving')
                : bottle
                ? t('bottleForm.update')
                : isAIPrefilled
                ? t('bottleForm.confirmAndAdd')
                : t('bottleForm.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
