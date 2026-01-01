import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../lib/toast';
import { BottleCard } from '../components/BottleCard';
import { BottleForm } from '../components/BottleForm';
import { CSVImport } from '../components/CSVImport';
import { CelebrationModal } from '../components/CelebrationModal';
import { AddBottleSheet } from '../components/AddBottleSheet';
import { LabelCapture } from '../components/LabelCapture';
import { WineLoader } from '../components/WineLoader';
import { TonightsOrbit } from '../components/TonightsOrbit';
import { DrinkWindowTimeline } from '../components/DrinkWindowTimeline';
import { WineDetailsModal } from '../components/WineDetailsModal';
import * as bottleService from '../services/bottleService';
import * as historyService from '../services/historyService';
import * as aiAnalysisService from '../services/aiAnalysisService';
import type { ExtractedWineData } from '../services/labelScanService';
import * as labelParseService from '../services/labelParseService';
import { trackBottle, trackCSV, trackSommelier } from '../services/analytics';

export function CellarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bottles, setBottles] = useState<bottleService.BottleWithWineInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingBottle, setEditingBottle] = useState<bottleService.BottleWithWineInfo | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [openedBottleName, setOpenedBottleName] = useState('');
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  
  // Wine Details Modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBottle, setSelectedBottle] = useState<bottleService.BottleWithWineInfo | null>(null);
  
  // Label scan state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showLabelCapture, setShowLabelCapture] = useState(false);
  const [labelCaptureMode, setLabelCaptureMode] = useState<'camera' | 'upload'>('camera');
  const [extractedData, setExtractedData] = useState<{
    imageUrl: string;
    data: ExtractedWineData;
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedFields, setParsedFields] = useState<string[]>([]);

  useEffect(() => {
    loadBottles();
    
    // Clear any stale form drafts on mount (prevent crashes from old data)
    try {
      localStorage.removeItem('wine-form-draft');
      console.log('[CellarPage] Cleared stale form draft on mount');
    } catch (e) {
      console.error('[CellarPage] Failed to clear form draft:', e);
    }
  }, []);

  async function loadBottles() {
    console.log('[CellarPage] ========== LOADING BOTTLES ==========');
    try {
      console.log('[CellarPage] Fetching bottles from database...');
      const data = await bottleService.listBottles();
      console.log('[CellarPage] ✅ Bottles loaded successfully');
      console.log('[CellarPage] Number of bottles:', data.length);
      console.log('[CellarPage] Bottles:', data.map(b => ({
        id: b.id,
        wine_name: b.wine.wine_name,
        quantity: b.quantity
      })));
      setBottles(data);
      console.log('[CellarPage] Bottles state updated');
    } catch (error: any) {
      console.error('[CellarPage] ❌ Error loading bottles:', error);
      toast.error(error.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('cellar.bottle.deleteConfirm'))) return;

    try {
      await bottleService.deleteBottle(id);
      trackBottle.delete(); // Track bottle deletion
      setBottles(bottles.filter((b) => b.id !== id));
      toast.success(t('cellar.bottle.deleted'));
    } catch (error: any) {
      console.error('Error deleting bottle:', error);
      toast.error(error.message || t('cellar.bottle.deleteFailed'));
    }
  }

  async function handleAnalyze(id: string) {
    try {
      // Find the bottle to analyze
      const bottle = bottles.find((b) => b.id === id);
      if (!bottle) {
        throw new Error('Bottle not found');
      }

      /**
       * ANALYSIS SOURCE: ChatGPT-powered AI analysis via Supabase Edge Function
       * 
       * This generates a unique, bottle-specific sommelier note using:
       * - Wine name, producer, vintage, region, grapes, style
       * - User notes (if any)
       * - ChatGPT (gpt-4o-mini) with structured JSON output
       * 
       * Results are cached for 30 days to:
       * - Avoid repeated API calls
       * - Provide consistent analysis
       * - Keep costs low
       * 
       * The analysis includes:
       * - Summary (2-3 sentences, non-generic, references specific details)
       * - Reasons (bullet points explaining why)
       * - Readiness label (READY/HOLD/PEAK_SOON)
       * - Serving suggestions (temp, decant time, drink window)
       * - Confidence level (LOW/MEDIUM/HIGH)
       * 
       * UX: Visual feedback via card update. Errors shown via toast.
       */
      
      // Show subtle loading state (optional - can remove if too fast)
      setBottles(
        bottles.map((b) =>
          b.id === id ? { ...b, isAnalyzing: true } as any : b
        )
      );

      // Generate AI analysis
      const analysis = await aiAnalysisService.generateAIAnalysis(bottle);
      trackSommelier.success(); // Track successful analysis
      
      // Reload bottles to get fresh data
      await loadBottles();
      
      // ✅ No success toast - visual feedback is sufficient
    } catch (error: any) {
      console.error('Error analyzing bottle:', error);
      trackSommelier.error('analysis_failed'); // Track analysis error
      // ❌ Only show toast for errors
      toast.error(error.message || t('cellar.sommelier.failed'));
      
      // Clear loading state
      setBottles(
        bottles.map((b) =>
          b.id === id ? { ...b, isAnalyzing: false } as any : b
        )
      );
    }
  }

  async function handleMarkOpened(bottle: bottleService.BottleWithWineInfo) {
    try {
      // Mark the bottle as opened
      await historyService.markBottleOpened({
        bottle_id: bottle.id,
        occasion: 'casual',
        meal_type: undefined,
        vibe: undefined,
      });

      trackBottle.opened(bottle.wine.vintage || undefined); // Track bottle opened
      
      // Store bottle name for celebration modal
      setOpenedBottleName(bottle.wine.wine_name);
      
      // Show celebration modal
      setShowCelebration(true);
      
      // Reload bottles to update quantities
      await loadBottles();
    } catch (error: any) {
      console.error('Error marking bottle as opened:', error);
      toast.error(error.message || t('cellar.bottle.markOpenedFailed'));
    }
  }

  async function handleFormSuccess() {
    console.log('[CellarPage] ========== FORM SUCCESS ==========');
    console.log('[CellarPage] Reloading bottles from database...');
    
    // CRITICAL: Reload bottles FIRST to get updated data
    await loadBottles();
    console.log('[CellarPage] ✅ Bottles reloaded with latest data');
    
    // Then close form and clear state
    setShowForm(false);
    setEditingBottle(null);
    setExtractedData(null); // Clear AI extraction data to prevent stale scans
    console.log('[CellarPage] Form closed, state cleared');
  }

  function handleImportSuccess() {
    setShowImport(false);
    loadBottles();
  }

  /**
   * Filter and search bottles
   * Memoized for performance
   */
  const filteredBottles = useMemo(() => {
    // CRITICAL: Filter out bottles with 0 quantity (already consumed)
    let result = bottles.filter(bottle => bottle.quantity > 0);

    // Apply search query (debounced via input)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((bottle) => {
        const searchableText = [
          bottle.wine.wine_name,
          bottle.wine.producer,
          bottle.wine.region,
          bottle.wine.vintage?.toString(),
          ...(Array.isArray(bottle.wine.grapes) ? bottle.wine.grapes : []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    // Apply active filters with OR logic within categories
    if (activeFilters.length > 0) {
      result = result.filter((bottle) => {
        // Group filters by category
        const colorFilters = activeFilters.filter(f => ['red', 'white', 'rose', 'sparkling'].includes(f));
        const readinessFilters = activeFilters.filter(f => ['ready', 'aging'].includes(f));
        const otherFilters = activeFilters.filter(f => !['red', 'white', 'rose', 'sparkling', 'ready', 'aging'].includes(f));
        
        // Check color filters (OR logic - wine matches ANY selected color)
        const matchesColor = colorFilters.length === 0 || colorFilters.some((filter) => {
          switch (filter) {
            case 'red':
              return bottle.wine.color === 'red';
            case 'white':
              return bottle.wine.color === 'white';
            case 'rose':
              return bottle.wine.color === 'rose';
            case 'sparkling':
              return bottle.wine.color === 'sparkling';
            default:
              return false;
          }
        });
        
        // Check readiness filters (OR logic - wine matches ANY selected readiness state)
        const matchesReadiness = readinessFilters.length === 0 || readinessFilters.some((filter) => {
          switch (filter) {
            case 'ready':
              return (
                bottle.readiness_status === 'InWindow' ||
                bottle.readiness_status === 'Peak'
              );
            case 'aging':
              return (
                bottle.readiness_status === 'TooYoung' ||
                bottle.readiness_status === 'Approaching'
              );
            default:
              return false;
          }
        });
        
        // Check other filters (AND logic - wine must match ALL other filters)
        const matchesOther = otherFilters.every((filter) => {
          switch (filter) {
            case 'analyzed':
              return bottle.readiness_status && bottle.readiness_status !== 'Unknown';
            default:
              return true;
          }
        });
        
        // Wine must match all categories (AND between categories, OR within categories)
        return matchesColor && matchesReadiness && matchesOther;
      });
    }

    return result;
  }, [bottles, searchQuery, activeFilters]);

  /**
   * Toggle filter chip
   */
  function toggleFilter(filter: string) {
    setActiveFilters((prev) =>
      prev.includes(filter)
        ? prev.filter((f) => f !== filter)
        : [...prev, filter]
    );
  }

  /**
   * Clear all filters and search
   */
  function clearFilters() {
    setSearchQuery('');
    setActiveFilters([]);
  }

  if (loading) {
    return <WineLoader variant="page" size="lg" message={t('cellar.loading')} />;
  }

  return (
    <div>
      {/**
       * Page Header - Mobile Optimized
       * 
       * Mobile Layout:
       * - Stacked vertically on small screens
       * - Full-width buttons on mobile
       * - Reduced text sizes on mobile
       * - Better spacing and alignment
       */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
          <div>
            <h1 
              className="text-2xl sm:text-3xl font-bold"
              style={{ 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 'var(--font-bold)',
                lineHeight: 'var(--leading-tight)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('cellar.title')}
            </h1>
            <p 
              className="text-sm sm:text-base mt-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              {filteredBottles.length === bottles.length
                ? t('cellar.bottleCount', { count: bottles.length })
                : t('cellar.filteredCount', { count: filteredBottles.length, total: bottles.length })}
            </p>
          </div>

          {/* Action Buttons - Only show when cellar has bottles */}
          {bottles.length > 0 && (
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowImport(true);
                }}
                className="btn-luxury-secondary text-sm sm:text-base w-full xs:w-auto"
              >
                <span className="hidden xs:inline">{t('cellar.importCsv')}</span>
                <span className="xs:hidden">{t('cellar.importCsv')}</span>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddSheet(true);
                }}
                className="btn-luxury-primary text-sm sm:text-base w-full xs:w-auto"
              >
                <span className="hidden xs:inline">+ {t('cellar.addBottleButton')}</span>
                <span className="xs:hidden">+ {t('cellar.addBottleButton')}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filters - Only show when cellar has bottles */}
      {bottles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6 space-y-3"
        >
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('cellar.search.placeholder')}
              className="input-luxury w-full pl-11 pr-11 py-3 text-sm sm:text-base"
              style={{
                borderRadius: 'var(--radius-lg)',
              }}
            />
            {searchQuery && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearchQuery('');
                }}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 transition-colors min-w-[44px] min-h-[44px]"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
                aria-label={t('cellar.search.clear')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto touch-scroll no-scrollbar pb-2">
            <span className="text-xs font-medium text-gray-600 flex-shrink-0">
              {t('cellar.filters.label')}:
            </span>
            
            {/* Wine Type Filters */}
            {['red', 'white', 'rose', 'sparkling'].map((type) => (
              <button
                key={type}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFilter(type);
                }}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 min-h-[36px]"
                style={{
                  backgroundColor: activeFilters.includes(type)
                    ? 'var(--color-wine-500)'
                    : 'var(--color-stone-100)',
                  color: activeFilters.includes(type) ? 'white' : 'var(--color-stone-700)',
                  border: `2px solid ${
                    activeFilters.includes(type) ? 'var(--color-wine-500)' : 'var(--color-stone-200)'
                  }`,
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
              >
                {t(`cellar.wineStyles.${type}`)}
              </button>
            ))}

            {/* Readiness Filters */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFilter('ready');
              }}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 min-h-[36px]"
              style={{
                backgroundColor: activeFilters.includes('ready')
                  ? 'var(--color-wine-500)'
                  : 'var(--color-stone-100)',
                color: activeFilters.includes('ready') ? 'white' : 'var(--color-stone-700)',
                border: `2px solid ${
                  activeFilters.includes('ready') ? 'var(--color-wine-500)' : 'var(--color-stone-200)'
                }`,
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              ✓ {t('cellar.filters.ready')}
            </button>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFilter('aging');
              }}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 min-h-[36px]"
              style={{
                backgroundColor: activeFilters.includes('aging')
                  ? 'var(--color-wine-500)'
                  : 'var(--color-stone-100)',
                color: activeFilters.includes('aging') ? 'white' : 'var(--color-stone-700)',
                border: `2px solid ${
                  activeFilters.includes('aging') ? 'var(--color-wine-500)' : 'var(--color-stone-200)'
                }`,
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              ⏳ {t('cellar.filters.aging')}
            </button>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFilter('analyzed');
              }}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 min-h-[36px]"
              style={{
                backgroundColor: activeFilters.includes('analyzed')
                  ? 'var(--color-wine-500)'
                  : 'var(--color-stone-100)',
                color: activeFilters.includes('analyzed') ? 'white' : 'var(--color-stone-700)',
                border: `2px solid ${
                  activeFilters.includes('analyzed') ? 'var(--color-wine-500)' : 'var(--color-stone-200)'
                }`,
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              🔍 {t('cellar.filters.analyzed')}
            </button>

            {/* Clear Filters */}
            {(searchQuery || activeFilters.length > 0) && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 text-gray-600 hover:text-gray-800 underline"
              >
                {t('cellar.filters.clear')}
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Innovation Widgets - Tonight's Orbit and Drink Window */}
      {bottles.length > 0 && !searchQuery && activeFilters.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6"
        >
          <TonightsOrbit 
            bottles={filteredBottles}
            onBottleClick={(bottle) => {
              setSelectedBottle(bottle);
              setShowDetailsModal(true);
            }}
          />
          <DrinkWindowTimeline bottles={filteredBottles} />
        </motion.div>
      )}

      {bottles.length === 0 ? (
        /**
         * Empty State - Mobile Optimized
         * 
         * - Responsive text sizes
         * - Stacked buttons on small mobile
         * - Adequate padding for touch
         * - Buttons ONLY show here when empty (not in header)
         */
        <div className="luxury-card text-center py-8 sm:py-12">
          <p 
            className="text-lg sm:text-xl mb-3 sm:mb-4"
            style={{ color: 'var(--text-primary)', fontWeight: 'var(--font-semibold)' }}
          >
            {t('cellar.empty.title')}
          </p>
          <p 
            className="text-sm sm:text-base mb-4 sm:mb-6 px-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('cellar.empty.subtitle')}
          </p>
          <div className="flex flex-col xs:flex-row gap-2 xs:gap-3 justify-center max-w-sm mx-auto px-4">
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAddSheet(true);
              }}
              className="btn-luxury-primary w-full xs:w-auto"
            >
              + {t('cellar.empty.addButton')}
            </button>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowImport(true);
              }}
              className="btn-luxury-secondary w-full xs:w-auto"
            >
              {t('cellar.empty.importButton')}
            </button>
          </div>
        </div>
      ) : filteredBottles.length === 0 ? (
        /**
         * No Results State - When search/filters return empty
         */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="luxury-card text-center py-8 sm:py-12"
        >
          <div className="text-5xl mb-4">🔍</div>
          <p 
            className="text-lg sm:text-xl mb-2"
            style={{ color: 'var(--text-primary)', fontWeight: 'var(--font-semibold)' }}
          >
            {t('cellar.search.noResults')}
          </p>
          <p 
            className="text-sm sm:text-base mb-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('cellar.search.noResultsHint')}
          </p>
          <button
            onClick={clearFilters}
            className="btn-luxury-secondary"
          >
            {t('cellar.filters.clear')}
          </button>
        </motion.div>
      ) : (
        /**
         * Bottle Grid - Mobile Optimized
         * 
         * Breakpoints:
         * - Mobile (default): 1 column
         * - Tablet (sm: 640px+): 2 columns
         * - Desktop (lg: 1024px+): 3 columns
         * 
         * - Responsive gap (smaller on mobile)
         * - Cards automatically adjust padding via .card class
         */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 cellar-grid"
        >
          {filteredBottles.map((bottle, index) => (
            <motion.div
              key={bottle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className="flex cellar-grid-item"
            >
              <BottleCard
                bottle={bottle}
                onEdit={() => {
                  setEditingBottle(bottle);
                  setShowForm(true);
                }}
                onDelete={() => handleDelete(bottle.id)}
                onAnalyze={() => handleAnalyze(bottle.id)}
                onMarkOpened={() => handleMarkOpened(bottle)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {showForm && (
        <BottleForm
          bottle={editingBottle}
          onClose={() => {
            setShowForm(false);
            setEditingBottle(null);
            setExtractedData(null);
          }}
          onSuccess={() => {
            handleFormSuccess();
            setExtractedData(null);
          }}
          prefillData={extractedData ? {
            wine_name: extractedData.data?.wine_name || '',
            producer: extractedData.data?.producer || '',
            vintage: extractedData.data?.vintage,
            region: extractedData.data?.region || '',
            country: extractedData.data?.country || '',
            grapes: extractedData.data?.grape || '',
            color: extractedData.data?.wine_color || 'red',
            label_image_url: extractedData.imageUrl,
          } : undefined}
        />
      )}

      {showImport && (
        <CSVImport
          onClose={() => setShowImport(false)}
          onSuccess={handleImportSuccess}
        />
      )}

      {/* Celebration Modal for marking bottle as opened */}
      {/* Celebration Modal */}
      <CelebrationModal
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        bottleName={openedBottleName}
        onViewHistory={() => {
          setShowCelebration(false);
          navigate('/history');
        }}
      />

      {/* Add Bottle Sheet */}
      <AddBottleSheet
        isOpen={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onUploadPhoto={() => {
          setShowAddSheet(false);
          setLabelCaptureMode('upload'); // 'upload' mode allows both camera and gallery
          setShowLabelCapture(true);
        }}
        onManualEntry={() => {
          setShowAddSheet(false);
          setEditingBottle(null);
          setShowForm(true);
        }}
        onPhotoSelected={async (file) => {
          // Direct photo processing (bypasses LabelCapture modal for fewer taps)
          setShowAddSheet(false);
          setIsParsing(true);
          toast.info(t('cellar.labelParse.reading'));
          
          try {
            // Import scanLabelImage to upload and get URL
            const { scanLabelImage } = await import('../services/labelScanService');
            const result = await scanLabelImage(file);
            
            // Now process with AI
            const parseResult = await labelParseService.parseLabelImage(result.imageUrl);
            
            if (parseResult.success && parseResult.data) {
              const formData = labelParseService.convertParsedDataToFormData(parseResult.data);
              const extractedFieldNames = labelParseService.getExtractedFields(parseResult.data);
              setParsedFields(extractedFieldNames);
              
              const mergedData = {
                imageUrl: result.imageUrl,
                data: {
                  wine_name: formData.wine_name || '',
                  producer: formData.producer || '',
                  vintage: formData.vintage,
                  region: formData.region || '',
                  country: '',
                  grape: formData.grapes || '',
                  wine_color: formData.color || 'red',
                } as ExtractedWineData,
              };
              
              setExtractedData(mergedData);
              
              if (extractedFieldNames.length > 0) {
                toast.success(t('cellar.labelParse.success', { count: extractedFieldNames.length }));
              } else {
                toast.warning(t('cellar.labelParse.partial'));
              }
            } else {
              const fallbackData = {
                imageUrl: result.imageUrl,
                data: {} as ExtractedWineData,
              };
              setExtractedData(fallbackData);
              toast.warning(t('cellar.labelParse.failed'));
            }
          } catch (error: any) {
            console.error('[CellarPage] Direct photo processing error:', error);
            toast.error(t('cellar.labelParse.error'));
          } finally {
            setIsParsing(false);
          }
          
          // Open form
          setEditingBottle(null);
          setShowForm(true);
        }}
      />

      {/* AI Processing Overlay - Luxury Wine Glass Animation */}
      <AnimatePresence>
        {isParsing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
              background: 'rgba(250, 248, 245, 0.97)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <div className="flex flex-col items-center gap-6 px-6 text-center max-w-md">
              {/* Luxury Wine Glass Loader - Large and Prominent */}
              <div className="mb-2">
                <WineLoader 
                  size={120}
                  variant="default"
                />
              </div>
              
              {/* Message */}
              <div className="space-y-3">
                <h3 
                  className="text-2xl font-semibold"
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 'var(--font-bold)',
                  }}
                >
                  {t('cellar.labelParse.analyzing')}
                </h3>
                <p 
                  className="text-base leading-relaxed"
                  style={{ 
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {t('cellar.labelParse.analyzingSubtitle')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Label Capture */}
      <AnimatePresence>
        {showLabelCapture && (
          <LabelCapture
            mode={labelCaptureMode}
            onSuccess={async (result) => {
              console.log('[CellarPage] ========== LABEL CAPTURE SUCCESS ==========');
              console.log('[CellarPage] Result:', result);
              console.log('[CellarPage] Image URL:', result.imageUrl);
              console.log('[CellarPage] Result data:', result.data);
              
              // Don't close label capture yet - keep user on same view
              console.log('[CellarPage] Photo captured, starting AI processing...');
              
              // Show parsing state FIRST (before closing anything)
              setIsParsing(true);
              console.log('[CellarPage] Set isParsing to true');
              toast.info(t('cellar.labelParse.reading'));
              console.log('[CellarPage] Showed toast: reading label');
              
              // Now close label capture (user will see loading spinner)
              setShowLabelCapture(false);
              console.log('[CellarPage] Closed label capture modal');
              
              try {
                // Call AI parsing service
                console.log('[CellarPage] ========== STARTING AI PARSE ==========');
                console.log('[CellarPage] Calling labelParseService.parseLabelImage...');
                const parseResult = await labelParseService.parseLabelImage(result.imageUrl);
                console.log('[CellarPage] ========== PARSE RESULT ==========');
                console.log('[CellarPage] Parse result:', JSON.stringify(parseResult, null, 2));
                
                if (parseResult.success && parseResult.data) {
                  console.log('[CellarPage] ✅ Parse successful!');
                  console.log('[CellarPage] Parsed data:', parseResult.data);
                  
                  // Convert parsed data to form format
                  console.log('[CellarPage] Converting parsed data to form format...');
                  const formData = labelParseService.convertParsedDataToFormData(parseResult.data);
                  console.log('[CellarPage] Form data:', formData);
                  
                  const extractedFieldNames = labelParseService.getExtractedFields(parseResult.data);
                  console.log('[CellarPage] Extracted field names:', extractedFieldNames);
                  
                  // Store parsed fields for highlighting
                  setParsedFields(extractedFieldNames);
                  console.log('[CellarPage] Set parsed fields');
                  
                  // Merge with any existing extracted data from old label scan
                  const mergedData = {
                    imageUrl: result.imageUrl,
                    data: {
                      wine_name: formData.wine_name || result.data?.wine_name || '',
                      producer: formData.producer || result.data?.producer || '',
                      vintage: formData.vintage || result.data?.vintage,
                      region: formData.region || result.data?.region || '',
                      country: result.data?.country || '',
                      grape: formData.grapes || result.data?.grape || '',
                      wine_color: formData.color || result.data?.wine_color || 'red',
                    } as ExtractedWineData,
                  };
                  console.log('[CellarPage] Merged data:', mergedData);
                  console.log('[CellarPage] ✓ Vintage in merged data:', mergedData.data.vintage);
                  console.log('[CellarPage] ✓ Region in merged data:', mergedData.data.region);
                  
                  setExtractedData(mergedData);
                  console.log('[CellarPage] Set extracted data');
                  
                  // Show success message
                  const fieldsCount = extractedFieldNames.length;
                  console.log('[CellarPage] Fields count:', fieldsCount);
                  if (fieldsCount > 0) {
                    toast.success(t('cellar.labelParse.success', { count: fieldsCount }));
                    console.log('[CellarPage] Showed success toast');
                  } else {
                    toast.warning(t('cellar.labelParse.partial'));
                    console.log('[CellarPage] Showed partial toast');
                  }
                } else {
                  console.warn('[CellarPage] ⚠️ Parse failed or no data');
                  console.warn('[CellarPage] Parse result:', parseResult);
                  
                  // Still allow manual entry with the image
                  const fallbackData = {
                    imageUrl: result.imageUrl,
                    data: result.data || {} as ExtractedWineData,
                  };
                  console.log('[CellarPage] Fallback data:', fallbackData);
                  
                  setExtractedData(fallbackData);
                  console.log('[CellarPage] Set fallback extracted data');
                  
                  toast.warning(t('cellar.labelParse.failed'));
                  console.log('[CellarPage] Showed failed toast');
                }
              } catch (error: any) {
                console.error('[CellarPage] ❌ Parse error:', error);
                console.error('[CellarPage] Error message:', error.message);
                console.error('[CellarPage] Error stack:', error.stack);
                
                // Fallback to manual entry with image
                const errorFallbackData = {
                  imageUrl: result.imageUrl,
                  data: result.data || {} as ExtractedWineData,
                };
                console.log('[CellarPage] Error fallback data:', errorFallbackData);
                
                setExtractedData(errorFallbackData);
                console.log('[CellarPage] Set error fallback extracted data');
                
                toast.error(t('cellar.labelParse.error'));
                console.log('[CellarPage] Showed error toast');
              } finally {
                setIsParsing(false);
                console.log('[CellarPage] Set isParsing to false');
              }
              
              // ALWAYS open form with prefilled data (or empty if parse failed)
              console.log('[CellarPage] ========== OPENING FORM ==========');
              setEditingBottle(null);
              console.log('[CellarPage] Set editing bottle to null');
              setShowForm(true);
              console.log('[CellarPage] Set showForm to true - FORM SHOULD NOW BE VISIBLE');
            }}
            onCancel={() => {
              console.log('[CellarPage] Label capture cancelled');
              setShowLabelCapture(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Wine Details Modal (for Tonight's Selection clicks) */}
      <WineDetailsModal 
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedBottle(null);
        }}
        bottle={selectedBottle}
        onMarkAsOpened={handleMarkOpened}
        onRefresh={loadBottles}
      />
      
      {/* Grid Overflow Prevention */}
      <style>{`
        .cellar-grid {
          width: 100%;
        }
        
        .cellar-grid-item {
          min-width: 0;
        }
      `}</style>
    </div>
  );
}

