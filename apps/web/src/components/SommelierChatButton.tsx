/**
 * Sommelier Chat Button
 * 
 * Floating action button that opens the Sommelier Agent chat
 * Positioned above bottom nav on mobile, bottom-right on desktop
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function SommelierChatButton() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => navigate('/agent')}
      className="fixed z-[45] flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl group"
      style={{
        // Mobile: Above new floating footer, right side
        // Desktop: Bottom right
        bottom: 'calc(6.5rem + env(safe-area-inset-bottom) + 1rem)', // 104px footer + safe-area + 16px gap (adjusted for new floating footer)
        right: '1rem',
        background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
        color: 'white',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(139, 21, 56, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
      aria-label={t('cellarSommelier.askSommelier', 'Ask the Sommelier')}
    >
      {/* Icon - Sommelier/Chat */}
      <motion.div
        animate={{ rotate: [0, -10, 10, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        className="flex-shrink-0"
      >
        <svg 
          className="w-6 h-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
          />
        </svg>
      </motion.div>

      {/* Text - Hidden on small screens, visible on larger */}
      <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap">
        {t('cellarSommelier.askSommelier', 'Ask Sommelier')}
      </span>

      {/* Pulse animation indicator */}
      <span 
        className="absolute inset-0 rounded-full animate-ping opacity-20"
        style={{
          background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
        }}
      />
    </motion.button>
  );
}
