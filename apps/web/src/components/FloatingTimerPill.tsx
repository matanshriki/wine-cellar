/**
 * Floating Timer Pill
 * 
 * Displays active wine timers (decant, rate reminders) as a floating pill above the footer.
 * Tapping opens a mini-sheet with timer details and actions.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTimers, WineTimer } from '../contexts/TimerContext';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';

interface FloatingTimerPillProps {
  onRateNow?: (timer: WineTimer) => void;
}

export function FloatingTimerPill({ onRateNow }: FloatingTimerPillProps) {
  const { t } = useTranslation();
  const { activeTimers, completedTimers, formatRemainingTime, dismissCompletedTimer, cancelTimer, tick } = useTimers();
  const reduceMotion = shouldReduceMotion();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [completedToShow, setCompletedToShow] = useState<WineTimer | null>(null);

  // Check for newly completed timers
  useEffect(() => {
    if (completedTimers.length > 0 && !showCompletedModal) {
      setCompletedToShow(completedTimers[0]);
      setShowCompletedModal(true);
    }
  }, [completedTimers, showCompletedModal]);

  const hasTimers = activeTimers.length > 0;
  const primaryTimer = activeTimers[0];

  if (!hasTimers && !showCompletedModal) return null;

  const handlePillClick = () => {
    if (activeTimers.length === 1) {
      setIsExpanded(!isExpanded);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const handleDismissCompleted = () => {
    if (completedToShow) {
      dismissCompletedTimer(completedToShow.id);
    }
    setShowCompletedModal(false);
    setCompletedToShow(null);
  };

  const handleRateNow = () => {
    if (completedToShow && onRateNow) {
      onRateNow(completedToShow);
    }
    handleDismissCompleted();
  };

  const handleCancelTimer = (timerId: string) => {
    cancelTimer(timerId);
    if (activeTimers.length <= 1) {
      setIsExpanded(false);
    }
  };

  return (
    <>
      {/* Active Timer Pill */}
      <AnimatePresence>
        {hasTimers && (
          <motion.div
            className="fixed z-40 pointer-events-auto"
            style={{
              bottom: 'calc(80px + env(safe-area-inset-bottom))',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <motion.button
              onClick={handlePillClick}
              className="flex items-center gap-3 px-5 py-3 rounded-full shadow-xl"
              style={{
                background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                boxShadow: '0 8px 32px rgba(164, 76, 104, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
              }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
            >
              {/* Timer Icon */}
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
                className="text-xl"
              >
                {primaryTimer?.type === 'decant' ? '🍷' : '⏰'}
              </motion.div>

              {/* Timer Info */}
              <div className="text-left">
                <p className="text-white text-sm font-medium leading-tight">
                  {primaryTimer?.label}
                </p>
                <p className="text-white/80 text-xs">
                  {primaryTimer && formatRemainingTime(primaryTimer)}
                  {activeTimers.length > 1 && ` +${activeTimers.length - 1}`}
                </p>
              </div>

              {/* Expand Icon */}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </motion.div>
            </motion.button>

            {/* Expanded Timer List */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 rounded-2xl overflow-hidden shadow-2xl"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="p-3 space-y-2">
                    {activeTimers.map((timer) => (
                      <TimerRow
                        key={timer.id}
                        timer={timer}
                        formatRemainingTime={formatRemainingTime}
                        onCancel={() => handleCancelTimer(timer.id)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timer Completed Modal */}
      <AnimatePresence>
        {showCompletedModal && completedToShow && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'var(--bg-overlay)',
                backdropFilter: 'var(--blur-medium)',
              }}
              onClick={handleDismissCompleted}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-sm rounded-2xl p-6 text-center"
              style={{
                background: 'var(--bg-surface)',
                boxShadow: 'var(--shadow-2xl)',
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {/* Icon */}
              <motion.div
                className="text-5xl mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
              >
                {completedToShow.type === 'decant' ? '🍷' : '⭐'}
              </motion.div>

              {/* Title */}
              <h3 
                className="text-xl font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {completedToShow.type === 'decant'
                  ? t('ritual.decantReady', 'Decant Ready!')
                  : t('ritual.timeToRate', 'Time to Rate!')}
              </h3>

              {/* Wine Name */}
              <p 
                className="text-base mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {completedToShow.wine_name}
              </p>
              {completedToShow.producer && (
                <p 
                  className="text-sm mb-4"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {completedToShow.producer}
                  {completedToShow.vintage && ` · ${completedToShow.vintage}`}
                </p>
              )}

              {/* CTAs */}
              <div className="flex gap-3">
                <button
                  onClick={handleDismissCompleted}
                  className="flex-1 py-3 rounded-xl font-medium"
                  style={{
                    background: 'var(--bg-muted)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {t('common.dismiss', 'Dismiss')}
                </button>
                <motion.button
                  onClick={handleRateNow}
                  className="flex-1 py-3 rounded-xl font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                    color: 'white',
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  {completedToShow.type === 'decant'
                    ? t('ritual.pourNow', 'Pour Now')
                    : t('ritual.rateNow', 'Rate Now')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Individual timer row in expanded list
interface TimerRowProps {
  timer: WineTimer;
  formatRemainingTime: (timer: WineTimer) => string;
  onCancel: () => void;
}

function TimerRow({ timer, formatRemainingTime, onCancel }: TimerRowProps) {
  const { t } = useTranslation();

  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: 'var(--bg-muted)' }}
    >
      <div className="text-2xl">
        {timer.type === 'decant' ? '🍷' : '⏰'}
      </div>
      <div className="flex-1 min-w-0">
        <p 
          className="text-sm font-medium truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {timer.wine_name}
        </p>
        <p 
          className="text-xs"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {timer.label} · {formatRemainingTime(timer)}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="p-1.5 rounded-lg transition-colors"
        style={{ color: 'var(--text-tertiary)' }}
        title={t('common.cancel', 'Cancel')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
