// Wishlist feature (dev only)
/**
 * Wishlist Page Component
 * 
 * Shows list of wines the user wants to buy later.
 * Allows searching, editing, removing, and moving to cellar.
 * 
 * Feature-gated: Only accessible if user has wishlist_enabled flag.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../lib/toast';
import * as wishlistService from '../services/wishlistService';
import * as bottleService from '../services/bottleService';
import type { WishlistItem } from '../services/wishlistService';
import { AddBottleSheet } from '../components/AddBottleSheet'; // Wishlist feature (dev only)
import { WishlistForm } from '../components/WishlistForm'; // Wishlist feature (dev only)
import type { ExtractedWineData } from '../services/labelScanService'; // Wishlist feature (dev only)
import * as labelParseService from '../services/labelParseService'; // Wishlist feature (dev only)
import { generateVivinoSearchUrl } from '../utils/vivinoAutoLink'; // Wishlist feature - auto-generate Vivino URLs

export function WishlistPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  
  // Wishlist feature (dev only) - Add bottle sheet state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showWishlistForm, setShowWishlistForm] = useState(false);
  const [wishlistExtractedData, setWishlistExtractedData] = useState<{
    imageUrl: string;
    data: ExtractedWineData;
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // Load wishlist items on mount
  useEffect(() => {
    loadItems();
    
    // Check if there's a saved draft
    try {
      const saved = sessionStorage.getItem('wishlist_form_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
          // Restore extracted data if available (for image URL)
          if (parsed.imageUrl) {
            setWishlistExtractedData({
              imageUrl: parsed.imageUrl,
              data: parsed.data || {} as any,
            });
          }
          
          // If form was open when user left, keep it open
          if (parsed.isFormOpen === true) {
            console.log('[WishlistPage] Auto-opening form (was open when user navigated away)');
            setShowWishlistForm(true);
            setHasDraft(false); // Don't show banner, form is already open
          } else {
            // Form was explicitly closed, show draft banner
            console.log('[WishlistPage] Showing draft banner (form was explicitly closed)');
            setHasDraft(true);
          }
        } else {
          sessionStorage.removeItem('wishlist_form_draft');
        }
      }
    } catch (e) {
      console.error('[WishlistPage] Failed to check for draft:', e);
    }
  }, []);

  async function loadItems() {
    try {
      setLoading(true);
      const loaded = await wishlistService.loadWishlist();
      setItems(loaded);
      console.log('[WishlistPage] Loaded items:', loaded.length);
    } catch (error) {
      console.error('[WishlistPage] Failed to load items:', error);
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  async function handleMoveToCellar(item: WishlistItem) {
    if (!confirm('Move this wine to your cellar?')) {
      return;
    }

    setMovingId(item.id);

    try {
      // Create bottle from wishlist item
      const createInput: bottleService.CreateBottleInput = {
        // Wine info
        wine_name: item.wineName || 'Unknown',
        producer: item.producer || 'Unknown',
        vintage: item.vintage,
        region: item.region,
        country: item.country,
        grapes: item.grapes ? item.grapes.split(',').map(g => g.trim()).filter(Boolean) : null,
        color: item.color || 'red',
        appellation: null,
        vivino_wine_id: null,
        vivino_url: item.vivinoUrl,
        rating: null,
        wine_notes: item.note,
        
        // Bottle info
        quantity: 1,
        purchase_price: null,
        purchase_price_currency: null,
        notes: item.restaurantName ? `From: ${item.restaurantName}` : null,
        purchase_date: null,
        purchase_location: item.restaurantName || null,
        storage_location: null,
        bottle_size_ml: 750,
        tags: ['wishlist'], // Tag as coming from wishlist (Wishlist feature - dev only)
        image_url: item.imageUrl,
      };

      console.log('[WishlistPage] Creating bottle from wishlist item:', item.id);
      await bottleService.createBottle(createInput);

      // Remove from wishlist
      await wishlistService.removeWishlistItem(item.id);

      // Reload items
      await loadItems();

      toast.success(t('wishlist.movedToCellar'));
      console.log('[WishlistPage] ✅ Moved to cellar and removed from wishlist');
    } catch (error: any) {
      console.error('[WishlistPage] Failed to move to cellar:', error);
      toast.error(error.message || t('wishlist.moveError'));
    } finally {
      setMovingId(null);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this wine from your wishlist?')) {
      return;
    }

    try {
      await wishlistService.removeWishlistItem(id);
      await loadItems();
      toast.success('Removed from wishlist');
    } catch (error: any) {
      console.error('[WishlistPage] Failed to remove item:', error);
      toast.error(error.message || t('errors.generic'));
    }
  }

  // Filter items by search query (client-side)
  const filteredItems = searchQuery.trim()
    ? items.filter(item => {
        const query = searchQuery.toLowerCase();
        return (
          item.producer?.toLowerCase().includes(query) ||
          item.wine_name?.toLowerCase().includes(query) ||
          item.restaurant_name?.toLowerCase().includes(query) ||
          item.region?.toLowerCase().includes(query) ||
          item.grapes?.toLowerCase().includes(query)
        );
      })
    : items;

  // Format "Added X days ago"
  function formatTimeAgo(createdAt: string): string {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('wishlist.today');
    if (diffDays === 1) return t('wishlist.yesterday');
    return t('wishlist.daysAgo', { count: diffDays });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wine-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h1 
            className="text-3xl font-bold"
            style={{ 
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {t('wishlist.title')} {/* "Wishlist" */}
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          {t('wishlist.subtitle')} {/* "Wines you want to buy later" */}
        </p>
      </div>

      {/* Draft Notice */}
      {hasDraft && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-lg flex items-center justify-between"
          style={{
            backgroundColor: 'var(--color-blue-50)',
            border: '1px solid var(--color-blue-200)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="text-2xl">📝</div>
            <div>
              <div 
                className="font-semibold text-sm"
                style={{ color: 'var(--color-blue-900)' }}
              >
                You have an unsaved draft
              </div>
              <div 
                className="text-xs"
                style={{ color: 'var(--color-blue-700)' }}
              >
                Continue where you left off
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                sessionStorage.removeItem('wishlist_form_draft');
                setHasDraft(false);
                toast.success('Draft deleted');
              }}
              className="px-3 py-1.5 text-sm rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
              }}
            >
              Delete
            </button>
            <button
              onClick={() => {
                setShowWishlistForm(true);
                setHasDraft(false);
              }}
              className="px-4 py-1.5 text-sm font-medium rounded-lg transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                color: 'var(--text-inverse)',
              }}
            >
              Resume Draft
            </button>
          </div>
        </motion.div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <svg 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: 'var(--text-tertiary)' }}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('wishlist.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-3 rounded-xl border transition-colors"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-input)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div 
            className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <svg 
              className="w-12 h-12"
              style={{ color: 'var(--text-tertiary)' }}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <h3 
            className="text-xl font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {searchQuery ? t('wishlist.noResults') : t('wishlist.empty')}
          </h3>
          <p 
            className="mb-6"
            style={{ color: 'var(--text-secondary)' }}
          >
            {searchQuery ? t('wishlist.noResultsDesc') : t('wishlist.emptyDesc')}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowAddSheet(true)} // Wishlist feature - Open add sheet directly
              className="px-6 py-3 rounded-lg font-medium transition-all min-h-[44px]"
              style={{
                background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                color: 'var(--text-inverse)',
              }}
            >
              {t('wishlist.addFirst')} {/* "Add Your First Wine" */}
            </button>
          )}
        </motion.div>
      )}

      {/* Wishlist Items */}
      <AnimatePresence mode="popLayout">
        {filteredItems.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mb-4 rounded-xl border p-4 sm:p-6 transition-all hover:shadow-md"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-soft)',
            }}
          >
            {/* Mobile hardening (wishlist): Improved card layout for narrow screens */}
            <div className="flex gap-3 sm:gap-4">
              {/* Image */}
              {item.imageUrl && (
                <div className="flex-shrink-0 w-16 h-20 sm:w-20 sm:h-24 rounded-lg overflow-hidden bg-gray-100">
                  <img 
                    src={item.imageUrl} 
                    alt={`${item.producer} ${item.wineName}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Title - improved wrapping on mobile */}
                <h3 
                  className="text-base sm:text-lg font-semibold mb-1 break-words"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {item.producer} {item.wineName}
                  {item.vintage && <span className="ml-2 font-normal whitespace-nowrap">{item.vintage}</span>}
                </h3>

                {/* Metadata */}
                <div 
                  className="text-sm mb-2 space-y-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {item.region && <div>📍 {item.region}</div>}
                  {item.grapes && <div>🍇 {item.grapes}</div>}
                  {item.restaurantName && (
                    <div className="font-medium">
                      🍽️ {item.restaurantName}
                    </div>
                  )}
                  {item.note && (
                    <div 
                      className="italic mt-2 p-2 rounded text-sm break-words"
                      style={{ 
                        backgroundColor: 'var(--bg-secondary)',
                      }}
                    >
                      "{item.note}"
                    </div>
                  )}
                </div>

                {/* Time ago */}
                <div 
                  className="text-xs mt-2"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {formatTimeAgo(item.createdAt)}
                </div>
              </div>
            </div>

            {/* Actions */}
            {/* Mobile hardening (wishlist): Improved touch targets and mobile stacking */}
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              {/* Primary: Move to Cellar */}
              <button
                onClick={() => handleMoveToCellar(item)}
                disabled={movingId === item.id}
                className="px-4 py-3 rounded-lg font-medium transition-all flex-1 min-h-[44px]"
                style={{
                  background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                  color: 'var(--text-inverse)',
                  opacity: movingId === item.id ? 0.6 : 1,
                }}
              >
                {movingId === item.id ? t('common.moving') : t('wishlist.moveToCellar')}
              </button>

              {/* Secondary: Remove */}
              <button
                onClick={() => handleRemove(item.id)}
                disabled={movingId === item.id}
                className="px-4 py-3 rounded-lg font-medium transition-colors min-h-[44px] sm:w-auto"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-danger)',
                }}
              >
                {t('common.remove')}
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Wishlist feature - Add Bottle Sheet */}
      <AddBottleSheet
        isOpen={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onUploadPhoto={() => {}} // Not used (direct file input)
        onManualEntry={() => {
          setShowAddSheet(false);
          // Open wishlist form for manual entry (no photo)
          setWishlistExtractedData(null); // No extracted data
          setShowWishlistForm(true);
        }}
        onPhotoSelected={async (file) => {
          // Wishlist feature (dev only) - Primary button: Add photo to wishlist
          setShowAddSheet(false);
          setIsParsing(true);
          toast.info(t('cellar.labelParse.reading'));

          try {
            // Step 1: Upload image
            const { scanLabelImage } = await import('../services/labelScanService');
            const result = await scanLabelImage(file);

            // Step 2: Parse with AI
            const parseResult = await labelParseService.parseLabelImage(result.imageUrl);

            if (parseResult.success && parseResult.data) {
              // Convert parsed data to form data
              const formData = labelParseService.convertParsedDataToFormData(parseResult.data);

              // Auto-generate Vivino search URL from extracted data
              const vivinoUrl = generateVivinoSearchUrl({
                producer: formData.producer,
                wine_name: formData.wine_name,
                vintage: formData.vintage,
                region: formData.region,
                grape: formData.grapes,
              });

              setWishlistExtractedData({
                imageUrl: result.imageUrl,
                data: {
                  wine_name: formData.wine_name || null,
                  producer: formData.producer || null,
                  vintage: formData.vintage || null,
                  region: formData.region || null,
                  country: null,
                  grape: formData.grapes || null,
                  wine_color: formData.color || null,
                  bottle_size_ml: null,
                  vivino_url: vivinoUrl || undefined, // ✨ Auto-populated Vivino URL
                  confidence: parseResult.data.overallConfidence ? {
                    producer: parseResult.data.producer?.confidence || 'low',
                    wine_name: parseResult.data.name?.confidence || 'low',
                    vintage: parseResult.data.vintage?.confidence || 'low',
                    overall: parseResult.data.overallConfidence,
                  } : {
                    producer: 'medium',
                    wine_name: 'medium',
                    vintage: 'medium',
                    overall: 'medium',
                  },
                  notes: '',
                } as ExtractedWineData,
              });
              console.log('[WishlistPage] ✅ Wishlist: Extracted data ready');
              console.log('[WishlistPage] Auto-generated Vivino URL:', vivinoUrl);
              console.log('[WishlistPage] FormData:', formData);
              console.log('[WishlistPage] ParseResult:', parseResult.data);
            } else {
              console.warn('[WishlistPage] ⚠️ Wishlist: AI extraction returned no data');
              toast.warning(t('cellar.labelParse.noData'));
            }
          } catch (error: any) {
            console.error('[WishlistPage] ❌ Wishlist: Label parsing error:', error);
            toast.error(t('cellar.labelParse.error') + (error.message ? ` (${error.message.substring(0, 50)})` : ''));
          } finally {
            setIsParsing(false);
            setShowWishlistForm(true); // Open wishlist form after parsing
          }
        }}
        onPhotoSelectedForWishlist={async (file) => {
          // Wishlist feature (dev only) - Amber button: Add to wishlist (same logic)
          setShowAddSheet(false);
          setIsParsing(true);
          toast.info(t('cellar.labelParse.reading'));

          try {
            // Step 1: Upload image
            const { scanLabelImage } = await import('../services/labelScanService');
            const result = await scanLabelImage(file);

            // Step 2: Parse with AI
            const parseResult = await labelParseService.parseLabelImage(result.imageUrl);

            if (parseResult.success && parseResult.data) {
              // Convert parsed data to form data
              const formData = labelParseService.convertParsedDataToFormData(parseResult.data);

              // Auto-generate Vivino search URL from extracted data
              const vivinoUrl = generateVivinoSearchUrl({
                producer: formData.producer,
                wine_name: formData.wine_name,
                vintage: formData.vintage,
                region: formData.region,
                grape: formData.grapes,
              });

              setWishlistExtractedData({
                imageUrl: result.imageUrl,
                data: {
                  wine_name: formData.wine_name || null,
                  producer: formData.producer || null,
                  vintage: formData.vintage || null,
                  region: formData.region || null,
                  country: null,
                  grape: formData.grapes || null,
                  wine_color: formData.color || null,
                  bottle_size_ml: null,
                  vivino_url: vivinoUrl || undefined, // ✨ Auto-populated Vivino URL
                  confidence: parseResult.data.overallConfidence ? {
                    producer: parseResult.data.producer?.confidence || 'low',
                    wine_name: parseResult.data.name?.confidence || 'low',
                    vintage: parseResult.data.vintage?.confidence || 'low',
                    overall: parseResult.data.overallConfidence,
                  } : {
                    producer: 'medium',
                    wine_name: 'medium',
                    vintage: 'medium',
                    overall: 'medium',
                  },
                  notes: '',
                } as ExtractedWineData,
              });
              console.log('[WishlistPage] ✅ Wishlist: Extracted data ready');
              console.log('[WishlistPage] Auto-generated Vivino URL:', vivinoUrl);
              console.log('[WishlistPage] FormData:', formData);
              console.log('[WishlistPage] ParseResult:', parseResult.data);
            } else {
              console.warn('[WishlistPage] ⚠️ Wishlist: AI extraction returned no data');
              toast.warning(t('cellar.labelParse.noData'));
            }
          } catch (error: any) {
            console.error('[WishlistPage] ❌ Wishlist: Label parsing error:', error);
            toast.error(t('cellar.labelParse.error') + (error.message ? ` (${error.message.substring(0, 50)})` : ''));
          } finally {
            setIsParsing(false);
            setShowWishlistForm(true); // Open wishlist form after parsing
          }
        }}
      />

      {/* Wishlist feature (dev only) - Wishlist Form */}
      {showWishlistForm && (
        <AnimatePresence>
          <WishlistForm
            onClose={() => {
              setShowWishlistForm(false);
              setWishlistExtractedData(null);
            }}
            onSuccess={() => {
              setShowWishlistForm(false);
              setWishlistExtractedData(null);
              setHasDraft(false); // Clear draft notice
              loadItems(); // Reload wishlist items
            }}
            prefillData={{
              wine_name: wishlistExtractedData?.data.wine_name || undefined,
              producer: wishlistExtractedData?.data.producer || undefined,
              vintage: wishlistExtractedData?.data.vintage || undefined,
              region: wishlistExtractedData?.data.region || undefined,
              country: wishlistExtractedData?.data.country || undefined,
              grapes: wishlistExtractedData?.data.grape || undefined,
              color: wishlistExtractedData?.data.wine_color || undefined,
              vivino_url: (wishlistExtractedData?.data as any)?.vivino_url || undefined,
              imageUrl: wishlistExtractedData?.imageUrl,
              extractedData: wishlistExtractedData?.data,
            }}
          />
        </AnimatePresence>
      )}

      {/* Parsing indicator */}
      {isParsing && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="animate-spin text-4xl mb-4">🍷</div>
            <p className="text-lg font-medium">{t('cellar.labelParse.reading')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

