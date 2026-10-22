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
import { supabase } from '../lib/supabase';
import * as wishlistService from '../services/wishlistService';
import * as bottleService from '../services/bottleService';
import type { WishlistItem } from '../services/wishlistService';
import { AddBottleSheet } from '../components/AddBottleSheet'; // Wishlist feature (dev only)
import { Bookmark, FilePen, MapPin, Plus, Search, Utensils, Grape, Trash2, Wine } from 'lucide-react';
import { WineLoader } from '../components/WineLoader';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { WineImage } from '../components/ui/WineImage';
import { OverflowMenu } from '../components/ui/OverflowMenu';
import { WishlistForm } from '../components/WishlistForm'; // Wishlist feature (dev only)
import { WishlistDetailsModal } from '../components/WishlistDetailsModal'; // Wishlist feature - details modal
import type { ExtractedWineData } from '../services/labelScanService'; // Wishlist feature (dev only)
import * as labelParseService from '../services/labelParseService'; // Wishlist feature (dev only)
import { generateVivinoSearchUrl } from '../utils/vivinoAutoLink'; // Wishlist feature - auto-generate Vivino URLs
import { isInsufficientCreditsError } from '../lib/insufficientCredits';

export function WishlistPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true); // Keep true for proper data loading
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
  
  // Confirmation modal state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDanger?: boolean;
  } | null>(null);

  // Details modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null);

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
    // Show luxury confirmation modal instead of basic confirm()
    setConfirmationData({
      title: t('wishlist.moveToCellar'),
      message: t('wishlist.moveToCellarConfirm'),
      confirmText: t('wishlist.moveToCellar'),
      onConfirm: () => {
        setShowConfirmation(false);
        doMoveToCellar(item);
      },
    });
    setShowConfirmation(true);
  }

  async function doMoveToCellar(item: WishlistItem) {
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
        entry_source: 'manual',
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
    // Show luxury confirmation modal instead of basic confirm()
    setConfirmationData({
      title: t('common.remove'),
      message: t('wishlist.removeConfirm'),
      confirmText: t('common.remove'),
      isDanger: true, // Red confirm button
      onConfirm: () => {
        setShowConfirmation(false);
        doRemove(id);
      },
    });
    setShowConfirmation(true);
  }

  async function doRemove(id: string) {
    try {
      await wishlistService.removeWishlistItem(id);
      await loadItems();
      toast.success(t('wishlist.removed'));
    } catch (error: any) {
      console.error('[WishlistPage] Failed to remove item:', error);
      toast.error(error.message || t('errors.generic'));
    }
  }

  async function handleSaveWishlistImage(imageUrl: string) {
    const id = selectedItem?.id;
    if (!id) return;

    const trimmed = imageUrl.trim();
    const nextUrl = trimmed ? trimmed : null;

    try {
      const updated = await wishlistService.updateWishlistItem(id, {
        imageUrl: nextUrl,
      });
      setSelectedItem(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      toast.success(
        nextUrl
          ? t('wineImage.updateSuccess', 'Wine image updated!')
          : t('wineImage.removeSuccess', 'Wine image removed')
      );
    } catch (error: any) {
      console.error('[WishlistPage] Failed to update wishlist image:', error);
      toast.error(error.message || t('errors.generic'));
      throw error;
    }
  }

  // Filter items by search query (client-side)
  const filteredItems = searchQuery.trim()
    ? items.filter(item => {
        const query = searchQuery.toLowerCase();
        return (
          item.producer?.toLowerCase().includes(query) ||
          item.wineName?.toLowerCase().includes(query) ||
          item.restaurantName?.toLowerCase().includes(query) ||
          item.region?.toLowerCase().includes(query) ||
          item.grapes?.toLowerCase().includes(query) ||
          item.note?.toLowerCase().includes(query)
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
      <WineLoader
        variant="page"
        size="lg"
        message={t('common.loading')}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        eyebrow={t('wishlist.eyebrow')}
        title={t('wishlist.title')}
        subtitle={t('wishlist.subtitle')}
        actions={
          items.length > 0 ? (
            <button onClick={() => setShowAddSheet(true)} className="btn-luxury-primary hidden sm:inline-flex">
              <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {t('wishlist.addWine')}
            </button>
          ) : undefined
        }
      />

      {/* Draft Notice */}
      {hasDraft && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="app-card-muted mb-4 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <div className="flex items-center gap-3">
            <span className="lp-blob lp-blob-gold app-blob-sm shrink-0" aria-hidden>
              <FilePen className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>
                {t('wishlist.draft.title')}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('wishlist.draft.body')}
              </div>
            </div>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <button
              onClick={() => {
                sessionStorage.removeItem('wishlist_form_draft');
                setHasDraft(false);
                toast.success(t('wishlist.draft.deleted'));
              }}
              className="btn-luxury-ghost text-sm"
            >
              {t('wishlist.draft.delete')}
            </button>
            <button
              onClick={() => {
                setShowWishlistForm(true);
                setHasDraft(false);
              }}
              className="btn-luxury-primary text-sm"
            >
              {t('wishlist.draft.resume')}
            </button>
          </div>
        </motion.div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: 'var(--text-tertiary)' }}
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('wishlist.searchPlaceholder')}
            aria-label={t('wishlist.searchPlaceholder')}
            className="w-full ps-11 pe-4 min-h-[48px] rounded-full border transition-colors focus:border-[var(--wine-500)]"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-input)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {filteredItems.length === 0 && (
        searchQuery ? (
          <EmptyState
            icon={<Search className="h-7 w-7" strokeWidth={1.75} aria-hidden />}
            title={t('wishlist.noResults')}
            body={t('wishlist.noResultsDesc')}
          />
        ) : (
          <EmptyState
            art="/assets/app/empty-wishlist.jpg"
            title={t('wishlist.empty')}
            body={t('wishlist.emptyDesc')}
            actions={
              <button onClick={() => setShowAddSheet(true)} className="btn-luxury-primary">
                <Bookmark className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                {t('wishlist.addFirst')}
              </button>
            }
          />
        )
      )}

      {/* Wishlist Items */}
      <AnimatePresence mode="popLayout">
        {filteredItems.map((item) => (
          <motion.article
            key={item.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="app-card mb-4 p-4 sm:p-5 transition-shadow hover:shadow-[var(--shadow-card-hover)] cursor-pointer"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button, a, [role="menu"]')) return;
              setSelectedItem(item);
              setShowDetailsModal(true);
            }}
          >
            <div className="flex gap-3 sm:gap-4">
              <WineImage
                src={item.imageUrl}
                alt={`${item.producer} ${item.wineName}`}
                className="w-16 h-20 sm:w-20 sm:h-24"
              />

              <div className="flex-1 min-w-0">
                <h3
                  className="text-lg sm:text-xl font-semibold leading-snug break-words"
                  style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display)' }}
                >
                  <button
                    type="button"
                    className="text-start rounded-sm min-h-[44px] inline-flex items-center py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-text)]"
                    onClick={() => {
                      setSelectedItem(item);
                      setShowDetailsModal(true);
                    }}
                    aria-label={t('cellar.bottle.viewDetailsFor', { name: `${item.wineName}${item.vintage ? ` ${item.vintage}` : ''}` })}
                    title={`${item.wineName}${item.vintage ? ` ${item.vintage}` : ''}`}
                  >
                    <bdi>{item.wineName}</bdi>
                    {item.vintage && (
                      <span className="ms-2 align-middle inline-flex px-2 py-0.5 rounded-full text-sm font-semibold" style={{ background: 'var(--bg-muted)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                        {item.vintage}
                      </span>
                    )}
                  </button>
                </h3>
                {item.producer && (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <bdi>{item.producer}</bdi>
                  </p>
                )}

                {item.restaurantName && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    <Utensils className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--accent-text)' }} aria-hidden />
                    <span className="min-w-0 break-words">{t('wishlist.card.source', { place: item.restaurantName })}</span>
                  </p>
                )}

                {item.note && (
                  <blockquote
                    className="mt-2 px-3 py-2 rounded-xl text-sm break-words"
                    style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-primary)', borderInlineStart: '3px solid var(--wine-200)' }}
                  >
                    <bdi>{item.note}</bdi>
                  </blockquote>
                )}

                {(item.region || item.grapes) && (
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {item.region && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden /> {item.region}
                      </span>
                    )}
                    {item.grapes && (
                      <span className="inline-flex items-center gap-1">
                        <Grape className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden /> {item.grapes}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs me-auto" style={{ color: 'var(--text-tertiary)' }}>
                {formatTimeAgo(item.createdAt)}
              </span>
              <button
                type="button"
                onClick={() => handleMoveToCellar(item)}
                disabled={movingId === item.id}
                className="btn-luxury-secondary !min-h-[44px] !py-2 !px-4 text-sm disabled:opacity-60"
              >
                <Wine className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                {movingId === item.id ? t('common.moving') : t('wishlist.moveToCellar')}
              </button>
              <OverflowMenu
                label={t('wishlist.card.moreActions', { name: item.wineName })}
                items={[
                  {
                    key: 'remove',
                    label: t('common.remove'),
                    icon: <Trash2 className="h-4 w-4" strokeWidth={1.75} />,
                    tone: 'danger',
                    disabled: movingId === item.id,
                    onSelect: () => handleRemove(item.id),
                  },
                ]}
              />
            </div>
          </motion.article>
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
          let openWishlistFormAfter = true;

          try {
            // Step 1: Upload image
            const { scanLabelImage } = await import('../services/labelScanService');
            const result = await scanLabelImage(file);

            // Step 2: Generate temporary URL for AI parsing
            const { data: signedUrlData, error: signedError } = await supabase.storage
              .from(result.imageBucket)
              .createSignedUrl(result.imagePath, 600);

            if (signedError) {
              throw new Error('Failed to process image');
            }

            const tempImageUrl = signedUrlData.signedUrl;

            // Step 3: Parse with AI
            const parseResult = await labelParseService.parseLabelImage(tempImageUrl);

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
                imageUrl: tempImageUrl, // Temporary URL for immediate display only
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
            if (isInsufficientCreditsError(error)) {
              openWishlistFormAfter = false;
              const detail: {
                context: 'scan';
                requiredCredits?: number;
                balance?: number;
              } = { context: 'scan' };
              if (
                typeof error.requiredCredits === 'number' &&
                typeof error.balance === 'number'
              ) {
                detail.requiredCredits = error.requiredCredits;
                detail.balance = error.balance;
              }
              window.dispatchEvent(
                new CustomEvent('sommi-insufficient-credits', { detail }),
              );
            } else {
              toast.error(t('cellar.labelParse.error') + (error.message ? ` (${error.message.substring(0, 50)})` : ''));
            }
          } finally {
            setIsParsing(false);
            if (openWishlistFormAfter) setShowWishlistForm(true);
          }
        }}
        onPhotoSelectedForWishlist={async (file) => {
          // Wishlist feature (dev only) - Amber button: Add to wishlist (same logic)
          setShowAddSheet(false);
          setIsParsing(true);
          toast.info(t('cellar.labelParse.reading'));
          let openWishlistFormAfter = true;

          try {
            // Step 1: Upload image
            const { scanLabelImage } = await import('../services/labelScanService');
            const result = await scanLabelImage(file);

            // Step 2: Generate temporary URL for AI parsing
            const { data: signedUrlData, error: signedError } = await supabase.storage
              .from(result.imageBucket)
              .createSignedUrl(result.imagePath, 600);

            if (signedError) {
              throw new Error('Failed to process image');
            }

            const tempImageUrl = signedUrlData.signedUrl;

            // Step 3: Parse with AI
            const parseResult = await labelParseService.parseLabelImage(tempImageUrl);

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
                imageUrl: tempImageUrl, // Temporary URL for immediate display only
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
            if (isInsufficientCreditsError(error)) {
              openWishlistFormAfter = false;
              const detail: {
                context: 'scan';
                requiredCredits?: number;
                balance?: number;
              } = { context: 'scan' };
              if (
                typeof error.requiredCredits === 'number' &&
                typeof error.balance === 'number'
              ) {
                detail.requiredCredits = error.requiredCredits;
                detail.balance = error.balance;
              }
              window.dispatchEvent(
                new CustomEvent('sommi-insufficient-credits', { detail }),
              );
            } else {
              toast.error(t('cellar.labelParse.error') + (error.message ? ` (${error.message.substring(0, 50)})` : ''));
            }
          } finally {
            setIsParsing(false);
            if (openWishlistFormAfter) setShowWishlistForm(true);
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

      {/* Floating Action Button - Always visible when wishlist has items */}
      {items.length > 0 && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddSheet(true)}
          className="fixed end-4 sm:hidden rounded-full w-14 h-14 flex items-center justify-center"
          style={{
            bottom: 'calc(6.5rem + env(safe-area-inset-bottom) + 1rem)', // 104px footer + safe-area + 16px gap (PWA-safe, adjusted for new floating footer)
            background: 'var(--sommi-gradient-primary)',
            boxShadow: 'var(--shadow-cta)',
            color: 'white',
            zIndex: 40,
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label={t('wishlist.addWine')}
        >
          <Plus className="w-6 h-6" strokeWidth={2} aria-hidden />
        </motion.button>
      )}

      {/* Parsing indicator - PWA animation fix: Wrapped in AnimatePresence with forced animation restart */}
      <AnimatePresence>
        {isParsing && (
          <motion.div
            key="wishlist-parsing-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-[1.5rem] px-8 py-7 text-center"
              style={{
                backgroundColor: 'var(--bg-surface)',
                boxShadow: 'var(--shadow-modal)',
                // PWA animation fix: Force hardware acceleration on iOS
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)',
              }}
            >
              {/* PWA animation fix: Inline animation + willChange for mobile reliability */}
              <div 
                className="animate-spin text-4xl mb-4"
                style={{
                  // Force animation to work in PWA standalone mode
                  willChange: 'transform',
                  transform: 'translateZ(0)',
                  WebkitTransform: 'translateZ(0)',
                  animation: 'spin 1s linear infinite',
                }}
              >
                🍷
              </div>
              <p className="text-lg font-medium" style={{ color: 'var(--text-heading)' }}>{t('cellar.labelParse.reading')}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wishlist Details Modal */}
      <WishlistDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        onMoveToCellar={handleMoveToCellar}
        onRemove={handleRemove}
        onSaveWishlistImage={handleSaveWishlistImage}
      />

      {/* Luxury Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && confirmationData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
            role="dialog"
            aria-modal="true"
            onClick={() => setShowConfirmation(false)}
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-[1.5rem] w-full max-w-md overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-soft)',
                boxShadow: 'var(--shadow-modal)',
              }}
            >
              {/* Header */}
              <div 
                className="px-6 py-5 border-b"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <h3 className="app-section-title">
                  {confirmationData.title}
                </h3>
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                <p 
                  className="text-base"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {confirmationData.message}
                </p>
              </div>

              {/* Footer */}
              <div 
                className="px-6 py-4 border-t flex gap-3 justify-end"
                style={{ 
                  borderColor: 'var(--border-soft)',
                  backgroundColor: 'var(--bg-secondary)',
                }}
              >
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="px-5 py-2.5 rounded-full font-medium transition-colors min-h-[44px]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmationData.onConfirm}
                  className="px-5 py-2.5 rounded-full font-medium transition-all min-h-[44px]"
                  style={{
                    background: confirmationData.isDanger 
                      ? 'linear-gradient(135deg, #c0392b, #9b2c22)' 
                      : 'var(--sommi-gradient-primary)',
                    color: 'white',
                  }}
                >
                  {confirmationData.confirmText || t('common.confirm')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

