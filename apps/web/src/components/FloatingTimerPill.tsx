/**
 * FloatingTimerPill
 *
 * A luxury floating pill that shows active decant / rate-reminder timers.
 * Positioned above the mobile footer (safe-area aware).
 *
 * Behaviour:
 *  – Shows the most urgent active timer's countdown
 *  – Tap → expands to a mini options sheet
 *  – When a timer expires → shows an in-app alert modal
 *  – Handles multiple timers by cycling primary display
 */

import { useState, useEffect, useRef } from 'react';
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

// Track which expired timers we've already alerted about this session
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

  // Detect newly-expired timers and show alert once
  useEffect(() => {
    for (const timer of recentlyExpiredTimers) {
      if (!alertedTimerIds.has(timer.id)) {
        alertedTimerIds.add(timer.id);
        setExpiredAlert(timer);
        break; // show one at a time
      }
    }
  }, [recentlyExpiredTimers]);

  // Primary timer to display (earliest to expire)
  const primaryTimer = activeTimers.length > 0
    ? activeTimers.reduce((a, b) =>
        getRemainingMs(a) < getRemainingMs(b) ? a : b,
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

  const pillColor = primaryTimer?.type === 'decant' ? 'var(--wine-600)' : '#D4AF37';
  const pillEmoji = primaryTimer?.type === 'decant' ? '🫙' : '⭐';

  return (
    <>
      {/* ── Floating pill ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {primaryTimer && (
          <motion.div
            key="timer-pill"
            initial={{ y: 80, opacity: 0, scale: 0.85 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed left-1/2 -translate-x-1/2 z-[55]"
            style={{
              // Above mobile footer (≈80px) + safe area
              bottom: 'calc(max(0px, var(--safe-bottom)) + 88px)',
            }}
          >
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-white font-medium text-sm shadow-lg"
              style={{
                background: pillColor,
                boxShadow: `0 4px 20px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1)`,
                WebkitTapHighlightColor: 'transparent',
              }}
              aria-label={t('timerPill.ariaLabel', 'Active timer — tap to manage')}
            >
              <span className="text-base">{pillEmoji}</span>
              <span className="font-mono text-sm tabular-nums">
                {formatCountdown(primaryTimer)}
              </span>
              <span className="text-xs opacity-80 max-w-[90px] truncate">
                {primaryTimer.wine_name}
              </span>
              {/* Expand indicator */}
              <motion.span
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-xs opacity-60"
              >
                ▲
              </motion.span>
              {/* Pulse dot for active */}
              <motion.div
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="w-2 h-2 rounded-full bg-white opacity-60"
              />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded mini-sheet ────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <>
            {/* Tap-away backdrop */}
            <motion.div
              key="pill-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[53]"
              onClick={() => setExpanded(false)}
            />

            <motion.div
              key="pill-sheet"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'tween', duration: reduce ? 0 : 0.25, ease: [0.4, 0, 0.2, 1] }}
              onClick={e => e.stopPropagation()}
              className="fixed left-0 right-0 z-[54]"
              style={{
                bottom: 'max(0px, var(--safe-bottom))',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-xl)',
                borderTopLeftRadius: 'var(--radius-2xl)',
                borderTopRightRadius: 'var(--radius-2xl)',
                borderBottom: 'none',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border-medium)' }} />
              </div>

              <div className="px-5 pb-2">
                <h3
                  className="text-sm font-semibold mb-3"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('timerPill.activeTimers', 'Active timers')}
                </h3>

                <div className="space-y-2">
                  {activeTimers.map(timer => (
                    <div
                      key={timer.id}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-subtle)' }}
                    >
                      <span className="text-lg flex-shrink-0">
                        {timer.type === 'decant' ? '🫙' : '⭐'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {timer.label} · {timer.wine_name}
                        </p>
                        <p className="text-xs mt-0.5 font-mono tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                          {formatCountdown(timer)} {t('timerPill.remaining', 'remaining')}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-1.5 flex-shrink-0">
                        {timer.type === 'rate' && timer.history_id && (
                          <motion.button
                            whileTap={{ scale: 0.92 }}
                            onClick={() => handleRateNow(timer)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
                            style={{
                              background: 'var(--wine-600)',
                              color: 'white',
                            }}
                          >
                            {t('timerPill.rateNow', 'Rate now')}
                          </motion.button>
                        )}
                        <motion.button
                          whileTap={{ scale: 0.92 }}
                          onClick={() => handleCancelTimer(timer)}
                          className="px-2.5 py-1.5 rounded-lg text-xs"
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
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Expired timer alert modal ──────────────────────────────────── */}
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
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            />
            <motion.div
              key="expired-modal"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="fixed left-4 right-4 z-[63] p-6 rounded-2xl"
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              {/* Icon */}
              <div className="text-center mb-4">
                <span className="text-5xl">
                  {expiredAlert.type === 'decant' ? '🍷' : '⭐'}
                </span>
              </div>

              {/* Message */}
              <h3
                className="text-lg font-bold text-center mb-1"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
              >
                {expiredAlert.type === 'decant'
                  ? t('timerPill.decantReady', 'Decant ready')
                  : t('timerPill.ratePrompt', 'How was it?')}
              </h3>
              <p className="text-sm text-center mb-5" style={{ color: 'var(--text-secondary)' }}>
                {expiredAlert.wine_name}
                {expiredAlert.type === 'decant'
                  ? ` ${t('timerPill.decantReadyMsg', 'is ready to pour.')}`
                  : ` ${t('timerPill.ratePromptMsg', '— take a moment to rate it.')}`}
              </p>

              {/* Actions */}
              <div className="space-y-2">
                {expiredAlert.type === 'rate' && expiredAlert.history_id ? (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleRateNow(expiredAlert)}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm"
                    style={{
                      background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                      color: 'white',
                      border: '1px solid var(--wine-700)',
                    }}
                  >
                    {t('timerPill.rateNow', 'Rate now')}
                  </motion.button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleDismissExpired(expiredAlert)}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm"
                    style={{
                      background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                      color: 'white',
                      border: '1px solid var(--wine-700)',
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

      {/* ── Rate ritual sheet (triggered from timer) ───────────────────── */}
      {rateTarget && rateTarget.history_id && (
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
