// Wishlist feature (dev only)
/**
 * Wishlist Form Component
 * 
 * Form for reviewing and editing wines to add to wishlist.
 * Shows extracted data with ability to edit before saving.
 * Includes wishlist-specific fields: restaurant name and personal note.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from '../lib/toast';
import type { ExtractedWineData } from '../services/labelScanService';
import * as wishlistService from '../services/wishlistService';
import { fetchVivinoWineData, isVivinoWineUrl } from '../services/vivinoScraper';

const STORAGE_KEY = 'wishlist_form_draft';

interface Props {
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
    imageUrl?: string;
    vivino_url?: string;
    extractedData?: ExtractedWineData;
  };
}

export function WishlistForm({ onClose, onSuccess, prefillData }: Props) {
  const { t } = useTranslation();
  
  // Try to restore from sessionStorage first, then use prefillData
  const getInitialFormData = () => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check if data is recent (within 1 hour)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
          console.log('[WishlistForm] Restored draft from sessionStorage');
          return parsed.data;
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) {
      console.error('[WishlistForm] Failed to restore draft:', e);
      sessionStorage.removeItem(STORAGE_KEY);
    }
    
    // Default: use prefillData
    return {
      wine_name: prefillData?.wine_name || '',
      producer: prefillData?.producer || '',
      vintage: prefillData?.vintage?.toString() || '',
      region: prefillData?.region || '',
      grapes: prefillData?.grapes || '',
      color: (prefillData?.color as 'red' | 'white' | 'rose' | 'sparkling') || 'red',
      vivino_url: prefillData?.vivino_url || '',
      restaurantName: '',
      note: '',
    };
  };
  
  const [formData, setFormData] = useState(() => {
    const initialData = getInitialFormData();
    console.log('[WishlistForm] Initial form data:', initialData);
    console.log('[WishlistForm] Initial color:', initialData.color);
    return initialData;
  });
  const [loading, setLoading] = useState(false);
  const [fetchingVivino, setFetchingVivino] = useState(false);
  
  // Save form data to sessionStorage whenever it changes
  useEffect(() => {
    // Only save if form has meaningful data
    if (formData.wine_name || formData.producer || formData.vivino_url) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          data: formData,
          timestamp: Date.now(),
          imageUrl: prefillData?.imageUrl,
          isFormOpen: true, // Mark that form should be open
        }));
      } catch (e) {
        console.error('[WishlistForm] Failed to save draft:', e);
      }
    }
  }, [formData, prefillData?.imageUrl]);
  
  // Get confidence indicator if we have extracted data
  const confidence = prefillData?.extractedData?.confidence;
  const hasLowConfidence = confidence && (
    confidence.overall === 'low' ||
    confidence.producer === 'low' ||
    confidence.wine_name === 'low'
  );

  function handleChange(field: string, value: string) {
    console.log(`[WishlistForm] Field changed: ${field} = ${value}`);
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  // Vivino fetch functionality (same as BottleForm)
  async function handleFetchFromVivino() {
    if (!formData.vivino_url) {
      toast.error('Please enter a Vivino URL first');
      return;
    }

    if (!isVivinoWineUrl(formData.vivino_url)) {
      toast.error('Invalid Vivino URL. Please use a wine page URL.');
      return;
    }

    setFetchingVivino(true);

    try {
      console.log('[WishlistForm] Fetching from Vivino:', formData.vivino_url);
      const vivinoData = await fetchVivinoWineData(formData.vivino_url);

      // Update form with Vivino data
      setFormData(prev => ({
        ...prev,
        wine_name: vivinoData.wine_name || prev.wine_name,
        producer: vivinoData.producer || prev.producer,
        vintage: vivinoData.vintage?.toString() || prev.vintage,
        region: vivinoData.region || prev.region,
        grapes: vivinoData.grapes || prev.grapes,
      }));

      const ratingText = vivinoData.rating ? `${vivinoData.rating}/5 ⭐` : '';
      const ratingsCount = vivinoData.ratings_count ? ` (${vivinoData.ratings_count.toLocaleString()} ratings)` : '';
      toast.success(`✅ Fetched from Vivino! Rating: ${ratingText}${ratingsCount}`);
      
      console.log('[WishlistForm] ✅ Vivino data fetched:', vivinoData);
    } catch (error: any) {
      console.error('[WishlistForm] Vivino fetch error:', error);
      toast.error(`Could not fetch from Vivino: ${error.message}`);
    } finally {
      setFetchingVivino(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validation: Must have at least producer + wine name
    if (!formData.producer.trim() || !formData.wine_name.trim()) {
      toast.error(t('wishlist.form.validation'));
      return;
    }
    
    setLoading(true);
    
    try {
      // Add to wishlist
      const item = await wishlistService.addWishlistItem({
        producer: formData.producer.trim(),
        wineName: formData.wine_name.trim(),
        vintage: formData.vintage ? parseInt(formData.vintage) : null,
        region: formData.region.trim() || null,
        country: prefillData?.country || null,
        grapes: formData.grapes.trim() || null,
        color: formData.color,
        imageUrl: prefillData?.imageUrl || null,
        restaurantName: formData.restaurantName.trim() || null,
        note: formData.note.trim() || null,
        vivinoUrl: formData.vivino_url.trim() || null,
        source: 'wishlist-photo',
        extractionConfidence: prefillData?.extractedData?.confidence || null,
      });
      
      console.log('[WishlistForm] ✅ Added to wishlist:', item.id);
      toast.success('Added to wishlist! 🔖');
      
      // Clear draft from sessionStorage on success
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error('[WishlistForm] Failed to clear draft:', e);
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[WishlistForm] Error adding to wishlist:', error);
      toast.error(error.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return;
    
    // Ask user if they want to keep the draft
    if (formData.wine_name || formData.producer || formData.vivino_url) {
      const message = 'Your draft will be saved so you can come back to it. Close anyway?';
      if (!confirm(message)) {
        return;
      }
      
      // User confirmed - mark form as explicitly closed
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...parsed,
            isFormOpen: false, // Mark form as explicitly closed
          }));
        }
      } catch (e) {
        console.error('[WishlistForm] Failed to update draft status:', e);
      }
    }
    
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-[100]"
      onClick={handleClose}
      style={{ pointerEvents: 'auto' }} // Fix: Ensure backdrop doesn't block interactions
    >
      {/* Mobile hardening (wishlist): Changed max-h to dvh for mobile viewport, improved touch areas, responsive padding */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-soft)',
          maxHeight: 'calc(100dvh - 2rem)', // Mobile: Full viewport - 1rem padding top/bottom
          pointerEvents: 'auto', // Fix: Ensure modal content is interactive
        }}
      >
        {/* Header */}
        <div 
          className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="flex items-center justify-between">
            <h2 
              className="text-xl font-bold"
              style={{ 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {t('wishlist.form.title')} {/* "Add to Wishlist" */}
            </h2>
            {/* Mobile hardening (wishlist): Increased tap target to 44px minimum */}
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 -mr-2"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label={t('common.close')}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Confidence warning */}
          {hasLowConfidence && (
            <div 
              className="mt-3 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--color-amber-50)',
                color: 'var(--color-amber-800)',
                border: '1px solid var(--color-amber-200)',
              }}
            >
              ⚠️ {t('wishlist.form.lowConfidence')} {/* "Some fields may be unclear - please review" */}
            </div>
          )}
        </div>

        {/* Form */}
        <form 
          onSubmit={handleSubmit} 
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
          style={{ 
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
            pointerEvents: 'auto', // Fix: Ensure form is interactive
          }}
        >
          {/* Producer */}
          <div>
            <label 
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('bottleForm.producer')} *
            </label>
            <input
              type="text"
              value={formData.producer}
              onChange={(e) => handleChange('producer', e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
              }}
              placeholder={t('bottleForm.producerPlaceholder')}
            />
          </div>

          {/* Wine Name */}
          <div>
            <label 
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('bottleForm.wineName')} *
            </label>
            <input
              type="text"
              value={formData.wine_name}
              onChange={(e) => handleChange('wine_name', e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
              }}
              placeholder={t('bottleForm.wineNamePlaceholder')}
            />
          </div>

          {/* Vintage */}
          <div>
            <label 
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('bottleForm.vintage')}
            </label>
            <input
              type="number"
              value={formData.vintage}
              onChange={(e) => handleChange('vintage', e.target.value)}
              min="1900"
              max="2099"
              className="w-full px-3 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
              }}
              placeholder="2020"
            />
          </div>

          {/* Region */}
          <div>
            <label 
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('bottleForm.region')}
            </label>
            <input
              type="text"
              value={formData.region}
              onChange={(e) => handleChange('region', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
              }}
              placeholder={t('bottleForm.regionPlaceholder')}
            />
          </div>

          {/* Grapes */}
          <div>
            <label 
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('bottleForm.grapes')}
            </label>
            <input
              type="text"
              value={formData.grapes}
              onChange={(e) => handleChange('grapes', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
              }}
              placeholder={t('bottleForm.grapesPlaceholder')}
            />
          </div>

          {/* Color */}
          {/* Mobile hardening (wishlist): Changed grid to flex-wrap for better mobile fit */}
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('bottleForm.color')}
            </label>
            <div className="flex flex-wrap gap-2">
              {(['red', 'white', 'rose', 'sparkling'] as const).map((color) => {
                const isSelected = formData.color === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleChange('color', color)}
                    className="py-2 px-4 rounded-lg border-2 transition-all flex-1 min-w-[calc(50%-0.25rem)] text-sm font-medium"
                    style={{
                      borderColor: isSelected ? 'var(--wine-600)' : 'var(--border-input)',
                      backgroundColor: isSelected ? 'var(--wine-50)' : 'var(--bg-input)',
                      color: isSelected ? 'var(--wine-700)' : 'var(--text-secondary)',
                    }}
                  >
                    {isSelected && '✓ '}
                    {t(`bottleForm.colors.${color}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vivino URL (optional) */}
          <div>
            <label 
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('bottleForm.vivinoUrl')} <span className="text-xs opacity-70">({t('bottleForm.optional')})</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={formData.vivino_url}
                onChange={(e) => handleChange('vivino_url', e.target.value)}
                placeholder={t('bottleForm.vivinoUrlPlaceholder')}
                className="flex-1 px-3 py-2 rounded-lg border transition-colors"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-input)',
                  color: 'var(--text-primary)',
                }}
              />
              {formData.vivino_url && isVivinoWineUrl(formData.vivino_url) && (
                <button
                  type="button"
                  onClick={handleFetchFromVivino}
                  disabled={fetchingVivino}
                  className="px-4 py-2 rounded-lg font-medium transition-all"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                    color: 'var(--text-inverse)',
                    cursor: fetchingVivino ? 'wait' : 'pointer',
                  }}
                >
                  {fetchingVivino ? '⏳' : '⬇️'} {fetchingVivino ? t('common.loading') : t('bottleForm.fetchFromVivino')}
                </button>
              )}
            </div>
            {formData.vivino_url && isVivinoWineUrl(formData.vivino_url) && (
              <p 
                className="text-xs mt-1"
                style={{ color: 'var(--color-emerald-700)' }}
              >
                ✨ {t('bottleForm.vivinoFetchHint')}
              </p>
            )}
          </div>

          {/* WISHLIST-SPECIFIC FIELDS */}
          <div 
            className="pt-4 border-t"
            style={{ borderColor: 'var(--border-soft)' }}
          >
            <h3 
              className="text-sm font-semibold mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('wishlist.form.additionalInfo')} {/* "Where did you try it?" */}
            </h3>

            {/* Restaurant Name */}
            <div className="mb-4">
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('wishlist.form.restaurant')} {/* "Restaurant / Location" */}
              </label>
              <input
                type="text"
                value={formData.restaurantName}
                onChange={(e) => handleChange('restaurantName', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border transition-colors"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-input)',
                  color: 'var(--text-primary)',
                }}
                placeholder={t('wishlist.form.restaurantPlaceholder')}
              />
            </div>

            {/* Personal Note */}
            <div>
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('wishlist.form.note')} {/* "My Note" */}
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => handleChange('note', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border transition-colors resize-none"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-input)',
                  color: 'var(--text-primary)',
                }}
                placeholder={t('wishlist.form.notePlaceholder')}
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        {/* Mobile hardening (wishlist): Added safe-area-inset-bottom for PWA, improved touch targets, fixed button layout */}
        <div 
          className="px-4 sm:px-6 border-t flex gap-2 sm:gap-3 justify-end flex-shrink-0"
          style={{ 
            borderColor: 'var(--border-soft)',
            paddingTop: '1rem',
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
            pointerEvents: 'auto', // Fix: Ensure footer is interactive
            backgroundColor: 'var(--bg-surface)', // Ensure footer has background to be visible
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-3 rounded-lg font-medium transition-colors min-h-[44px] border-2"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-medium)',
              color: 'var(--text-secondary)',
              pointerEvents: 'auto', // Fix: Ensure button is clickable
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-3 rounded-lg font-medium transition-all min-h-[44px] flex-1 sm:flex-none"
            style={{
              background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
              color: 'var(--text-inverse)',
              opacity: loading ? 0.6 : 1,
              pointerEvents: loading ? 'none' : 'auto', // Fix: Ensure button is clickable when not loading
            }}
          >
            {loading ? t('common.saving') : t('wishlist.form.save')} {/* "Add to Wishlist" */}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

