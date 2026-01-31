import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../lib/toast';
import { BottleCard } from '../components/BottleCard';
import { BottleForm } from '../components/BottleForm';
import { CSVImport } from '../components/CSVImport';
import { CelebrationModal } from '../components/CelebrationModal';
import { OpenBottleQuantityModal } from '../components/OpenBottleQuantityModal';
import { AddBottleSheet } from '../components/AddBottleSheet';
import { LabelCapture } from '../components/LabelCapture';
import { BulkAnalysisModal } from '../components/BulkAnalysisModal';
import { WineLoader } from '../components/WineLoader';
import { TonightsOrbit } from '../components/TonightsOrbit';
import { DrinkWindowTimeline } from '../components/DrinkWindowTimeline';
import { WineDetailsModal } from '../components/WineDetailsModal';
import { MultiBottleImport } from '../components/MultiBottleImport'; // Feedback iteration (dev only)
import { WishlistForm } from '../components/WishlistForm'; // Wishlist feature (dev only)
import { WineEventBanner, type WineEvent } from '../components/WineEventBanner'; // Wine World Moments
// Onboarding v1 – value first: Onboarding components (DEV ONLY)
import { WelcomeModal } from '../components/WelcomeModal';
import { DemoBanner } from '../components/DemoBanner';
import { DemoRecommendationCard } from '../components/DemoRecommendationCard';
import { FirstBottleSuccessModal } from '../components/FirstBottleSuccessModal';
import * as bottleService from '../services/bottleService';
import * as historyService from '../services/historyService';
import * as aiAnalysisService from '../services/aiAnalysisService';
import type { ExtractedWineData } from '../services/labelScanService';
import * as labelParseService from '../services/labelParseService';
import { trackBottle, trackCSV, trackSommelier } from '../services/analytics';
import { generateVivinoSearchUrl } from '../utils/vivinoAutoLink';
import { isDevEnvironment } from '../utils/devOnly'; // Feedback iteration (dev only)
import { useFeatureFlags } from '../hooks/useFeatureFlags'; // Feature flags for beta features
import { useFeatureFlag } from '../contexts/FeatureFlagsContext'; // Feature flags context
// Onboarding v1 – production: Onboarding utilities and demo data
import * as onboardingUtils from '../utils/onboarding';
import { DEMO_BOTTLES } from '../data/demoCellar';
import * as wineEventsService from '../services/wineEventsService'; // Wine World Moments

