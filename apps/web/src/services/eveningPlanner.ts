/**
 * "Plan an evening" rules, kept pure so the planner UI stays thin and testable.
 *
 * Business rules (unchanged from the original planner):
 * - 2–4 people → 3 wines, 5–8 → 4, 9+ → 5.
 * - Only in-stock, non-reserved bottles; optional reds-only and Vivino ≥ 4.2 filters.
 * - Score = readiness + rating + food pairing (when a dish is chosen) + taste affinity.
 * - Served from lighter to fuller (profile power), avoiding back-to-back tannic/oaky wines.
 *
 * Generating, reviewing and swapping never touch inventory.
 */

import type { BottleWithWineInfo } from './bottleService';
import type { FoodProfile, WineProfile } from './wineProfileService';
import { calculateFoodPairingScore, getWineProfile } from './wineProfileService';
import { groundedPairingReasons } from './mealPairing';
import { vivinoRatingOrZero } from '../utils/wineRating';

export type Occasion = 'friends' | 'bbq' | 'pizza' | 'date' | 'celebration';
export type GroupSize = '2-4' | '5-8' | '9+';
export type StartTime = 'now' | '1hour' | '2hours';
export type Level = 'low' | 'med' | 'high';

export interface FoodChoices {
  protein: FoodProfile['protein'];
  sauce: FoodProfile['sauce'];
  spice: Level;
  smoke: Level;
}

export interface PlanChoices {
  occasion: Occasion;
  groupSize: GroupSize;
  redsOnly: boolean;
  highRatingOnly: boolean;
  startTime: StartTime;
  food: FoodChoices;
}

export const MIN_VIVINO_RATING = 4.2;

type WineExtras = { rating?: number | null; image_path?: string | null; label_image_path?: string | null };

export function wineExtras(bottle: BottleWithWineInfo): WineExtras {
  return bottle.wine as BottleWithWineInfo['wine'] & WineExtras;
}

/** Vivino / community rating only — never personal user_rating. */
export function vivinoRatingOf(bottle: BottleWithWineInfo): number {
  return vivinoRatingOrZero(wineExtras(bottle));
}

export const NO_FOOD: FoodChoices = { protein: 'none', sauce: 'none', spice: 'low', smoke: 'low' };

export const DEFAULT_CHOICES: PlanChoices = {
  occasion: 'friends',
  groupSize: '2-4',
  redsOnly: false,
  highRatingOnly: true,
  startTime: 'now',
  food: NO_FOOD,
};

export function winesForGroup(size: GroupSize): number {
  return size === '2-4' ? 3 : size === '5-8' ? 4 : 5;
}

/** Choosing "No food" clears the dish details so nothing hidden can affect the lineup. */
export function withProtein(food: FoodChoices, protein: FoodChoices['protein']): FoodChoices {
  return protein === 'none' ? NO_FOOD : { ...food, protein };
}

/** Null when no dish was chosen: the lineup is then picked without food pairing. */
export function buildFoodProfile(food: FoodChoices): FoodProfile | null {
  if (food.protein === 'none') return null;
  const fat: FoodProfile['fat'] =
    food.protein === 'beef' || food.protein === 'lamb' ? 'high'
      : food.protein === 'fish' || food.protein === 'veggie' ? 'low'
        : 'med';
  return { protein: food.protein, fat, sauce: food.sauce, spice: food.spice, smoke: food.smoke };
}

type Readiness = 'READY' | 'PEAK_SOON' | 'HOLD' | null;

export function readinessOf(bottle: BottleWithWineInfo): Readiness {
  const label = (bottle as { readiness_label?: string | null }).readiness_label;
  return label === 'READY' || label === 'PEAK_SOON' || label === 'HOLD' ? label : null;
}

