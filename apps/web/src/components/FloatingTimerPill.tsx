/**
 * FloatingTimerPill
 *
 * A luxury floating pill that shows active decant / rate-reminder timers.
 * Positioned above the mobile footer (safe-area aware).
 *
 * Behaviour:
 *  – Shows the most urgent active timer's countdown
 *  – Tap → expands to a bottom sheet with all timers (with opaque backdrop)
 *  – When a timer expires → shows a centred alert modal
 *  – Handles multiple timers
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { WineTimer } from '../hooks/useTimerManager';
import { RateRitualSheet } from './RateRitualSheet';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';

const reduce = shouldReduceMotion();

interface FloatingTimerPillProps {
  activeTimers: WineTimer[];
  recentlyExpiredTimers: WineTimer[];
  formatCountdown: (timer: WineTimer) => string;
  getRemainingMs: (timer: WineTimer) => number;
  cancelTimer: (id: string) => void;
  dismissTimer: (id: string) => void;
}

const alertedTimerIds = new Set<string>();

export function FloatingTimerPill({
  activeTimers,
  recentlyExpiredTimers,
  formatCountdown,
  getRemainingMs,
  cancelTimer,
  dismissTimer,
}: FloatingTimerPillProps) {
  const { t } = useTranslation();

  const [expanded, setExpanded] = useState(false);
  const [expiredAlert, setExpiredAlert] = useState<WineTimer | null>(null);
  const [showRateSheet, setShowRateSheet] = useState(false);
  const [rateTarget, setRateTarget] = useState<WineTimer | null>(null);

  // Close expanded sheet when all timers disappear
  useEffect(() => {
    if (activeTimers.length === 0) setExpanded(false);
  }, [activeTimers.length]);

  // Show alert for newly expired timers (once per session)
  useEffect(() => {
    for (const timer of recentlyExpiredTimers) {
      if (!alertedTimerIds.has(timer.id)) {
        alertedTimerIds.add(timer.id);
        setExpiredAlert(timer);
        break;
      }
    }
  }, [recentlyExpiredTimers]);

  // Primary timer = the one expiring soonest
  const primaryTimer =
    activeTimers.length > 0
      ? activeTimers.reduce((a, b) =>
          getRemainingMs(a) <= getRemainingMs(b) ? a : b,
        )
      : null;

  function handleRateNow(timer: WineTimer) {
    setRateTarget(timer);
    setShowRateSheet(true);
    setExpanded(false);
    setExpiredAlert(null);
    dismissTimer(timer.id);
  }

  function handleDismissExpired(timer: WineTimer) {
    dismissTimer(timer.id);
    setExpiredAlert(null);
  }

  function handleCancelTimer(timer: WineTimer) {
    cancelTimer(timer.id);
    if (activeTimers.length <= 1) setExpanded(false);
  }

  const isDecant = primaryTimer?.type === 'decant';
  const pillBg = isDecant ? 'var(--wine-600)' : '#C8972A';
  const pillEmoji = isDecant ? '🫙' : '⭐';

  return (
    <>
      {/* ── Floating pill ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {primaryTimer && !expanded && (
          <motion.div
            key="timer-pill"
            initial={{ y: 60, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="fixed left-1/2 -translate-x-1/2 z-[55]"
            style={{
              // Sits just above the mobile footer (~80px) + safe area
              bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 0px) + 88px)',
            }}
          >
            <motion.button
              whileHover={reduce ? {} : { scale: 1.04 }}
              whileTap={reduce ? {} : { scale: 0.94 }}
              onClick={() => setExpanded(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-white font-medium text-sm"
              style={{
                background: pillBg,
                boxShadow: '0 4px 24px rgba(0,0,0,0.3), 0 0 0 1.5px rgba(255,255,255,0.15)',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
              aria-label={t('timerPill.ariaLabel', 'Active timer — tap to manage')}
            >
              <span className="text-base leading-none">{pillEmoji}</span>
              <span className="font-mono tabular-nums">{formatCountdown(primaryTimer)}</span>
              <span className="opacity-80 max-w-[80px] truncate text-xs">
                {primaryTimer.wine_name}
              </span>
              {/* Live pulse dot */}
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                className="w-1.5 h-1.5 rounded-full bg-white"
              />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded sheet ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <>
            {/* Opaque backdrop — makes the sheet clearly visible */}
            <motion.div
              key="pill-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              className="fixed inset-0 z-[53]"
              style={{
                background: 'rgba(0, 0, 0, 0.55)',
                backdropFilter: 'blur(3px)',
                WebkitBackdropFilter: 'blur(3px)',
              }}
              onClick={() => setExpanded(false)}
            />

            {/* Sheet */}
            <motion.div
              key="pill-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: reduce ? 0 : 0.28, ease: [0.4, 0, 0.2, 1] }}
              onClick={e => e.stopPropagation()}
              className="fixed left-0 right-0 z-[54]"
              style={{
                bottom: 0,
                background: 'var(--bg-surface)',
                borderTop: '1px solid var(--border-light)',
                borderTopLeftRadius: '20px',
                borderTopRightRadius: '20px',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
                paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
              }}
              role="dialog"
              aria-modal="true"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--border-medium)' }}
                />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-2 pb-3">
                <h3
                  className="text-base font-semibold"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                >
                  {t('timerPill.activeTimers', 'Active timers')}
                </h3>
                <button
                  onClick={() => setExpanded(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                  style={{ background: 'var(--bg-muted)', color: 'var(--text-tertiary)' }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Timer rows */}
              <div className="px-5 space-y-2 pb-2">
                {activeTimers.map(timer => {
                  const remaining = formatCountdown(timer);
                  const emoji = timer.type === 'decant' ? '🫙' : '⭐';
                  const accentColor = timer.type === 'decant' ? 'var(--wine-600)' : '#C8972A';

                  return (
                    <div
                      key={timer.id}
                      className="flex items-center gap-3 p-3.5 rounded-2xl"
                      style={{
                        background: 'var(--bg-muted)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {/* Color accent + emoji */}
                      <div
                        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{ background: accentColor + '20' }}
                      >
                        {emoji}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {timer.label}
                        </p>
                        <p
                          className="text-xs mt-0.5 truncate"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {timer.wine_name}
                        </p>
                        <p
                          className="text-xs font-mono tabular-nums mt-1"
                          style={{ color: accentColor, fontWeight: 600 }}
                        >
                          {remaining} {t('timerPill.remaining', 'remaining')}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {timer.type === 'rate' && timer.history_id && (
                          <motion.button
                            whileTap={{ scale: 0.93 }}
                            onClick={() => handleRateNow(timer)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                            style={{ background: 'var(--wine-600)' }}
                          >
                            {t('timerPill.rateNow', 'Rate now')}
                          </motion.button>
                        )}
                        <motion.button
                          whileTap={{ scale: 0.93 }}
                          onClick={() => handleCancelTimer(timer)}
                          className="px-3 py-1.5 rounded-lg text-xs"
                          style={{
                            background: 'var(--bg-surface-elevated)',
                            color: 'var(--text-tertiary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {t('timerPill.dismiss', 'Dismiss')}
                        </motion.button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Expired timer alert ───────────────────────────────────────────── */}
      <AnimatePresence>
        {expiredAlert && (
          <>
            <motion.div
              key="expired-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[62]"
              style={{
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            />
            <motion.div
              key="expired-modal"
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              className="fixed left-5 right-5 z-[63] p-6 rounded-3xl"
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
              }}
            >
              <div className="text-center mb-4">
                <span className="text-5xl">
                  {expiredAlert.type === 'decant' ? '🍷' : '⭐'}
                </span>
              </div>

              <h3
                className="text-lg font-bold text-center mb-1"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
              >
                {expiredAlert.type === 'decant'
                  ? t('timerPill.decantReady', 'Decant ready')
                  : t('timerPill.ratePrompt', 'How was it?')}
              </h3>
              <p className="text-sm text-center mb-5" style={{ color: 'var(--text-secondary)' }}>
                <strong>{expiredAlert.wine_name}</strong>{' '}
                {expiredAlert.type === 'decant'
                  ? t('timerPill.decantReadyMsg', 'is ready to pour.')
                  : t('timerPill.ratePromptMsg', '— take a moment to rate it.')}
              </p>

              <div className="space-y-2">
                {expiredAlert.type === 'rate' && expiredAlert.history_id ? (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleRateNow(expiredAlert)}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm text-white"
                    style={{
                      background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                    }}
                  >
                    {t('timerPill.rateNow', 'Rate now')}
                  </motion.button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleDismissExpired(expiredAlert)}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm text-white"
                    style={{
                      background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                    }}
                  >
                    {t('timerPill.enjoyNow', 'Enjoy!')}
                  </motion.button>
                )}
                <button
                  onClick={() => handleDismissExpired(expiredAlert)}
                  className="w-full py-3 text-sm rounded-xl"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('timerPill.dismiss', 'Dismiss')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Rate ritual sheet ─────────────────────────────────────────────── */}
      {rateTarget?.history_id && (
        <RateRitualSheet
          isOpen={showRateSheet}
          onClose={() => {
            setShowRateSheet(false);
            setRateTarget(null);
          }}
          historyId={rateTarget.history_id}
          wineName={rateTarget.wine_name}
          producer={rateTarget.producer}
        />
      )}
    </>
  );
}
