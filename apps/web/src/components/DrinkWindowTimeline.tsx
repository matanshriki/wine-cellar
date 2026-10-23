/**
 * Drink Window Timeline Card
 * 
 * Premium visualization of bottles by readiness
 * Clean, elegant progress bars - inspired by luxury analytics
 * 
 * Enhanced with:
 * - Actionable buckets (click to filter)
 * - Momentum deltas (changes over time)
 * - Tonight Signal (highly-rated ready wines)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { BottleWithWineInfo } from '../services/bottleService';
import {
  getBucketInsights,
  computeTonightSignal,
  saveSnapshot,
  shouldSaveSnapshot,
  type ReadinessCategory,
} from '../utils/drinkWindowInsights';
import { hasDrinkWindowAnalysis } from '../utils/cellarReadinessFilters';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';

interface DrinkWindowTimelineProps {
  bottles: BottleWithWineInfo[];
}

export function DrinkWindowTimeline({ bottles }: DrinkWindowTimelineProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reduceMotion = shouldReduceMotion();
  const [isVisible, setIsVisible] = useState(false);

  // Compute insights
  const insights = getBucketInsights(bottles);
  const tonightSignal = computeTonightSignal(insights.READY.bottles);
  // Unlabeled / unanalyzed wines are intentionally excluded from Drink Window buckets
  // and readiness chips — they remain visible in the full cellar when no readiness filter is on.
  const unlabeledCount = bottles.filter(
    (b) => b.quantity > 0 && !hasDrinkWindowAnalysis(b as any),
  ).length;

  // Save snapshot on mount (once per day)
  useEffect(() => {
    if (insights.totalAnalyzed > 0 && shouldSaveSnapshot()) {
      saveSnapshot({
        HOLD: insights.HOLD.count,
        PEAK_SOON: insights.PEAK_SOON.count,
        READY: insights.READY.count,
      });
    }
  }, [insights.HOLD.count, insights.PEAK_SOON.count, insights.READY.count, insights.totalAnalyzed]);

  // Trigger bar animations on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const timelineStages = [
    {
      key: 'HOLD' as ReadinessCategory,
      label: t('dashboard.drinkWindow.hold', 'Hold'),
      bar: 'var(--status-hold-text)',
      icon: '⏳',
      count: insights.HOLD.count,
      delta: insights.HOLD.delta,
    },
    {
      key: 'PEAK_SOON' as ReadinessCategory,
      label: t('dashboard.drinkWindow.peakSoon', 'Peak Soon'),
      bar: 'var(--status-drink-soon-text)',
      icon: '⚡',
      count: insights.PEAK_SOON.count,
      delta: insights.PEAK_SOON.delta,
    },
    {
      key: 'READY' as ReadinessCategory,
      label: t('dashboard.drinkWindow.ready', 'Ready Now'),
      bar: 'var(--status-ready-text)',
      icon: '✨',
      count: insights.READY.count,
      delta: insights.READY.delta,
    },
  ];

  if (insights.totalAnalyzed === 0) {
    return null;
  }

  /**
   * Handle bucket click - navigate to cellar with readiness filter
   */
  const handleBucketClick = (readinessLabel: ReadinessCategory) => {
    const params = new URLSearchParams();
    params.set('readiness', readinessLabel);
    params.set('sort', 'rating'); // Sort by rating (highest first)
    navigate(`/cellar?${params.toString()}`);
  };

  /**
   * Handle tonight signal click - navigate with ready + high rating filter
   */
  const handleTonightSignalClick = () => {
    const params = new URLSearchParams();
    params.set('readiness', 'READY');
    params.set('rating', tonightSignal.threshold.toString());
    params.set('sort', 'rating');
    navigate(`/cellar?${params.toString()}`);
  };

  /**
   * Format delta text
   */
  const formatDelta = (delta?: number): string | null => {
    if (delta === undefined) return null;
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta} ${t('dashboard.drinkWindow.thisMonth', 'this month')}`;
  };

  return (
    <div className="luxury-card overflow-hidden">
      {/* Premium Header with gradient background */}
      <div 
        className="px-4 pt-4 pb-3 sm:px-5 sm:pt-5"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="app-section-title">
              {t('dashboard.drinkWindow.title', 'Drink Window')}
            </h2>
            <p className="app-helper" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {t('dashboard.drinkWindow.subtitle', 'Optimal timing for your collection')}
            </p>
          </div>
          
        </div>
      </div>

      <div className="px-4 py-3 sm:px-5">
        {/* Timeline visualization - Clickable buckets */}
        <div className="space-y-1">
          {timelineStages.map((stage, index) => {
            const percentage = insights.totalAnalyzed > 0 ? (stage.count / insights.totalAnalyzed) * 100 : 0;

            return (
              <motion.button
                key={stage.key}
                onClick={() => handleBucketClick(stage.key)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                whileTap={reduceMotion ? {} : { scale: 0.99 }}
                transition={{ 
                  delay: index * 0.1,
                  duration: 0.4,
                  ease: [0.4, 0, 0.2, 1]
                }}
                className="relative w-full text-start px-3 py-2 -mx-3 rounded-lg transition-colors hover:bg-[var(--interactive-hover)] min-h-[44px]"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Stage label with delta */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden>{stage.icon}</span>
                    <span 
                      className="text-sm font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {stage.label}
                    </span>
                    {/* Momentum delta */}
                    {stage.delta !== undefined && (
                      <span
                        className="text-xs font-normal"
                        style={{
                          color: stage.delta > 0 ? 'var(--text-success)' : 'var(--text-secondary)',
                        }}
                      >
                        ({formatDelta(stage.delta)})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {stage.count}
                    </span>
                    {/* Chevron indicator */}
                    <svg
                      className="w-4 h-4 flip-rtl" aria-hidden
                      style={{ 
                        color: 'var(--text-tertiary)',
                      }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* Progress bar with animation */}
                <div 
                  className="h-2 rounded-full overflow-hidden"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: isVisible ? `${percentage}%` : 0 }}
                    transition={reduceMotion ? {
                      duration: 0,
                    } : { 
                      duration: 0.8, 
                      delay: index * 0.1 + 0.3,
                      ease: [0.4, 0, 0.2, 1]
                    }}
                    className="h-full rounded-full"
                    style={{
                      background: stage.bar,
                      opacity: 0.75,
                    }}
                  />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Tonight Signal */}
        {tonightSignal.count > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            onClick={handleTonightSignalClick}
            className="w-full mt-2 pt-2 text-start"
            style={{
              borderTop: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div 
              className="flex items-start gap-2 px-3 py-2 -mx-3 rounded-lg transition-colors hover:bg-[var(--interactive-hover)] min-h-[44px]"
            >
              <span className="text-lg mt-0.5" aria-hidden>✨</span>
              <div className="flex-1 min-w-0">
                <span 
                  className="text-sm font-medium block"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('dashboard.drinkWindow.tonightSignal', {
                    count: tonightSignal.count,
                    defaultValue: `${tonightSignal.count} ${tonightSignal.count === 1 ? 'wine is' : 'wines are'} perfect for tonight`
                  })}
                </span>
                <span
                  className="text-xs mt-0.5 block leading-snug"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('dashboard.drinkWindow.tonightSignalHelp', {
                    threshold: tonightSignal.threshold,
                  })}
                </span>
              </div>
              <svg
                className="w-4 h-4 ms-auto mt-1 flex-shrink-0 flip-rtl" aria-hidden
                style={{ 
                  color: 'var(--text-tertiary)',
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </motion.button>
        )}

        {/* Summary footer */}
        <div 
          className="mt-2 pt-3"
          style={{
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <span style={{ color: 'var(--text-secondary)' }}>
                {t('dashboard.drinkWindow.totalAnalyzed')}
              </span>
              <p
                className="text-xs mt-1 leading-snug"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('dashboard.drinkWindow.totalAnalyzedHelp')}
              </p>
              {unlabeledCount > 0 && (
                <p
                  className="text-xs mt-1.5 leading-snug"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('dashboard.drinkWindow.unlabeledNote', {
                    count: unlabeledCount,
                    defaultValue:
                      '{{count}} wine without a readiness label is not in these buckets — clear filters to see it in your full cellar.',
                    defaultValue_other:
                      '{{count}} wines without a readiness label are not in these buckets — clear filters to see them in your full cellar.',
                  })}
                </p>
              )}
            </div>
            <span 
              className="font-semibold tabular-nums flex-shrink-0"
              style={{ color: 'var(--text-primary)' }}
            >
              {insights.totalAnalyzed}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
