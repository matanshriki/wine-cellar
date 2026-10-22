/**
 * Tonight's Orbit Widget - Cinematic Luxury Edition
 * 
 * Premium carousel with Filmstruck-inspired design:
 * - Active card centered and fully visible
 * - Adjacent cards partially visible with scale/opacity effects
 * - Smooth auto-advance every ~3 seconds
 * - Pauses on interaction
 * - Respects prefers-reduced-motion
 * 
 * STABILITY FIXES (Feb 2026):
 * ✅ Stable data: useMemo prevents re-sorting on every render (no Math.random())
 * ✅ Index clamping: activeIndex auto-adjusts when bottles array changes
 * ✅ Navigation: preventDefault/stopPropagation prevent event interference
 * ✅ Autoplay: Single timer pattern with 5s manual cooldown
 * ✅ Keys: Stable unique keys prevent React remounting
 * ✅ Images: Fixed aspect-ratio containers prevent layout shift
 */

import { useState, useEffect, useRef, useMemo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';
import type { BottleWithWineInfo } from '../services/bottleService';
import * as labelArtService from '../services/labelArtService';
import { usePlanEveningFeature } from '../hooks/usePlanEveningFeature';
import { PlanEveningModal } from './PlanEveningModal';
import { EveningQueuePlayer } from './EveningQueuePlayer';
import * as eveningPlanService from '../services/eveningPlanService';
import type { EveningPlan } from '../services/eveningPlanService';
import { getLocalizedWineData } from '../utils/wineTranslations';
import { WineImage } from './ui/WineImage';
import { ChevronLeft, ChevronRight, Pause, Play, Star } from 'lucide-react';
import { selectTonightCategories, type CategorizedSlot, type SlotKey } from '../services/tonightsCategoryService';

interface TonightsOrbitCinematicProps {
  bottles: BottleWithWineInfo[];
  onBottleClick: (bottle: BottleWithWineInfo) => void;
}

export function TonightsOrbitCinematic({ bottles, onBottleClick }: TonightsOrbitCinematicProps) {
  const { t, i18n } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const unpauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastManualInteractionRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = shouldReduceMotion();
  const [autoplayStopped, setAutoplayStopped] = useState(false);
  const directionRef = useRef<1 | -1>(1);
  const titleId = useId();
  
  // Dev logging
  const isDev = import.meta.env.DEV;
  
  // Plan an evening feature
  const { isEnabled: isPlanEveningEnabled, isLoading: isPlanEveningLoading } = usePlanEveningFeature();
  const [showPlanEveningModal, setShowPlanEveningModal] = useState(false);
  const [activePlan, setActivePlan] = useState<EveningPlan | null>(null);
  const [checkingForPlan, setCheckingForPlan] = useState(true);
  const [showQueuePlayer, setShowQueuePlayer] = useState(false);
  const isPlanning = showPlanEveningModal || showQueuePlayer;

  // ─── Per-slot visual config ─────────────────────────────────────────────
  const SLOT_CONFIG: Record<SlotKey, { bg: string; color: string; icon: string }> = {
    bestTonight:  { bg: 'var(--wine-50)',          color: 'var(--accent-text)',        icon: '🍷' },
    crowdPleaser: { bg: 'var(--status-ready-bg)',  color: 'var(--status-ready-text)',  icon: '👥' },
    specialBottle:{ bg: 'var(--gold-50)',          color: 'var(--text-eyebrow)',       icon: '⭐' },
  };

  // For HOLD bottles shown in bestTonight slot, the categoryKey becomes
  // 'dashboard.tonightsOrbit.categories.bestAvailable' — use a neutral amber badge
  const HOLD_BADGE_STYLE = { bg: 'var(--status-hold-bg)', color: 'var(--status-hold-text)', icon: '⏳' };

  /**
   * Category-based selection — STABLE (useMemo, no randomness)
   *
   * Replaces the old single-score sort with three named slots:
   *   bestTonight, crowdPleaser, specialBottle
   * Each slot is picked deterministically from existing analysis fields.
   * No AI calls, no DB queries, no mutations.
   */
  const selection = useMemo(() => selectTonightCategories(bottles), [bottles]);

  // Flat ordered array of bottles for the carousel mechanics (unchanged)
  const topBottles = useMemo(
    () => selection.slots.map(s => s.bottle),
    [selection.slots],
  );

  // Fast bottle-id → slot lookup for card rendering
  const slotByBottleId = useMemo<Map<string, CategorizedSlot>>(() => {
    const map = new Map<string, CategorizedSlot>();
    for (const slot of selection.slots) map.set(slot.bottle.id, slot);
    return map;
  }, [selection.slots]);

  /**
   * CRITICAL FIX: Clamp activeIndex when topBottles changes
   * Prevents accessing invalid indices when bottles array updates
   */
  useEffect(() => {
    if (topBottles.length === 0) return;
    
    setActiveIndex(current => {
      if (current >= topBottles.length) {
        const newIndex = Math.min(current, topBottles.length - 1);
        if (isDev) console.log('[Carousel] 🔧 Clamping index:', current, '→', newIndex, '(length:', topBottles.length, ')');
        return newIndex;
      }
      return current;
    });
  }, [topBottles.length, isDev]);

  /**
   * Auto-advance timer - Fixed for smooth, single-step advancement
   * 
   * CRITICAL FIXES:
   * 1. Always clear existing timer before creating new one (prevents double-advance)
   * 2. Check for recent manual interactions (5s cooldown)
   * 3. Use functional state update to avoid stale closure
   * 4. Single source of truth for timer lifecycle
   */
  useEffect(() => {
    // Clear any existing timer first (prevents multiple intervals)
    if (timerRef.current) {
      if (isDev) console.log('[Carousel] Clearing existing timer');
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Don't start autoplay if conditions aren't met
    if (reduceMotion || topBottles.length <= 1 || isPaused || autoplayStopped || isPlanning) {
      if (isDev) console.log('[Carousel] Autoplay disabled:', { reduceMotion, count: topBottles.length, isPaused });
      return;
    }

    // Check if we should respect manual interaction cooldown
    const timeSinceManual = Date.now() - lastManualInteractionRef.current;
    if (timeSinceManual < 5000) {
      if (isDev) console.log('[Carousel] Waiting for manual interaction cooldown:', Math.round((5000 - timeSinceManual) / 1000) + 's remaining');
      // Set a timeout to start autoplay after cooldown
      const cooldownTimer = setTimeout(() => {
        setIsPaused(false); // This will re-trigger effect
      }, 5000 - timeSinceManual);
      return () => clearTimeout(cooldownTimer);
    }

    if (isDev) console.log('[Carousel] Starting autoplay timer');

    // Create new timer with functional state update (avoids stale closure)
    timerRef.current = setInterval(() => {
      if (isDev) console.log('[Carousel] Auto-advance tick');
      setActiveIndex((current) => {
        const next = (current + 1) % topBottles.length;
        if (isDev) console.log('[Carousel] Auto-advancing:', current, '→', next);
        return next;
      });
    }, 6000);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timerRef.current) {
        if (isDev) console.log('[Carousel] Cleanup: clearing timer');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [topBottles.length, isPaused, autoplayStopped, isPlanning, reduceMotion, isDev]);

  /**
   * Check for active evening plan on mount
   * Silently fails if table doesn't exist (migration not applied)
   */
  useEffect(() => {
    async function checkActivePlan() {
      if (!isPlanEveningEnabled) {
        setCheckingForPlan(false);
        return;
      }
      
      try {
        const plan = await eveningPlanService.getActivePlan();
        setActivePlan(plan);
        if (plan) {
          console.log('[TonightsOrbit] Active plan found');
        }
      } catch (error) {
        // Silently handle errors (likely table doesn't exist)
        // No need to log - this is expected if migration not applied
      } finally {
        setCheckingForPlan(false);
      }
    }
    
    checkActivePlan();
  }, [isPlanEveningEnabled]);
  
  /**
   * Preload adjacent images for smooth transitions
   * Prevents layout shift when navigating between slides
   */
  useEffect(() => {
    if (topBottles.length <= 1) return;
    
    const preloadImages: HTMLImageElement[] = [];
    
    // Preload next and previous images
    const nextIndex = (activeIndex + 1) % topBottles.length;
    const prevIndex = (activeIndex - 1 + topBottles.length) % topBottles.length;
    
    [nextIndex, prevIndex].forEach(index => {
      const bottle = topBottles[index];
      if (!bottle) return;
      
      const mergedWine = {
        ...bottle.wine,
        image_path: bottle.wine.image_path || (bottle as any).label_image_path || (bottle as any).image_path || null,
        label_image_path: bottle.wine.label_image_path || (bottle as any).label_image_path || null,
        image_url: bottle.wine.image_url || (bottle as any).image_url || null,
      };
      const displayImage = labelArtService.getWineDisplayImage(mergedWine);
      if (displayImage.imageUrl) {
        const img = new Image();
        img.src = displayImage.imageUrl;
        preloadImages.push(img);
        if (isDev) console.log('[Carousel] Preloading image for index', index);
      }
    });
    
    // Cleanup (images will stay in browser cache)
    return () => {
      preloadImages.length = 0;
    };
  }, [activeIndex, topBottles, isDev]);
  
  /**
   * Pause auto-advance on hover/touch (temporary)
   */
  const handleInteractionStart = () => {
    setIsPaused(true);
  };

  const handleInteractionEnd = () => {
    // Resume after a short delay (for hover/touch, not manual nav)
    if (unpauseTimerRef.current) {
      clearTimeout(unpauseTimerRef.current);
    }
    unpauseTimerRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 1000);
  };

  /**
   * Manual navigation - Fixed to prevent double-advance
   * 
   * CRITICAL FIXES:
   * 1. preventDefault + stopPropagation to block all event interference
   * 2. Record timestamp to enforce 5s autoplay cooldown
   * 3. Cancel any pending unpause timers
   * 4. Use functional state update
   * 5. Pause autoplay immediately
   */
  const goToNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (topBottles.length <= 1) return;
    
    if (isDev) console.log('[Carousel] ➡️ Manual NEXT clicked');
    
    // Record manual interaction timestamp
    lastManualInteractionRef.current = Date.now();
    
    // Cancel any pending unpause timers
    if (unpauseTimerRef.current) {
      clearTimeout(unpauseTimerRef.current);
      unpauseTimerRef.current = null;
    }
    
    // Pause autoplay (will stay paused for 5s due to cooldown check)
    setIsPaused(true);
    
    directionRef.current = 1;
    // Advance slide with functional update
    setActiveIndex((current) => {
      const next = (current + 1) % topBottles.length;
      if (isDev) console.log('[Carousel] 📊 Index change:', current, '→', next, '(total:', topBottles.length, ')');
      return next;
    });
    
    // Resume autoplay after 5s cooldown
    setTimeout(() => {
      if (isDev) console.log('[Carousel] ⏱️ Manual cooldown ended, resuming autoplay');
      setIsPaused(false);
    }, 5000);
  };

  const goToPrevious = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (topBottles.length <= 1) return;
    
    if (isDev) console.log('[Carousel] ⬅️ Manual PREVIOUS clicked');
    
    // Record manual interaction timestamp
    lastManualInteractionRef.current = Date.now();
    
    // Cancel any pending unpause timers
    if (unpauseTimerRef.current) {
      clearTimeout(unpauseTimerRef.current);
      unpauseTimerRef.current = null;
    }
    
    // Pause autoplay (will stay paused for 5s due to cooldown check)
    setIsPaused(true);
    
    directionRef.current = -1;
    // Go to previous slide with functional update
    setActiveIndex((current) => {
      const prev = (current - 1 + topBottles.length) % topBottles.length;
      if (isDev) console.log('[Carousel] 📊 Index change:', current, '→', prev, '(total:', topBottles.length, ')');
      return prev;
    });
    
    // Resume autoplay after 5s cooldown
    setTimeout(() => {
      if (isDev) console.log('[Carousel] ⏱️ Manual cooldown ended, resuming autoplay');
      setIsPaused(false);
    }, 5000);
  };

  /**
   * Swipe/Drag handler for mobile
   */
  const handleDragEnd = (_event: any, info: any) => {
    const swipeThreshold = 50; // Minimum drag distance to trigger navigation
    
    if (Math.abs(info.offset.x) > swipeThreshold) {
      if (info.offset.x > 0) {
        // Swiped right → go to previous
        goToPrevious();
      } else {
        // Swiped left → go to next
        goToNext();
      }
    }
    
    setIsDragging(false);
  };

  /**
   * Generate stable unique key for each bottle
   * Prevents React from remounting components when order changes
   */
  const getBottleKey = (bottle: BottleWithWineInfo) => {
    return bottle.id || `${bottle.wine.wine_name}-${bottle.wine.vintage || 'nv'}-${bottle.wine.producer || 'unknown'}`;
  };

  if (selection.noBottles) {
    return null;
  }

  if (selection.needsAnalysis) {
    return (
      <div className="luxury-card p-6 text-center">
        <p className="text-2xl mb-3">🍾</p>
        <h2
          className="text-xl font-bold mb-2"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          {t('dashboard.tonightsOrbit.title', "Tonight's Selection")}
        </h2>
        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
          {t('dashboard.tonightsOrbit.analyzePrompt', 'Analyze your cellar to unlock personalized picks')}
        </p>
      </div>
    );
  }

  const activeBottle = topBottles[Math.min(activeIndex, topBottles.length - 1)];
  const canAutoplay = !reduceMotion && topBottles.length > 1;
  const isRotating = canAutoplay && !autoplayStopped && !isPaused && !isPlanning;

  const goToIndex = (index: number) => {
    directionRef.current = index > activeIndex ? 1 : -1;
    lastManualInteractionRef.current = Date.now();
    if (unpauseTimerRef.current) {
      clearTimeout(unpauseTimerRef.current);
      unpauseTimerRef.current = null;
    }
    setIsPaused(true);
    setActiveIndex(index);
    setTimeout(() => setIsPaused(false), 5000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (topBottles.length <= 1) return;
    const isRtl = document.documentElement.dir === 'rtl';
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      isRtl ? goToPrevious() : goToNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      isRtl ? goToNext() : goToPrevious();
    }
  };

  const renderSlide = (bottle: BottleWithWineInfo, index: number) => {
    const lw = getLocalizedWineData(bottle.wine, i18n.language);
    const slotInfo = slotByBottleId.get(bottle.id);
    const isHoldBadge = slotInfo?.categoryKey.endsWith('.bestAvailable');
    const cfg = slotInfo ? (isHoldBadge ? HOLD_BADGE_STYLE : SLOT_CONFIG[slotInfo.slot]) : null;
    const mergedWine = {
      ...bottle.wine,
      image_path: bottle.wine.image_path || (bottle as any).label_image_path || (bottle as any).image_path || null,
      label_image_path: bottle.wine.label_image_path || (bottle as any).label_image_path || null,
      image_url: bottle.wine.image_url || (bottle as any).image_url || null,
    };
    const displayImage = labelArtService.getWineDisplayImage(mergedWine);
    const dir = directionRef.current;

    return (
      <motion.div
        key={getBottleKey(bottle)}
        role="group"
        aria-roledescription="slide"
        aria-label={t('dashboard.tonightsOrbit.slideOf', { current: index + 1, total: topBottles.length })}
        initial={reduceMotion ? false : { opacity: 0, x: dir * 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: dir * -24 }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        drag={topBottles.length > 1 ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragStart={() => {
          setIsDragging(true);
          handleInteractionStart();
        }}
        onDragEnd={handleDragEnd}
        className="flex gap-4 items-stretch"
        style={{ touchAction: 'pan-y' }}
      >
        <WineImage
          src={displayImage.imageUrl}
          alt={lw.wine_name}
          isGenerated={displayImage.isGenerated}
          loading="eager"
          className="w-24 h-32 sm:w-28 sm:h-36"
          iconSize={32}
        />

        <div className="min-w-0 flex-1 flex flex-col">
          {cfg && slotInfo && (
            <span
              className="self-start inline-flex items-center gap-1 px-2 py-0.5 mb-1.5 rounded-full text-xs font-semibold"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              <span aria-hidden>{cfg.icon}</span>
              <span>{t(slotInfo.categoryKey) as string}</span>
            </span>
          )}

          <h3
            className="text-base sm:text-lg font-semibold leading-snug line-clamp-2"
            style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display)' }}
          >
            <bdi>{lw.wine_name}</bdi>
          </h3>

          <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
            {lw.producer && <bdi>{lw.producer}</bdi>}
            {lw.producer && bottle.wine.vintage ? ' · ' : ''}
            {bottle.wine.vintage && (
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {bottle.wine.vintage}
              </span>
            )}
          </p>

          {slotInfo && (
            <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
              {t(slotInfo.reasonKey)}
            </p>
          )}

          {slotInfo && slotInfo.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1 mt-1.5 list-none m-0 p-0">
              {slotInfo.tags.slice(0, 3).map((tag, i) => (
                <li
                  key={i}
                  className="px-1.5 py-0.5 rounded text-xs font-medium"
                  style={{
                    background: 'var(--bg-muted)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {t(tag.key, tag.values as any) as string}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto pt-2 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (!isDragging) onBottleClick(bottle);
              }}
              className="btn-luxury-secondary !min-h-[44px] !py-2 !px-4 text-sm"
            >
              {t('dashboard.tonightsOrbit.viewDetails')}
              <ChevronRight className="h-4 w-4 flip-rtl" strokeWidth={1.75} aria-hidden />
            </button>
            {bottle.wine.rating && bottle.wine.rating > 0 ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Star className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: 'var(--rating-star)', fill: 'var(--rating-star)' }} aria-hidden />
                {bottle.wine.rating.toFixed(1)}
              </span>
            ) : null}
            {bottle.quantity > 1 && (
              <span className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                ×{bottle.quantity}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const navBtnClass =
    'app-icon-btn border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--accent-text)]';

  return (
    <section className="luxury-card isolate" aria-roledescription="carousel" aria-labelledby={titleId}>
      {/* Header */}
      <div
        className="px-4 pt-4 pb-3 sm:px-5 sm:pt-5"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-xl"
              style={{
                color: 'var(--text-heading)',
                fontFamily: 'var(--font-display)',
                fontWeight: 'var(--font-bold)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('dashboard.tonightsOrbit.title', 'Tonight\'s Selection')}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboard.tonightsOrbit.subtitle', 'Perfect bottles for this evening')}
            </p>
          </div>

          {/* Plan an evening CTA (gated feature) */}
          {!isPlanEveningLoading && isPlanEveningEnabled && !checkingForPlan && (
            <button
              type="button"
              onClick={() => (activePlan ? setShowQueuePlayer(true) : setShowPlanEveningModal(true))}
              className="btn-luxury-primary !min-h-[44px] !py-2 !px-4 text-sm flex-shrink-0"
            >
              <span aria-hidden>{activePlan ? '▶️' : '🎯'}</span>
              <span className="hidden sm:inline">
                {activePlan ? t('planEvening.resumeButton', 'Resume evening') : t('planEvening.title', 'Plan an evening')}
              </span>
              <span className="sm:hidden">{activePlan ? t('planEvening.resumeShort') : t('planEvening.planShort')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={containerRef}
        className="px-4 pt-4 pb-3 sm:px-5 focus-visible:outline-none"
        tabIndex={topBottles.length > 1 ? 0 : undefined}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleInteractionStart}
        onMouseLeave={handleInteractionEnd}
        onFocus={handleInteractionStart}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) handleInteractionEnd();
        }}
        onTouchStart={handleInteractionStart}
        onTouchEnd={handleInteractionEnd}
      >
        <div aria-live={isRotating ? 'off' : 'polite'} className="min-h-[8rem] sm:min-h-[9rem]">
          <AnimatePresence mode="wait" initial={false}>
            {activeBottle && renderSlide(activeBottle, Math.min(activeIndex, topBottles.length - 1))}
          </AnimatePresence>
        </div>

        {/* Phones: controls cluster at the start edge, clear of the floating Sommi button at the end edge */}
        {topBottles.length > 1 && (
          <div className="mt-3 flex items-center justify-start sm:justify-between gap-2">
            <button type="button" onClick={goToPrevious} className={navBtnClass} aria-label={t('common.previous')}>
              <ChevronLeft className="h-5 w-5 flip-rtl" strokeWidth={1.75} aria-hidden />
            </button>

            <div className="flex items-center">
              {topBottles.map((bottle, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={`dot-${getBottleKey(bottle)}`}
                    type="button"
                    onClick={() => goToIndex(index)}
                    className="flex items-center justify-center min-w-[28px] min-h-[44px]"
                    aria-label={t('dashboard.tonightsOrbit.goTo', {
                      n: index + 1,
                      name: getLocalizedWineData(bottle.wine, i18n.language).wine_name,
                    })}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <span
                      className="block h-2 rounded-full transition-all duration-200"
                      style={{
                        width: isActive ? 20 : 8,
                        background: isActive ? 'var(--accent-text)' : 'var(--border-strong)',
                      }}
                    />
                  </button>
                );
              })}
              {canAutoplay && (
                <button
                  type="button"
                  onClick={() => setAutoplayStopped((v) => !v)}
                  className="app-icon-btn ms-1"
                  aria-label={autoplayStopped ? t('dashboard.tonightsOrbit.play') : t('dashboard.tonightsOrbit.pause')}
                >
                  {autoplayStopped ? (
                    <Play className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Pause className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  )}
                </button>
              )}
            </div>

            <button type="button" onClick={goToNext} className={navBtnClass} aria-label={t('common.next')}>
              <ChevronRight className="h-5 w-5 flip-rtl" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        )}
      </div>

      {/* Footer note — shown when cellar is small, all HOLD, or fewer than 3 slots */}
      {(topBottles.length < 3 || selection.allHold) && (
        <div
          className="mx-4 sm:mx-5 mb-4 rounded-lg p-3 text-center text-sm"
          style={{
            background: 'var(--bg-surface-elevated)',
            color: 'var(--text-tertiary)',
          }}
        >
          {selection.allHold
            ? t('dashboard.tonightsOrbit.allHold', 'Your wines are best kept for now — consider holding a little longer')
            : t('dashboard.tonightsOrbit.needMore', 'Add more bottles to see personalized recommendations')}
        </div>
      )}
      
      {/* Plan an evening modal */}
      {isPlanEveningEnabled && (
        <PlanEveningModal
          isOpen={showPlanEveningModal}
          onClose={() => setShowPlanEveningModal(false)}
          candidateBottles={bottles}
          onPlanStarted={setActivePlan}
        />
      )}
      
      {/* Queue Player for active/resumed plans */}
      {activePlan && showQueuePlayer && (
        <EveningQueuePlayer
          isOpen={showQueuePlayer}
          onClose={() => setShowQueuePlayer(false)}
          plan={activePlan}
          onPlanUpdated={setActivePlan}
          onComplete={async () => {
            setShowQueuePlayer(false);
            setActivePlan(null);
            // Reload to check for new active plans
            const newPlan = await eveningPlanService.getActivePlan();
            setActivePlan(newPlan);
          }}
        />
      )}
    </section>
  );
}