export function isEligible(bottle: BottleWithWineInfo, choices: PlanChoices): boolean {
  if (!(bottle.quantity > 0)) return false;
  if ((bottle as { is_reserved?: boolean }).is_reserved) return false;
  if (choices.redsOnly && bottle.wine.color !== 'red') return false;
  if (choices.highRatingOnly && vivinoRatingOf(bottle) < MIN_VIVINO_RATING) return false;
  return true;
}

export interface LineupSlot {
  bottle: BottleWithWineInfo;
  profile: WineProfile;
  position: number;
}

export interface ScoreOptions {
  /** 0–1 taste affinity times its confidence weight; omitted when there is no taste profile. */
  affinityOf?: (profile: WineProfile, bottle: BottleWithWineInfo) => number;
  profileOf?: (bottle: BottleWithWineInfo) => WineProfile;
}

export function scoreBottle(
  bottle: BottleWithWineInfo,
  profile: WineProfile,
  food: FoodProfile | null,
  affinityOf?: ScoreOptions['affinityOf'],
): number {
  let score = 0;
  const readiness = readinessOf(bottle);
  if (readiness === 'READY') score += 100;
  else if (readiness === 'PEAK_SOON') score += 50;
  if (vivinoRatingOf(bottle) >= MIN_VIVINO_RATING) score += 30;
  if (food) score += calculateFoodPairingScore(profile, food);
  if (affinityOf) score += affinityOf(profile, bottle) * 50;
  return score;
}

const profileFor = (opts: ScoreOptions) => opts.profileOf ?? ((b: BottleWithWineInfo) => getWineProfile(b.wine));

function orderLightToFull<T extends { profile: WineProfile }>(items: T[]): T[] {
  const ordered = [...items].sort((a, b) => a.profile.power - b.profile.power);
  for (let i = 1; i < ordered.length - 1; i++) {
    const prev = ordered[i - 1].profile;
    const curr = ordered[i].profile;
    const next = ordered[i + 1].profile;
    if (prev.tannin >= 4 && prev.oak >= 4 && curr.tannin >= 4 && curr.oak >= 4 && next.tannin < 4) {
      [ordered[i], ordered[i + 1]] = [ordered[i + 1], ordered[i]];
    }
  }
  return ordered;
}

export interface LineupResult {
  slots: LineupSlot[];
  requested: number;
  eligibleCount: number;
}

export function buildLineup(
  bottles: BottleWithWineInfo[],
  choices: PlanChoices,
  opts: ScoreOptions & { random?: () => number } = {},
): LineupResult {
  const requested = winesForGroup(choices.groupSize);
  const food = buildFoodProfile(choices.food);
  const random = opts.random ?? Math.random;
  const getProfile = profileFor(opts);

  const scored = bottles
    .filter((b) => isEligible(b, choices))
    .map((bottle) => {
      const profile = getProfile(bottle);
      // Small jitter keeps repeat plans from always being identical.
      return { bottle, profile, score: scoreBottle(bottle, profile, food, opts.affinityOf) + random() * 10 };
    })
    .sort((a, b) => b.score - a.score);

  const picked: typeof scored = [];
  const wineIds = new Set<string>();
  for (const item of scored) {
    if (picked.length >= requested) break;
    if (wineIds.has(item.bottle.wine.id)) continue;
    wineIds.add(item.bottle.wine.id);
    picked.push(item);
  }

  const slots = orderLightToFull(picked).map(({ bottle, profile }, i) => ({ bottle, profile, position: i + 1 }));
  return { slots, requested, eligibleCount: new Set(scored.map((s) => s.bottle.wine.id)).size };
}

export interface SwapOption {
  bottle: BottleWithWineInfo;
  profile: WineProfile;
  score: number;
}

