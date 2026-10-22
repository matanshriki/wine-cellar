/**
 * Meal detail → food profile, and grounded pairing reasons.
 *
 * Pure (no i18n, no Supabase). Reasons are returned as i18n keys under
 * `recommendation.grounded.*` and only cite wine characteristics that come from
 * real data (a stored AI/Vivino profile or a label sweetness term), never from
 * the color/region heuristic.
 */

import type { FoodProfile, WineProfile } from './wineProfileService';
import { hasKnownResidualSugar } from './wineProfileService';

/** Optional follow-up choices for broad meals. Omitting the detail keeps the old behavior. */
export const MEAL_DETAILS: Record<string, readonly string[]> = {
  pasta: ['tomato', 'creamy', 'pesto', 'meat_ragu', 'seafood'],
  pizza: ['margherita', 'meat', 'white'],
  steak: ['grilled', 'peppercorn', 'lean'],
  fish: ['white_fish', 'salmon', 'shellfish', 'raw'],
  cheese: ['fresh', 'aged', 'blue'],
  spicy_asian: ['mild', 'fiery'],
};

export function mealDetailOptions(meal: string | undefined | null): readonly string[] {
  return (meal && MEAL_DETAILS[meal]) || [];
}

const BASE: FoodProfile = { protein: 'none', fat: 'med', sauce: 'none', spice: 'low', smoke: 'low' };

export interface MealContext {
  food: FoodProfile;
  /** Blue cheese and similar salty/strong foods where residual sugar helps. */
  saltyStrong?: boolean;
}

/** Null when there is no valid detail: callers then skip detail-based scoring entirely. */
export function mealContextFor(meal: string | undefined | null, detail: string | undefined | null): MealContext | null {
  if (!meal || !detail || !mealDetailOptions(meal).includes(detail)) return null;
  const f = (p: Partial<FoodProfile>, extra?: Omit<MealContext, 'food'>): MealContext => ({ food: { ...BASE, ...p }, ...extra });

  switch (`${meal}:${detail}`) {
    case 'pasta:tomato': return f({ sauce: 'tomato' });
    case 'pasta:creamy': return f({ sauce: 'creamy', fat: 'high' });
    case 'pasta:pesto': return f({ protein: 'veggie' });
    case 'pasta:meat_ragu': return f({ protein: 'beef', sauce: 'tomato', fat: 'high' });
    case 'pasta:seafood': return f({ protein: 'fish', fat: 'low' });
    case 'pizza:margherita': return f({ sauce: 'tomato' });
    case 'pizza:meat': return f({ protein: 'beef', sauce: 'tomato', fat: 'high', spice: 'med' });
    case 'pizza:white': return f({ sauce: 'creamy', fat: 'high' });
    case 'steak:grilled': return f({ protein: 'beef', fat: 'high', smoke: 'high' });
    case 'steak:peppercorn': return f({ protein: 'beef', fat: 'high', sauce: 'creamy', spice: 'med' });
    case 'steak:lean': return f({ protein: 'beef', fat: 'med' });
    case 'fish:white_fish': return f({ protein: 'fish', fat: 'low' });
    case 'fish:salmon': return f({ protein: 'fish', fat: 'med' });
    case 'fish:shellfish': return f({ protein: 'fish', fat: 'low' });
    case 'fish:raw': return f({ protein: 'fish', fat: 'low' });
    case 'cheese:fresh': return f({ fat: 'med' });
    case 'cheese:aged': return f({ fat: 'high' });
    case 'cheese:blue': return f({ fat: 'high' }, { saltyStrong: true });
    case 'spicy_asian:mild': return f({ protein: 'chicken', spice: 'med' });
    case 'spicy_asian:fiery': return f({ protein: 'chicken', spice: 'high' });
    default: return null;
  }
}

/** Structure values are evidence only when they come from a stored AI/Vivino profile. */
export function hasTrustedStructure(profile: WineProfile): boolean {
  return profile.source === 'ai' || profile.source === 'vivino';
}

export interface PairingReason {
  key: string;
  /** Positive reasons support the pick; cautions explain a trade-off. */
  tone: 'positive' | 'caution';
}

