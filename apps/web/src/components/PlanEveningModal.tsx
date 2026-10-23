/**
 * Plan an evening — guided lineup planner launched from Tonight's Selection.
 *
 * 1. Plan: occasion, group size, preferences, optional food, start time.
 * 2. Review: ordered lineup with grounded reasons; swap any wine.
 * Start evening saves the plan and opens the evening player. Inventory only
 * changes later, when the user wraps up the evening and confirms what was opened.
 *
 * Rules live in services/eveningPlanner.ts; dialogs use the shared ModalLayer.
 */

import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeftRight, Loader2, Pencil, X } from 'lucide-react';
import type { BottleWithWineInfo } from '../services/bottleService';
import { EveningQueuePlayer } from './EveningQueuePlayer';
import * as eveningPlanService from '../services/eveningPlanService';
import type { EveningPlan, QueuedWine } from '../services/eveningPlanService';
import type { WineProfile } from '../services/wineProfileService';
import * as tasteProfileService from '../services/tasteProfileService';
import * as labelArtService from '../services/labelArtService';
import type { TasteProfile } from '../types/supabase';
import { getLocalizedWineData } from '../utils/wineTranslations';
import { ModalLayer } from './ui/ModalLayer';
import { ChoiceChip } from './ui/ChoiceChip';
import { WineImage } from './ui/WineImage';
import {
  MIN_VIVINO_RATING,
  buildFoodProfile,
  buildLineup,
  fitReasons,
  initialPlannerState,
  isLightToFull,
  plannerReducer,
  readinessOf,
  servingGuidance,
  servingStage,
  singleFlight,
  stageReason,
  swapAlternatives,
  winesForGroup,
  type FitReason,
  type FoodChoices,
  type GroupSize,
  type Level,
  type LineupSlot,
  type Occasion,
  type PlanChoices,
  type StartTime,
  type ServingGuidance,
  type SwapOption,
  vivinoRatingOf,
  wineExtras,
} from '../services/eveningPlanner';

interface PlanEveningModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateBottles: BottleWithWineInfo[];
  /** Called once a plan is saved, so the launcher can offer "Resume evening". */
  onPlanStarted?: (plan: EveningPlan) => void;
}

const OCCASIONS: { value: Occasion; icon: string }[] = [
  { value: 'friends', icon: '👥' },
  { value: 'bbq', icon: '🔥' },
  { value: 'pizza', icon: '🍕' },
  { value: 'date', icon: '💝' },
  { value: 'celebration', icon: '🎉' },
];
const GROUP_SIZES: GroupSize[] = ['2-4', '5-8', '9+'];
const PROTEINS: FoodChoices['protein'][] = ['none', 'beef', 'lamb', 'chicken', 'fish', 'veggie'];
const SAUCES: FoodChoices['sauce'][] = ['none', 'tomato', 'bbq', 'creamy'];
const LEVELS: Level[] = ['low', 'med', 'high'];
const START_TIMES: StartTime[] = ['now', '1hour', '2hours'];
const TASTE_TIMEOUT_MS = 2500;

function displayImage(bottle: BottleWithWineInfo) {
  const b = bottle as BottleWithWineInfo & { label_image_path?: string | null; image_path?: string | null; image_url?: string | null };
  const w = wineExtras(bottle);
  return labelArtService.getWineDisplayImage({
    ...bottle.wine,
    image_path: w.image_path || b.label_image_path || b.image_path || null,
    label_image_path: w.label_image_path || b.label_image_path || null,
    image_url: bottle.wine.image_url || b.image_url || null,
  } as Parameters<typeof labelArtService.getWineDisplayImage>[0]);
}

function toQueuedGuidance(g: ServingGuidance | null): QueuedWine['serving_guidance'] {
  if (!g || (!g.temp && !g.decant)) return null;
  return {
    ...(g.temp ? { temp_min: g.temp.min, temp_max: g.temp.max } : {}),
    ...(g.decant
      ? { decanting: 'recommended' as const, decant_min: g.decant.min, ...(g.decant.max ? { decant_max: g.decant.max } : {}) }
      : { decanting: 'none' as const }),
  };
}

