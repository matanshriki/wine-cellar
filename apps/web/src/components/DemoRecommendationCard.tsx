/**
 * Demo Recommendation Card - Onboarding v1 – value first
 * 
 * Shows an instant recommendation from the demo cellar.
 * Demonstrates the app's core value proposition.
 * 
 * DEV MODE ONLY
 */

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { BottleWithWineInfo } from '../services/bottleService';

interface DemoRecommendationCardProps {
  recommendedBottle: BottleWithWineInfo;
  onAddBottle: () => void;
}

export function DemoRecommendationCard({
  recommendedBottle,
  onAddBottle,
}: DemoRecommendationCardProps) {
  const { t } = useTranslation();
  const wine = recommendedBottle.wine;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6"
    >
      {/* Card container */}
      <div
        className="luxury-card p-5 sm:p-6 md:p-8"
        style={{
          background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-secondary) 100%)',
          border: '2px solid var(--wine-200)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Title */}
        <h3
          className="text-xl sm:text-2xl font-bold mb-4"
          style={{
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {t('onboarding.demoRecommendation.title')}
        </h3>

        {/* Recommendation content */}
        <div className="flex gap-4 mb-4">
          {/* Wine color indicator */}
          <div className="flex-shrink-0">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
              style={{
                background:
                  wine.color === 'red'
                    ? 'linear-gradient(135deg, #8B1538, #6B0F2A)'
                    : wine.color === 'white'
                    ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                    : wine.color === 'rose'
                    ? 'linear-gradient(135deg, #EC4899, #DB2777)'
                    : 'linear-gradient(135deg, #3B82F6, #2563EB)',
              }}
            >
              🍷
            </div>
          </div>

          {/* Wine details */}
          <div className="flex-1 min-w-0">
            <h4
              className="text-lg font-semibold mb-1"
              style={{ color: 'var(--text-primary)' }}
            >
              {wine.wine_name}
            </h4>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              {wine.producer}
              {wine.vintage && ` · ${wine.vintage}`}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {wine.region}
            </p>
          </div>
        </div>

        {/* Explanation */}
        <div
          className="p-4 rounded-lg mb-4"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-base)',
          }}
        >
          <p className="text-sm sm:text-base" style={{ color: 'var(--text-primary)' }}>
            {recommendedBottle.readiness_status === 'READY'
              ? t('onboarding.demoRecommendation.readyNow')
              : recommendedBottle.readiness_status === 'PEAK_SOON'
              ? t('onboarding.demoRecommendation.peakSoon')
              : t('onboarding.demoRecommendation.hold')}
          </p>
        </div>

        {/* Combined info notes */}
        <div
          className="p-4 rounded-lg mb-5 space-y-3"
          style={{
            background: 'var(--wine-50)',
            border: '1px solid var(--wine-100)',
          }}
        >
          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('onboarding.demoRecommendation.educationalNote')}
          </p>
          <p className="text-xs sm:text-sm pt-2 border-t" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--wine-200)' }}>
            {t('onboarding.demoRecommendation.demoOnly')}
          </p>
        </div>

        {/* CTA section */}
        <div className="text-center">
          <h4
            className="text-base sm:text-lg font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('onboarding.demoRecommendation.ctaTitle')}
          </h4>

          <button
            onClick={onAddBottle}
            className="w-full py-4 px-6 rounded-xl font-semibold text-base sm:text-lg mb-2 transition-all min-h-[52px] sm:min-h-[56px]"
            style={{
              background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
              color: 'var(--text-inverse)',
              border: '1px solid var(--wine-700)',
              boxShadow: 'var(--shadow-lg)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }}
          >
            {t('onboarding.demoRecommendation.ctaButton')}
          </button>

          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('onboarding.demoRecommendation.ctaHelper')}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

