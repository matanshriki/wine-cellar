import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BottleWithWineInfo } from '../services/bottleService';
import * as bottleService from '../services/bottleService';
import { toast } from '../lib/toast';

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
  };
}

export function BottleForm({ bottle, onClose, onSuccess, prefillData }: Props) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
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
  });
  const [loading, setLoading] = useState(false);

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (bottle) {
        // For updates, we only update bottle-level fields
        const bottleUpdates = {
          quantity: parseInt(formData.quantity),
          purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
          notes: formData.notes || null,
        };
        
        await bottleService.updateBottle(bottle.id, bottleUpdates);
        toast.success(t('bottleForm.bottleUpdated'));
      } else {
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
          wine_notes: null,
          label_image_url: formData.label_image_url || null,
          
          // Bottle info
          quantity: parseInt(formData.quantity) || 1,
          purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
          notes: formData.notes || null,
          purchase_date: null,
          purchase_location: null,
          storage_location: null,
          bottle_size_ml: 750,
          tags: null,
          image_url: null,
        };
        
        await bottleService.createBottle(createInput);
        toast.success(t('bottleForm.bottleAdded'));
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving bottle:', error);
      toast.error(error.message || t('bottleForm.saveFailed'));
    } finally {
      setLoading(false);
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
                : t('bottleForm.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
