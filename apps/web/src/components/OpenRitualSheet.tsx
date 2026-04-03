/**
 * OpenRitualSheet
 *
 * A luxury 4-step bottom sheet that guides the user through opening a bottle:
 *   Step 1 – "Open":  confirm quantity
 *   Step 2 – "Serve": serving temp + decant suggestion + optional timer
 *   Step 3 – "Done":  celebratory success → quick-star teaser + clear CTAs
 *   Step 4 – "Rate":  full inline rating (stars + mood chips + notes)
 *
 * Calls markBottleOpened at Step 2 → 3 transition (no DB writes if cancelled).
 * Rating is saved inline at Step 4, no navigation to History required.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import * as historyService from '../services/historyService';
import * as labelArtService from '../services/labelArtService';
import type { BottleWithWineInfo } from '../services/bottleService';
import type { WineTimer } from '../hooks/useTimerManager';
import { MOOD_CHIPS } from './RateRitualSheet';
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

// Step ordering used to derive slide direction
const STEP_ORDER = ['open', 'serve', 'done', 'rate'] as const;
type Step = (typeof STEP_ORDER)[number];

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

/** Large interactive stars used in the inline rating step */
function InlineStarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-1 justify-center" role="group" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= (hovered || value);
        return (
          <motion.button
            key={star}
            whileTap={{ scale: 0.8 }}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onTouchStart={() => setHovered(star)}
            onTouchEnd={() => setHovered(0)}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            className="p-1"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
          >
            <motion.span
              animate={{ scale: filled ? 1.2 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="text-4xl block"
              style={{ filter: filled ? 'none' : 'grayscale(1) opacity(0.3)' }}
            >
              ⭐
            </motion.span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Primary component ────────────────────────────────────────────────────────

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
  const [rateLaterMins, setRateLaterMins] = useState(45);
  const [loading, setLoading] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);

  // Rating state (step 4)
  const [rating, setRating] = useState(0);
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [ratingNotes, setRatingNotes] = useState('');
  const [ratingSaving, setRatingSaving] = useState(false);

  const serving = bottle ? deriveServingInfo(bottle) : null;

  // Reset all state whenever the sheet opens for a new bottle.
  // useEffect on isOpen is reliable and avoids the onAnimationComplete pitfall
  // (which fires on both enter AND exit animations).
  useEffect(() => {
    if (!isOpen) return;
    setStep('open');
    setDirection(1);
    setQty(1);
    setLoading(false);
    setHistoryId(null);
    setRating(0);
    setSelectedChips(new Set());
    setRatingNotes('');
    setRatingSaving(false);
    if (serving) {
      const defaultDecant = serving.decantMins > 0 ? serving.decantMins : 30;
      setTimerEnabled(serving.decantMins > 0);
      setTimerDuration(defaultDecant);
      setRateLaterMins(defaultRateLaterMins(serving.decantMins));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Navigate between steps, inferring slide direction from step order
  function goTo(nextStep: Step) {
    const cur = STEP_ORDER.indexOf(step);
    const next = STEP_ORDER.indexOf(nextStep);
    setDirection(next >= cur ? 1 : -1);
    setStep(nextStep);
  }

  // ── Step 2 → 3: mark bottle as opened ─────────────────────────────────────

  // skipTimer: true when user clicks "Open without timer" — bypasses state-batching
  // race where timerEnabled could still read as true after setTimerEnabled(false).
  async function handleStartAndOpen(skipTimer = false) {
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

      // Advance the UI immediately — timer creation is best-effort and must
      // not block the success path (createTimer throws if userId isn't loaded yet).
      onComplete(history.id);
      setDirection(1);
      setStep('done');

      // Start decant timer if enabled (non-critical: swallow errors silently)
      if (!skipTimer && timerEnabled && timerDuration > 0) {
        try {
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
        } catch (timerErr) {
          console.warn('[OpenRitual] Decant timer creation failed (non-critical):', timerErr);
        }
      }
    } catch (err: any) {
      const msg = err?.message || t('openRitual.errorOpen', 'Failed to open bottle');
      import('../lib/toast').then(({ toast }) => toast.error(msg));
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: "Remind me later" ──────────────────────────────────────────────

  function handleRemindLater() {
    if (bottle && historyId) {
      try {
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
      } catch (err) {
        console.warn('[OpenRitual] Rate reminder timer failed (non-critical):', err);
      }
    }
    onClose();
  }

  // ── Step 4: save inline rating ─────────────────────────────────────────────

  function toggleChip(id: string) {
    setSelectedChips(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSaveRating() {
    if (!historyId || rating === 0) return;
    setRatingSaving(true);
    try {
      const chipsText =
        selectedChips.size > 0
          ? Array.from(selectedChips)
              .map(id => MOOD_CHIPS.find(c => c.id === id)?.emoji)
              .join(' ')
          : undefined;
      const combinedNotes = [chipsText, ratingNotes.trim()].filter(Boolean).join(' · ') || undefined;

      await historyService.updateConsumptionHistory(historyId, {
        user_rating: rating,
        tasting_notes: combinedNotes,
      });

      import('../lib/toast').then(({ toast }) =>
        toast.success(t('rateRitual.saved', 'Rating saved!'))
      );
      onClose();
    } catch (err: any) {
      import('../lib/toast').then(({ toast }) =>
        toast.error(err?.message || t('rateRitual.saveFailed', 'Failed to save rating'))
      );
    } finally {
      setRatingSaving(false);
    }
  }

  // Tapping a star on the "done" step pre-selects and slides into rating step
  function handleQuickStarTap(star: number) {
    setRating(star);
    goTo('rate');
  }

  if (!bottle) return null;

  const DECANT_PRESETS = [15, 30, 45, 60];

  // Progress dots: 3 dots (open / serve / done+rate share the 3rd)
  const PROGRESS_STEPS = ['open', 'serve', 'done'] as const;
  const progressActive = step === 'rate' ? 'done' : step;

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
            onClick={step === 'open' || step === 'serve' ? onClose : undefined}
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
          >
            <Handle />

            {/* Step indicators */}
            <div className="flex justify-center gap-2 pb-3 px-6 flex-shrink-0">
              {PROGRESS_STEPS.map((s, i) => (
                <div
                  key={s}
                  className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: progressActive === s ? 24 : 8,
                    background:
                      progressActive === s
                        ? 'var(--wine-600)'
                        : i < PROGRESS_STEPS.indexOf(progressActive as typeof PROGRESS_STEPS[number])
                        ? 'var(--wine-400)'
                        : 'var(--border-medium)',
                  }}
                />
              ))}
            </div>

            {/* Step content – scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-4">
              <AnimatePresence mode="wait" custom={direction}>

                {/* ── Step 1: Confirm bottle ─────────────────────────────── */}
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
                    <div>
                      <h2
                        className="text-xl font-bold"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                      >
                        {t('openRitual.step1.title', 'Ready to open?')}
                      </h2>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {t('openRitual.step1.subtitle', "Confirm the bottle you're opening tonight.")}
                      </p>
                    </div>

                    <WineMiniCard bottle={bottle} />

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

                {/* ── Step 2: Serving & timer ────────────────────────────── */}
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

                {/* ── Step 3: Celebration + quick-rate teaser ────────────── */}
                {step === 'done' && (
                  <motion.div
                    key="step-done"
                    custom={direction}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={stepTransition}
                    className="space-y-6 text-center"
                  >
                    {/* Celebratory icon */}
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                      className="flex justify-center pt-2"
                    >
                      <div className="text-6xl">🍷</div>
                    </motion.div>

                    <div>
                      <h2
                        className="text-xl font-bold"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                      >
                        {t('openRitual.step3.title', 'Enjoy!')}
                      </h2>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {bottle.wine.wine_name}
                        {bottle.wine.producer ? ` · ${bottle.wine.producer}` : ''}
                      </p>
                    </div>

                    {/* Divider with label */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                        {t('openRitual.step3.howWasIt', 'How was it?')}
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                    </div>

                    {/* Quick-star teaser — tap to jump straight into rating */}
                    <div className="space-y-2">
                      <div className="flex gap-1 justify-center">
                        {[1, 2, 3, 4, 5].map(star => (
                          <motion.button
                            key={star}
                            whileTap={{ scale: 0.8 }}
                            onClick={() => handleQuickStarTap(star)}
                            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                            className="p-1.5"
                            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                          >
                            <motion.span
                              whileHover={{ scale: 1.25 }}
                              className="text-3xl block"
                              style={{ filter: 'grayscale(1) opacity(0.35)' }}
                            >
                              ⭐
                            </motion.span>
                          </motion.button>
                        ))}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {t('openRitual.step3.tapToRate', 'Tap a star to rate now')}
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* ── Step 4: Full inline rating ─────────────────────────── */}
                {step === 'rate' && (
                  <motion.div
                    key="step-rate"
                    custom={direction}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={stepTransition}
                    className="space-y-6"
                  >
                    {/* Header */}
                    <div className="text-center">
                      <h2
                        className="text-xl font-bold"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                      >
                        {t('rateRitual.title', 'How was it?')}
                      </h2>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {bottle.wine.producer} · {bottle.wine.wine_name}
                      </p>
                    </div>

                    {/* Stars */}
                    <InlineStarRating value={rating} onChange={setRating} />

                    {/* Mood chips */}
                    <div className="flex gap-2 justify-center flex-wrap">
                      {MOOD_CHIPS.map(chip => {
                        const active = selectedChips.has(chip.id);
                        return (
                          <motion.button
                            key={chip.id}
                            whileTap={{ scale: 0.93 }}
                            onClick={() => toggleChip(chip.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                            style={{
                              background: active ? 'var(--wine-50, #fdf2f5)' : 'var(--bg-muted)',
                              color: active ? 'var(--wine-700)' : 'var(--text-secondary)',
                              border: active ? '1px solid var(--wine-400)' : '1px solid var(--border-subtle)',
                            }}
                          >
                            <span>{chip.emoji}</span>
                            <span>{t(chip.labelKey)}</span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Notes */}
                    <div>
                      <label
                        className="block text-xs mb-1.5 font-medium"
                        style={{ color: 'var(--text-tertiary)' }}
                        htmlFor="ritual-tasting-notes"
                      >
                        {t('rateRitual.notesLabel', 'Tasting notes (optional)')}
                      </label>
                      <textarea
                        id="ritual-tasting-notes"
                        value={ratingNotes}
                        onChange={e => setRatingNotes(e.target.value)}
                        placeholder={t('rateRitual.notesPlaceholder', 'Describe what you tasted…')}
                        rows={3}
                        maxLength={400}
                        className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none transition-colors"
                        style={{
                          background: 'var(--bg-muted)',
                          border: '1px solid var(--border-medium)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* ── Sticky footer actions ─────────────────────────────────── */}
            <div
              className="flex-shrink-0 px-6 pt-3 pb-4 space-y-2"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              {/* Step 1 footer */}
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

              {/* Step 2 footer */}
              {step === 'serve' && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleStartAndOpen()}
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
                    onClick={() => handleStartAndOpen(true)}
                    disabled={loading}
                    className="w-full py-3 text-sm rounded-xl transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('openRitual.step2.skipTimer', 'Open without timer')}
                  </button>
                </>
              )}

              {/* Step 3 footer — three clear, unambiguous options */}
              {step === 'done' && (
                <>
                  {/* Primary: Rate now */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => goTo('rate')}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm"
                    style={{
                      background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                      color: 'white',
                      border: '1px solid var(--wine-700)',
                    }}
                  >
                    ⭐ {t('openRitual.step3.rateNow', 'Rate now')}
                  </motion.button>

                  {/* Secondary: Remind me later */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRemindLater}
                    className="w-full py-3 rounded-xl font-medium text-sm transition-colors"
                    style={{
                      background: 'var(--wine-50, #fdf2f5)',
                      color: 'var(--wine-700)',
                      border: '1px solid var(--wine-200, #f0c5ce)',
                    }}
                  >
                    ⏰ {t('openRitual.step3.remindLater', 'Remind me later')}
                  </motion.button>

                  {/* Tertiary: Skip */}
                  <button
                    onClick={onClose}
                    className="w-full py-2.5 text-sm rounded-xl transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('openRitual.step3.skip', 'Skip')}
                  </button>
                </>
              )}

              {/* Step 4 footer */}
              {step === 'rate' && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSaveRating}
                    disabled={ratingSaving || rating === 0}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm transition-opacity"
                    style={{
                      background:
                        rating === 0
                          ? 'var(--bg-muted)'
                          : 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                      color: rating === 0 ? 'var(--text-tertiary)' : 'white',
                      border: rating === 0 ? '1px solid var(--border-medium)' : '1px solid var(--wine-700)',
                      opacity: ratingSaving ? 0.7 : 1,
                    }}
                  >
                    {ratingSaving
                      ? t('rateRitual.saving', 'Saving…')
                      : t('rateRitual.save', 'Save rating')}
                  </motion.button>
                  <button
                    onClick={onClose}
                    className="w-full py-2.5 text-sm rounded-xl transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('rateRitual.skipRating', 'Skip for now')}
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
