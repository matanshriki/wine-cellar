/**
 * Demo Banner - Onboarding v1 – value first
 * 
 * Shown at the top of the cellar when demo mode is active.
 * Lets users know they're viewing demo data.
 * 
 * DEV MODE ONLY
 */

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface DemoBannerProps {
  onExitDemo: () => void;
}

export function DemoBanner({ onExitDemo }: DemoBannerProps) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="mb-4 sm:mb-6 p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-4"
      style={{
        background: 'linear-gradient(135deg, var(--wine-50) 0%, var(--wine-100) 100%)',
        border: '2px solid var(--wine-200)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Icon and message */}
      <div className="flex items-center gap-3 flex-1 min-w-0 w-full sm:w-auto">
        <div
          className="flex-shrink-0 text-2xl"
          role="img"
          aria-label="Magnifying glass"
        >
          🔍
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm sm:text-base font-medium"
            style={{
              color: 'var(--text-primary)',
            }}
          >
            {t('onboarding.demoBanner.message')}
          </p>
        </div>
      </div>

      {/* Exit button - Full width on mobile, auto on desktop */}
      <button
        onClick={onExitDemo}
        className="flex-shrink-0 px-4 py-3 rounded-lg font-medium text-sm transition-all w-full sm:w-auto min-h-[44px]"
        style={{
          background: 'var(--wine-600)',
          color: 'var(--text-inverse)',
          border: '1px solid var(--wine-700)',
          boxShadow: 'var(--shadow-md)',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--wine-700)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--wine-600)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {t('onboarding.demoBanner.exitDemo')}
      </button>
    </motion.div>
  );
}

