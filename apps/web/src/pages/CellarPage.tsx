import { useState, useEffect, useMemo, useRef } from 'react';
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
import { BulkAnalysisModal } from '../components/BulkAnalysisModal';
import { WineLoader } from '../components/WineLoader';
import { TonightsOrbit } from '../components/TonightsOrbit';
import { DrinkWindowTimeline } from '../components/DrinkWindowTimeline';
import { WineDetailsModal } from '../components/WineDetailsModal';
import { MultiBottleImport } from '../components/MultiBottleImport'; // Feedback iteration (dev only)
import { ShareCellarModal } from '../components/ShareCellarModal'; // Feedback iteration (dev only)
import { WishlistForm } from '../components/WishlistForm'; // Wishlist feature (dev only)
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

export function CellarPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const featureFlags = useFeatureFlags(); // Load user's feature flags
  const wishlistEnabled = useFeatureFlag('wishlistEnabled'); // Wishlist feature flag
  const [bottles, setBottles] = useState<bottleService.BottleWithWineInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingBottle, setEditingBottle] = useState<bottleService.BottleWithWineInfo | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [openedBottleName, setOpenedBottleName] = useState('');
  const [showBulkAnalysis, setShowBulkAnalysis] = useState(false);
  const [bulkAnalysisCooldown, setBulkAnalysisCooldown] = useState(false);
  
  // Feedback iteration (dev only) - Multi-bottle import state
  const [showMultiBottleImport, setShowMultiBottleImport] = useState(false);
  
  // Feedback iteration (dev only) - Share cellar state
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Wishlist feature (dev only) - Wishlist state
  const [showWishlistForm, setShowWishlistForm] = useState(false);
  const [wishlistExtractedData, setWishlistExtractedData] = useState<{
    imageUrl: string;
    data: ExtractedWineData;
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
      const analysis = await aiAnalysisService.generateAIAnalysis(bottle, i18n.language);
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

  function handleBulkAnalysis() {
    console.log('[CellarPage] Opening bulk analysis modal');
    setShowBulkAnalysis(true);
  }

  async function handleBulkAnalysisComplete() {
    console.log('[CellarPage] Bulk analysis complete, reloading bottles');
    await loadBottles();
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
   * Memoized for performance
   */
  const bottlesInCellar = useMemo(() => {
    return bottles.filter(bottle => bottle.quantity > 0);
  }, [bottles]);

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

    return result;
  }, [bottlesInCellar, searchQuery, activeFilters, sortBy, sortDir]);

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
                ? t('cellar.bottleCount', { count: bottlesInCellar.length })
                : t('cellar.filteredCount', { count: filteredBottles.length, total: bottlesInCellar.length })}
            </p>
          </div>

          {/* Action Buttons - Always show Add Bottle, others only when cellar has bottles */}
          <div className="flex flex-col xs:flex-row gap-2 sm:gap-2">
            {/* Beta feature: Share button - Only show when cellar has bottles */}
            {bottlesInCellar.length > 0 && featureFlags.canShareCellar && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowShareModal(true);
                }}
                className="btn-luxury-secondary text-sm sm:text-base w-full xs:w-auto"
                title={t('cellar.shareCellar.button')}
              >
                {t('cellar.shareCellar.button')}
              </button>
            )}
            {/* Beta feature: Multi-bottle import - Only show when cellar has bottles */}
            {bottlesInCellar.length > 0 && featureFlags.canMultiBottleImport && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMultiBottleImport(true);
                }}
                className="btn-luxury-secondary text-sm sm:text-base w-full xs:w-auto"
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.15) 100%)',
                  borderColor: 'var(--color-amber-300)',
                }}
              >
                {t('cellar.multiBottle.button')}
              </button>
            )}
            {/* Import CSV - Only show when cellar has bottles */}
            {bottlesInCellar.length > 0 && (
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
            {/* Add Bottle - Only show when cellar has bottles (empty state has its own buttons) */}
            {bottlesInCellar.length > 0 && (
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
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters - Only show when cellar has bottles */}
      {bottlesInCellar.length > 0 && (
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
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mb-4"
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

      {/* Innovation Widgets - Tonight's Orbit and Drink Window */}
      {bottlesInCellar.length > 0 && !searchQuery && activeFilters.length === 0 && (
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

      {(() => {
        console.log('[CellarPage] Rendering bottles check:', {
          bottlesInCellar: bottlesInCellar.length,
          isEmpty: bottlesInCellar.length === 0
        });
        return null;
      })()}
      {bottlesInCellar.length === 0 ? (
        /**
         * Empty State - Enhanced UX
         * 
         * - Sophisticated messaging
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

          {/* Sophisticated heading */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-2xl sm:text-3xl mb-3"
            style={{ 
              color: 'var(--text-primary)', 
              fontFamily: 'var(--font-display)',
              fontWeight: 'var(--font-bold)',
              letterSpacing: '-0.02em',
            }}
          >
            {t('cellar.empty.title')}
          </motion.h2>

          {/* Refined explanation */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-base sm:text-lg mb-2 max-w-md mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('cellar.empty.subtitle')}
          </motion.p>

          {/* Additional helpful hint */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-sm mb-8 max-w-md mx-auto"
            style={{ 
              color: 'var(--text-tertiary)',
              fontStyle: 'italic'
            }}
          >
            {t('cellar.empty.hint')}
          </motion.p>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="flex flex-col xs:flex-row gap-2 xs:gap-3 justify-center max-w-lg mx-auto"
          >
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
            {/* Beta feature: Multi-bottle import in empty state - Enabled in dev OR if user has flag */}
            {featureFlags.canMultiBottleImport && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMultiBottleImport(true);
                }}
                className="btn-luxury-secondary w-full xs:w-auto"
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.15) 100%)',
                  borderColor: 'var(--color-amber-300)',
                }}
              >
                {t('cellar.multiBottle.button')}
              </button>
            )}
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
        showWishlistOption={false} // Don't show wishlist option in Cellar page - only in Wishlist page
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
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedBottle(null);
        }}
        bottle={selectedBottle}
        onMarkAsOpened={handleMarkOpened}
        onRefresh={loadBottles}
      />

      {/* Beta feature: Multi-Bottle Import Modal - Enabled in dev OR if user has flag */}
      {featureFlags.canMultiBottleImport && (
        <MultiBottleImport
          isOpen={showMultiBottleImport}
          onClose={() => setShowMultiBottleImport(false)}
          onSuccess={async () => {
            await loadBottles();
            setShowMultiBottleImport(false);
          }}
          existingBottles={bottles}
        />
      )}

      {/* Beta feature: Share Cellar Modal - Enabled in dev OR if user has flag */}
      {featureFlags.canShareCellar && (
        <ShareCellarModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          bottles={bottles}
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

