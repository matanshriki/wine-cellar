import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BottleWithWineInfo } from '../services/bottleService';
import * as bottleService from '../services/bottleService';
import { toast } from '../lib/toast';
import { trackBottle } from '../services/analytics';
import { getCurrencySymbol, getCurrencyCode, getDisplayPrice } from '../utils/currency';
import { fetchVivinoWineData, isVivinoWineUrl } from '../services/vivinoScraper';
import { isLocalDevEnvironment } from '../utils/vivinoAutoLink';
import { isDevEnvironment } from '../utils/devOnly'; // Wishlist feature (dev only)
import * as wishlistService from '../services/wishlistService'; // Wishlist feature (dev only)

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
    // NEW: Stable storage paths (preferred)
    label_image_path?: string;
    label_image_bucket?: string;
    // Legacy: URL for backward compatibility
    label_image_url?: string;
    vivino_url?: string;
  };
  showWishlistOption?: boolean; // Wishlist feature (dev only) - Show "Save to Wishlist" button
}

export function BottleForm({ bottle, onClose, onSuccess, prefillData, showWishlistOption = false }: Props) {
  const { t, i18n } = useTranslation();
  const currencySymbol = getCurrencySymbol(i18n.language);
  const currentCurrency = getCurrencyCode(i18n.language);
  
  // ROBUST: Check sessionStorage first (for Vivino flow), then prefillData/bottle
  const getInitialFormData = () => {
    // Try to restore from sessionStorage (if user is returning from Vivino)
    try {
      const saved = sessionStorage.getItem('wine-form-vivino-flow');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check if data is recent (within 10 minutes)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 600000) {
          console.log('[BottleForm] 🔄 Restoring form data from sessionStorage (returning from Vivino)');
          // Don't clear yet - user might go back to Vivino again
          return parsed.data;
        } else {
          console.log('[BottleForm] Clearing expired sessionStorage data');
          sessionStorage.removeItem('wine-form-vivino-flow');
        }
      }
    } catch (e) {
      console.error('[BottleForm] Failed to restore from sessionStorage:', e);
      sessionStorage.removeItem('wine-form-vivino-flow');
    }
    
    // Default: use prefillData or bottle data
    return {
      wine_name: prefillData?.wine_name || bottle?.wine.wine_name || '',
      producer: prefillData?.producer || bottle?.wine.producer || '',
      vintage: prefillData?.vintage?.toString() || bottle?.wine.vintage?.toString() || '',
      region: prefillData?.region || bottle?.wine.region || '',
      grapes: prefillData?.grapes || (bottle?.wine.grapes ? (Array.isArray(bottle.wine.grapes) ? bottle.wine.grapes.join(', ') : '') : ''),
      color: prefillData?.color || bottle?.wine.color || 'red',
      quantity: bottle?.quantity?.toString() || '1',
      purchase_price: (() => {
        if (!bottle?.purchase_price) return '';
        // Convert price to current currency for display
        const displayPrice = getDisplayPrice(
          bottle.purchase_price,
          (bottle as any).purchase_price_currency || 'USD',
          i18n.language
        );
        return displayPrice.amount?.toFixed(2) || '';
      })(),
      notes: bottle?.notes || '',
      label_image_url: prefillData?.label_image_url || '',
      label_image_path: prefillData?.label_image_path || '',
      label_image_bucket: prefillData?.label_image_bucket || 'labels',
      vivino_url: prefillData?.vivino_url || (bottle?.wine as any)?.vivino_url || '',
      rating: (bottle?.wine as any)?.rating?.toString() || '', // Vivino rating (0-5 scale)
    };
  };
  
  const [formData, setFormData] = useState(getInitialFormData());
  const [loading, setLoading] = useState(false);
  const [fetchingVivino, setFetchingVivino] = useState(false);
  const [autoFetchingVivino, setAutoFetchingVivino] = useState(false); // Background auto-fetch indicator
  const autoFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce timer

  // Update displayed price when language changes
  useEffect(() => {
    if (bottle?.purchase_price) {
      const displayPrice = getDisplayPrice(
        bottle.purchase_price,
        (bottle as any).purchase_price_currency || 'USD',
        i18n.language
      );
      setFormData(prev => ({
        ...prev,
        purchase_price: displayPrice.amount?.toFixed(2) || '',
      }));
    }
  }, [i18n.language, bottle?.purchase_price, (bottle as any)?.purchase_price_currency]);
  
  // **AUTO-FETCH FROM VIVINO (Background)**
  // When user manually types wine name + producer, automatically fetch from Vivino
  // to fill missing fields (vintage, region, grapes, rating)
  useEffect(() => {
    // Only if we're adding a new bottle (not editing)
    if (bottle) return;
    
    // Only if we have name + producer
    if (!formData.wine_name || !formData.producer) return;
    
    // Don't trigger if this is AI-prefilled (already has Vivino data)
    if (prefillData) return;
    
    // Don't trigger if already fetching
    if (autoFetchingVivino || fetchingVivino) return;
    
    // Clear any pending timeout
    if (autoFetchTimeoutRef.current) {
      clearTimeout(autoFetchTimeoutRef.current);
    }
    
    // Debounce: wait 2 seconds after user stops typing
    autoFetchTimeoutRef.current = setTimeout(async () => {
      console.log('[BottleForm] 🔍 Auto-fetching from Vivino (background)...');
      console.log('[BottleForm] Trigger: wine_name + producer both filled');
      
      // Generate Vivino search URL from current form data
      const vivinoUrl = generateVivinoSearchUrl();
      if (!vivinoUrl) {
        console.log('[BottleForm] ⚠️ Could not generate Vivino search URL');
        return;
      }
      
      // Only auto-fetch if we already have a direct wine page URL (not a search URL)
      // The fetcher requires a wine page like /w/12345 or /wines/12345
      if (!isVivinoWineUrl(vivinoUrl)) {
        console.log('[BottleForm] ⏩ Skipping auto-fetch: generated URL is a search page, not a wine page');
        return;
      }
      
      setAutoFetchingVivino(true);
      
      try {
        // Import Vivino fetcher dynamically
        const { fetchVivinoWineData } = await import('../services/vivinoScraper');
        
        // Fetch from Vivino
        const vivinoData = await fetchVivinoWineData(vivinoUrl);
        
        if (vivinoData && (vivinoData.name || vivinoData.winery)) {
          console.log('[BottleForm] ✅ Auto-fetched Vivino data:', vivinoData);
          
          // **SMART MERGE: Only fill EMPTY fields** (user's typing takes priority)
          setFormData(prev => {
            const merged = {
              ...prev,
              // Only fill if empty - use ALL grapes if available
              vintage: prev.vintage || (vivinoData.vintage ? vivinoData.vintage.toString() : ''),
              region: prev.region || vivinoData.region || '',
              grapes: prev.grapes || vivinoData.grapes || vivinoData.grape || '',
              rating: prev.rating || (vivinoData.rating ? vivinoData.rating.toString() : ''),
            };
            
            // Count how many fields were filled
            const filledCount = [
              !prev.vintage && merged.vintage,
              !prev.region && merged.region,
              !prev.grapes && merged.grapes,
              !prev.rating && merged.rating,
            ].filter(Boolean).length;
            
            if (filledCount > 0) {
              console.log('[BottleForm] 🎯 Auto-filled', filledCount, 'fields from Vivino');
              toast.success(`🍷 Auto-enriched with Vivino data (${filledCount} fields)`);
            }
            
            return merged;
          });
        } else {
          console.log('[BottleForm] ⚠️ Vivino auto-fetch returned no data');
        }
      } catch (error) {
        console.error('[BottleForm] ❌ Vivino auto-fetch failed:', error);
        // Silent failure - don't interrupt user
      } finally {
        setAutoFetchingVivino(false);
      }
    }, 2000); // 2 second debounce
    
    // Cleanup
    return () => {
      if (autoFetchTimeoutRef.current) {
        clearTimeout(autoFetchTimeoutRef.current);
      }
    };
  }, [formData.wine_name, formData.producer, bottle, prefillData, autoFetchingVivino, fetchingVivino]);
  
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
  
  function handleSearchVivino() {
    const searchUrl = generateVivinoSearchUrl();
    
    console.log('[BottleForm] 📝 Saving form data to sessionStorage before opening Vivino...');
    console.log('[BottleForm] Current form data:', formData);
    
    // Save current form data to sessionStorage (survives page reload)
    try {
      sessionStorage.setItem('wine-form-vivino-flow', JSON.stringify({
        data: formData,
        timestamp: Date.now(),
      }));
      console.log('[BottleForm] ✅ Form data saved to sessionStorage');
    } catch (e) {
      console.error('[BottleForm] ⚠️ Failed to save to sessionStorage:', e);
    }
    
    console.log('[BottleForm] 🚀 Opening Vivino in new tab:', searchUrl);
    
    // Open Vivino in new tab (user's preferred UX)
    // On iOS, this might cause app to pause/reload, but sessionStorage will restore data
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
    
    console.log('[BottleForm] ℹ️ Vivino opened. Form data is saved and will restore when you return.');
  }
  
  // Vivino data fetcher (dev only) - Auto-populate rating and details from Vivino URL
  async function handleFetchFromVivino() {
    if (!formData.vivino_url) {
      toast.error(t('bottleForm.vivinoUrlRequired', 'Please enter a Vivino wine page URL first'));
      return;
    }
    
    if (!isVivinoWineUrl(formData.vivino_url)) {
      toast.error(t('bottleForm.invalidVivinoUrl', 'Invalid Vivino URL. Please use a wine page URL like: https://www.vivino.com/wines/123456'));
      return;
    }
    
    setFetchingVivino(true);
    console.log('[BottleForm] 🍷 Fetching wine data from Vivino:', formData.vivino_url);
    
    try {
      const vivinoData = await fetchVivinoWineData(formData.vivino_url);
      
      if (!vivinoData || (vivinoData as any).success === false || (vivinoData as any).error) {
        console.error('[BottleForm] ❌ Failed to fetch from Vivino:', vivinoData);
        const errorMsg = (vivinoData as any)?.error || 'Could not fetch wine data from Vivino';
        toast.error(`⚠️ ${errorMsg}. Please enter details manually or try a different Vivino URL.`);
        return;
      }
      
      console.log('[BottleForm] ✅ Fetched Vivino data:', vivinoData);
      
      // Auto-populate fields with Vivino data (UPDATE all fields with fetched data)
      setFormData(prev => ({
        ...prev,
        // Update with fetched data (or keep existing if fetch returned empty)
        wine_name: vivinoData.name || prev.wine_name,
        producer: vivinoData.winery || prev.producer,
        vintage: vivinoData.vintage ? vivinoData.vintage.toString() : prev.vintage,
        region: vivinoData.region || prev.region,
        // Use ALL grapes if available, fallback to primary grape
        grapes: vivinoData.grapes || vivinoData.grape || prev.grapes,
        // Store rating from Vivino (0-5 scale)
        rating: vivinoData.rating ? vivinoData.rating.toString() : prev.rating,
      }));
      
      // Show success message with rating if available
      if (vivinoData.rating && vivinoData.rating_count) {
        toast.success(
          `✅ Fetched from Vivino! Rating: ${vivinoData.rating}/5 ⭐ (${vivinoData.rating_count.toLocaleString()} ratings)`
        );
      } else if (vivinoData.name || vivinoData.winery) {
        toast.success(
          `✅ Fetched wine details from Vivino!`
        );
      } else {
        toast.warning(
          `⚠️ Fetched from Vivino but could not extract all details. Please verify the information.`
        );
      }
      
      console.log('[BottleForm] 📝 Updated form with Vivino data');
      
    } catch (error: any) {
      console.error('[BottleForm] ❌ Vivino fetch error:', error);
      toast.error(t('bottleForm.vivinoFetchError', 'Error fetching from Vivino: {{error}}', { error: error.message }));
    } finally {
      setFetchingVivino(false);
    }
  }

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleClose() {
    console.log('[BottleForm] User closed form without submitting');
    // Clear sessionStorage when user closes form (they're abandoning this wine)
    try {
      sessionStorage.removeItem('wine-form-vivino-flow');
      console.log('[BottleForm] 🧹 Cleared sessionStorage (form closed)');
    } catch (e) {
      console.error('[BottleForm] Failed to clear sessionStorage:', e);
    }
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[BottleForm] ========== SUBMIT STARTED ==========');
    console.log('[BottleForm] Form data:', formData);
    console.log('[BottleForm] Loading state:', loading);
    
    // Prevent double submissions
    if (loading) {
      console.log('[BottleForm] ⚠️ Already submitting, ignoring duplicate submit');
      return;
    }
    
    // Validate required fields
    if (!formData.wine_name || !formData.wine_name.trim()) {
      console.log('[BottleForm] ❌ Validation failed: Wine name is required');
      toast.error(t('bottleForm.nameRequired', 'Wine name is required'));
      return;
    }
    
    if (!formData.quantity || parseInt(formData.quantity) < 1) {
      console.log('[BottleForm] ❌ Validation failed: Invalid quantity');
      toast.error(t('bottleForm.quantityRequired', 'Quantity must be at least 1'));
      return;
    }
    
    setLoading(true);

    try {
      if (bottle) {
        console.log('[BottleForm] ========== UPDATING EXISTING BOTTLE ==========');
        console.log('[BottleForm] Bottle ID:', bottle.id);
        console.log('[BottleForm] Wine ID:', bottle.wine_id);
        console.log('[BottleForm] Form data:', formData);
        
        // Update bottle-level fields
        const bottleUpdates = {
          quantity: parseInt(formData.quantity),
          purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
          purchase_price_currency: currentCurrency, // Store current currency
          notes: formData.notes || null,
        };
        
        console.log('[BottleForm] Updating bottle fields:', bottleUpdates);
        await bottleService.updateBottle(bottle.id, bottleUpdates);
        console.log('[BottleForm] ✅ Bottle fields updated');
        
        // Update wine-level fields (vintage, producer, etc.)
        const wineUpdates: bottleService.UpdateWineInput = {
          wine_name: formData.wine_name,
          producer: formData.producer || 'Unknown',
          vintage: formData.vintage ? parseInt(formData.vintage) : null,
          region: formData.region || null,
          color: formData.color as 'red' | 'white' | 'rose' | 'sparkling',
          grapes: formData.grapes ? formData.grapes.split(',').map(g => g.trim()).filter(Boolean) : null,
          vivino_url: formData.vivino_url || null,
          rating: formData.rating ? parseFloat(formData.rating) : null, // Save Vivino rating
        };
        
        console.log('[BottleForm] Updating wine fields:', wineUpdates);
        await bottleService.updateWineInfo(bottle.wine_id, wineUpdates);
        console.log('[BottleForm] ✅ Wine fields updated');
        
        trackBottle.edit(); // Track bottle edit
        toast.success(t('bottleForm.bottleUpdated'));
        console.log('[BottleForm] ========== UPDATE COMPLETE ==========');
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
          rating: formData.rating ? parseFloat(formData.rating) : null, // Save Vivino rating (0-5 scale)
          wine_notes: null,
          
          // Bottle info
          quantity: parseInt(formData.quantity) || 1,
          purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
          purchase_price_currency: currentCurrency, // Store current currency
          notes: formData.notes || null,
          purchase_date: null,
          purchase_location: null,
          storage_location: null,
          bottle_size_ml: 750,
          tags: null,
          // NEW: Save stable storage path (preferred)
          image_path: formData.label_image_path || null,
          // Legacy: Save URL for backward compatibility (external URLs)
          image_url: formData.label_image_url || null,
        };
        
        console.log('[BottleForm] Create input:', JSON.stringify(createInput, null, 2));
        const result = await bottleService.createBottle(createInput);
        console.log('[BottleForm] ✅ Bottle created successfully:', result);
        trackBottle.addManual(); // Track manual bottle addition
        toast.success(t('bottleForm.bottleAdded'));
      }

      console.log('[BottleForm] Calling onSuccess callback...');
      
      // Clear sessionStorage on successful submit (no longer need saved data)
      try {
        sessionStorage.removeItem('wine-form-vivino-flow');
        console.log('[BottleForm] 🧹 Cleared sessionStorage (form successfully submitted)');
      } catch (e) {
        console.error('[BottleForm] Failed to clear sessionStorage:', e);
      }
      
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

  // Wishlist feature (dev only) - Save to wishlist instead of cellar
  async function handleSaveToWishlist(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.wine_name || !formData.producer) {
      toast.error(t('bottleForm.fillRequired'));
      return;
    }

    setLoading(true);

    try {
      const wishlistItem: Omit<wishlistService.WishlistItem, 'id' | 'createdAt'> = {
        producer: formData.producer,
        wineName: formData.wine_name,
        vintage: formData.vintage ? parseInt(formData.vintage) : undefined,
        region: formData.region || undefined,
        country: undefined, // Could add country field to form
        grapes: formData.grapes || undefined,
        color: formData.color as 'red' | 'white' | 'rose' | 'sparkling' | undefined,
        imageUrl: formData.label_image_url || undefined,
        source: 'wishlist-photo',
        vivinoUrl: formData.vivino_url || undefined,
        note: formData.notes || undefined,
      };

      wishlistService.addWishlistItem(wishlistItem);
      console.log('[BottleForm] ✅ Saved to wishlist:', wishlistItem);
      toast.success('Added to wishlist! 🔖');
      
      // Clear sessionStorage
      try {
        sessionStorage.removeItem('wine-form-vivino-flow');
      } catch (e) {
        console.error('[BottleForm] Failed to clear sessionStorage:', e);
      }
      
      onSuccess();
    } catch (error: any) {
      console.error('[BottleForm] ❌ Error saving to wishlist:', error);
      toast.error('Failed to save to wishlist');
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
                <div className="flex gap-2 w-full sm:w-auto">
                  {(formData.wine_name || formData.producer) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSearchVivino();
                      }}
                      className="btn-luxury-secondary text-sm flex-1 sm:flex-initial"
                      style={{ 
                        minHeight: '48px',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      🔍 {t('bottleForm.searchVivino')}
                    </button>
                  )}
                  {(() => {
                    const hasUrl = !!formData.vivino_url;
                    const isValidUrl = hasUrl && isVivinoWineUrl(formData.vivino_url);
                    console.log('[BottleForm] Vivino URL check:', {
                      hasUrl,
                      url: formData.vivino_url,
                      isValidUrl,
                      hostname: window.location.hostname,
                    });
                    return isValidUrl;
                  })() && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('[BottleForm] 🔘 Fetch Data button clicked!');
                        handleFetchFromVivino();
                      }}
                      disabled={fetchingVivino}
                      className="btn-luxury-primary text-sm flex-1 sm:flex-initial"
                      style={{ 
                        minHeight: '48px',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        cursor: fetchingVivino ? 'wait' : 'pointer',
                      }}
                      title={t('bottleForm.fetchFromVivino', 'Fetch wine data and rating from Vivino')}
                    >
                      {fetchingVivino ? '⏳' : '⬇️'} {fetchingVivino ? t('common.loading') : t('bottleForm.fetchFromVivino', 'Fetch Data')}
                    </button>
                  )}
                </div>
              </div>
              {isAIPrefilled && (
                <p 
                  className="text-xs mt-1"
                  style={{ color: 'var(--color-amber-700)' }}
                >
                  💡 {t('bottleForm.vivinoHint')}
                </p>
              )}
              {formData.vivino_url && isVivinoWineUrl(formData.vivino_url) && (
                <p 
                  className="text-xs mt-1"
                  style={{ color: 'var(--color-emerald-700)' }}
                >
                  ✨ {t('bottleForm.vivinoFetchHint', 'Click "Fetch Data" to auto-fill wine details and rating from Vivino')}
                </p>
              )}
              
              {/* Show rating if available (from Vivino or manual entry) */}
              {formData.rating && parseFloat(formData.rating) > 0 && (
                <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-amber-50)', border: '1px solid var(--color-amber-200)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⭐</span>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--color-amber-900)' }}>
                        Vivino Rating: {parseFloat(formData.rating).toFixed(1)}/5.0
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-amber-700)' }}>
                        This rating will be saved with the wine
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Auto-fetch indicator (new bottles only) */}
            {!bottle && autoFetchingVivino && (
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--color-blue-50)', border: '1px solid var(--color-blue-200)' }}>
                  <div className="animate-spin" style={{ fontSize: '16px' }}>🔍</div>
                  <span className="text-sm" style={{ color: 'var(--color-blue-700)' }}>
                    Auto-enriching from Vivino...
                  </span>
                </div>
              </div>
            )}

            <div>
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('bottleForm.purchasePrice')}
              </label>
              <div className="relative">
                <span 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none z-10"
                  style={{ fontSize: '1rem' }}
                >
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  value={formData.purchase_price}
                  onChange={(e) => handleChange('purchase_price', e.target.value)}
                  className="input-luxury w-full"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder={t('bottleForm.purchasePricePlaceholder', { currencySymbol })}
                  min="0"
                  step="0.01"
                />
              </div>
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
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          {/* Wishlist feature (dev only) - Show wishlist option if enabled */}
          {isDevEnvironment() && showWishlistOption && !bottle ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 btn-luxury-secondary text-sm sm:text-base"
                  disabled={loading}
                  style={{ 
                    minHeight: '48px',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {t('bottleForm.cancel')}
                </button>
                <button
                  type="submit"
                  form="bottle-form"
                  onClick={(e) => {
                    // Fallback: If form submission doesn't work, manually trigger it
                    e.stopPropagation();
                    const form = document.getElementById('bottle-form') as HTMLFormElement;
                    if (form && !loading) {
                      console.log('[BottleForm] Button clicked, triggering form submission');
                      form.requestSubmit();
                    }
                  }}
                  className="flex-1 btn-luxury-primary text-sm sm:text-base"
                  disabled={loading}
                  style={{ 
                    minHeight: '48px',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    pointerEvents: loading ? 'none' : 'auto',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading
                    ? t('bottleForm.saving')
                    : isAIPrefilled
                    ? t('bottleForm.confirmAndAdd')
                    : t('bottleForm.save')}
                </button>
              </div>
              {/* Wishlist alternative button */}
              <button
                type="button"
                onClick={handleSaveToWishlist}
                className="w-full text-sm sm:text-base font-medium py-3 rounded-lg transition-all"
                disabled={loading}
                style={{ 
                  background: 'linear-gradient(135deg, var(--color-amber-500), var(--color-amber-600))',
                  border: '1px solid var(--color-amber-700)',
                  color: 'var(--text-inverse)',
                  minHeight: '48px',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                🔖 Save to Wishlist Instead <span className="text-xs opacity-80">(dev)</span>
              </button>
            </div>
          ) : (
            // Normal buttons (no wishlist option)
            <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 btn-luxury-secondary text-sm sm:text-base"
                disabled={loading}
                style={{ 
                  minHeight: '48px',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {t('bottleForm.cancel')}
              </button>
              <button
                type="submit"
                form="bottle-form"
                onClick={(e) => {
                  // Fallback: If form submission doesn't work, manually trigger it
                  e.stopPropagation();
                  const form = document.getElementById('bottle-form') as HTMLFormElement;
                  if (form && !loading) {
                    console.log('[BottleForm] Button clicked, triggering form submission');
                    form.requestSubmit();
                  }
                }}
                className="flex-1 btn-luxury-primary text-sm sm:text-base"
                disabled={loading}
                style={{ 
                  minHeight: '48px',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  pointerEvents: loading ? 'none' : 'auto',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
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
          )}
        </div>
      </div>
    </div>
  );
}
