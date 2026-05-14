/**
 * Tonight's Category Service
 *
 * Assigns up to 3 distinct named slots from the user's cellar:
 *  - bestTonight    — best bottle to open right now
 *  - crowdPleaser   — safe, approachable choice for guests
 *  - specialBottle  — prestige / mature bottle worth a special occasion
 *
 * Pure deterministic logic — no AI calls, no randomness, no DB queries.
 * Uses existing fields only: readiness_label, readiness_score,
 * drink_window_start/end, serve_temp_c, decant_minutes, serving_guidance,
 * wine_profile, rating, color, vintage, region, appellation, producer, wine_name.
 */

import type { BottleWithWineInfo } from './bottleService';

export type SlotKey = 'bestTonight' | 'crowdPleaser' | 'specialBottle';

export interface CategorizedSlot {
  bottle: BottleWithWineInfo;
  slot: SlotKey;
  /** Full i18n key for the category title label */
  categoryKey: string;
  /** Full i18n key for the one-line reason shown on the card */
  reasonKey: string;
  /** Up to 3 i18n tag keys with optional interpolation values */
  tags: Array<{ key: string; values?: Record<string, string | number> }>;
}

export interface TonightSelection {
  slots: CategorizedSlot[];
  /** True when there are available bottles but none have been AI-analyzed */
  needsAnalysis: boolean;
  /** True when the cellar has no available (quantity>0, non-reserved) bottles */
  noBottles: boolean;
  /** True when all analyzed bottles have readiness_label === 'HOLD' */
  allHold: boolean;
}

// ─── Prestige signals ──────────────────────────────────────────────────────
// Matched against region, appellation, regional_wine_style, producer, wine_name

const PRESTIGE_SIGNALS = [
  'barolo', 'brunello', 'amarone', 'barbaresco', 'barossa',
  'burgundy', 'bordeaux', 'champagne', 'châteauneuf', 'chateauneuf',
  'ribera del duero', 'priorat', 'napa valley', 'napa',
  'ridge', 'penfolds', 'opus one', 'sassicaia', 'tignanello',
  'ornellaia', 'grange', 'super tuscan', 'rioja gran reserva',
  'chablis premier cru', 'côte rôtie', 'cote rotie', 'hermitage',
  'gevrey', 'vosne', 'chambolle', 'pomerol', 'petrus', 'le pin',
] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────

function getReadiness(bottle: BottleWithWineInfo): 'READY' | 'PEAK_SOON' | 'HOLD' | null {
  const label = (bottle as any).readiness_label;
  if (label === 'READY' || label === 'PEAK_SOON' || label === 'HOLD') return label;
  return null;
}

function getAge(bottle: BottleWithWineInfo): number | null {
  const vintage = bottle.wine.vintage;
  if (!vintage) return null;
  return new Date().getFullYear() - vintage;
}

function isInDrinkWindow(bottle: BottleWithWineInfo): boolean {
  const b = bottle as any;
  const now = new Date().getFullYear();
  if (typeof b.drink_window_start === 'number' && typeof b.drink_window_end === 'number') {
    return now >= b.drink_window_start && now <= b.drink_window_end;
  }
  return false;
}