export function PlanEveningModal({ isOpen, onClose, candidateBottles, onPlanStarted }: PlanEveningModalProps) {
  const { t, i18n } = useTranslation();
  const [state, dispatch] = useReducer(plannerReducer, initialPlannerState);
  const { step, choices, lineup, requested, busy, error } = state;
  const choicesRef = useRef(choices);
  choicesRef.current = choices;

  const [taste, setTaste] = useState<TasteProfile | null>(null);
  const tasteRequest = useRef<Promise<TasteProfile | null> | null>(null);
  const loadTaste = useCallback(() => {
    if (!tasteRequest.current) {
      tasteRequest.current = tasteProfileService
        .getMyTasteProfile()
        .then((p) => {
          setTaste(p ?? null);
          return p ?? null;
        })
        .catch(() => null);
    }
    return tasteRequest.current;
  }, []);

  const [activePlan, setActivePlan] = useState<EveningPlan | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [swapPosition, setSwapPosition] = useState<number | null>(null);
  const [swapOptions, setSwapOptions] = useState<SwapOption[] | null>(null);
  const [swapFailed, setSwapFailed] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const ids = { title: useId(), subtitle: useId(), stepHeading: useId(), swapTitle: useId(), swapDesc: useId() };
  const bodyRef = useRef<HTMLDivElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);

  useEffect(() => {
    if (isOpen) loadTaste();
    else {
      dispatch({ type: 'reset' });
      setShowPlayer(false);
      setActivePlan(null);
      setSwapPosition(null);
      setAnnouncement('');
    }
  }, [isOpen, loadTaste]);

  // New step: start at the top and move focus to its heading (no focus jumps while editing).
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    bodyRef.current?.scrollTo({ top: 0 });
    requestAnimationFrame(() => stepHeadingRef.current?.focus({ preventScroll: true }));
  }, [step]);

  const affinityOf = useMemo(() => {
    if (!taste) return undefined;
    const weight = tasteProfileService.getAffinityWeight(taste.confidence);
    return (profile: WineProfile) => tasteProfileService.calculateAffinity(profile, taste) * weight;
  }, [taste]);

  const generate = useMemo(
    () =>
      singleFlight(async () => {
        dispatch({ type: 'generateStart' });
        try {
          const profile = await Promise.race([
            loadTaste(),
            new Promise<null>((r) => setTimeout(() => r(null), TASTE_TIMEOUT_MS)),
          ]);
          const weight = profile ? tasteProfileService.getAffinityWeight(profile.confidence) : 0;
          const result = buildLineup(candidateBottles, choicesRef.current, {
            affinityOf: profile ? (p) => tasteProfileService.calculateAffinity(p, profile) * weight : undefined,
          });
          dispatch({ type: 'generateDone', result });
        } catch (err) {
          console.error('[PlanEvening] Lineup generation failed:', err);
          dispatch({ type: 'generateFailed' });
        }
      }),
    [candidateBottles, loadTaste],
  );

  const start = useMemo(
    () =>
      singleFlight(async (slots: LineupSlot[], c: PlanChoices) => {
        dispatch({ type: 'startBegin' });
        try {
          const plan = await eveningPlanService.createPlan({
            occasion: c.occasion,
            group_size: c.groupSize,
            settings: {
              occasion: c.occasion,
              groupSize: c.groupSize,
              startTime: c.startTime,
              redsOnly: c.redsOnly,
              minVivinoRating: c.highRatingOnly ? MIN_VIVINO_RATING : null,
              food: buildFoodProfile(c.food),
            },
            queue: eveningPlanService
              .lineupToQueue(
                slots.map((s, i) => ({ bottle: s.bottle, position: s.position, label: servingStage(i, slots.length) })),
              )
              .map((item, i) => ({ ...item, serving_guidance: toQueuedGuidance(servingGuidance(slots[i].bottle)) })),
          });
          dispatch({ type: 'startDone' });
          setActivePlan(plan);
          setShowPlayer(true);
          onPlanStarted?.(plan);
        } catch (err) {
          console.error('[PlanEvening] Failed to start evening:', err);
          dispatch({ type: 'startFailed' });
        }
      }),
    [onPlanStarted],
  );

  const handleClose = useCallback(() => {
    if (busy === 'starting') return;
    onClose();
  }, [busy, onClose]);

  const openSwap = (position: number) => {
    setSwapFailed(false);
    try {
      setSwapOptions(swapAlternatives(candidateBottles, choices, lineup, { affinityOf }));
    } catch (err) {
      console.error('[PlanEvening] Could not list alternatives:', err);
      setSwapOptions(null);
      setSwapFailed(true);
    }
    setSwapPosition(position);
  };

  const closeSwap = useCallback(() => setSwapPosition(null), []);

  const chooseAlternative = (option: SwapOption) => {
    if (swapPosition === null) return;
    dispatch({ type: 'swap', position: swapPosition, bottle: option.bottle, profile: option.profile });
    setAnnouncement(
      t('planEvening.swap.announced', {
        position: swapPosition,
        name: getLocalizedWineData(option.bottle.wine, i18n.language).wine_name,
      }),
    );
    setSwapPosition(null);
  };

  const tasteReasonOf = useCallback(
    (slot: { bottle: BottleWithWineInfo; profile: WineProfile }) =>
      taste
        ? tasteProfileService.generateAffinityReason(slot.profile, taste, slot.bottle.wine, { requireTrustedStructure: true })
        : null,
    [taste],
  );

  if (showPlayer && activePlan) {
    return (
      <EveningQueuePlayer
        isOpen
        onClose={() => {
          setShowPlayer(false);
          onClose();
        }}
        plan={activePlan}
        onPlanUpdated={setActivePlan}
        onComplete={() => {
          setShowPlayer(false);
          onClose();
        }}
      />
    );
  }

  const swapSlot = swapPosition !== null ? lineup.find((s) => s.position === swapPosition) ?? null : null;
  const food = buildFoodProfile(choices.food);
  const errorText =
    error === 'noEligible'
      ? t('planEvening.errors.noEligible')
      : error === 'generateFailed'
        ? t('planEvening.errors.generateFailed')
        : error === 'startFailed'
          ? t('planEvening.errors.startFailed')
          : null;

  return (
    <>
      <ModalLayer
        open={isOpen}
        onClose={handleClose}
        labelledBy={ids.title}
        describedBy={ids.subtitle}
        testId="plan-evening-dialog"
      >
        <header className="modal-header">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={ids.title} className="app-dialog-title">
                {t('planEvening.title')}
              </h2>
              <p id={ids.subtitle} className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {step === 'plan' ? t('planEvening.input.title') : t('planEvening.lineup.title')}
              </p>
            </div>
            <button type="button" className="app-icon-btn flex-shrink-0" onClick={handleClose} aria-label={t('common.close')}>
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <ol className="app-steps mt-3" aria-label={t('planEvening.steps.label')}>
            <li aria-current={step === 'plan' ? 'step' : undefined} className={step === 'review' ? 'is-done' : ''}>
              {t('planEvening.steps.plan')}
            </li>
            <li aria-current={step === 'review' ? 'step' : undefined}>{t('planEvening.steps.review')}</li>
          </ol>
          <p className="sr-only" role="status" aria-live="polite">
            {busy === 'generating' ? t('planEvening.input.generating') : busy === 'starting' ? t('planEvening.lineup.starting') : announcement}
          </p>
        </header>

        <div ref={bodyRef} className="modal-body" aria-busy={busy !== 'idle'}>
          {step === 'plan' ? (
            <PlanForm
              headingId={ids.stepHeading}
              headingRef={stepHeadingRef}
              choices={choices}
              disabled={busy !== 'idle'}
              onChoices={(patch) => dispatch({ type: 'choices', patch })}
              onProtein={(protein) => dispatch({ type: 'protein', protein })}
              onFood={(patch) => dispatch({ type: 'food', patch })}
            />
          ) : (
            <ReviewStep
              headingId={ids.stepHeading}
              headingRef={stepHeadingRef}
              choices={choices}
              lineup={lineup}
              requested={requested}
              food={food}
              tasteReasonOf={tasteReasonOf}
              disabled={busy !== 'idle'}
              onEdit={() => dispatch({ type: 'back' })}
              onSwap={openSwap}
              onReorder={() => {
                dispatch({ type: 'reorder' });
                setAnnouncement(t('planEvening.review.reordered'));
              }}
            />
          )}
        </div>

        <footer className="modal-footer">
          {errorText && (
            <p role="alert" className="mb-2.5 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--status-error-bg, var(--wine-50))', color: 'var(--status-error-text, var(--accent-text))' }}>
              {errorText}
            </p>
          )}
          {step === 'plan' ? (
            <button
              type="button"
              className="btn-luxury-primary w-full"
              onClick={() => void generate()}
              disabled={busy !== 'idle'}
              aria-busy={busy === 'generating'}
            >
              {busy === 'generating' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  {t('planEvening.input.generating')}
                </>
              ) : (
                t('planEvening.input.generate')
              )}
            </button>
          ) : (
            <>
              <p className="mb-2.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {t('planEvening.lineup.startNote')}
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  className="btn-luxury-secondary flex-1"
                  onClick={() => dispatch({ type: 'back' })}
                  disabled={busy === 'starting'}
                >
                  {t('planEvening.lineup.back')}
                </button>
                <button
                  type="button"
                  className="btn-luxury-primary flex-[1.4]"
                  onClick={() => void start(lineup, choices)}
                  disabled={busy !== 'idle'}
                  aria-busy={busy === 'starting'}
                >
                  {busy === 'starting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                      {t('planEvening.lineup.starting')}
                    </>
                  ) : (
                    t('planEvening.lineup.startEvening')
                  )}
                </button>
              </div>
            </>
          )}
        </footer>
      </ModalLayer>

      <ModalLayer
        open={isOpen && swapSlot !== null}
        onClose={closeSwap}
        labelledBy={ids.swapTitle}
        describedBy={ids.swapDesc}
        level="nested"
        size="md"
        testId="plan-evening-swap"
      >
        {swapSlot && (
          <SwapView
            titleId={ids.swapTitle}
            descId={ids.swapDesc}
            slot={swapSlot}
            total={lineup.length}
            options={swapOptions}
            failed={swapFailed}
            food={food}
            choices={choices}
            tasteReasonOf={tasteReasonOf}
            onChoose={chooseAlternative}
            onRetry={() => openSwap(swapSlot.position)}
            onClose={closeSwap}
          />
        )}
      </ModalLayer>
    </>
  );
}

