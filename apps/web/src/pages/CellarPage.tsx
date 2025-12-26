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
import * as bottleService from '../services/bottleService';
import * as historyService from '../services/historyService';
import * as aiAnalysisService from '../services/aiAnalysisService';
import type { ExtractedWineData } from '../services/labelScanService';

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
  
  // Label scan state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showLabelCapture, setShowLabelCapture] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    imageUrl: string;
    data: ExtractedWineData;
  } | null>(null);

  useEffect(() => {
    loadBottles();
  }, []);

  async function loadBottles() {
    try {
      const data = await bottleService.listBottles();
      setBottles(data);
    } catch (error: any) {
      console.error('Error loading bottles:', error);
      toast.error(error.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('cellar.bottle.deleteConfirm'))) return;

    try {
      await bottleService.deleteBottle(id);
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
      
      // Reload bottles to get fresh data
      await loadBottles();
      
      // ✅ No success toast - visual feedback is sufficient
    } catch (error: any) {
      console.error('Error analyzing bottle:', error);
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

  function handleFormSuccess() {
    setShowForm(false);
    setEditingBottle(null);
    loadBottles();
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
    let result = [...bottles];

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

    // Apply active filters
    if (activeFilters.length > 0) {
      result = result.filter((bottle) => {
        return activeFilters.every((filter) => {
          switch (filter) {
            case 'red':
              return bottle.wine.color === 'red';
            case 'white':
              return bottle.wine.color === 'white';
            case 'rose':
              return bottle.wine.color === 'rose';
            case 'sparkling':
              return bottle.wine.color === 'sparkling';
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
            case 'analyzed':
              return bottle.readiness_status && bottle.readiness_status !== 'Unknown';
            default:
              return true;
          }
        });
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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-sm sm:text-base text-gray-600">{t('cellar.loading')}</p>
        </div>
      </div>
    );
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('cellar.title')}</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              {filteredBottles.length === bottles.length
                ? t('cellar.bottleCount', { count: bottles.length })
                : t('cellar.filteredCount', { count: filteredBottles.length, total: bottles.length })}
            </p>
          </div>

          {/* Action Buttons - Only show when cellar has bottles */}
          {bottles.length > 0 && (
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-2">
              <button
                onClick={() => setShowImport(true)}
                className="btn btn-secondary text-sm sm:text-base w-full xs:w-auto"
              >
                <span className="hidden xs:inline">{t('cellar.importCsv')}</span>
                <span className="xs:hidden">{t('cellar.importCsv')}</span>
              </button>
              <button
                onClick={() => setShowAddSheet(true)}
                className="btn btn-primary text-sm sm:text-base w-full xs:w-auto"
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
              className="w-full pl-11 pr-11 py-3 rounded-xl border-2 transition-all text-sm sm:text-base"
              style={{
                borderColor: searchQuery ? 'var(--color-wine-500)' : 'var(--color-stone-200)',
                backgroundColor: 'white',
                boxShadow: searchQuery ? 'var(--glow-wine)' : 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-wine-500)';
                e.currentTarget.style.boxShadow = 'var(--glow-wine)';
              }}
              onBlur={(e) => {
                if (!searchQuery) {
                  e.currentTarget.style.borderColor = 'var(--color-stone-200)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 transition-colors"
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
                onClick={() => toggleFilter(type)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0"
                style={{
                  backgroundColor: activeFilters.includes(type)
                    ? 'var(--color-wine-500)'
                    : 'var(--color-stone-100)',
                  color: activeFilters.includes(type) ? 'white' : 'var(--color-stone-700)',
                  border: `2px solid ${
                    activeFilters.includes(type) ? 'var(--color-wine-500)' : 'var(--color-stone-200)'
                  }`,
                }}
              >
                {t(`cellar.wineStyles.${type}`)}
              </button>
            ))}

            {/* Readiness Filters */}
            <button
              onClick={() => toggleFilter('ready')}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0"
              style={{
                backgroundColor: activeFilters.includes('ready')
                  ? 'var(--color-wine-500)'
                  : 'var(--color-stone-100)',
                color: activeFilters.includes('ready') ? 'white' : 'var(--color-stone-700)',
                border: `2px solid ${
                  activeFilters.includes('ready') ? 'var(--color-wine-500)' : 'var(--color-stone-200)'
                }`,
              }}
            >
              ✓ {t('cellar.filters.ready')}
            </button>

            <button
              onClick={() => toggleFilter('aging')}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0"
              style={{
                backgroundColor: activeFilters.includes('aging')
                  ? 'var(--color-wine-500)'
                  : 'var(--color-stone-100)',
                color: activeFilters.includes('aging') ? 'white' : 'var(--color-stone-700)',
                border: `2px solid ${
                  activeFilters.includes('aging') ? 'var(--color-wine-500)' : 'var(--color-stone-200)'
                }`,
              }}
            >
              ⏳ {t('cellar.filters.aging')}
            </button>

            <button
              onClick={() => toggleFilter('analyzed')}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0"
              style={{
                backgroundColor: activeFilters.includes('analyzed')
                  ? 'var(--color-wine-500)'
                  : 'var(--color-stone-100)',
                color: activeFilters.includes('analyzed') ? 'white' : 'var(--color-stone-700)',
                border: `2px solid ${
                  activeFilters.includes('analyzed') ? 'var(--color-wine-500)' : 'var(--color-stone-200)'
                }`,
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

      {bottles.length === 0 ? (
        /**
         * Empty State - Mobile Optimized
         * 
         * - Responsive text sizes
         * - Stacked buttons on small mobile
         * - Adequate padding for touch
         * - Buttons ONLY show here when empty (not in header)
         */
        <div className="text-center py-8 sm:py-12 card">
          <p className="text-lg sm:text-xl text-gray-600 mb-3 sm:mb-4">{t('cellar.empty.title')}</p>
          <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6 px-4">
            {t('cellar.empty.subtitle')}
          </p>
          <div className="flex flex-col xs:flex-row gap-2 xs:gap-3 justify-center max-w-sm mx-auto px-4">
            <button 
              onClick={() => setShowForm(true)} 
              className="btn btn-primary w-full xs:w-auto"
            >
              + {t('cellar.empty.addButton')}
            </button>
            <button 
              onClick={() => setShowImport(true)} 
              className="btn btn-secondary w-full xs:w-auto"
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
          className="text-center py-8 sm:py-12 card"
        >
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-lg sm:text-xl text-gray-600 mb-2">{t('cellar.search.noResults')}</p>
          <p className="text-sm sm:text-base text-gray-500 mb-4">
            {t('cellar.search.noResultsHint')}
          </p>
          <button
            onClick={clearFilters}
            className="btn btn-secondary"
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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        >
          {filteredBottles.map((bottle, index) => (
            <motion.div
              key={bottle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
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
            wine_name: extractedData.data.wine_name,
            producer: extractedData.data.producer,
            vintage: extractedData.data.vintage,
            region: extractedData.data.region,
            country: extractedData.data.country,
            grapes: extractedData.data.grape_variety,
            color: extractedData.data.wine_type,
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
        onScanLabel={() => {
          setShowAddSheet(false);
          setShowLabelCapture(true);
        }}
        onUploadPhoto={() => {
          setShowAddSheet(false);
          setShowLabelCapture(true);
        }}
        onManualEntry={() => {
          setShowAddSheet(false);
          setEditingBottle(null);
          setShowForm(true);
        }}
      />

      {/* Label Capture */}
      <AnimatePresence>
        {showLabelCapture && (
          <LabelCapture
            onSuccess={(result) => {
              setShowLabelCapture(false);
              setExtractedData(result);
              // Open form with prefilled data
              setEditingBottle(null);
              setShowForm(true);
            }}
            onCancel={() => setShowLabelCapture(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

