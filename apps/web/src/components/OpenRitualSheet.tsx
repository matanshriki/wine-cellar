/**
 * OpenRitualSheet
 *
 * A luxury 3-step bottom sheet that guides the user through opening a bottle:
 *   Step 1 – "Open":  confirm quantity
 *   Step 2 – "Serve": serving temp + decant suggestion + optional timer
 *   Step 3 – "Now":   celebratory success + optional rate-later reminder
 *
 * Calls markBottleOpened at Step 2 → 3 transition (no DB writes if cancelled).
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import * as historyService from '../services/historyService';
import * as labelArtService from '../services/labelArtService';
import type { BottleWithWineInfo } from '../services/bottleService';
import type { WineTimer } from '../hooks/useTimerManager';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';

// ─── Serving guidance derivation ──────────────────────────────────────────────

interface ServingInfo {
  temp: string;
  decantMins: number;
  decantNote: string;
}

function deriveServingInfo(bottle: BottleWithWineInfo): ServingInfo {
  const color = bottle.wine.color;
  const profile = (bottle.wine as any).wine_profile as {
    power?: number;
    tannin?: number;
    body?: number;
  } | null;

  if (color === 'sparkling') {
    return { temp: '6–9 °C / 43–48 °F', decantMins: 0, decantNote: 'Serve immediately – no decanting' };
  }
  if (color === 'white') {
    return { temp: '8–12 °C / 46–54 °F', decantMins: 0, decantNote: 'No decanting needed' };
  }
  if (color === 'rose') {
    return { temp: '8–12 °C / 46–54 °F', decantMins: 0, decantNote: 'No decanting needed' };
  }

  // Red wine
  const power = profile?.power ?? 5;
  const tannin = profile?.tannin ?? 3;
  if (power >= 7 || tannin >= 4) {
    return { temp: '16–18 °C / 61–64 °F', decantMins: 45, decantNote: 'Decant to soften tannins and open aromas' };
  }
  if (power >= 5 || tannin >= 3) {
    return { temp: '14–16 °C / 57–61 °F', decantMins: 20, decantNote: 'A brief decant brings out complexity' };
  }
  return { temp: '12–14 °C / 54–57 °F', decantMins: 0, decantNote: 'Ready to enjoy immediately' };
}

function defaultRateLaterMins(decantMins: number): number {
  if (decantMins >= 45) return 90;
  if (decantMins >= 20) return 45;
  return 20;
}

// ─── Animation variants ────────────────────────────────────────────────────────

const reduce = shouldReduceMotion();

const stepVariants = {
  enter: (dir: number) => ({
    x: reduce ? 0 : dir * 40,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: reduce ? 0 : dir * -40,
    opacity: 0,
  }),
};

const stepTransition: Transition = { type: 'tween', duration: reduce ? 0 : 0.28, ease: [0.4, 0, 0.2, 1] };

// ─── Sub-components ───────────────────────────────────────────────────────────

function Handle() {
  return (
    <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
      <div className="w-12 h-1 rounded-full" style={{ backgroundColor: 'var(--border-medium)' }} />
    </div>
  );
}

function WineMiniCard({ bottle }: { bottle: BottleWithWineInfo }) {
  const display = labelArtService.getWineDisplayImage(bottle.wine);
  const wine = bottle.wine;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-subtle)' }}
    >
      {/* Thumbnail */}
      <div
        className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center"
        style={{ background: 'var(--bg-surface-elevated)' }}
      >
        {display.imageUrl ? (
          <img src={display.imageUrl} alt={wine.wine_name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl">{wine.color === 'red' ? '🍷' : wine.color === 'sparkling' ? '🥂' : '🍾'}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="font-semibold text-sm leading-tight truncate"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          {wine.wine_name}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
          {wine.producer}
          {wine.vintage ? ` · ${wine.vintage}` : ''}
        </p>
        {wine.region && (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
            {wine.region}
          </p>
        )}
      </div>

      {/* Color dot */}
      <div
        className="flex-shrink-0 w-2 h-2 rounded-full"
        style={{
          background:
            wine.color === 'red'
              ? '#8B1A2F'
              : wine.color === 'white'
              ? '#D4AF37'
              : wine.color === 'sparkling'
              ? '#C8E6F0'
              : '#F4A0A0',
        }}
      />
    </div>
  );
}

function QuantityStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-light transition-colors"
        style={{
          background: value <= min ? 'var(--bg-muted)' : 'var(--bg-surface-elevated)',
          color: value <= min ? 'var(--text-tertiary)' : 'var(--text-primary)',
          border: '1px solid var(--border-medium)',
        }}
      >
        −
      </motion.button>

      <span
        className="text-3xl font-bold w-10 text-center"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
      >
        {value}
      </span>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-light transition-colors"
        style={{
          background: value >= max ? 'var(--bg-muted)' : 'var(--bg-surface-elevated)',
          color: value >= max ? 'var(--text-tertiary)' : 'var(--text-primary)',
          border: '1px solid var(--border-medium)',
        }}
      >
        +
      </motion.button>
    </div>
  );
}

function InfoChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-subtle)' }}
    >
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {label}
        </p>
        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function DurationPreset({
  minutes,
  selected,
  onSelect,
}: {
  minutes: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onSelect}
      className="px-4 py-2 rounded-full text-sm font-medium transition-all"
      style={{
        background: selected
          ? 'linear-gradient(135deg, var(--wine-600), var(--wine-700))'
          : 'var(--bg-surface-elevated)',
        color: selected ? 'white' : 'var(--text-secondary)',
        border: selected ? '1px solid var(--wine-700)' : '1px solid var(--border-medium)',
      }}
    >
      {minutes} min
    </motion.button>
  );
}

// ─── Primary component ────────────────────────────────────────────────────────

type Step = 'open' | 'serve' | 'done';

export interface OpenRitualSheetProps {
  isOpen: boolean;
  onClose: () => void;
  bottle: BottleWithWineInfo | null;
  occasion?: string;
  mealType?: string;
  vibe?: string;
  /** Called after successful open with the new history entry id */
  onComplete: (historyId: string) => void;
  /** Injected from context so timers are shared globally */
  createTimer: (data: Omit<WineTimer, 'id'>) => WineTimer;
}

export function OpenRitualSheet({
  isOpen,
  onClose,
  bottle,
  occasion,
  mealType,
  vibe,
  onComplete,
  createTimer,
}: OpenRitualSheetProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('open');
  const [direction, setDirection] = useState(1);
  const [qty, setQty] = useState(1);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(30);
  const [rateLaterEnabled, setRateLaterEnabled] = useState(false);
  const [rateLaterMins, setRateLaterMins] = useState(45);
  const [loading, setLoading] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const serving = bottle ? deriveServingInfo(bottle) : null;

  // Reset state when sheet opens
  const handleOpen = useCallback(() => {
    setStep('open');
    setDirection(1);
    setQty(1);
    setLoading(false);
    setHistoryId(null);
    if (serving) {
      const defaultDecant = serving.decantMins > 0 ? serving.decantMins : 30;
      setTimerEnabled(serving.decantMins > 0);
      setTimerDuration(defaultDecant);
      setRateLaterMins(defaultRateLaterMins(serving.decantMins));
    }
  }, [serving]);

  // Navigate steps
  function goTo(nextStep: Step) {
    setDirection(nextStep === 'done' || (nextStep === 'serve' && step === 'open') ? 1 : -1);
    setStep(nextStep);
  }

  // Perform the actual open action (Step 2 → 3)
  async function handleStartAndOpen() {
    if (!bottle) return;
    setLoading(true);
    try {
      const history = await historyService.markBottleOpened({
        bottle_id: bottle.id,
        opened_count: qty,
        occasion: occasion || undefined,
        meal_type: mealType || undefined,
        vibe: vibe || undefined,
      });

      setHistoryId(history.id);

      // Start decant timer if enabled
      if (timerEnabled && timerDuration > 0) {
        createTimer({
          bottle_id: bottle.id,
          wine_id: bottle.wine_id,
          wine_name: bottle.wine.wine_name,
          producer: bottle.wine.producer,
          history_id: history.id,
          started_at: new Date().toISOString(),
          duration_minutes: timerDuration,
          type: 'decant',
          label: t('openRitual.timer.decantLabel', 'Decanting'),
        });
      }

      onComplete(history.id);
      setDirection(1);
      setStep('done');
    } catch (err: any) {
      const msg = err?.message || t('openRitual.errorOpen', 'Failed to open bottle');
      // Show toast via built-in import
      import('../lib/toast').then(({ toast }) => toast.error(msg));
    } finally {
      setLoading(false);
    }
  }

  // Set rate-later timer from Step 3
  function handleSetRateLater() {
    if (!bottle || !historyId) return;
    createTimer({
      bottle_id: bottle.id,
      wine_id: bottle.wine_id,
      wine_name: bottle.wine.wine_name,
      producer: bottle.wine.producer,
      history_id: historyId,
      started_at: new Date().toISOString(),
      duration_minutes: rateLaterMins,
      type: 'rate',
      label: t('openRitual.timer.rateLabel', 'Rate reminder'),
    });
    onClose();
  }

  if (!bottle) return null;

  const DECANT_PRESETS = [15, 30, 45, 60];
  const RATE_PRESETS = [20, 45, 90];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ritual-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{
              background: 'var(--bg-overlay)',
              backdropFilter: 'var(--blur-medium)',
              WebkitBackdropFilter: 'var(--blur-medium)',
            }}
            onClick={step !== 'done' ? onClose : undefined}
          />

          {/* Sheet */}
          <motion.div
            key="ritual-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: reduce ? 0 : 0.3, ease: [0.4, 0, 0.2, 1] }}
            onClick={e => e.stopPropagation()}
            className="fixed left-0 right-0 z-50 flex flex-col"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-xl)',
              bottom: 'max(0px, var(--safe-bottom))',
              maxHeight: 'calc(90dvh - max(0px, var(--safe-bottom)))',
              borderTopLeftRadius: 'var(--radius-2xl)',
              borderTopRightRadius: 'var(--radius-2xl)',
              borderBottom: 'none',
            }}
            role="dialog"
            aria-modal="true"
            aria-label={t('openRitual.ariaLabel', 'Open bottle ritual')}
            onAnimationComplete={() => step === 'open' && handleOpen()}
          >
            <Handle />

            {/* Step indicators */}
            <div className="flex justify-center gap-2 pb-3 px-6 flex-shrink-0">
              {(['open', 'serve', 'done'] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: step === s ? 24 : 8,
                    background:
                      step === s
                        ? 'var(--wine-600)'
                        : i < ['open', 'serve', 'done'].indexOf(step)
                        ? 'var(--wine-400)'
                        : 'var(--border-medium)',
                  }}
                />
              ))}
            </div>

            {/* Step content – scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-4">
              <AnimatePresence mode="wait" custom={direction}>
                {step === 'open' && (
                  <motion.div
                    key="step-open"
                    custom={direction}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={stepTransition}
                    className="space-y-5"
                  >
                    {/* Header */}
                    <div>
                      <h2
                        className="text-xl font-bold"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                      >
                        {t('openRitual.step1.title', 'Ready to open?')}
                      </h2>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {t('openRitual.step1.subtitle', 'Confirm the bottle you\'re opening tonight.')}
                      </p>
                    </div>

                    <WineMiniCard bottle={bottle} />

                    {/* Quantity stepper – only if qty > 1 */}
                    {bottle.quantity > 1 && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-center" style={{ color: 'var(--text-secondary)' }}>
                          {t('openRitual.step1.howMany', 'How many bottles are you opening?')}
                        </p>
                        <QuantityStepper
                          value={qty}
                          min={1}
                          max={bottle.quantity}
                          onChange={setQty}
                        />
                        <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                          {bottle.quantity} {t('openRitual.step1.inCellar', 'bottles in cellar')}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {step === 'serve' && serving && (
                  <motion.div
                    key="step-serve"
                    custom={direction}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={stepTransition}
                    className="space-y-5"
                  >
                    {/* Header */}
                    <div>
                      <h2
                        className="text-xl font-bold"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                      >
                        {t('openRitual.step2.title', 'How to serve')}
                      </h2>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {t('openRitual.step2.subtitle', 'Get the most out of this bottle.')}
                      </p>
                    </div>

                    {/* Serving chips */}
                    <div className="space-y-2">
                      <InfoChip
                        icon="🌡️"
                        label={t('openRitual.step2.tempLabel', 'Serving temperature')}
                        value={serving.temp}
                      />
                      <InfoChip
                        icon="🫙"
                        label={t('openRitual.step2.decantLabel', 'Decanting')}
                        value={serving.decantNote}
                      />
                    </div>

                    {/* Timer toggle */}
                    {serving.decantMins > 0 && (
                      <div className="space-y-3">
                        <button
                          onClick={() => setTimerEnabled(v => !v)}
                          className="w-full flex items-center justify-between p-3 rounded-xl transition-colors"
                          style={{
                            background: timerEnabled ? 'var(--wine-50, #fdf2f5)' : 'var(--bg-muted)',
                            border: timerEnabled ? '1px solid var(--wine-300)' : '1px solid var(--border-subtle)',
                          }}
                        >
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            ⏱ {t('openRitual.step2.startTimer', 'Start decant timer')}
                          </span>
                          <div
                            className="w-10 h-6 rounded-full relative transition-colors"
                            style={{ background: timerEnabled ? 'var(--wine-600)' : 'var(--border-medium)' }}
                          >
                            <motion.div
                              animate={{ x: timerEnabled ? 16 : 2 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className="absolute top-1 w-4 h-4 rounded-full bg-white"
                              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                            />
                          </div>
                        </button>

                        {timerEnabled && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2"
                          >
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {t('openRitual.step2.duration', 'Duration')}
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              {DECANT_PRESETS.map(m => (
                                <DurationPreset
                                  key={m}
                                  minutes={m}
                                  selected={timerDuration === m}
                                  onSelect={() => setTimerDuration(m)}
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {step === 'done' && (
                  <motion.div
                    key="step-done"
                    custom={direction}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={stepTransition}
                    className="space-y-5 text-center"
                  >
                    {/* Celebratory icon */}
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                      className="flex justify-center py-2"
                    >
                      <div className="text-6xl">🍷</div>
                    </motion.div>

                    <div>
                      <h2
                        className="text-xl font-bold"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                      >
                        {t('openRitual.step3.title', 'Enjoy')}
                      </h2>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {t('openRitual.step3.subtitle', 'Want a reminder to rate it later?')}
                      </p>
                    </div>

                    {/* Rate later toggle */}
                    <div className="space-y-3">
                      <button
                        onClick={() => setRateLaterEnabled(v => !v)}
                        className="w-full flex items-center justify-between p-3 rounded-xl transition-colors"
                        style={{
                          background: rateLaterEnabled ? 'var(--wine-50, #fdf2f5)' : 'var(--bg-muted)',
                          border: rateLaterEnabled ? '1px solid var(--wine-300)' : '1px solid var(--border-subtle)',
                        }}
                      >
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          ⭐ {t('openRitual.step3.rateLater', 'Remind me to rate it')}
                        </span>
                        <div
                          className="w-10 h-6 rounded-full relative transition-colors"
                          style={{ background: rateLaterEnabled ? 'var(--wine-600)' : 'var(--border-medium)' }}
                        >
                          <motion.div
                            animate={{ x: rateLaterEnabled ? 16 : 2 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute top-1 w-4 h-4 rounded-full bg-white"
                            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                          />
                        </div>
                      </button>

                      {rateLaterEnabled && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2"
                        >
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {t('openRitual.step3.remindIn', 'Remind me in')}
                          </p>
                          <div className="flex gap-2 justify-center flex-wrap">
                            {RATE_PRESETS.map(m => (
                              <DurationPreset
                                key={m}
                                minutes={m}
                                selected={rateLaterMins === m}
                                onSelect={() => setRateLaterMins(m)}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sticky footer actions */}
            <div
              className="flex-shrink-0 px-6 pt-3 pb-4 space-y-2"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              {step === 'open' && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => goTo('serve')}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm"
                    style={{
                      background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                      color: 'white',
                      border: '1px solid var(--wine-700)',
                    }}
                  >
                    {t('openRitual.step1.continue', 'Continue')}
                  </motion.button>
                  <button
                    onClick={onClose}
                    className="w-full py-3 text-sm rounded-xl transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                </>
              )}

              {step === 'serve' && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStartAndOpen}
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm transition-opacity"
                    style={{
                      background: 'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
                      color: 'white',
                      border: '1px solid var(--gold-600)',
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading
                      ? t('openRitual.step2.opening', 'Opening…')
                      : timerEnabled
                      ? t('openRitual.step2.startAndOpen', 'Start Timer & Open')
                      : t('openRitual.step2.open', 'Open Bottle')}
                  </motion.button>
                  <button
                    onClick={() => {
                      setTimerEnabled(false);
                      handleStartAndOpen();
                    }}
                    disabled={loading}
                    className="w-full py-3 text-sm rounded-xl transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('openRitual.step2.skipTimer', 'Open without timer')}
                  </button>
                </>
              )}

              {step === 'done' && (
                <>
                  {rateLaterEnabled ? (
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSetRateLater}
                      className="w-full py-3.5 rounded-xl font-semibold text-sm"
                      style={{
                        background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                        color: 'white',
                        border: '1px solid var(--wine-700)',
                      }}
                    >
                      {t('openRitual.step3.setReminder', 'Set reminder')}
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onClose}
                      className="w-full py-3.5 rounded-xl font-semibold text-sm"
                      style={{
                        background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                        color: 'white',
                        border: '1px solid var(--wine-700)',
                      }}
                    >
                      {t('openRitual.step3.cheers', 'Cheers!')}
                    </motion.button>
                  )}
                  <button
                    onClick={onClose}
                    className="w-full py-3 text-sm rounded-xl transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('openRitual.step3.noThanks', 'No thanks')}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
