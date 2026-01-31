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
      color: 'var(--wine-400)',
      bgGradient: 'linear-gradient(90deg, rgba(164, 77, 90, 0.15), rgba(164, 77, 90, 0.25))',
      icon: '⏳',
      count: insights.HOLD.count,
      delta: insights.HOLD.delta,
    },
    {
      key: 'PEAK_SOON' as ReadinessCategory,
      label: t('dashboard.drinkWindow.peakSoon', 'Peak Soon'),
      color: 'var(--gold-400)',
      bgGradient: 'linear-gradient(90deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.3))',
      icon: '⚡',
      count: insights.PEAK_SOON.count,
      delta: insights.PEAK_SOON.delta,
    },
    {
      key: 'READY' as ReadinessCategory,
      label: t('dashboard.drinkWindow.ready', 'Ready Now'),
      color: 'var(--gold-300)',
      bgGradient: 'linear-gradient(90deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.4))',
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
        className="p-6 pb-8"
        style={{
          background: 'linear-gradient(135deg, rgba(164, 77, 90, 0.03) 0%, rgba(212, 175, 55, 0.03) 100%)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 
              className="text-2xl mb-2"
              style={{ 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 'var(--font-bold)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('dashboard.drinkWindow.title', 'Drink Window')}
            </h2>
            <p 
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('dashboard.drinkWindow.subtitle', 'Optimal timing for your collection')}
            </p>
          </div>
          
          {/* Decorative icon */}
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--wine-50), var(--wine-100))',
              border: '1px solid var(--wine-200)',
            }}
          >
            <span className="text-2xl">⏱️</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Timeline visualization - Clickable buckets */}
        <div className="space-y-5">
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
                className="relative w-full text-left p-3 -mx-3 rounded-lg transition-colors"
                style={{
                  background: 'transparent',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Stage label with delta */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{stage.icon}</span>
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
                          color: stage.delta > 0 ? 'var(--color-emerald-600)' : 'var(--color-rose-600)',
                          opacity: 0.8,
                        }}
                      >
                        ({formatDelta(stage.delta)})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: stage.color }}
                    >
                      {stage.count}
                    </span>
                    {/* Chevron indicator */}
                    <svg
                      className="w-4 h-4 transition-opacity"
                      style={{ 
                        color: 'var(--text-tertiary)',
                        opacity: 0.4,
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
                      background: stage.bgGradient,
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
            className="w-full mt-6 pt-4 text-left"
            style={{
              borderTop: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div 
              className="flex items-center gap-2 p-3 -mx-3 rounded-lg transition-colors"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="text-lg">✨</span>
              <span 
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('dashboard.drinkWindow.tonightSignal', {
                  count: tonightSignal.count,
                  defaultValue: `${tonightSignal.count} ${tonightSignal.count === 1 ? 'wine is' : 'wines are'} perfect for tonight`
                })}
              </span>
              <svg
                className="w-4 h-4 ms-auto transition-opacity"
                style={{ 
                  color: 'var(--text-tertiary)',
                  opacity: 0.4,
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
          className="mt-6 pt-4"
          style={{
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>
              {t('dashboard.drinkWindow.totalAnalyzed', 'Total analyzed')}
            </span>
            <span 
              className="font-semibold tabular-nums"
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