/** Eligible bottles of wines not already in the lineup, best first. Deterministic. */
export function swapAlternatives(
  bottles: BottleWithWineInfo[],
  choices: PlanChoices,
  lineup: LineupSlot[],
  opts: ScoreOptions & { limit?: number } = {},
): SwapOption[] {
  const food = buildFoodProfile(choices.food);
  const getProfile = profileFor(opts);
  const usedBottles = new Set(lineup.map((s) => s.bottle.id));
  const usedWines = new Set(lineup.map((s) => s.bottle.wine.id));
  const seenWines = new Set<string>();
  const options: SwapOption[] = [];
  for (const bottle of bottles) {
    if (!isEligible(bottle, choices)) continue;
    if (usedBottles.has(bottle.id) || usedWines.has(bottle.wine.id) || seenWines.has(bottle.wine.id)) continue;
    seenWines.add(bottle.wine.id);
    const profile = getProfile(bottle);
    options.push({ bottle, profile, score: scoreBottle(bottle, profile, food, opts.affinityOf) });
  }
  return options.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 8);
}

/** Replaces one slot; the rest of the lineup and every position stay as they were. */
export function applySwap(lineup: LineupSlot[], position: number, bottle: BottleWithWineInfo, profile: WineProfile): LineupSlot[] {
  const duplicate = lineup.some(
    (s) => s.position !== position && (s.bottle.id === bottle.id || s.bottle.wine.id === bottle.wine.id),
  );
  if (duplicate || !lineup.some((s) => s.position === position)) return lineup;
  return lineup.map((s) => (s.position === position ? { bottle, profile, position } : s));
}

export function isLightToFull(lineup: LineupSlot[]): boolean {
  return lineup.every((s, i) => i === 0 || lineup[i - 1].profile.power <= s.profile.power);
}

export function reorderLightToFull(lineup: LineupSlot[]): LineupSlot[] {
  return orderLightToFull(lineup).map((s, i) => ({ ...s, position: i + 1 }));
}

export type ServingStage = 'opener' | 'middle' | 'main' | 'only';

export function servingStage(index: number, total: number): ServingStage {
  if (total <= 1) return 'only';
  if (index === 0) return 'opener';
  if (index === total - 1) return 'main';
  return 'middle';
}

export type StageReason = 'lighterStart' | 'fullestLast' | 'bridge';

/** Why a wine sits where it does, claimed only when the intensity estimates actually differ. */
export function stageReason(lineup: LineupSlot[], index: number): StageReason | null {
  const powers = lineup.map((s) => s.profile.power);
  const last = powers.length - 1;
  if (last < 1) return null;
  if (index === 0) return powers[0] < Math.max(...powers.slice(1)) ? 'lighterStart' : null;
  if (index === last) return powers[last] > Math.max(...powers.slice(0, last)) ? 'fullestLast' : null;
  const p = powers[index];
  return powers[index - 1] <= p && p <= powers[index + 1] && powers[index - 1] < powers[index + 1] ? 'bridge' : null;
}

export type FitReason =
  | { kind: 'pairing'; key: string; tone: 'positive' | 'caution' }
  | { kind: 'taste'; text: string }
  | { kind: 'readiness'; key: 'ready' | 'peakSoon' };

/**
 * Up to two data-backed reasons a wine fits: grounded food-pairing reasons
 * (stored AI/Vivino structure only), a taste-profile reason, then readiness.
 */
export function fitReasons(
  slot: { bottle: BottleWithWineInfo; profile: WineProfile },
  food: FoodProfile | null,
  tasteReason?: string | null,
): FitReason[] {
  const out: FitReason[] = [];
  if (food) {
    for (const r of groundedPairingReasons(slot.profile, { food })) out.push({ kind: 'pairing', key: r.key, tone: r.tone });
  }
  if (tasteReason) out.push({ kind: 'taste', text: tasteReason });
  const readiness = readinessOf(slot.bottle);
  if (readiness === 'READY') out.push({ kind: 'readiness', key: 'ready' });
  else if (readiness === 'PEAK_SOON') out.push({ kind: 'readiness', key: 'peakSoon' });
  return out.slice(0, 2);
}

export interface ServingGuidance {
  temp: { min: number; max: number } | null;
  decant: { min: number; max: number | null } | null;
}