function hasPrestigeSignal(bottle: BottleWithWineInfo): boolean {
  const haystack = [
    bottle.wine.region,
    (bottle.wine as any).appellation,
    (bottle.wine as any).regional_wine_style,
    bottle.wine.producer,
    bottle.wine.wine_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return PRESTIGE_SIGNALS.some(s => haystack.includes(s));
}

function getWineProfile(bottle: BottleWithWineInfo): Record<string, number | null> | null {
  return (bottle.wine as any).wine_profile ?? null;
}

// ─── Scoring functions ─────────────────────────────────────────────────────

function scoreBestTonight(bottle: BottleWithWineInfo): number {
  let score = 0;
  const b = bottle as any;
  const readiness = getReadiness(bottle);

  if (readiness === 'READY') score += 100;
  else if (readiness === 'PEAK_SOON') score += 50;
  else if (readiness === 'HOLD') score -= 50;

  if (typeof b.readiness_score === 'number') score += b.readiness_score * 0.3;
  if (isInDrinkWindow(bottle)) score += 20;

  // Good serving guidance = more actionable tonight
  const servingConf = (b.serving_guidance as any)?.confidence;
  if (servingConf === 'high') score += 10;
  else if (servingConf === 'medium') score += 5;

  // Multiple bottles = less risk opening one
  score += Math.min(bottle.quantity * 3, 12);

  return score;
}

function scoreCrowdPleaser(bottle: BottleWithWineInfo): number {
  let score = 0;
  const readiness = getReadiness(bottle);
  const color = bottle.wine.color?.toLowerCase() ?? '';

  // Approachable styles
  if (color === 'white') score += 25;
  else if (color === 'rose') score += 22;
  else if (color === 'sparkling') score += 20;
  else if (color === 'red') score += 10;

  if (readiness === 'READY') score += 25;
  else if (readiness === 'PEAK_SOON') score += 10;
  else if (readiness === 'HOLD') score -= 40;

  // Good Vivino rating → crowd-trusted choice
  const rating = (bottle.wine as any).rating as number | undefined | null;
  if (rating && rating >= 4.0) score += 20;
  else if (rating && rating >= 3.5) score += 10;

  // Avoid using prestige bottles casually
  if (hasPrestigeSignal(bottle)) score -= 15;

  // Lower tannin = more approachable (if profile is available)
  const profile = getWineProfile(bottle);
  if (profile?.tannin != null) {
    score += Math.max(0, 12 - (profile.tannin as number) * 2);
  }

  // Multiple bottles = can share freely with guests
  score += Math.min(bottle.quantity * 4, 16);

  return score;
}

function scoreSpecialBottle(bottle: BottleWithWineInfo): number {
  let score = 0;
  const readiness = getReadiness(bottle);
  const age = getAge(bottle);

  // High Vivino rating
  const rating = (bottle.wine as any).rating as number | undefined | null;
  if (rating && rating >= 4.2) score += 40;
  else if (rating && rating >= 3.8) score += 20;

  // Prestige region / appellation / style
  if (hasPrestigeSignal(bottle)) score += 35;

  // Mature and ready = ideal occasion bottle
  if (age !== null && age >= 10 && readiness === 'READY') score += 30;
  else if (age !== null && age >= 15) score += 15;
  else if (age !== null && age >= 7 && readiness === 'READY') score += 10;

  if (readiness === 'READY') score += 10;
  else if (readiness === 'HOLD') score -= 35;

  return score;
}

// ─── Reason + tag builders ─────────────────────────────────────────────────

function getReasonKey(slot: SlotKey, bottle: BottleWithWineInfo): string {
  const readiness = getReadiness(bottle);
  const BASE = 'dashboard.tonightsOrbit.reasons';
  if (slot === 'bestTonight') {
    if (readiness === 'READY') return `${BASE}.readyOpenTonight`;
    if (readiness === 'PEAK_SOON') return `${BASE}.approachingPeak`;
    return `${BASE}.bestAvailable`;
  }
  if (slot === 'crowdPleaser') {
    return `${BASE}.crowdFriendly`;
  }
  // specialBottle
  if (hasPrestigeSignal(bottle)) return `${BASE}.prestigeBottle`;
  const age = getAge(bottle);
  if (age !== null && age >= 10) return `${BASE}.matureAndReady`;
  const ratingForReason = (bottle.wine as any).rating as number | undefined | null;
  if (ratingForReason && ratingForReason >= 4.0) return `${BASE}.highlyRated`;
  return `${BASE}.impressBottle`;
}

function buildTags(slot: SlotKey, bottle: BottleWithWineInfo): CategorizedSlot['tags'] {
  const b = bottle as any;
  const readiness = getReadiness(bottle);
  const age = getAge(bottle);
  const serving = (b.serving_guidance as any) ?? null;
  const tags: CategorizedSlot['tags'] = [];

  // Readiness tag — always first
  const BASE = 'dashboard.tonightsOrbit.tags';
  if (readiness === 'READY') tags.push({ key: `${BASE}.readyNow` });
  else if (readiness === 'PEAK_SOON') tags.push({ key: `${BASE}.inPeakWindow` });
  else if (readiness === 'HOLD') tags.push({ key: `${BASE}.holdWine` });

  // Slot-specific tag
  if (slot === 'crowdPleaser') tags.push({ key: `${BASE}.guestFriendly` });
  if (slot === 'specialBottle') tags.push({ key: `${BASE}.specialBottle` });
  if (slot === 'bestTonight' && age !== null && age >= 10) {
    tags.push({ key: `${BASE}.matureBottle` });
  }

  // Decant guidance (from structured serving_guidance or scalar field)
  const decantMin: number | undefined = serving?.decant_min ?? b.decant_minutes;
  if (decantMin && decantMin > 0) {
    tags.push({ key: `${BASE}.needsDecant`, values: { min: decantMin } });
  }

  // High-rated signal
  const ratingForTag = (bottle.wine as any).rating as number | undefined | null;
  if (ratingForTag && ratingForTag >= 4.0) {
    tags.push({ key: `${BASE}.highRated` });
  }

  return tags.slice(0, 3);
}

// ─── Main export ───────────────────────────────────────────────────────────

export function selectTonightCategories(bottles: BottleWithWineInfo[]): TonightSelection {
  const available = bottles.filter(b => b.quantity > 0 && !(b as any).is_reserved);

  if (available.length === 0) {
    return { slots: [], needsAnalysis: false, noBottles: true, allHold: false };
  }

  const analyzed = available.filter(b => getReadiness(b) !== null);

  if (analyzed.length === 0) {
    return { slots: [], needsAnalysis: true, noBottles: false, allHold: false };
  }

  const allHold = analyzed.every(b => getReadiness(b) === 'HOLD');
  const usedIds = new Set<string>();

  /** Pick the top-scoring bottle from analyzed pool excluding already-used ids */
  function pickBest(scoreFn: (b: BottleWithWineInfo) => number): BottleWithWineInfo | null {
    const pool = analyzed.filter(b => !usedIds.has(b.id));
    if (pool.length === 0) return null;
    return [...pool].sort((a, b) => scoreFn(b) - scoreFn(a))[0];
  }

  const slots: CategorizedSlot[] = [];

  // Slot 1: bestTonight
  const bestBottle = pickBest(scoreBestTonight);
  if (bestBottle) {
    usedIds.add(bestBottle.id);
    // When the best available bottle is HOLD, label it neutrally — do not suggest opening
    const bestIsHold = getReadiness(bestBottle) === 'HOLD';
    slots.push({
      bottle: bestBottle,
      slot: 'bestTonight',
      categoryKey: bestIsHold
        ? 'dashboard.tonightsOrbit.categories.bestAvailable'
        : 'dashboard.tonightsOrbit.categories.bestTonight',
      reasonKey: getReasonKey('bestTonight', bestBottle),
      tags: buildTags('bestTonight', bestBottle),
    });
  }

  // Slot 2: crowdPleaser — skip if all wines are HOLD (no safe crowd option)
  if (!allHold) {
    const crowdBottle = pickBest(scoreCrowdPleaser);
    if (crowdBottle) {
      usedIds.add(crowdBottle.id);
      slots.push({
        bottle: crowdBottle,
        slot: 'crowdPleaser',
        categoryKey: 'dashboard.tonightsOrbit.categories.crowdPleaser',
        reasonKey: getReasonKey('crowdPleaser', crowdBottle),
        tags: buildTags('crowdPleaser', crowdBottle),
      });
    }
  }

  // Slot 3: specialBottle — skip if all wines are HOLD (no occasion to impress with)
  if (!allHold) {
    const specialBottle = pickBest(scoreSpecialBottle);
    if (specialBottle) {
      usedIds.add(specialBottle.id);
      slots.push({
        bottle: specialBottle,
        slot: 'specialBottle',
        categoryKey: 'dashboard.tonightsOrbit.categories.specialBottle',
        reasonKey: getReasonKey('specialBottle', specialBottle),
        tags: buildTags('specialBottle', specialBottle),
      });
    }
  }

  return { slots, needsAnalysis: false, noBottles: false, allHold };
}