export function CellarPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const featureFlags = useFeatureFlags(); // Load user's feature flags (beta features)
  const wishlistEnabled = useFeatureFlag('wishlistEnabled'); // Wishlist feature flag
  const csvImportEnabled = useFeatureFlag('csvImportEnabled'); // CSV Import permission flag
  const [bottles, setBottles] = useState<bottleService.BottleWithWineInfo[]>([]);
  const [loading, setLoading] = useState(true); // Keep true for proper initial load
  const [loadingMore, setLoadingMore] = useState(false); // Infinite scroll: loading more bottles
  const [hasMore, setHasMore] = useState(true); // Infinite scroll: more bottles available
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingBottle, setEditingBottle] = useState<bottleService.BottleWithWineInfo | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [openedBottleName, setOpenedBottleName] = useState('');
  const [showBulkAnalysis, setShowBulkAnalysis] = useState(false);
  const [bulkAnalysisCooldown, setBulkAnalysisCooldown] = useState(false);
  
  // Quantity modal state (for opening multiple bottles)
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [bottleToOpen, setBottleToOpen] = useState<bottleService.BottleWithWineInfo | null>(null);
  
  // Feedback iteration (dev only) - Multi-bottle import state
  const [showMultiBottleImport, setShowMultiBottleImport] = useState(false);
  
  // Wishlist feature (dev only) - Wishlist state
  const [showWishlistForm, setShowWishlistForm] = useState(false);
  const [wishlistExtractedData, setWishlistExtractedData] = useState<{
    imageUrl: string;
    data: ExtractedWineData;
  } | null>(null);
  
  // Confirmation modal state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDanger?: boolean;
  } | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  
  // Sort state - persist in localStorage
  const [sortBy, setSortBy] = useState<string>(() => {
    try {
      return localStorage.getItem('cellar-sort-by') || 'createdAt';
    } catch {
      return 'createdAt';
    }
  });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => {
    try {
      return (localStorage.getItem('cellar-sort-dir') as 'asc' | 'desc') || 'desc';
    } catch {
      return 'desc';
    }
  });
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Wine Details Modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBottle, setSelectedBottle] = useState<bottleService.BottleWithWineInfo | null>(null);

  // Ref for bottles section (for smooth scroll)
  const bottlesSectionRef = useRef<HTMLDivElement>(null);
  
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

  // Onboarding v1 – production: Onboarding state
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showFirstBottleSuccess, setShowFirstBottleSuccess] = useState(false);
  const [firstBottleName, setFirstBottleName] = useState('');
  const hasCheckedOnboarding = useRef(false);

  // Wine World Moments: Wine events state
  const [activeEvents, setActiveEvents] = useState<WineEvent[]>([]);

  useEffect(() => {
    loadBottles(true); // Initial load with reset=true
    
    // Clear any stale form drafts on mount (prevent crashes from old data)
    try {
      localStorage.removeItem('wine-form-draft');
      console.log('[CellarPage] Cleared stale form draft on mount');
    } catch (e) {
      console.error('[CellarPage] Failed to clear form draft:', e);
    }
  }, []);

  // Listen for Camera FAB actions from global Layout
  useEffect(() => {
    const handleOpenLabelCapture = () => {
      setShowCamera(true);
    };
    const handleOpenManualForm = () => {
      setShowForm(true);
    };
    const handleOpenMultiBottleImport = () => {
      setShowMultiImport(true);
    };

    window.addEventListener('openLabelCapture', handleOpenLabelCapture);
    window.addEventListener('openManualForm', handleOpenManualForm);
    window.addEventListener('openMultiBottleImport', handleOpenMultiBottleImport);

    return () => {
      window.removeEventListener('openLabelCapture', handleOpenLabelCapture);
      window.removeEventListener('openManualForm', handleOpenManualForm);
      window.removeEventListener('openMultiBottleImport', handleOpenMultiBottleImport);
    };
  }, []);

  // Infinite scroll: Detect when user scrolls near bottom
  useEffect(() => {
    const handleScroll = () => {
      // Check if user scrolled near bottom (within 500px)
      const scrollPosition = window.innerHeight + window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;
      const threshold = 500; // px from bottom

      if (scrollPosition >= pageHeight - threshold && hasMore && !loadingMore && !loading) {
        console.log('[CellarPage] Near bottom, loading more bottles...');
        loadMoreBottles();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, loading, bottles.length]); // Reattach when these change

  // Onboarding v1 – production: Initialize onboarding for new users and re-engagement
  useEffect(() => {
    // Only check once to avoid multiple modals
    if (hasCheckedOnboarding.current) return;
    hasCheckedOnboarding.current = true;

    // Check if onboarding should be shown (first-time users OR re-engagement after 7 days)
    if (onboardingUtils.shouldShowOnboarding(bottles.length)) {
      if (bottles.length === 0) {
        console.log('[CellarPage] Showing onboarding - new user or re-engagement (empty cellar after 7 days)');
      } else {
        console.log('[CellarPage] First-time user detected - showing welcome modal');
      }
      setShowWelcomeModal(true);
    }

    // Check if demo mode is active
    if (onboardingUtils.isDemoModeActive()) {
      console.log('[CellarPage] Demo mode active');
      setIsDemoMode(true);
    }
  }, [bottles.length]);

  // Wine World Moments: Load active events
  useEffect(() => {
    async function fetchActiveEvents() {
      const events = await wineEventsService.getActiveEvents();
      setActiveEvents(events);
    }
    
    // Only fetch if not in demo mode and has bottles
    if (!isDemoMode && bottles.length > 0) {
      fetchActiveEvents();
    }
  }, [isDemoMode, bottles.length]);

  // Wine World Moments: Periodically check for new events
  // This ensures new events appear without requiring page refresh
  useEffect(() => {
    if (isDemoMode) return; // Don't check in demo mode

    // Check for new events every 5 minutes
    const intervalId = setInterval(async () => {
      console.log('[CellarPage] 🔄 Checking for new wine events...');
      const events = await wineEventsService.getActiveEvents();
      
      // Only update if events changed (different count or IDs)
      const currentIds = activeEvents.map(e => e.id).sort().join(',');
      const newIds = events.map(e => e.id).sort().join(',');
      
      if (newIds !== currentIds) {
        console.log('[CellarPage] 🎉 Events changed:', events.length, 'events');
        setActiveEvents(events);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(intervalId);
  }, [isDemoMode, activeEvents]);

  // Onboarding v1 – production: Auto-exit demo mode when user has real bottles
  useEffect(() => {
    // If demo mode is active AND user has at least one real bottle, exit demo mode
    if (isDemoMode && bottles.length > 0) {
      console.log('[CellarPage] User has real bottles, auto-exiting demo mode');
      onboardingUtils.deactivateDemoMode();
      setIsDemoMode(false);
    }
  }, [bottles, isDemoMode]);

  // Onboarding v1 – production: Handle welcome modal actions
  function handleShowDemo() {
    console.log('[CellarPage] User chose to see demo');
    onboardingUtils.markOnboardingSeen();
    onboardingUtils.activateDemoMode();
    setShowWelcomeModal(false);
    setIsDemoMode(true);
  }

  function handleSkipOnboarding() {
    console.log('[CellarPage] User skipped onboarding');
    onboardingUtils.markOnboardingSeen();
    setShowWelcomeModal(false);
  }

  // Onboarding v1 – production: Exit demo mode
  function handleExitDemo() {
    console.log('[CellarPage] Exiting demo mode');
    onboardingUtils.deactivateDemoMode();
    setIsDemoMode(false);
  }

  // Infinite scroll: Page size
  const PAGE_SIZE = 100; // Increased to load more bottles initially

  async function loadBottles(reset = false) {
    console.log('[CellarPage] ========== LOADING BOTTLES ==========');
    console.log('[CellarPage] Reset:', reset);
    
    try {
      const startTime = Date.now();
      const offset = reset ? 0 : bottles.length;
      
      console.log('[CellarPage] Fetching bottles from database...');
      console.log('[CellarPage] Offset:', offset, 'Limit:', PAGE_SIZE);
      
      // Load bottles with pagination
      const data = await bottleService.listBottles({ 
        offset, 
        limit: PAGE_SIZE 
      });
      
      console.log('[CellarPage] ✅ Bottles loaded successfully');
      console.log('[CellarPage] Number of bottles fetched:', data.length);
      
      // Update bottles state (append or replace)
      if (reset) {
        setBottles(data);
      } else {
        setBottles(prev => [...prev, ...data]);
      }
      
      // Check if there are more bottles to load
      setHasMore(data.length === PAGE_SIZE);
      
      console.log('[CellarPage] Bottles state updated');
      console.log('[CellarPage] Total bottles in state:', reset ? data.length : bottles.length + data.length);
      console.log('[CellarPage] Has more:', data.length === PAGE_SIZE);
      
      // Mobile UX Fix: Ensure minimum loading time to prevent tap issues
      // This gives the browser time to fully render and make buttons interactive
      const elapsedTime = Date.now() - startTime;
      const minLoadingTime = 400; // 400ms minimum
      if (elapsedTime < minLoadingTime) {
        console.log(`[CellarPage] Waiting ${minLoadingTime - elapsedTime}ms for smooth transition...`);
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
      }
    } catch (error: any) {
      console.error('[CellarPage] ❌ Error loading bottles:', error);
      toast.error(error.message || t('errors.generic'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // Infinite scroll: Load more bottles
  async function loadMoreBottles() {
    if (loadingMore || !hasMore) return;
    
    console.log('[CellarPage] Loading more bottles...');
    setLoadingMore(true);
    await loadBottles(false);
  }

  async function handleDelete(id: string) {
    // Show luxury confirmation modal instead of basic confirm()
    setConfirmationData({
      title: t('common.delete'),
      message: t('cellar.bottle.deleteConfirm'),
      confirmText: t('common.delete'),
      isDanger: true, // Red confirm button
      onConfirm: () => {
        setShowConfirmation(false);
        doDelete(id);
      },
    });
    setShowConfirmation(true);
  }

  async function doDelete(id: string) {
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
      const analysis = await aiAnalysisService.generateAIAnalysis(bottle, i18n.language);
      trackSommelier.success(); // Track successful analysis
      
      // Reload bottles to get fresh data
      await loadBottles(true); // Reset pagination
      
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
    // If quantity > 1, show quantity selection modal
    if (bottle.quantity > 1) {
      setBottleToOpen(bottle);
      setShowQuantityModal(true);
      return;
    }

    // If quantity == 1, proceed directly with opening
    await markBottleOpenedWithQuantity(bottle, 1);
  }

  async function markBottleOpenedWithQuantity(bottle: bottleService.BottleWithWineInfo, openedCount: number) {
    try {
      // Mark the bottle as opened with specified quantity
      await historyService.markBottleOpened({
        bottle_id: bottle.id,
        opened_count: openedCount,
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
      await loadBottles(true); // Reset pagination
    } catch (error: any) {
      console.error('Error marking bottle as opened:', error);
      toast.error(error.message || t('cellar.bottle.markOpenedFailed'));
    }
  }

  async function handleFormSuccess() {
    console.log('[CellarPage] ========== FORM SUCCESS ==========');
    console.log('[CellarPage] Reloading bottles from database...');
    
    // Onboarding v1 – production: Check if this is the first bottle
    const isFirstBottle = bottles.length === 0 && !onboardingUtils.hasAddedFirstBottle();
    
    // CRITICAL: Reload bottles FIRST to get updated data (reset pagination)
    await loadBottles(true); // Reset pagination to load from beginning
    console.log('[CellarPage] ✅ Bottles reloaded with latest data');
    
    // Onboarding v1 – production: Show first bottle success modal
    if (isFirstBottle) {
      console.log('[CellarPage] First bottle added! Showing success modal');
      onboardingUtils.markFirstBottleAdded();
      // Exit demo mode if active
      if (isDemoMode) {
        setIsDemoMode(false);
      }
      // Get the bottle name for the modal
      const newBottles = await bottleService.listBottles();
      if (newBottles.length > 0) {
        setFirstBottleName(newBottles[0].wine.wine_name);
      }
      setShowFirstBottleSuccess(true);
    }
    
    // Then close form and clear state
    setShowForm(false);
    setEditingBottle(null);
    setExtractedData(null); // Clear AI extraction data to prevent stale scans
    console.log('[CellarPage] Form closed, state cleared');
  }

  function handleImportSuccess() {
    setShowImport(false);
    loadBottles(true); // Reset pagination after import
  }

  function handleBulkAnalysis() {
    console.log('[CellarPage] Opening bulk analysis modal');
    setShowBulkAnalysis(true);
  }

  async function handleBulkAnalysisComplete() {
    console.log('[CellarPage] Bulk analysis complete, reloading bottles');
    await loadBottles(true); // Reset pagination
    setShowBulkAnalysis(false);
    
    // Set cooldown (5 minutes)
    setBulkAnalysisCooldown(true);
    setTimeout(() => {
      console.log('[CellarPage] Bulk analysis cooldown expired');
      setBulkAnalysisCooldown(false);
    }, 5 * 60 * 1000);
  }

  /**
   * Bottles in cellar (excluding consumed bottles)
   * Onboarding v1 – value first: Use demo bottles when in demo mode (DEV ONLY)
   * Memoized for performance
   */
  const bottlesInCellar = useMemo(() => {
    // Onboarding v1 – production: Return demo bottles when in demo mode
    if (isDemoMode) {
      console.log('[CellarPage] Using demo bottles:', DEMO_BOTTLES.length);
      return DEMO_BOTTLES;
    }
    return bottles.filter(bottle => bottle.quantity > 0);
  }, [bottles, isDemoMode]);

  // Total number of physical bottles (sum of all quantities)
  const totalBottleCount = useMemo(() => {
    return bottlesInCellar.reduce((sum, bottle) => sum + bottle.quantity, 0);
  }, [bottlesInCellar]);

  // Calculate unanalyzed bottles count (only for bottles in cellar)
  const unanalyzedCount = bottlesInCellar.filter(bottle => {
    const b = bottle as any;
    return !b.analysis_summary || !b.readiness_label;
  }).length;

  /**
   * Filter and search bottles
   * Memoized for performance
   */
  const filteredBottles = useMemo(() => {
    // Start with bottles in cellar (quantity > 0)
    let result = bottlesInCellar;
    
    console.log('[CellarPage] 🔍 Filtering bottles:', {
      total: bottlesInCellar.length,
      searchQuery,
      activeFilters,
    });

    // Apply search query (debounced via input)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((bottle) => {
        // Handle grapes as either string or array
        let grapesText = '';
        if (bottle.wine.grapes) {
          if (Array.isArray(bottle.wine.grapes)) {
            grapesText = bottle.wine.grapes.join(' ');
          } else if (typeof bottle.wine.grapes === 'string') {
            grapesText = bottle.wine.grapes;
          }
        }
        
        const searchableText = [
          bottle.wine.wine_name,
          bottle.wine.producer,
          bottle.wine.region,
          bottle.wine.vintage?.toString(),
          grapesText,
          bottle.wine.color, // Also search by color/style
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
        const readinessFilters = activeFilters.filter(f => ['ready', 'aging', 'pastPeak'].includes(f)); // Feedback iteration (dev only) - added pastPeak
        const otherFilters = activeFilters.filter(f => !['red', 'white', 'rose', 'sparkling', 'ready', 'aging', 'pastPeak'].includes(f));
        
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
            case 'pastPeak': // Feedback iteration (dev only)
              return bottle.readiness_status === 'PastPeak';
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

    // Apply sorting
    result = [...result].sort((a, b) => {
      let compareValue = 0;

      if (sortBy === 'createdAt') {
        // Sort by creation date
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        compareValue = dateA - dateB;
      } else if (sortBy === 'vintage') {
        // Sort by vintage (handle nulls - put them last)
        const vintageA = a.wine.vintage || 0;
        const vintageB = b.wine.vintage || 0;
        
        if (vintageA === 0 && vintageB === 0) compareValue = 0;
        else if (vintageA === 0) compareValue = 1; // nulls last
        else if (vintageB === 0) compareValue = -1; // nulls last
        else compareValue = vintageA - vintageB;
      } else if (sortBy === 'rating') {
        // Sort by rating (Vivino rating from wine table)
        const ratingA = (a.wine as any).rating || 0;
        const ratingB = (b.wine as any).rating || 0;
        
        if (ratingA === 0 && ratingB === 0) compareValue = 0;
        else if (ratingA === 0) compareValue = 1; // nulls last
        else if (ratingB === 0) compareValue = -1; // nulls last
        else compareValue = ratingA - ratingB;
      } else if (sortBy === 'readiness') {
        // Sort by readiness rank (Ready first, then Peak Soon, then Hold, then Unknown)
        const readinessRank: Record<string, number> = {
          'InWindow': 1,
          'Peak': 1,
          'Approaching': 2,
          'TooYoung': 3,
          'Unknown': 4,
        };
        
        const rankA = readinessRank[a.readiness_status || 'Unknown'] || 4;
        const rankB = readinessRank[b.readiness_status || 'Unknown'] || 4;
        compareValue = rankA - rankB;
        
        // Secondary sort by vintage if same readiness
        if (compareValue === 0) {
          const vintageA = a.wine.vintage || 0;
          const vintageB = b.wine.vintage || 0;
          compareValue = vintageB - vintageA; // Newer vintages first as secondary
        }
      }

      // Apply sort direction
      return sortDir === 'asc' ? compareValue : -compareValue;
    });
    
    console.log('[CellarPage] 🔍 Filtered result:', result.length, 'bottles');
    return result;
  }, [bottlesInCellar, searchQuery, activeFilters, sortBy, sortDir]);

  // Total filtered bottle count (sum of quantities in filtered results)
  const totalFilteredCount = useMemo(() => {
    return filteredBottles.reduce((sum, bottle) => sum + bottle.quantity, 0);
  }, [filteredBottles]);

  /**
   * Toggle filter chip
   */
  function toggleFilter(filter: string) {
    console.log('[CellarPage] 🔍 Filter clicked:', filter);
    console.log('[CellarPage] Current activeFilters BEFORE:', activeFilters);
    
    const willHaveFilters = !activeFilters.includes(filter) || activeFilters.length > 1;
    console.log('[CellarPage] Will have active filters after toggle:', willHaveFilters);
    
    setActiveFilters((prev) => {
      const newFilters = prev.includes(filter)
        ? prev.filter((f) => f !== filter)
        : [...prev, filter];
      console.log('[CellarPage] New activeFilters:', newFilters);
      return newFilters;
    });

    console.log('[CellarPage] Filter state updated, preparing to scroll...');
    console.log('[CellarPage] Tonight/DrinkWindow will hide:', willHaveFilters);

    // Wait for React to re-render and DOM to update before scrolling
    // Using requestAnimationFrame + setTimeout to ensure DOM is fully updated
    requestAnimationFrame(() => {
      setTimeout(() => {
        console.log('[CellarPage] 🎯 Scroll timeout triggered (after DOM update)');
        console.log('[CellarPage] bottlesSectionRef.current exists:', !!bottlesSectionRef.current);
        
        if (bottlesSectionRef.current) {
          console.log('[CellarPage] 📍 Scrolling to bottles section...');
          
          // Get element position and viewport info
          const element = bottlesSectionRef.current;
          const rect = element.getBoundingClientRect();
          console.log('[CellarPage] Element rect:', {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            height: rect.height,
            width: rect.width
          });
          console.log('[CellarPage] Current scroll position:', {
            pageYOffset: window.pageYOffset,
            scrollY: window.scrollY,
            innerHeight: window.innerHeight
          });
          
          // Check if bottles section is already visible
          const isVisible = rect.top >= 0 && rect.top <= window.innerHeight / 2;
          console.log('[CellarPage] Bottles section already visible:', isVisible, '(top:', rect.top, ')');
          
          // Calculate offset to account for fixed header + some breathing room
          const headerOffset = 100; // Top nav bar + padding
          const elementPosition = rect.top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          
          console.log('[CellarPage] Calculated scroll position:', {
            headerOffset,
            elementPosition,
            offsetPosition,
            willScrollBy: offsetPosition - window.pageYOffset
          });

          // Only scroll if not already in view or needs adjustment
          if (!isVisible || rect.top > 150) {
            console.log('[CellarPage] 🚀 Initiating LUXURY scroll...');
            luxuryScrollTo(Math.max(0, offsetPosition), 1200);
            console.log('[CellarPage] ✓ Luxury scroll animation started');
          } else {
            console.log('[CellarPage] ⏭️ Skipping scroll - bottles already visible at top');
          }
          
          // Verify scroll after animation completes
          setTimeout(() => {
            console.log('[CellarPage] 📊 Post-scroll position:', {
              pageYOffset: window.pageYOffset,
              scrollY: window.scrollY
            });
          }, 800);
        } else {
          console.warn('[CellarPage] ⚠️ bottlesSectionRef.current is null - cannot scroll');
        }
      }, 300); // Wait for DOM to fully update (widgets to hide)
    });
  }

  /**
   * Luxury smooth scroll with custom easing
   * Slower, more elegant animation than browser default
   */
  function luxuryScrollTo(targetPosition: number, duration: number = 1200) {
    // Get starting position from body (the actual scroll container)
    const startPosition = document.body.scrollTop || document.documentElement.scrollTop || window.pageYOffset || 0;
    const distance = targetPosition - startPosition;
    let startTime: number | null = null;

    console.log('[CellarPage] 🎨 Starting LUXURY scroll animation:', {
      from: startPosition,
      to: targetPosition,
      distance,
      duration
    });

    // Debug: Check if page is scrollable
    console.log('[CellarPage] 🔍 Scroll container debug:', {
      'window.pageYOffset': window.pageYOffset,
      'document.documentElement.scrollTop': document.documentElement.scrollTop,
      'document.body.scrollTop': document.body.scrollTop,
      'body.scrollHeight': document.body.scrollHeight,
      'html.scrollHeight': document.documentElement.scrollHeight,
      'window.innerHeight': window.innerHeight,
      'isScrollable': document.body.scrollHeight > window.innerHeight,
      'body.overflow': window.getComputedStyle(document.body).overflow,
      'html.overflow': window.getComputedStyle(document.documentElement).overflow,
      'body.overflowY': window.getComputedStyle(document.body).overflowY,
      'html.overflowY': window.getComputedStyle(document.documentElement).overflowY
    });

    // Elegant easing function (ease-in-out-cubic)
    function easeInOutCubic(t: number): number {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function animation(currentTime: number) {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      
      // Apply easing
      const easedProgress = easeInOutCubic(progress);
      const currentPosition = startPosition + (distance * easedProgress);
      
      // Scroll the body element (since html has overflow:hidden)
      document.body.scrollTop = currentPosition;
      document.documentElement.scrollTop = currentPosition;
      window.scrollTo(0, currentPosition);
      
      if (progress < 1) {
        requestAnimationFrame(animation);
      } else {
        console.log('[CellarPage] ✨ Luxury scroll animation COMPLETE');
        console.log('[CellarPage] 📍 Final position:', window.pageYOffset || document.body.scrollTop);
      }
    }

    requestAnimationFrame(animation);
  }

  /**
   * Clear all filters and search
   */
  function clearFilters() {
    setSearchQuery('');
    setActiveFilters([]);
  }

  /**
   * Wine World Moments: Dismiss event
   */
  async function handleEventDismiss(eventId: string) {
    try {
      await wineEventsService.dismissEvent(eventId);
      // Remove dismissed event from list
      setActiveEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (error) {
      console.error('[CellarPage] Failed to dismiss event:', error);
    }
  }

  /**
   * Wine World Moments: View matching bottles
   */
  function handleViewEventMatches(filterTag: string) {
    console.log('[CellarPage] 🍷 Event: Filtering by tag:', filterTag);
    setSearchQuery(filterTag);
    // Don't hide the banner - keep it visible so user can see context
    // setActiveEvent(null); // REMOVED - banner should stay visible
    
    // Scroll to bottles section after a short delay to let state update
    setTimeout(() => {
      if (bottlesSectionRef.current) {
        console.log('[CellarPage] 🍷 Event: Scrolling to bottles section');
        bottlesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  function handleSortChange(newSortBy: string, newSortDir: 'asc' | 'desc') {
    console.log('[CellarPage] 📊 Sort changed:', { newSortBy, newSortDir });
    setSortBy(newSortBy);
    setSortDir(newSortDir);
    setShowSortMenu(false);
    
    // Persist to localStorage
    try {
      localStorage.setItem('cellar-sort-by', newSortBy);
      localStorage.setItem('cellar-sort-dir', newSortDir);
    } catch (e) {
      console.error('[CellarPage] Failed to persist sort:', e);
    }

    // Smooth scroll to bottles section (skip Tonight's Selection and Drink Window)
    console.log('[CellarPage] 📊 Sort changed, preparing to scroll to bottles...');
    console.log('[CellarPage] 📏 BEFORE scroll - Current position:', {
      pageYOffset: window.pageYOffset,
      scrollY: window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight
    });
    
    requestAnimationFrame(() => {
      setTimeout(() => {
        console.log('[CellarPage] 🎯 Scroll timeout triggered (after sort)');
        console.log('[CellarPage] 📏 Current scroll position in timeout:', window.pageYOffset);
        
        if (bottlesSectionRef.current) {
          console.log('[CellarPage] ✅ bottlesSectionRef.current exists');
          
          const element = bottlesSectionRef.current;
          const rect = element.getBoundingClientRect();
          console.log('[CellarPage] 📍 Bottles section position:', {
            'rect.top': rect.top,
            'rect.bottom': rect.bottom,
            'rect.height': rect.height,
            'window.pageYOffset': window.pageYOffset,
            'window.scrollY': window.scrollY
          });
          
          // Check if bottles section is already visible at top
          const isVisible = rect.top >= 0 && rect.top <= 150;
          console.log('[CellarPage] 👁️ Bottles already visible at top:', isVisible, '(rect.top:', rect.top, ')');
          
          // Calculate scroll position
          const headerOffset = 100;
          const elementPosition = rect.top;
          const absolutePosition = elementPosition + window.pageYOffset;
          const offsetPosition = absolutePosition - headerOffset;
          const finalPosition = Math.max(0, offsetPosition);
          
          console.log('[CellarPage] 🧮 Scroll calculation:', {
            headerOffset,
            'elementPosition (rect.top)': elementPosition,
            'absolutePosition (rect.top + pageYOffset)': absolutePosition,
            'offsetPosition (absolute - headerOffset)': offsetPosition,
            'finalPosition (Math.max(0, offset))': finalPosition,
            'currentPosition': window.pageYOffset,
            'scrollDistance': finalPosition - window.pageYOffset
          });
          
          // Check if we need to scroll
          const needsScroll = !isVisible || rect.top > 150;
          console.log('[CellarPage] 🤔 Needs scroll:', needsScroll);
          
          // Scroll to bottles
          if (needsScroll) {
            console.log('[CellarPage] 🚀 CALLING window.scrollTo with:', {
              top: finalPosition,
              behavior: 'smooth'
            });
            
            const startPosition = window.pageYOffset;
            console.log('[CellarPage] 📍 Starting from position:', startPosition);
            console.log('[CellarPage] 🎨 Using LUXURY scroll animation (1.2s duration)');
            
            // Use custom luxury scroll animation
            try {
              luxuryScrollTo(finalPosition, 1200);
              console.log('[CellarPage] ✨ Luxury scroll animation started');
              
              // Verify scroll is working after a moment
              setTimeout(() => {
                const newPosition = window.pageYOffset;
                console.log('[CellarPage] 📊 Position 300ms into animation:', newPosition);
                console.log('[CellarPage] 📊 Scroll in progress:', Math.abs(newPosition - startPosition) > 5);
              }, 300);
              
              // Check final position after animation completes
              setTimeout(() => {
                const finalPos = window.pageYOffset;
                console.log('[CellarPage] 📊 FINAL position after animation (1200ms):', finalPos);
                console.log('[CellarPage] 📊 Expected:', finalPosition, 'Actual:', finalPos);
                console.log('[CellarPage] 📊 Total scroll distance:', finalPos - startPosition, 'px');
                const wasSuccessful = Math.abs(finalPos - finalPosition) < 50;
                console.log('[CellarPage] ✨ Luxury scroll successful:', wasSuccessful);
              }, 1300);
            } catch (error) {
              console.error('[CellarPage] ❌ Error in luxury scroll:', error);
            }
          } else {
            console.log('[CellarPage] ⏭️ SKIPPING scroll - bottles already visible at top');
          }
        } else {
          console.error('[CellarPage] ❌ bottlesSectionRef.current is NULL - cannot scroll');
        }
      }, 200);
    });
  }

  // Sort options (6 total as requested)
  const sortOptions = [
    { key: 'createdAt-desc', label: t('cellar.sort.recentlyAddedNewest', 'Recently Added (Newest)'), by: 'createdAt', dir: 'desc' as const, icon: '🆕' },
    { key: 'createdAt-asc', label: t('cellar.sort.recentlyAddedOldest', 'Recently Added (Oldest)'), by: 'createdAt', dir: 'asc' as const, icon: '📅' },
    { key: 'vintage-desc', label: t('cellar.sort.vintageNewest', 'Vintage (Newest)'), by: 'vintage', dir: 'desc' as const, icon: '🍷' },
    { key: 'vintage-asc', label: t('cellar.sort.vintageOldest', 'Vintage (Oldest)'), by: 'vintage', dir: 'asc' as const, icon: '🕰️' },
    { key: 'rating-desc', label: t('cellar.sort.ratingHighest', 'Rating (Highest First)'), by: 'rating', dir: 'desc' as const, icon: '⭐' },
    { key: 'readiness', label: t('cellar.sort.readiness', 'Readiness (Ready First)'), by: 'readiness', dir: 'asc' as const, icon: '✨' },
  ];

  const currentSortOption = sortOptions.find(opt => opt.by === sortBy && opt.dir === sortDir) || sortOptions[0];

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
              {filteredBottles.length === bottlesInCellar.length
                ? t('cellar.bottleCount', { count: totalBottleCount })
                : t('cellar.filteredCount', { count: totalFilteredCount, total: totalBottleCount })}
            </p>
          </div>

          {/* Action Buttons - Always show Add Bottle, others only when cellar has bottles */}
          {/* Mobile Fix: Wrap buttons in motion.div to prevent tap issues during page load/switch */}
          <motion.div
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col xs:flex-row gap-2 sm:gap-2"
            style={{ pointerEvents: 'auto' }} // Ensure buttons work immediately
          >
            {/* Import CSV - Only show when cellar has bottles AND user has permission */}
            {bottlesInCellar.length > 0 && csvImportEnabled && (
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
            )}
            {/* Add Bottle - Desktop only (mobile uses floating Camera FAB) */}
            {bottlesInCellar.length > 0 && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddSheet(true);
                }}
                className="btn-luxury-primary text-sm sm:text-base w-full xs:w-auto hidden md:flex"
                style={{ pointerEvents: 'auto' }} // Fix: Ensure button works immediately on page load/switch
              >
                <span>+ {t('cellar.addBottleButton')}</span>
              </button>
            )}
          </motion.div>
        </div>
      </div>

      {/* Search and Filters - Only show when cellar has bottles */}
      {bottlesInCellar.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }} // Fast animation for immediate interactivity
          className="mb-4 sm:mb-6 space-y-3"
          style={{ pointerEvents: 'auto' }} // Fix: Ensure filters/search work immediately
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

            {/* Feedback iteration (dev only) - "Past Peak" filter */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFilter('pastPeak');
              }}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 min-h-[36px]"
              style={{
                backgroundColor: activeFilters.includes('pastPeak')
                  ? 'var(--color-wine-500)'
                  : 'var(--color-stone-100)',
                color: activeFilters.includes('pastPeak') ? 'white' : 'var(--color-stone-700)',
                border: `2px solid ${
                  activeFilters.includes('pastPeak') ? 'var(--color-wine-500)' : 'var(--color-stone-200)'
                }`,
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              🍷 {t('cellar.filters.pastPeak')}
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

            {/* Bulk Analysis Button - Subtle */}
            {bottlesInCellar.length > 0 && (
              <button
                onClick={handleBulkAnalysis}
                disabled={bulkAnalysisCooldown}
                title={bulkAnalysisCooldown ? t('bulkAnalysis.cooldownTooltip') : t('bulkAnalysis.buttonLabel')}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 min-h-[36px] ml-auto"
                style={{
                  backgroundColor: bulkAnalysisCooldown ? 'var(--bg-muted)' : 'var(--wine-50)',
                  color: bulkAnalysisCooldown ? 'var(--text-tertiary)' : 'var(--wine-600)',
                  border: bulkAnalysisCooldown ? '2px solid var(--border-subtle)' : '2px solid var(--wine-200)',
                  cursor: bulkAnalysisCooldown ? 'not-allowed' : 'pointer',
                  opacity: bulkAnalysisCooldown ? 0.5 : 1,
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
              >
                🧙‍♂️ {t('bulkAnalysis.buttonLabel')}
                {unanalyzedCount > 0 && (
                  <span
                    className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      background: 'var(--wine-500)',
                      color: 'white',
                    }}
                  >
                    {unanalyzedCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Sort Button - Below Filters */}
      {bottlesInCellar.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }} // Removed delay for faster interactivity
          className="mb-4"
          style={{ pointerEvents: 'auto' }} // Fix: Ensure sort button works immediately
        >
          <button
            onClick={() => setShowSortMenu(true)}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 min-h-[40px]"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <span className="text-sm">{currentSortOption.icon}</span>
            <span style={{ color: 'var(--text-primary)' }}>{currentSortOption.label}</span>
            <span className="ml-auto" style={{ color: 'var(--text-tertiary)' }}>›</span>
          </button>
        </motion.div>
      )}

      {/* Onboarding v1 – production: Demo Banner */}
      {isDemoMode && (
        <DemoBanner onExitDemo={handleExitDemo} />
      )}

      {/* Onboarding v1 – production: Demo Recommendation Card */}
      {isDemoMode && bottlesInCellar.length > 0 && (
        <DemoRecommendationCard
          recommendedBottle={bottlesInCellar[1]} // Use Cloudy Bay (ready to drink)
          onAddBottle={() => {
            setIsDemoMode(false);
            setShowAddSheet(true);
          }}
        />
      )}

      {/* Wine World Moments: Event Banner(s) - Only show if no active search/filters */}
      {!isDemoMode && activeEvents.length > 0 && !searchQuery && activeFilters.length === 0 && (
        <WineEventBanner
          events={activeEvents}
          onDismiss={handleEventDismiss}
          onViewMatches={handleViewEventMatches}
        />
      )}

      {/* Innovation Widgets - Tonight's Orbit and Drink Window */}
      {bottlesInCellar.length > 0 && !searchQuery && activeFilters.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }} // Removed delay for faster rendering
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6"
          style={{ pointerEvents: 'auto' }} // Fix: Ensure widgets are immediately interactive
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

      {(() => {
        console.log('[CellarPage] Rendering bottles check:', {
          bottlesInCellar: bottlesInCellar.length,
          isEmpty: bottlesInCellar.length === 0
        });
        return null;
      })()}
      {bottlesInCellar.length === 0 ? (
        /**
         * Empty State - Onboarding v1 – value first
         * 
         * - Improved messaging focused on teaching the app
         * - Visual element (wine glass illustration)
         * - Clear call-to-action
         * - Mobile optimized
         */
        <motion.div
          key="empty-cellar-state"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="luxury-card text-center py-8 sm:py-12 px-4"
        >
          {/* Elegant wine glass visual with dramatic bouncy animation */}
          <motion.div
            key="wine-glass-animation"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: 0,
            }}
            transition={{ 
              duration: 0.6,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="text-7xl sm:text-8xl mb-6"
          >
            🍷
          </motion.div>

          {/* Onboarding v1 – value first: Improved heading */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="text-2xl sm:text-3xl mb-3"
            style={{ 
              color: 'var(--text-primary)', 
              fontFamily: 'var(--font-display)',
              fontWeight: 'var(--font-bold)',
              letterSpacing: '-0.02em',
            }}
          >
            {t('onboarding.emptyState.title')}
          </motion.h2>

          {/* Onboarding v1 – value first: Improved explanation */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="text-base sm:text-lg mb-8 max-w-md mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('onboarding.emptyState.subtitle')}
          </motion.p>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="flex flex-col xs:flex-row gap-2 xs:gap-3 justify-center max-w-lg mx-auto"
            style={{ pointerEvents: 'auto' }}
          >
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAddSheet(true);
              }}
              className="btn-luxury-primary w-full xs:w-auto text-base sm:text-lg"
              style={{ pointerEvents: 'auto' }}
            >
              {t('onboarding.emptyState.cta')}
            </button>
            {/* Import CSV - Only show if user has permission */}
            {csvImportEnabled && (
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
            )}
          </motion.div>
        </motion.div>
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
        <>
          {/**
           * Bottle Grid - Mobile Optimized
           * 
           * Breakpoints:
           * - Mobile (default): 1 column
           * - Tablet (sm: 640px+): 2 columns
           * - Desktop (lg: 1024px+): 3 columns
           * 
           * - Responsive gap (smaller on mobile)
           * - Cards automatically adjust padding via .card class
           */}
          <motion.div
            ref={bottlesSectionRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 cellar-grid"
          >
            {filteredBottles.map((bottle, index) => (
              <motion.div
                key={bottle.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.2 }} // Reduced delay & capped at 0.3s
                className="flex cellar-grid-item"
                style={{ pointerEvents: 'auto' }} // Fix: Ensure cards are immediately interactive
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
                  onShowDetails={() => {
                    setSelectedBottle(bottle);
                    setShowDetailsModal(true);
                  }}
                  isDemo={isDemoMode}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Infinite scroll: Loading more indicator */}
          {loadingMore && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center items-center py-8"
            >
              <WineLoader size="medium" />
              <span 
                className="ml-3 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('cellar.loadingMore', { defaultValue: 'Loading more bottles...' })}
              </span>
            </motion.div>
          )}

          {/* Infinite scroll: No more bottles indicator */}
          {!hasMore && filteredBottles.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <p 
                className="text-sm"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('cellar.allBottlesLoaded', { 
                  count: totalFilteredCount,
                  defaultValue: `All ${totalFilteredCount} bottles loaded` 
                })}
              </p>
            </motion.div>
          )}
        </>
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
            vivino_url: (extractedData.data as any)?.vivino_url || '', // Vivino auto-link (dev only)
          } : undefined}
          showWishlistOption={!!extractedData && !editingBottle} // Wishlist feature (dev only) - Show wishlist option for scanned wines
        />
      )}

      {showImport && (
        <CSVImport
          onClose={() => setShowImport(false)}
          onSuccess={handleImportSuccess}
        />
      )}

      {/* Celebration Modal for marking bottle as opened */}
      {/* Open Bottle Quantity Modal */}
      <OpenBottleQuantityModal
        isOpen={showQuantityModal}
        onClose={() => {
          setShowQuantityModal(false);
          setBottleToOpen(null);
        }}
        onConfirm={(quantity) => {
          if (bottleToOpen) {
            markBottleOpenedWithQuantity(bottleToOpen, quantity);
          }
          setShowQuantityModal(false);
          setBottleToOpen(null);
        }}
        maxQuantity={bottleToOpen?.quantity || 1}
        wineName={bottleToOpen?.wine.wine_name || ''}
      />

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

      {/* Bulk Analysis Modal */}
      <BulkAnalysisModal
        isOpen={showBulkAnalysis}
        onClose={() => setShowBulkAnalysis(false)}
        onComplete={handleBulkAnalysisComplete}
        totalBottles={bottles.length}
        unanalyzedCount={unanalyzedCount}
      />

      {/* Sort Modal */}
      <AnimatePresence>
        {showSortMenu && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setShowSortMenu(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="w-full max-w-lg mx-4 mb-4 sm:mb-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="luxury-card overflow-hidden"
                style={{
                  maxHeight: 'min(90vh, calc(100dvh - 4rem))',
                }}
              >
                {/* Header */}
                <div
                  className="px-6 py-5 flex-shrink-0 flex items-center justify-between"
                  style={{
                    background: 'linear-gradient(135deg, rgba(164, 77, 90, 0.05), rgba(212, 175, 55, 0.05))',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <h2
                    className="text-xl font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('cellar.sort.title', 'Sort Cellar')}
                  </h2>
                  <button
                    onClick={() => setShowSortMenu(false)}
                    className="text-2xl leading-none opacity-60 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    ×
                  </button>
                </div>

                {/* Sort Options */}
                <div className="p-6 space-y-2">
                  {sortOptions.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => handleSortChange(option.by, option.dir)}
                      className="w-full px-4 py-4 rounded-lg text-left transition-all flex items-center gap-3 min-h-[56px]"
                      style={{
                        backgroundColor: sortBy === option.by && sortDir === option.dir
                          ? 'var(--wine-50)'
                          : 'var(--bg-surface)',
                        border: sortBy === option.by && sortDir === option.dir
                          ? '2px solid var(--wine-200)'
                          : '1px solid var(--border-base)',
                        color: 'var(--text-primary)',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                      }}
                    >
                      <span className="text-2xl">{option.icon}</span>
                      <span className="flex-1 font-medium">{option.label}</span>
                      {sortBy === option.by && sortDir === option.dir && (
                        <span
                          className="text-xl font-bold"
                          style={{ color: 'var(--wine-500)' }}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Footer */}
                <div
                  className="px-6 py-4 flex-shrink-0"
                  style={{
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
                  }}
                >
                  <button
                    onClick={() => setShowSortMenu(false)}
                    className="btn-luxury-secondary w-full"
                    style={{ minHeight: '48px' }}
                  >
                    {t('common.close', 'Close')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
        onMultiBottleImport={() => {
          setShowAddSheet(false);
          setShowMultiBottleImport(true);
        }}
        showWishlistOption={false} // Don't show wishlist option in Cellar page - only in Wishlist page
        showMultiBottleOption={featureFlags.canMultiBottleImport} // Beta feature: show multi-bottle option if user has flag
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
              
              // Vivino auto-link (dev only) - Auto-generate Vivino search URL from extracted data
              const vivinoUrl = generateVivinoSearchUrl({
                producer: mergedData.data.producer,
                wine_name: mergedData.data.wine_name,
                vintage: mergedData.data.vintage,
                region: mergedData.data.region,
                grape: mergedData.data.grape,
              });
              
              if (vivinoUrl) {
                console.log('[CellarPage] 🍷 Auto-generated Vivino URL (direct photo):', vivinoUrl);
                (mergedData.data as any).vivino_url = vivinoUrl;
              }
              
              // **AUTO-FILL MISSING DATA FROM VIVINO** (Smart Merge)
              // If AI extraction is incomplete AND we have enough data to search Vivino,
              // automatically fetch missing fields from Vivino
              const hasEnoughDataToSearch = mergedData.data.producer && mergedData.data.wine_name;
              const hasMissingFields = !mergedData.data.vintage || !mergedData.data.region || !mergedData.data.grape;
              
              // IMPORTANT: Only auto-fetch if we have a DIRECT wine page URL, not a search URL
              // Search URLs won't work with the Vivino scraper (it needs /w/12345 format)
              const isDirectWineUrl = vivinoUrl && (vivinoUrl.includes('/w/') || vivinoUrl.includes('/wines/'));
              
              if (hasEnoughDataToSearch && hasMissingFields && isDirectWineUrl) {
                console.log('[CellarPage] 🔍 AI extraction incomplete. Auto-fetching from Vivino to fill gaps...');
                console.log('[CellarPage] Missing fields:', {
                  vintage: !mergedData.data.vintage,
                  region: !mergedData.data.region,
                  grape: !mergedData.data.grape,
                });
                
                try {
                  // Import Vivino fetcher
                  const { fetchVivinoWineData } = await import('../services/vivinoScraper');
                  
                  // Fetch from Vivino (uses short URL format internally)
                  const vivinoData = await fetchVivinoWineData(vivinoUrl);
                  
                  if (vivinoData && (vivinoData.name || vivinoData.winery)) {
                    console.log('[CellarPage] ✅ Vivino data fetched:', vivinoData);
                    
                    // **SMART MERGE: AI data takes priority, Vivino fills gaps only**
                    mergedData.data = {
                      wine_name: mergedData.data.wine_name || vivinoData.name || '',
                      producer: mergedData.data.producer || vivinoData.winery || '',
                      vintage: mergedData.data.vintage || vivinoData.vintage || undefined,
                      region: mergedData.data.region || vivinoData.region || '',
                      country: mergedData.data.country || vivinoData.country || '',
                      grape: mergedData.data.grape || vivinoData.grape || '',
                      wine_color: mergedData.data.wine_color || 'red',
                    };
                    
                    // Add rating from Vivino if available
                    if (vivinoData.rating) {
                      (mergedData.data as any).rating = vivinoData.rating;
                    }
                    
                    console.log('[CellarPage] 🎯 Smart merge complete. AI + Vivino data combined.');
                    toast.success(`🍷 ${t('cellar.labelParse.vivinoEnhanced', 'Enriched with Vivino data!')}`);
                  } else {
                    console.log('[CellarPage] ⚠️ Vivino fetch returned no data or error');
                  }
                } catch (error) {
                  console.error('[CellarPage] ❌ Vivino auto-fetch failed:', error);
                  // Don't show error to user - AI data is still valid, just not enhanced
                }
              } else if (!hasEnoughDataToSearch) {
                console.log('[CellarPage] ⚠️ Not enough data to search Vivino (need producer + wine_name)');
              } else if (!isDirectWineUrl) {
                console.log('[CellarPage] ⚠️ Skipping auto-fetch: Generated URL is a search page, not a direct wine page');
                console.log('[CellarPage] 💡 TIP: User can manually click "Search on Vivino" button to find the exact wine');
              } else {
                console.log('[CellarPage] ✅ AI extraction complete. No Vivino fetch needed.');
              }
              
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
            console.error('[CellarPage] Error message:', error.message);
            console.error('[CellarPage] Error name:', error.name);
            console.error('[CellarPage] User agent:', navigator.userAgent);
            
            // Track error
            analytics.trackLabelParse.error(
              error.name || 'UnknownError',
              'camera',
              error.message
            );
            
            const errorDetails = error.message ? ` (${error.message.substring(0, 50)})` : '';
            toast.error(t('cellar.labelParse.error') + errorDetails);
          } finally {
            setIsParsing(false);
          }
          
          // Open form
          setEditingBottle(null);
          setShowForm(true);
        }}
        onPhotoSelectedForWishlist={async (file) => {
          // Wishlist feature (dev only) - Direct photo processing for wishlist
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
              
              // Store extracted data for wishlist form
              setWishlistExtractedData({
                imageUrl: result.imageUrl,
                data: parseResult.data,
              });
              
              console.log('[CellarPage] ✅ Wishlist: Extracted data ready');
              // Open wishlist form on success
              setShowWishlistForm(true);
            } else {
              console.warn('[CellarPage] ⚠️ Wishlist: AI extraction returned no data');
              toast.warning(t('cellar.labelParse.noData'));
              // Still open form to allow manual entry
              setWishlistExtractedData({
                imageUrl: result.imageUrl,
                data: parseResult.data || {} as ExtractedWineData,
              });
              setShowWishlistForm(true);
            }
          } catch (error: any) {
            console.error('[CellarPage] ❌ Wishlist: Label parsing error:', error);
            toast.error(t('cellar.labelParse.error') + (error.message ? ` (${error.message.substring(0, 50)})` : ''));
          } finally {
            setIsParsing(false);
          }
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
              
              // Track label parse start
              const parseSource = result.source || 'library';
              analytics.trackLabelParse.start(parseSource as 'camera' | 'library');
              
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
                  
                  // Track success
                  analytics.trackLabelParse.success(extractedFieldNames.length, parseSource as 'camera' | 'library');
                  
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
                  
                  // Vivino auto-link (dev only) - Auto-generate Vivino search URL from extracted data
                  const vivinoUrl = generateVivinoSearchUrl({
                    producer: mergedData.data.producer,
                    wine_name: mergedData.data.wine_name,
                    vintage: mergedData.data.vintage,
                    region: mergedData.data.region,
                    grape: mergedData.data.grape,
                  });
                  
                  if (vivinoUrl) {
                    console.log('[CellarPage] 🍷 Auto-generated Vivino URL:', vivinoUrl);
                    (mergedData.data as any).vivino_url = vivinoUrl;
                  }
                  
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
                console.error('[CellarPage] Error name:', error.name);
                console.error('[CellarPage] User agent:', navigator.userAgent);
                console.error('[CellarPage] Browser:', navigator.vendor);
                console.error('[CellarPage] Platform:', navigator.platform);
                
                // Track error with details
                analytics.trackLabelParse.error(
                  error.name || 'UnknownError',
                  parseSource as 'camera' | 'library',
                  error.message
                );
                
                // Fallback to manual entry with image
                const errorFallbackData = {
                  imageUrl: result.imageUrl,
                  data: result.data || {} as ExtractedWineData,
                };
                console.log('[CellarPage] Error fallback data:', errorFallbackData);
                
                setExtractedData(errorFallbackData);
                console.log('[CellarPage] Set error fallback extracted data');
                
                // Show error toast with more details for debugging
                const errorDetails = error.message ? ` (${error.message.substring(0, 50)})` : '';
                toast.error(t('cellar.labelParse.error') + errorDetails);
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
        key={selectedBottle?.id || 'no-bottle'}
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedBottle(null);
        }}
        bottle={selectedBottle}
        onMarkAsOpened={handleMarkOpened}
        onRefresh={() => loadBottles(true)}
        onAnalyze={selectedBottle ? () => handleAnalyze(selectedBottle.id) : undefined}
      />

      {/* Beta feature: Multi-Bottle Import Modal - Enabled in dev OR if user has flag */}
      {featureFlags.canMultiBottleImport && (
        <MultiBottleImport
          isOpen={showMultiBottleImport}
          onClose={() => setShowMultiBottleImport(false)}
          onSuccess={async () => {
            await loadBottles(true); // Reset pagination
            setShowMultiBottleImport(false);
          }}
          existingBottles={bottles}
        />
      )}

      {/* Wishlist feature (dev only) - Wishlist Form */}
      <AnimatePresence>
        {isDevEnvironment() && showWishlistForm && wishlistExtractedData && (
          <WishlistForm
            onClose={() => {
              setShowWishlistForm(false);
              setWishlistExtractedData(null);
            }}
            onSuccess={() => {
              // Success handled by WishlistForm (shows toast)
              // Optionally navigate to wishlist page
              // navigate('/wishlist');
            }}
            prefillData={{
              wine_name: wishlistExtractedData.data.wine_name || undefined,
              producer: wishlistExtractedData.data.producer || undefined,
              vintage: wishlistExtractedData.data.vintage || undefined,
              region: wishlistExtractedData.data.region || undefined,
              country: wishlistExtractedData.data.country || undefined,
              grapes: wishlistExtractedData.data.grape || undefined,
              color: wishlistExtractedData.data.wine_color || undefined,
              imageUrl: wishlistExtractedData.imageUrl,
              extractedData: wishlistExtractedData.data,
            }}
          />
        )}
      </AnimatePresence>

      {/* Luxury Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && confirmationData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]"
            onClick={() => setShowConfirmation(false)}
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-soft)',
              }}
            >
              {/* Header */}
              <div 
                className="px-6 py-5 border-b"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <h3 
                  className="text-xl font-bold"
                  style={{ 
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
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
                  className="px-5 py-2.5 rounded-lg font-medium transition-colors min-h-[44px]"
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
                  className="px-5 py-2.5 rounded-lg font-medium transition-all min-h-[44px]"
                  style={{
                    background: confirmationData.isDanger 
                      ? 'linear-gradient(135deg, #dc2626, #b91c1c)' 
                      : 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
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

      {/* Onboarding v1 – production: Welcome Modal */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onShowDemo={handleShowDemo}
        onSkip={handleSkipOnboarding}
      />

      {/* Onboarding v1 – production: First Bottle Success Modal */}
      <FirstBottleSuccessModal
        isOpen={showFirstBottleSuccess}
        onClose={() => setShowFirstBottleSuccess(false)}
        bottleName={firstBottleName}
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