/** Serving temperature and decanting from the stored analysis, when present and well-formed. */
export function servingGuidance(bottle: BottleWithWineInfo): ServingGuidance | null {
  const sg = (bottle as { serving_guidance?: Record<string, unknown> | null }).serving_guidance;
  if (!sg || typeof sg !== 'object') return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const tMin = num(sg.temp_min);
  const tMax = num(sg.temp_max);
  const temp = tMin !== null && tMax !== null && tMin <= tMax ? { min: tMin, max: tMax } : null;
  const dMin = num(sg.decant_min);
  const dMax = num(sg.decant_max);
  const decant = sg.decanting === 'recommended' && dMin !== null && dMin > 0
    ? { min: dMin, max: dMax !== null && dMax > dMin ? dMax : null }
    : null;
  return temp || decant ? { temp, decant } : null;
}

// ─── Planner state ────────────────────────────────────────────────────────

export type PlannerError = 'noEligible' | 'generateFailed' | 'startFailed';

export interface PlannerState {
  step: 'plan' | 'review';
  choices: PlanChoices;
  lineup: LineupSlot[];
  requested: number;
  busy: 'idle' | 'generating' | 'starting';
  error: PlannerError | null;
}

export type PlannerAction =
  | { type: 'choices'; patch: Partial<PlanChoices> }
  | { type: 'protein'; protein: FoodChoices['protein'] }
  | { type: 'food'; patch: Partial<Omit<FoodChoices, 'protein'>> }
  | { type: 'generateStart' }
  | { type: 'generateDone'; result: LineupResult }
  | { type: 'generateFailed' }
  | { type: 'back' }
  | { type: 'swap'; position: number; bottle: BottleWithWineInfo; profile: WineProfile }
  | { type: 'reorder' }
  | { type: 'startBegin' }
  | { type: 'startFailed' }
  | { type: 'startDone' }
  | { type: 'reset' };

export const initialPlannerState: PlannerState = {
  step: 'plan',
  choices: DEFAULT_CHOICES,
  lineup: [],
  requested: 0,
  busy: 'idle',
  error: null,
};

export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case 'choices':
      return { ...state, choices: { ...state.choices, ...action.patch }, error: null };
    case 'protein':
      return { ...state, choices: { ...state.choices, food: withProtein(state.choices.food, action.protein) }, error: null };
    case 'food':
      if (state.choices.food.protein === 'none') return state;
      return { ...state, choices: { ...state.choices, food: { ...state.choices.food, ...action.patch } } };
    case 'generateStart':
      return state.busy !== 'idle' ? state : { ...state, busy: 'generating', error: null };
    case 'generateDone':
      if (action.result.slots.length === 0) return { ...state, busy: 'idle', error: 'noEligible' };
      return { ...state, busy: 'idle', step: 'review', lineup: action.result.slots, requested: action.result.requested };
    case 'generateFailed':
      return { ...state, busy: 'idle', error: 'generateFailed' };
    case 'back':
      return state.busy === 'starting' ? state : { ...state, step: 'plan', error: null };
    case 'swap':
      return { ...state, lineup: applySwap(state.lineup, action.position, action.bottle, action.profile) };
    case 'reorder':
      return { ...state, lineup: reorderLightToFull(state.lineup) };
    case 'startBegin':
      return state.busy !== 'idle' || state.lineup.length === 0 ? state : { ...state, busy: 'starting', error: null };
    case 'startFailed':
      return { ...state, busy: 'idle', error: 'startFailed' };
    case 'startDone':
      return { ...state, busy: 'idle' };
    case 'reset':
      return initialPlannerState;
    default:
      return state;
  }
}

/** Wraps an async action so repeat calls while it runs share one in-flight promise. */
export function singleFlight<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  let inFlight: Promise<R> | null = null;
  return (...args: A) => {
    if (inFlight) return inFlight;
    inFlight = fn(...args).finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
