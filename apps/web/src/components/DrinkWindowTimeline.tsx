/**
 * Drink Window Timeline Card
 * 
 * Premium visualization of bottles by readiness
 * Clean, elegant progress bars - inspired by luxury analytics
 */

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { BottleWithWineInfo } from '../services/bottleService';

interface DrinkWindowTimelineProps {
  bottles: BottleWithWineInfo[];
}

type ReadinessCategory = 'READY' | 'PEAK_SOON' | 'HOLD' | 'UNKNOWN';

export function DrinkWindowTimeline({ bottles }: DrinkWindowTimelineProps) {
  const { t } = useTranslation();

  // Group bottles by readiness
  const categorizeBottles = () => {
    const categories: Record<ReadinessCategory, BottleWithWineInfo[]> = {
      HOLD: [],
      PEAK_SOON: [],
      READY: [],
      UNKNOWN: [],
    };

    bottles.forEach((bottle) => {
      const analysis = bottle as any;
      if (analysis.readiness_label) {
        const category = analysis.readiness_label as ReadinessCategory;
        if (categories[category]) {
          categories[category].push(bottle);
        } else {
          categories.UNKNOWN.push(bottle);
        }
      } else {
        categories.UNKNOWN.push(bottle);
      }
    });

    return categories;
  };

  const categorized = categorizeBottles();

  const timelineStages = [
    {
      key: 'HOLD' as ReadinessCategory,
      label: t('dashboard.drinkWindow.hold', 'Hold'),
      color: 'var(--wine-400)',
      bgGradient: 'linear-gradient(90deg, rgba(164, 77, 90, 0.15), rgba(164, 77, 90, 0.25))',
      icon: '⏳',
    },
    {
      key: 'PEAK_SOON' as ReadinessCategory,
      label: t('dashboard.drinkWindow.peakSoon', 'Peak Soon'),
      color: 'var(--gold-400)',
      bgGradient: 'linear-gradient(90deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.3))',
      icon: '⚡',
    },
    {
      key: 'READY' as ReadinessCategory,
      label: t('dashboard.drinkWindow.ready', 'Ready Now'),
      color: 'var(--gold-300)',
      bgGradient: 'linear-gradient(90deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.4))',
      icon: '✨',
    },
  ];

  // CRITICAL FIX: Count only analyzed bottles (those with readiness status)
  // Not all bottles in the cellar, only those that have been analyzed
  const totalBottles = categorized.HOLD.length + categorized.PEAK_SOON.length + categorized.READY.length;

  if (totalBottles === 0) {
    return null;
  }

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

        {/* Timeline visualization */}
        <div className="space-y-5">
        {timelineStages.map((stage, index) => {
          const count = categorized[stage.key].length;
          const percentage = totalBottles > 0 ? (count / totalBottles) * 100 : 0;

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                delay: index * 0.1,
                duration: 0.4,
                ease: [0.4, 0, 0.2, 1]
              }}
              className="relative"
            >
              {/* Stage label */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{stage.icon}</span>
                  <span 
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {stage.label}
                  </span>
                </div>
                <span 
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: stage.color }}
                >
                  {count}
                </span>
              </div>

              {/* Progress bar */}
              <div 
                className="h-2 rounded-full overflow-hidden"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ 
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
            </motion.div>
          );
        })}
        </div>

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
              {totalBottles}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
