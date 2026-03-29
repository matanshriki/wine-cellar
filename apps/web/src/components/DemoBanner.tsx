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
      className="mb-4 sm:mb-6 rounded-xl overflow-hidden"
      style={{
        border: '1px solid var(--wine-200)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          height: '3px',
          background: 'linear-gradient(90deg, var(--wine-400), var(--wine-600), var(--wine-400))',
        }}
      />

      <div
        className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        style={{
          background: 'linear-gradient(135deg, var(--wine-50) 0%, var(--bg-surface) 100%)',
        }}
      >
        {/* Icon and message */}
        <div className="flex items-center gap-3 flex-1 min-w-0 w-full sm:w-auto">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{
              background: 'linear-gradient(135deg, var(--wine-100), var(--wine-200))',
              border: '1px solid var(--wine-300)',
            }}
          >
            🔍
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm sm:text-base font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('onboarding.demoBanner.message')}
            </p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onExitDemo}
          className="flex-shrink-0 px-5 py-3 rounded-xl font-semibold text-sm transition-all w-full sm:w-auto min-h-[44px]"
          style={{
            background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
            color: 'var(--text-inverse)',
            border: '1px solid var(--wine-700)',
            boxShadow: '0 4px 12px rgba(139, 21, 56, 0.2)',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 21, 56, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 21, 56, 0.2)';
          }}
        >
          {t('onboarding.demoBanner.startMyCellar')}
        </button>
      </div>
    </motion.div>
  );
}
