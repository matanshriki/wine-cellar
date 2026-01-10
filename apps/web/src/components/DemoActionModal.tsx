/**
 * Demo Action Modal - Onboarding v1 – production
 * 
 * Displays a sophisticated message when users try to perform actions on demo bottles.
 * Encourages them to add their own bottles to use full features.
 */

import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface DemoActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBottle: () => void;
  action: 'edit' | 'markOpened' | 'delete';
}

export function DemoActionModal({ isOpen, onClose, onAddBottle, action }: DemoActionModalProps) {
  const { t } = useTranslation();

  // Get action-specific content
  const getContent = () => {
    switch (action) {
      case 'edit':
        return {
          title: t('onboarding.demoAction.edit.title', '✨ This is a demo bottle'),
          message: t('onboarding.demoAction.edit.message', 'Demo bottles are here to showcase the app\'s features. To edit and manage your own collection, add your first bottle.'),
        };
      case 'markOpened':
        return {
          title: t('onboarding.demoAction.markOpened.title', '🍷 Ready to track your real wines?'),
          message: t('onboarding.demoAction.markOpened.message', 'This is a demo bottle to show you what\'s possible. Add your own bottles to track when you open them, manage your cellar, and get personalized recommendations.'),
        };
      case 'delete':
        return {
          title: t('onboarding.demoAction.delete.title', '✨ This is a demo bottle'),
          message: t('onboarding.demoAction.delete.message', 'Demo bottles help you explore the app. They\'ll disappear once you add your first real bottle.'),
        };
    }
  };

  const content = getContent();

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{ backdropFilter: 'blur(12px)' }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md mx-auto rounded-2xl p-6 sm:p-8"
            style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-6 flex items-center justify-center"
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--wine-50), var(--wine-100))',
                border: '2px solid var(--wine-200)',
              }}
            >
              <span className="text-5xl" style={{ filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))' }}>🍷</span>
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-2xl sm:text-3xl font-bold text-center mb-4"
              style={{
                color: '#ffffff',
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
              }}
            >
              {content.title}
            </motion.h2>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base sm:text-lg text-center mb-8 leading-relaxed"
              style={{ 
                color: 'rgba(255, 255, 255, 0.9)',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
              }}
            >
              {content.message}
            </motion.p>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex flex-col gap-3"
            >
              {/* Primary CTA */}
              <button
                onClick={() => {
                  onClose();
                  onAddBottle();
                }}
                className="w-full py-4 px-6 rounded-xl font-semibold text-base sm:text-lg transition-all"
                style={{
                  background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                  color: 'var(--text-inverse)',
                  border: '1px solid var(--wine-700)',
                  boxShadow: 'var(--shadow-md)',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px -8px rgba(var(--wine-600-rgb), 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
              >
                {t('onboarding.demoAction.addBottleButton', 'Add My First Bottle')}
              </button>

              {/* Secondary CTA */}
              <button
                onClick={onClose}
                className="w-full py-3 px-6 rounded-xl font-medium text-sm sm:text-base transition-all"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-base)',
                  boxShadow: 'var(--shadow-xs)',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-muted)';
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                  e.currentTarget.style.borderColor = 'var(--border-base)';
                }}
              >
                {t('onboarding.demoAction.continueButton', 'Continue Exploring')}
              </button>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

