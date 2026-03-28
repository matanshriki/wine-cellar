/**
 * Deterministic shortlist + diversification.
 *
 * Phase 1 caps what the LLM sees (8–12 bottles) so the model reasons over a tight
 * set chosen server-side, improving consistency and leaving room for future tools.
 */

import type {
  CellarBottleInput,
  CompactCellarBottle,
  ExtractedConstraints,
  ScoredCandidate,
} from './types.js';
import { scoreBottleHeuristically } from './heuristics.js';
import type { SommelierPreferenceMemory } from './sommelierTypes.js';

/** Tunable: keep LLM context small but rich enough for multi-bottle asks. */
export const SHORTLIST_MIN = 8;
export const SHORTLIST_MAX = 12;

/** When the cellar is large, cap at 12; when small, send all ranked bottles (<8). */
export function computeEffectiveShortlistCap(totalRanked: number): number {
  if (totalRanked <= 0) return 0;
  if (totalRanked < SHORTLIST_MIN) return totalRanked;
  return Math.min(SHORTLIST_MAX, totalRanked);
}

function compactOne(b: CellarBottleInput): CompactCellarBottle {
  const pastNotes = b.pastNotesSummary?.trim();
  return {
    id: b.id,
    producer: b.producer || 'Unknown',
    wineName: b.wineName || 'Unknown',
    vintage: b.vintage,
    region: b.region,
    country: b.country,
    grapes: b.grapes,
    color: b.color,
    drinkWindowStart: b.drinkWindowStart,
    drinkWindowEnd: b.drinkWindowEnd,
    readinessStatus: b.readinessStatus,
    notes: b.notes?.substring(0, 200),
    quantity: b.quantity,
    pastOpeningsCount: b.pastOpeningsCount,
    pastOpeningsAvgRating: b.pastOpeningsAvgRating,
    pastOpeningsRatingCount: b.pastOpeningsRatingCount,
    pastNotesSummary: pastNotes ? pastNotes.substring(0, 220) : undefined,
  };
}

function normalizeColor(c: string | undefined): string {
  return (c || '').toLowerCase();
}

/**
 * Filter bottles by strict color match when the user asked for a color.
 * Returns null if nothing matches (caller may relax).
 */
function strictColorFilter(
  bottles: CellarBottleInput[],
  colors: string[]
): CellarBottleInput[] | null {
  if (colors.length === 0) return bottles;
  const out = bottles.filter((b) => {
    const bc = normalizeColor(b.color);
    return bc && colors.includes(bc);
  });
  return out.length === 0 ? null : out;
}

/**
 * Rank all bottles, optionally after strict color filter; relax filter if empty.
 */
export function shortlistCandidates(
  bottles: CellarBottleInput[],
  constraints: ExtractedConstraints,
  userMessageLower: string,
  memory?: SommelierPreferenceMemory | null,
  recentlyRecommended?: Set<string> | null
): { scored: ScoredCandidate[]; relaxedFilter: boolean } {
  let pool = bottles;
  let relaxedFilter = false;
  const strict = strictColorFilter(bottles, constraints.colors);
  if (strict) {
    pool = strict;
  } else if (constraints.colors.length > 0) {
    relaxedFilter = true;
    pool = bottles;
  }

  const scored: ScoredCandidate[] = pool.map((bottle) => {
    const { score, features } = scoreBottleHeuristically(
      bottle,
      constraints,
      userMessageLower,
      memory ?? null,
      recentlyRecommended ?? null
    );
    return { bottle, score, features };
  });

  scored.sort((a, b) => b.score - a.score);
  return { scored, relaxedFilter };
}

/** Slice top N after `computeEffectiveShortlistCap(scored.length)`. */
export function takeTopForCap(scored: ScoredCandidate[], cap: number): ScoredCandidate[] {
  if (cap <= 0) return [];
  return scored.slice(0, Math.min(cap, scored.length));
}

/**
 * For multi-bottle asks, prefer a spread of regions (then fill by score).
 * For single-bottle path, `requestedCount` is 1 — returns the top candidate.
 */
export function diversifyResults(
  ordered: ScoredCandidate[],
  requestedCount: number
): ScoredCandidate[] {
  const n = Math.max(1, Math.min(requestedCount, ordered.length));
  if (n <= 1) {
    return ordered.slice(0, n);
  }

  const picked: ScoredCandidate[] = [];
  const seenRegions = new Set<string>();
  const rest: ScoredCandidate[] = [];

  for (const cand of ordered) {
    const region = (cand.bottle.region || 'unknown').toLowerCase();
    if (!seenRegions.has(region)) {
      seenRegions.add(region);
      picked.push(cand);
      if (picked.length >= n) break;
    } else {
      rest.push(cand);
    }
  }

  for (const cand of rest) {
    if (picked.length >= n) break;
    picked.push(cand);
  }

  return picked.slice(0, n);
}

/**
 * Reorder top `maxPick` candidates so the LLM sees varied regions when possible.
 */
export function diversifyShortlistForPrompt(
  scoredSorted: ScoredCandidate[],
  maxPick: number
): ScoredCandidate[] {
  const top = scoredSorted.slice(0, maxPick);
  return diversifyResults(top, top.length);
}

export function compactBottlesForLlm(candidates: ScoredCandidate[]): CompactCellarBottle[] {
  return candidates.map((c) => compactOne(c.bottle));
}

/**
 * Legacy: same behavior as original `buildCellarContext` (up to 50 bottles, shuffled).
 * Kept for failsafe path — do not use for orchestrated shortlist.
 */
export function buildLegacyCellarContextPayload(bottles: CellarBottleInput[]): {
  bottles: CompactCellarBottle[];
  summary: string;
  totalBottles: number;
} {
  const readyBottles = bottles.filter(
    (b) => b.readinessStatus === 'ready' || b.readinessStatus === 'peak'
  );
  const otherBottles = bottles.filter(
    (b) => b.readinessStatus !== 'ready' && b.readinessStatus !== 'peak'
  );

  const shuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const sorted = [...shuffle(readyBottles), ...shuffle(otherBottles)];
  const limited = sorted.slice(0, 50);

  const compactBottles = limited.map((b) => compactOne(b));

  const totalPhysicalBottles = bottles.reduce((sum, b) => sum + (b.quantity || 1), 0);
  const limitedPhysicalBottles = limited.reduce((sum, b) => sum + (b.quantity || 1), 0);

  let summary = '';
  if (bottles.length > 50) {
    const remaining = totalPhysicalBottles - limitedPhysicalBottles;
    const colorCounts = bottles.reduce(
      (acc, b) => {
        const color = b.color || 'unknown';
        acc[color] = (acc[color] || 0) + (b.quantity || 1);
        return acc;
      },
      {} as Record<string, number>
    );

    summary = `\n\nNote: Showing ${limitedPhysicalBottles} bottles. You have ${remaining} more bottles in cellar (${Object.entries(colorCounts)
      .map(([c, n]) => `${n} ${c}`)
      .join(', ')}).`;
  }

  return { bottles: compactBottles, summary, totalBottles: totalPhysicalBottles };
}
