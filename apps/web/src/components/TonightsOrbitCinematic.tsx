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
 * LOCAL/STAGING ONLY - Not yet deployed to production
 */

import { useState, useEffect, useRef } from 'react';
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

interface TonightsOrbitCinematicProps {
  bottles: BottleWithWineInfo[];
  onBottleClick: (bottle: BottleWithWineInfo) => void;
}

export function TonightsOrbitCinematic({ bottles, onBottleClick }: TonightsOrbitCinematicProps) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const unpauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastManualInteractionRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = shouldReduceMotion();
  
  // Dev logging
  const isDev = import.meta.env.DEV;
  
  // Plan an evening feature
  const { isEnabled: isPlanEveningEnabled, isLoading: isPlanEveningLoading } = usePlanEveningFeature();
  const [showPlanEveningModal, setShowPlanEveningModal] = useState(false);
  const [activePlan, setActivePlan] = useState<EveningPlan | null>(null);
  const [checkingForPlan, setCheckingForPlan] = useState(true);
  const [showQueuePlayer, setShowQueuePlayer] = useState(false);

  /**
   * Smart Selection Logic:
   * Same as original - prioritize READY bottles, then PEAK_SOON, then by quantity
   */
  const getSmartSelection = (bottles: BottleWithWineInfo[]) => {
    const availableBottles = bottles.filter(bottle => bottle.quantity > 0);
    
    const scored = availableBottles.map(bottle => {
      const analysis = bottle as any;
      let score = 0;

      if (analysis.readiness_label === 'READY') {
        score += 100;
      } else if (analysis.readiness_label === 'PEAK_SOON') {
        score += 50;
      } else if (analysis.readiness_label === 'HOLD') {
        score += 10;
      }

      score += Math.min(bottle.quantity * 5, 25);
      score += Math.random() * 10;

      return { bottle, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.bottle);
  };

  const topBottles = getSmartSelection(bottles);

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
    if (reduceMotion || topBottles.length <= 1 || isPaused) {
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
    }, 3000);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timerRef.current) {
        if (isDev) console.log('[Carousel] Cleanup: clearing timer');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [topBottles.length, isPaused, reduceMotion, isDev]);

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
      
      const displayImage = labelArtService.getWineDisplayImage(bottle.wine);
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
   * 1. Record timestamp to enforce 5s autoplay cooldown
   * 2. Cancel any pending unpause timers
   * 3. Use functional state update
   * 4. Pause autoplay immediately
   */
  const goToNext = (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent event bubbling
    
    if (isDev) console.log('[Carousel] Manual next clicked');
    
    // Record manual interaction timestamp
    lastManualInteractionRef.current = Date.now();
    
    // Cancel any pending unpause timers
    if (unpauseTimerRef.current) {
      clearTimeout(unpauseTimerRef.current);
      unpauseTimerRef.current = null;
    }
    
    // Pause autoplay (will stay paused for 5s due to cooldown check)
    setIsPaused(true);
    
    // Advance slide with functional update
    setActiveIndex((current) => {
      const next = (current + 1) % topBottles.length;
      if (isDev) console.log('[Carousel] Manual advance:', current, '→', next);
      return next;
    });
    
    // Resume autoplay after 5s cooldown
    setTimeout(() => {
      if (isDev) console.log('[Carousel] Manual cooldown ended, resuming');
      setIsPaused(false);
    }, 5000);
  };

  const goToPrevious = (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent event bubbling
    
    if (isDev) console.log('[Carousel] Manual previous clicked');
    
    // Record manual interaction timestamp
    lastManualInteractionRef.current = Date.now();
    
    // Cancel any pending unpause timers
    if (unpauseTimerRef.current) {
      clearTimeout(unpauseTimerRef.current);
      unpauseTimerRef.current = null;
    }
    
    // Pause autoplay (will stay paused for 5s due to cooldown check)
    setIsPaused(true);
    
    // Go to previous slide with functional update
    setActiveIndex((current) => {
      const prev = (current - 1 + topBottles.length) % topBottles.length;
      if (isDev) console.log('[Carousel] Manual previous:', current, '→', prev);
      return prev;
    });
    
    // Resume autoplay after 5s cooldown
    setTimeout(() => {
      if (isDev) console.log('[Carousel] Manual cooldown ended, resuming');
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

  if (topBottles.length === 0) {
    return null;
  }

  /**
   * Get card style based on position relative to active index
   * Handles circular carousel wrapping for smooth infinite loop
   */
  const getCardStyle = (index: number) => {
    const totalCards = topBottles.length;
    let diff = index - activeIndex;
    
    // Handle circular wrapping: find shortest path
    // Example: with 3 cards, going from index 2 to 0 should be +1 (forward), not -2 (backward)
    if (diff > totalCards / 2) {
      diff -= totalCards;
    } else if (diff < -totalCards / 2) {
      diff += totalCards;
    }
    
    const isActive = diff === 0;
    const isAdjacent = Math.abs(diff) === 1;

    if (isActive) {
      return {
        scale: 1,
        opacity: 1,
        x: '0%',
        zIndex: 20,
        filter: 'none',
      };
    }

    if (isAdjacent) {
      const direction = diff > 0 ? 1 : -1;
      return {
        scale: 0.93,
        opacity: 0.7,
        x: `${direction * 20}%`,
        zIndex: 10,
        filter: 'brightness(0.95)',
      };
    }

    // Far cards - hidden
    return {
      scale: 0.85,
      opacity: 0,
      x: diff > 0 ? '40%' : '-40%',
      zIndex: 0,
      filter: 'brightness(0.9)',
    };
  };

  return (
    <div className="luxury-card">
      {/* Premium Header */}
      <div 
        className="p-6 pb-8"
        style={{
          background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.03) 0%, rgba(164, 77, 90, 0.03) 100%)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 
              className="text-2xl mb-2"
              style={{ 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 'var(--font-bold)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('dashboard.tonightsOrbit.title', 'Tonight\'s Selection')}
            </h2>
            <p 
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('dashboard.tonightsOrbit.subtitle', 'Perfect bottles for this evening')}
            </p>
          </div>
          
          {/* Plan an evening CTA (gated feature) */}
          {!isPlanEveningLoading && isPlanEveningEnabled && !checkingForPlan && (
            <>
              {activePlan ? (
                <motion.button
                  onClick={() => setShowQueuePlayer(true)}
                  className="ml-4 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                    color: 'white',
                    border: '1px solid var(--wine-700)',
                    boxShadow: '0 2px 8px rgba(164, 77, 90, 0.2)',
                  }}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span>▶️</span>
                  <span className="hidden sm:inline">Resume evening</span>
                  <span className="sm:hidden">Resume</span>
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => setShowPlanEveningModal(true)}
                  className="ml-4 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                    color: 'white',
                    border: '1px solid var(--wine-600)',
                    boxShadow: '0 2px 8px rgba(164, 77, 90, 0.15)',
                  }}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span>🎯</span>
                  <span className="hidden sm:inline">Plan an evening</span>
                  <span className="sm:hidden">Plan</span>
                </motion.button>
              )}
            </>
          )}
          
          {/* Decorative icon (only show if Plan feature not enabled) */}
          {(!isPlanEveningEnabled || isPlanEveningLoading) && (
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center ml-4"
              style={{
                background: 'linear-gradient(135deg, var(--gold-50), var(--gold-100))',
                border: '1px solid var(--gold-200)',
              }}
            >
              <span className="text-2xl">✨</span>
            </div>
          )}
        </div>
      </div>

      {/* Cinematic Carousel Container - Auto-sized with proper spacing */}
      <div 
        ref={containerRef}
        className="relative px-6 pt-6 pb-16"
        style={{
          overflow: 'visible',
        }}
        onMouseEnter={handleInteractionStart}
        onMouseLeave={handleInteractionEnd}
        onTouchStart={handleInteractionStart}
        onTouchEnd={handleInteractionEnd}
      >
        {/* Carousel Track */}
        <div 
          className="relative flex items-center justify-center"
          style={{
            minHeight: '300px', // Flexible height for card content
            perspective: '1200px',
          }}
        >
          {topBottles.map((bottle, index) => {
            const style = getCardStyle(index);
            const isActive = index === activeIndex;

            return (
              <motion.div
                key={bottle.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  scale: style.scale,
                  opacity: style.opacity,
                  x: isDragging && isActive ? undefined : style.x, // Don't animate x while dragging
                  zIndex: style.zIndex,
                }}
                drag={isActive && !reduceMotion ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragStart={() => {
                  setIsDragging(true);
                  handleInteractionStart();
                }}
                onDragEnd={handleDragEnd}
                transition={reduceMotion ? { duration: 0 } : {
                  type: 'spring',
                  stiffness: 260,
                  damping: 35,
                  mass: 0.8,
                  // Smooth luxury easing for non-spring properties
                  opacity: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
                  scale: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
                  filter: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
                }}
                style={{
                  position: 'absolute',
                  width: '100%',
                  maxWidth: '280px',
                  filter: style.filter,
                  pointerEvents: isActive ? 'auto' : 'none',
                  cursor: isActive ? (isDragging ? 'grabbing' : 'grab') : 'default',
                }}
                onClick={() => {
                  if (isActive && !isDragging) {
                    onBottleClick(bottle);
                  }
                }}
              >
                <motion.div
                  className="relative overflow-hidden rounded-2xl cursor-pointer"
                  style={{
                    background: 'white',
                    border: isActive ? '2px solid var(--wine-200)' : '1px solid var(--border-light)',
                    boxShadow: isActive 
                      ? '0 20px 60px rgba(124, 48, 48, 0.15)' 
                      : '0 4px 12px rgba(0, 0, 0, 0.08)',
                  }}
                  whileHover={isActive && !reduceMotion ? {
                    y: -8,
                    boxShadow: '0 24px 72px rgba(124, 48, 48, 0.2)',
                  } : {}}
                  whileTap={isActive && !reduceMotion ? { scale: 0.98 } : {}}
                >
                  {/* Wine Image - Fixed dimensions to prevent layout shift */}
                  {(() => {
                    const displayImage = labelArtService.getWineDisplayImage(bottle.wine);
                    return (
                      <div 
                        className="relative w-full bg-gradient-to-br from-stone-50 to-stone-100"
                        style={{
                          aspectRatio: '4 / 5', // Stable aspect ratio (wine bottle portrait)
                          overflow: 'hidden',
                          willChange: 'transform', // Performance hint for animations
                        }}
                      >
                        {displayImage.imageUrl ? (
                          <img 
                            src={displayImage.imageUrl} 
                            alt={bottle.wine.wine_name}
                            className="w-full h-full"
                            style={{
                              objectFit: 'cover',
                              objectPosition: 'center',
                            }}
                            // Remove lazy loading - carousel images are above fold
                            loading="eager"
                            // Preload for smooth transitions
                            fetchpriority={isActive ? "high" : "low"}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg
                              style={{ width: '64px', height: '64px', color: 'var(--text-tertiary)' }}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                        )}

                        {/* Removed ranking numbers - presenting as curated selection, not ranked list */}

                        {/* AI Badge */}
                        {displayImage.isGenerated && (
                          <div 
                            className="absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1"
                            style={{
                              background: 'rgba(0, 0, 0, 0.75)',
                              color: 'white',
                              backdropFilter: 'blur(8px)',
                            }}
                            title="AI-generated label art"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                            </svg>
                            <span>AI</span>
                          </div>
                        )}

                        {/* Gradient overlay for depth */}
                        <div 
                          className="absolute inset-0"
                          style={{
                            background: 'linear-gradient(to bottom, transparent 0%, transparent 60%, rgba(0,0,0,0.05) 100%)',
                            pointerEvents: 'none',
                          }}
                        />
                      </div>
                    );
                  })()}

                  {/* Wine Details Panel */}
                  <div className="p-5 bg-white">
                    {/* Wine Name */}
                    <h3 
                      className="text-lg font-bold mb-2 line-clamp-2 leading-tight"
                      style={{ 
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {bottle.wine.wine_name}
                    </h3>

                    {/* Producer + Vintage */}
                    <p 
                      className="text-sm mb-3"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {bottle.wine.producer}
                      {bottle.wine.vintage && (
                        <span className="font-semibold ms-2" style={{ color: 'var(--text-primary)' }}>
                          {bottle.wine.vintage}
                        </span>
                      )}
                    </p>

                    {/* Metadata Row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Rating */}
                      {bottle.wine.rating && bottle.wine.rating > 0 && (
                        <span
                          className="flex items-center gap-1 text-sm font-semibold"
                          style={{ color: 'var(--gold-600)' }}
                        >
                          ⭐ {bottle.wine.rating.toFixed(1)}
                        </span>
                      )}

                      {/* Wine Style Badge */}
                      <span
                        className="px-2 py-1 rounded-md text-xs font-semibold"
                        style={{
                          background: 'var(--wine-50)',
                          color: 'var(--wine-700)',
                        }}
                      >
                        {t(`cellar.wineStyles.${bottle.wine.color}`)}
                      </span>

                      {/* Quantity */}
                      {bottle.quantity > 1 && (
                        <span
                          className="px-2 py-1 rounded-md text-xs font-semibold"
                          style={{
                            background: 'var(--stone-100)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          ×{bottle.quantity}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Navigation Arrows - Enhanced with luxury micro-interactions */}
        {topBottles.length > 1 && (
          <>
            <motion.button
              onClick={goToPrevious}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center rounded-full"
              style={{
                width: '48px',
                height: '48px',
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid var(--border-light)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                color: 'var(--wine-600)',
                // Larger hit area for mobile
                padding: '12px',
              }}
              whileHover={reduceMotion ? {} : {
                background: 'white',
                boxShadow: '0 6px 16px rgba(0, 0, 0, 0.15)',
                scale: 1.05,
              }}
              whileTap={reduceMotion ? {} : {
                scale: 0.95,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
              }}
              transition={{
                duration: 0.2,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              aria-label="Previous wine"
            >
              <svg className="w-6 h-6 flip-rtl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>

            <motion.button
              onClick={goToNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center rounded-full"
              style={{
                width: '48px',
                height: '48px',
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid var(--border-light)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                color: 'var(--wine-600)',
                // Larger hit area for mobile
                padding: '12px',
              }}
              whileHover={reduceMotion ? {} : {
                background: 'white',
                boxShadow: '0 6px 16px rgba(0, 0, 0, 0.15)',
                scale: 1.05,
              }}
              whileTap={reduceMotion ? {} : {
                scale: 0.95,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
              }}
              transition={{
                duration: 0.2,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              aria-label="Next wine"
            >
              <svg className="w-6 h-6 flip-rtl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </motion.button>
          </>
        )}

        {/* Pagination Dots - Enhanced with proper pause handling */}
        {topBottles.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
            {topBottles.map((bottle, index) => (
              <motion.button
                key={`pagination-dot-${bottle.id}-${index}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDev) console.log('[Carousel] Dot clicked:', index);
                  
                  // Record manual interaction
                  lastManualInteractionRef.current = Date.now();
                  
                  // Cancel pending unpause
                  if (unpauseTimerRef.current) {
                    clearTimeout(unpauseTimerRef.current);
                    unpauseTimerRef.current = null;
                  }
                  
                  // Pause and navigate
                  setIsPaused(true);
                  setActiveIndex(index);
                  
                  // Resume after cooldown
                  setTimeout(() => {
                    setIsPaused(false);
                  }, 5000);
                }}
                whileTap={reduceMotion ? {} : { scale: 0.9 }}
                transition={{ duration: 0.15 }}
                style={{
                  width: index === activeIndex ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: index === activeIndex ? 'var(--wine-600)' : 'var(--stone-300)',
                  opacity: index === activeIndex ? 1 : 0.5,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                aria-label={`Go to wine ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Show message if less than 3 bottles */}
      {topBottles.length < 3 && (
        <div 
          className="mx-6 mb-6 p-3 rounded-lg text-sm text-center"
          style={{
            background: 'var(--bg-surface-elevated)',
            color: 'var(--text-tertiary)',
          }}
        >
          {t('dashboard.tonightsOrbit.needMore', 'Add more bottles to see personalized recommendations')}
        </div>
      )}
      
      {/* Plan an evening modal */}
      {isPlanEveningEnabled && (
        <PlanEveningModal
          isOpen={showPlanEveningModal}
          onClose={() => setShowPlanEveningModal(false)}
          candidateBottles={bottles}
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
    </div>
  );
}