/**
 * Up to two reasons, strongest first, connecting the wine's measured
 * characteristics to the dish. Empty when the data cannot support a claim.
 */
export function groundedPairingReasons(profile: WineProfile, ctx: MealContext): PairingReason[] {
  const out: PairingReason[] = [];
  const sweet = hasKnownResidualSugar(profile);
  const { food } = ctx;

  if (food.spice === 'high' && sweet) out.push({ key: 'spiceSweet', tone: 'positive' });
  if (ctx.saltyStrong && sweet) out.push({ key: 'blueCheeseSweet', tone: 'positive' });

  if (hasTrustedStructure(profile)) {
    const { body, tannin, acidity, oak } = profile;
    if (food.sauce === 'tomato') {
      if (acidity >= 4) out.push({ key: 'tomatoAcidity', tone: 'positive' });
      else if (acidity < 3) out.push({ key: 'tomatoLowAcidity', tone: 'caution' });
    }
    if ((food.protein === 'beef' || food.protein === 'lamb') && food.fat === 'high') {
      if (tannin >= 4 && body >= 4) out.push({ key: 'meatTanninBody', tone: 'positive' });
      else if (body < 3) out.push({ key: 'meatTooLight', tone: 'caution' });
    }
    if (food.protein === 'fish') {
      if (tannin > 2) out.push({ key: 'fishTannin', tone: 'caution' });
      else if (acidity >= 4 || body <= 2) out.push({ key: 'fishFresh', tone: 'positive' });
    }
    if (food.sauce === 'creamy' && body >= 3 && acidity >= 3) out.push({ key: 'creamyBodyAcid', tone: 'positive' });
    if (food.protein === 'veggie' && acidity >= 4) out.push({ key: 'herbFresh', tone: 'positive' });
    if (food.smoke === 'high' && oak >= 3) out.push({ key: 'smokeOak', tone: 'positive' });
    if (food.spice === 'high' && !sweet) {
      if (tannin <= 2) out.push({ key: 'spiceSoftTannin', tone: 'positive' });
      else if (tannin >= 4) out.push({ key: 'spiceTannin', tone: 'caution' });
    }
    if (food.fat === 'high' && food.protein === 'none' && acidity >= 4) out.push({ key: 'richAcid', tone: 'positive' });
  }

  // Positives first, then one caution at most.
  const positives = out.filter((r) => r.tone === 'positive');
  const caution = out.find((r) => r.tone === 'caution');
  return [...positives.slice(0, caution ? 1 : 2), ...(caution ? [caution] : [])];
}

export type DifferenceKey =
  | 'lighter'
  | 'fuller'
  | 'otherColor'
  | 'readyNow'
  | 'needsTime'
  | 'sweeter'
  | 'drier'
  | 'older'
  | 'younger'
  | 'closeAlternative';

export interface DiffInput {
  color: string;
  profile: WineProfile;
  readiness: 'READY' | 'PEAK_SOON' | 'HOLD' | null;
  vintage: number | null;
}

/** How a lower-ranked option differs from the top pick, from data only. */
export function differenceFromTop(option: DiffInput, top: DiffInput): DifferenceKey {
  if (option.color !== top.color) return 'otherColor';
  if (hasTrustedStructure(option.profile) && hasTrustedStructure(top.profile)) {
    if (option.profile.body <= top.profile.body - 1) return 'lighter';
    if (option.profile.body >= top.profile.body + 1) return 'fuller';
  }
  const optSweet = hasKnownResidualSugar(option.profile);
  const topSweet = hasKnownResidualSugar(top.profile);
  if (optSweet && !topSweet && top.profile.sweetness_basis !== 'unknown') return 'sweeter';
  if (!optSweet && topSweet && option.profile.sweetness_basis !== 'unknown') return 'drier';
  if (option.readiness === 'READY' && top.readiness && top.readiness !== 'READY') return 'readyNow';
  if (option.readiness === 'HOLD' && top.readiness !== 'HOLD') return 'needsTime';
  if (option.vintage && top.vintage) {
    if (option.vintage <= top.vintage - 4) return 'older';
    if (option.vintage >= top.vintage + 4) return 'younger';
  }
  return 'closeAlternative';
}