// ─── Step 1: plan ─────────────────────────────────────────────────────────

function Section({ legend, hint, hintId, children }: { legend: string; hint?: string; hintId?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>
        {legend}
      </legend>
      {hint && (
        <p id={hintId} className="text-xs mb-2.5" style={{ color: 'var(--text-secondary)' }}>
          {hint}
        </p>
      )}
      <div className={hint ? '' : 'mt-2'}>{children}</div>
    </fieldset>
  );
}

function PlanForm({
  headingId,
  headingRef,
  choices,
  disabled,
  onChoices,
  onProtein,
  onFood,
}: {
  headingId: string;
  headingRef: RefObject<HTMLHeadingElement>;
  choices: PlanChoices;
  disabled: boolean;
  onChoices: (patch: Partial<PlanChoices>) => void;
  onProtein: (protein: FoodChoices['protein']) => void;
  onFood: (patch: Partial<Omit<FoodChoices, 'protein'>>) => void;
}) {
  const { t } = useTranslation();
  const name = useId();
  const foodHintId = useId();
  const hasFood = choices.food.protein !== 'none';

  return (
    <div className="space-y-6">
      <h3 id={headingId} ref={headingRef} tabIndex={-1} className="sr-only">
        {t('planEvening.steps.plan')}
      </h3>

      <Section legend={t('planEvening.input.occasion')}>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map(({ value, icon }) => (
            <ChoiceChip
              key={value}
              type="radio"
              name={`${name}-occasion`}
              checked={choices.occasion === value}
              onChange={() => onChoices({ occasion: value })}
              icon={icon}
              label={t(`planEvening.input.occasions.${value}`)}
              disabled={disabled}
            />
          ))}
        </div>
      </Section>

      <Section legend={t('planEvening.input.groupSize')}>
        <div className="grid grid-cols-3 gap-2">
          {GROUP_SIZES.map((size) => (
            <ChoiceChip
              key={size}
              type="radio"
              name={`${name}-group`}
              checked={choices.groupSize === size}
              onChange={() => onChoices({ groupSize: size })}
              label={t(`planEvening.input.groupSizes.${size}`)}
              hint={t('planEvening.input.winesCount', { count: winesForGroup(size) })}
              disabled={disabled}
            />
          ))}
        </div>
      </Section>

      <Section legend={t('planEvening.input.preferences')}>
        <div className="space-y-2">
          <ChoiceChip
            type="checkbox"
            row
            checked={choices.redsOnly}
            onChange={(redsOnly) => onChoices({ redsOnly })}
            label={t('planEvening.input.redsOnly')}
            disabled={disabled}
          />
          <ChoiceChip
            type="checkbox"
            row
            checked={choices.highRatingOnly}
            onChange={(highRatingOnly) => onChoices({ highRatingOnly })}
            label={t('planEvening.input.vivinoOnly', { rating: MIN_VIVINO_RATING })}
            hint={t('planEvening.input.vivinoHint', { rating: MIN_VIVINO_RATING })}
            disabled={disabled}
          />
        </div>
      </Section>

      <Section
        legend={t('planEvening.input.foodLegend')}
        hint={hasFood ? t('planEvening.input.foodHintOn') : t('planEvening.input.foodHintOff')}
        hintId={foodHintId}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('planEvening.input.protein')} aria-describedby={foodHintId}>
            {PROTEINS.map((protein) => (
              <ChoiceChip
                key={protein}
                type="radio"
                name={`${name}-protein`}
                checked={choices.food.protein === protein}
                onChange={() => onProtein(protein)}
                label={t(`planEvening.input.proteins.${protein}`)}
                disabled={disabled}
              />
            ))}
          </div>

          {hasFood && (
            <div className="space-y-4 rounded-2xl p-3 sm:p-4" style={{ background: 'var(--bg-muted)' }}>
              <Section legend={t('planEvening.input.sauce')}>
                <div className="flex flex-wrap gap-2">
                  {SAUCES.map((sauce) => (
                    <ChoiceChip
                      key={sauce}
                      type="radio"
                      name={`${name}-sauce`}
                      checked={choices.food.sauce === sauce}
                      onChange={() => onFood({ sauce })}
                      label={t(`planEvening.input.sauces.${sauce}`)}
                      disabled={disabled}
                    />
                  ))}
                </div>
              </Section>
              <div className="grid gap-4 sm:grid-cols-2">
                <Section legend={t('planEvening.input.spice')}>
                  <div className="grid grid-cols-3 gap-2">
                    {LEVELS.map((level) => (
                      <ChoiceChip
                        key={level}
                        type="radio"
                        name={`${name}-spice`}
                        checked={choices.food.spice === level}
                        onChange={() => onFood({ spice: level })}
                        label={t(`planEvening.input.spiceLevels.${level}`)}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                </Section>
                <Section legend={t('planEvening.input.smoke')}>
                  <div className="grid grid-cols-3 gap-2">
                    {LEVELS.map((level) => (
                      <ChoiceChip
                        key={level}
                        type="radio"
                        name={`${name}-smoke`}
                        checked={choices.food.smoke === level}
                        onChange={() => onFood({ smoke: level })}
                        label={t(`planEvening.input.smokeLevels.${level}`)}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                </Section>
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section legend={t('planEvening.input.startTime')}>
        <div className="grid grid-cols-3 gap-2">
          {START_TIMES.map((time) => (
            <ChoiceChip
              key={time}
              type="radio"
              name={`${name}-start`}
              checked={choices.startTime === time}
              onChange={() => onChoices({ startTime: time })}
              label={t(`planEvening.input.startTimes.${time}`)}
              disabled={disabled}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── Step 2: review ───────────────────────────────────────────────────────

function useChoiceSummary(choices: PlanChoices): string[] {
  const { t } = useTranslation();
  const parts = [
    t(`planEvening.input.occasions.${choices.occasion}`),
    t(`planEvening.input.groupSizes.${choices.groupSize}`),
  ];
  if (choices.redsOnly) parts.push(t('planEvening.input.redsOnly'));
  if (choices.highRatingOnly) parts.push(t('planEvening.input.vivinoOnly', { rating: MIN_VIVINO_RATING }));
  if (choices.food.protein === 'none') parts.push(t('planEvening.input.proteins.none'));
  else {
    const dish = [t(`planEvening.input.proteins.${choices.food.protein}`)];
    if (choices.food.sauce !== 'none') dish.push(t(`planEvening.input.sauces.${choices.food.sauce}`));
    dish.push(t(`planEvening.review.spiceSummary.${choices.food.spice}`));
    dish.push(t(`planEvening.review.smokeSummary.${choices.food.smoke}`));
    parts.push(dish.join(', '));
  }
  parts.push(t(`planEvening.review.startSummary.${choices.startTime}`));
  return parts;
}

interface Reason {
  text: string;
  caution?: boolean;
}

function ReasonList({ reasons }: { reasons: Reason[] }) {
  const { t } = useTranslation();
  if (reasons.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
      {reasons.map((r) => (
        <li key={r.text} className="flex gap-1.5">
          {r.caution ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden style={{ color: 'var(--status-hold-text)' }} />
          ) : (
            <span aria-hidden style={{ color: 'var(--accent-text)' }}>•</span>
          )}
          <span dir="auto">
            {r.caution && <span className="sr-only">{t('planEvening.review.cautionLabel')} </span>}
            {r.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function useFitText() {
  const { t } = useTranslation();
  return (r: FitReason): Reason =>
    r.kind === 'pairing'
      ? { text: t(`recommendation.grounded.pairing.${r.key}`), caution: r.tone === 'caution' }
      : r.kind === 'taste'
        ? { text: r.text }
        : { text: t(`planEvening.review.readiness.${r.key}`) };
}

function MetaChips({ bottle, showGuidance }: { bottle: BottleWithWineInfo; showGuidance: boolean }) {
  const { t } = useTranslation();
  const readiness = readinessOf(bottle);
  const guidance = showGuidance ? servingGuidance(bottle) : null;
  const rating = vivinoRatingOf(bottle);
  const chip = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs';
  const muted = { background: 'var(--bg-muted)', color: 'var(--text-secondary)' };
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {readiness && (
        <span className={chip} style={readiness === 'HOLD' ? { background: 'var(--status-hold-bg)', color: 'var(--status-hold-text)' } : { background: 'var(--status-ready-bg)', color: 'var(--status-ready-text)' }}>
          {t(`planEvening.review.readinessBadge.${readiness}`)}
        </span>
      )}
      {rating > 0 && (
        <span className={chip} style={muted}>
          <span aria-hidden>★</span>
          {t('planEvening.review.vivinoRating', { rating: rating.toFixed(1) })}
        </span>
      )}
      {guidance?.temp && (
        <span className={chip} style={muted}>
          {t('planEvening.review.serveAt')} <bdi dir="ltr">{guidance.temp.min}–{guidance.temp.max}°C</bdi>
        </span>
      )}
      {guidance?.decant && (
        <span className={chip} style={muted}>
          {guidance.decant.max
            ? t('planEvening.review.decantRange', { min: guidance.decant.min, max: guidance.decant.max })
            : t('planEvening.review.decantMin', { min: guidance.decant.min })}
        </span>
      )}
    </div>
  );
}

function ReviewStep({
  headingId,
  headingRef,
  choices,
  lineup,
  requested,
  food,
  tasteReasonOf,
  disabled,
  onEdit,
  onSwap,
  onReorder,
}: {
  headingId: string;
  headingRef: RefObject<HTMLHeadingElement>;
  choices: PlanChoices;
  lineup: LineupSlot[];
  requested: number;
  food: ReturnType<typeof buildFoodProfile>;
  tasteReasonOf: (slot: LineupSlot) => string | null;
  disabled: boolean;
  onEdit: () => void;
  onSwap: (position: number) => void;
  onReorder: () => void;
}) {
  const { t, i18n } = useTranslation();
  const summary = useChoiceSummary(choices);
  const fitText = useFitText();
  const ordered = isLightToFull(lineup);

  // A taste reason that fits several wines is shown once, on the first of them.
  const seenTaste = new Set<string>();
  const reasonsBySlot = lineup.map((slot, index) => {
    const stage = stageReason(lineup, index);
    let taste = tasteReasonOf(slot);
    if (taste && seenTaste.has(taste)) taste = null;
    if (taste) seenTaste.add(taste);
    const fits = fitReasons(slot, food, taste).map(fitText);
    return [...(stage && ordered ? [{ text: t(`planEvening.review.stageReason.${stage}`) }] : []), ...fits];
  });

  return (
    <div className="space-y-4">
      <section aria-labelledby={`${headingId}-summary`} className="rounded-2xl p-3.5" style={{ background: 'var(--bg-muted)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={`${headingId}-summary`} className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
              {t('planEvening.review.yourChoices')}
            </h3>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {summary.join(' · ')}
            </p>
          </div>
          <button type="button" className="app-link inline-flex items-center gap-1 text-sm font-medium min-h-[44px] flex-shrink-0" onClick={onEdit} disabled={disabled}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {t('planEvening.review.editChoices')}
          </button>
        </div>
      </section>

      <div>
        <h3 id={headingId} ref={headingRef} tabIndex={-1} className="text-base font-semibold focus:outline-none" style={{ color: 'var(--text-heading)' }}>
          {t('planEvening.review.heading', { count: lineup.length })}
        </h3>
        {lineup.length < requested && (
          <p className="mt-1.5 text-sm" style={{ color: 'var(--status-hold-text)' }}>
            {t('planEvening.review.fewerThanRequested', { count: lineup.length, requested })}
          </p>
        )}
        {ordered ? (
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {lineup.length > 1 ? t('planEvening.review.orderExplained') : t('planEvening.review.singleWine')}
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--status-hold-bg)', color: 'var(--status-hold-text)' }}>
            <span className="flex-1 min-w-[12rem]">{t('planEvening.review.orderBroken')}</span>
            <button type="button" className="app-link font-semibold min-h-[44px]" onClick={onReorder} disabled={disabled}>
              {t('planEvening.review.reorder')}
            </button>
          </div>
        )}
      </div>

      <ol className="space-y-3">
        {lineup.map((slot, index) => {
          const lw = getLocalizedWineData(slot.bottle.wine, i18n.language);
          const img = displayImage(slot.bottle);
          const stage = servingStage(index, lineup.length);
          return (
            <li key={slot.position} className="rounded-2xl p-3.5" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex gap-3">
                <WineImage src={img.imageUrl} isGenerated={img.isGenerated} alt={lw.wine_name} className="w-14 h-[4.5rem] flex-shrink-0" iconSize={22} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold" style={{ color: 'var(--accent-text)' }}>
                    {t('planEvening.review.stage', { position: slot.position, stage: t(`planEvening.review.stages.${stage}`) })}
                  </p>
                  <h4 className="mt-0.5 font-semibold leading-snug line-clamp-2 break-words" style={{ color: 'var(--text-heading)' }}>
                    <bdi>{lw.wine_name}</bdi>
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <bdi>{lw.producer}</bdi>
                    {slot.bottle.wine.vintage ? <> · <bdi>{slot.bottle.wine.vintage}</bdi></> : null}
                  </p>
                </div>
                <button
                  type="button"
                  className="self-start inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full text-sm font-medium flex-shrink-0"
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}
                  onClick={() => onSwap(slot.position)}
                  disabled={disabled}
                  aria-label={t('planEvening.review.swapAria', { name: lw.wine_name })}
                >
                  <ArrowLeftRight className="h-4 w-4" aria-hidden />
                  {t('planEvening.lineup.swapWine')}
                </button>
              </div>
              <ReasonList reasons={reasonsBySlot[index]} />
              <MetaChips bottle={slot.bottle} showGuidance />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Swap (nested dialog) ─────────────────────────────────────────────────

function SwapView({
  titleId,
  descId,
  slot,
  total,
  options,
  failed,
  food,
  choices,
  tasteReasonOf,
  onChoose,
  onRetry,
  onClose,
}: {
  titleId: string;
  descId: string;
  slot: LineupSlot;
  total: number;
  options: SwapOption[] | null;
  failed: boolean;
  food: ReturnType<typeof buildFoodProfile>;
  choices: PlanChoices;
  tasteReasonOf: (slot: { bottle: BottleWithWineInfo; profile: WineProfile }) => string | null;
  onChoose: (option: SwapOption) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const fitText = useFitText();
  const stage = t(`planEvening.review.stages.${servingStage(slot.position - 1, total)}`);
  const filtersOn = choices.redsOnly || choices.highRatingOnly;

  const card = (bottle: BottleWithWineInfo) => {
    const lw = getLocalizedWineData(bottle.wine, i18n.language);
    const img = displayImage(bottle);
    return (
      <div className="flex gap-3">
        <WineImage src={img.imageUrl} isGenerated={img.isGenerated} alt={lw.wine_name} className="w-12 h-16 flex-shrink-0" iconSize={20} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug break-words" style={{ color: 'var(--text-heading)' }}>
            <bdi>{lw.wine_name}</bdi>
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <bdi>{lw.producer}</bdi>
            {bottle.wine.vintage ? <> · <bdi>{bottle.wine.vintage}</bdi></> : null}
            {' · '}
            {t('planEvening.swap.inStock', { count: bottle.quantity })}
          </p>
        </div>
      </div>
    );
  };

  return (
    <>
      <header className="modal-header">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="app-section-title !text-xl">
              {t('planEvening.swap.titleFor', { position: slot.position, stage })}
            </h2>
            <p id={descId} className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {t('planEvening.swap.subtitle')}
            </p>
          </div>
          <button type="button" className="app-icon-btn flex-shrink-0" onClick={onClose} aria-label={t('common.close')}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <div className="modal-body space-y-4">
        <section aria-label={t('planEvening.swap.current')}>
          <div className="rounded-2xl p-3" style={{ background: 'var(--bg-muted)', border: '1px dashed var(--border-medium)' }} aria-current="true">
            <span className="mb-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
              {t('planEvening.swap.current')}
            </span>
            {card(slot.bottle)}
          </div>
        </section>

        <section aria-labelledby={`${titleId}-alts`}>
          <h3 id={`${titleId}-alts`} className="text-sm font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
            {t('planEvening.swap.alternatives')}
          </h3>

          {failed ? (
            <div role="alert" className="rounded-2xl p-4 text-sm" style={{ background: 'var(--bg-muted)', color: 'var(--text-primary)' }}>
              <p>{t('planEvening.swap.error')}</p>
              <button type="button" className="app-link mt-2 font-semibold min-h-[44px]" onClick={onRetry}>
                {t('common.retry')}
              </button>
            </div>
          ) : !options || options.length === 0 ? (
            <div className="rounded-2xl p-4 text-sm" style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{t('planEvening.swap.emptyTitle')}</p>
              <p className="mt-1">{filtersOn ? t('planEvening.swap.emptyFilters') : t('planEvening.swap.emptyNoFilters')}</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {options.map((option) => {
                const lw = getLocalizedWineData(option.bottle.wine, i18n.language);
                const reasons = fitReasons(option, food, tasteReasonOf(option)).map(fitText);
                return (
                  <li key={option.bottle.id} className="rounded-2xl p-3" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                    {card(option.bottle)}
                    <ReasonList reasons={reasons} />
                    <MetaChips bottle={option.bottle} showGuidance={false} />
                    <button
                      type="button"
                      className="btn-luxury-secondary w-full mt-3 !min-h-[44px]"
                      onClick={() => onChoose(option)}
                      aria-label={t('planEvening.swap.chooseAria', { name: lw.wine_name, position: slot.position })}
                    >
                      {t('planEvening.swap.choose')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <footer className="modal-footer">
        <button type="button" className="btn-luxury-secondary w-full" onClick={onClose}>
          {t('planEvening.swap.keepCurrent')}
        </button>
      </footer>
    </>
  );
}
