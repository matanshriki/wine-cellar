/**
 * Deterministic scoring — the model explains; the server ranks.
 *
 * Scores are comparable only within one request. They bias shortlisting toward
 * readiness, constraint match, and simple text overlap (no embeddings in Phase 1).
 */

import type { CellarBottleInput, ExtractedConstraints } from './types.js';
import type { SommelierPreferenceMemory } from './sommelierTypes.js';

const READINESS_WEIGHT: Record<string, number> = {
  peak: 34,
  ready: 32,
  drink_soon: 18,
  entering: 12,
  aging: 8,
  young: 4,
  too_young: 2,
  past_peak: 0,
  unknown: 10,
};

function normalizeReadiness(s: string | undefined): string {
  if (!s) return 'unknown';
  const x = s.toLowerCase().replace(/\s+/g, '_');
  if (x.includes('peak') && x.includes('past')) return 'past_peak';
  if (x.includes('ready') || x === 'ready') return 'ready';
  if (x.includes('peak')) return 'peak';
  if (x.includes('soon')) return 'drink_soon';
  if (x.includes('aging')) return 'aging';
  if (x.includes('young')) return 'too_young';
  return x;
}

function grapeString(b: CellarBottleInput): string {
  const g = b.grapes;
  if (Array.isArray(g)) return g.join(' ').toLowerCase();
  return (g || '').toLowerCase();
}

function bottleSearchBlob(b: CellarBottleInput): string {
  return [
    b.producer,
    b.wineName,
    b.region,
    b.country,
    grapeString(b),
    b.notes,
    b.pastNotesSummary,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Nudge ranking from this user's past opens (History) — complements taste profile. */
function applyPastOpensHistory(
  bottle: CellarBottleInput,
  features: string[]
): number {
  const avg = bottle.pastOpeningsAvgRating;
  const rated = bottle.pastOpeningsRatingCount ?? 0;
  if (typeof avg !== 'number' || rated < 1) return 0;
  if (avg >= 4.25) {
    features.push('history:liked');
    return 10;
  }
  if (avg >= 3.5) {
    features.push('history:ok');
    return 4;
  }
  if (avg <= 2.25) {
    features.push('history:disliked');
    return -10;
  }
  if (avg <= 3) {
    features.push('history:meh');
    return -3;
  }
  return 0;
}

function colorNormalized(b: CellarBottleInput): string {
  return (b.color || '').toLowerCase();
}

function applyPreferenceMemory(
  bottle: CellarBottleInput,
  memory: SommelierPreferenceMemory | null | undefined,
  features: string[]
): number {
  if (!memory) return 0;
  let boost = 0;
  const hay = bottleSearchBlob(bottle);
  const region = (bottle.region || '').toLowerCase();

  for (const r of memory.favoriteRegions || []) {
    const rl = r.toLowerCase();
    if (rl.length >= 3 && (region.includes(rl) || hay.includes(rl))) {
      boost += 8;
      features.push(`mem_region:${rl}`);
      break;
    }
  }
  for (const g of memory.favoriteGrapes || []) {
    const gl = g.toLowerCase();
    if (gl.length >= 3 && grapeString(bottle).includes(gl)) {
      boost += 8;
      features.push(`mem_grape:${gl}`);
      break;
    }
  }

  const body = (memory.bodyPreference || '').toLowerCase();
  const gs = grapeString(bottle);
  if (body === 'light' && /pinot|gamay|barbera|grenache|valpolicella/.test(gs)) {
    boost += 5;
    features.push('mem_body:light');
  }
  if (body === 'full' && /cabernet|syrah|nebbiolo|malbec|petit\s*verdot/.test(gs)) {
    boost += 5;
    features.push('mem_body:full');
  }

  for (const d of memory.dislikedProfiles || []) {
    const dl = d.toLowerCase();
    if (dl.includes('heavy') && /cabernet|nebbiolo|barolo|napa\s*cab/.test(gs)) {
      boost -= 6;
      features.push('mem_avoid:heavy');
    }
    if (dl.includes('acid') && /sangiovese|barbera|riesling|sauvignon/.test(gs)) {
      boost -= 4;
      features.push('mem_avoid:acid');
    }
  }

  return boost;
}

/**
 * Heuristic score for one bottle vs. extracted constraints and user message intent.
 * Optional learned preferences (Phase 2) nudge ranking — never required for a valid score.
 */
export function scoreBottleHeuristically(
  bottle: CellarBottleInput,
  constraints: ExtractedConstraints,
  userMessageLower: string,
  memory?: SommelierPreferenceMemory | null
): { score: number; features: string[] } {
  const features: string[] = [];
  let score = 0;

  const readiness = normalizeReadiness(bottle.readinessStatus);
  const rw = READINESS_WEIGHT[readiness] ?? READINESS_WEIGHT.unknown;
  score += rw;
  features.push(`readiness:${readiness}`);

  const bColor = colorNormalized(bottle);
  if (constraints.colors.length > 0) {
    if (bColor && constraints.colors.includes(bColor)) {
      score += 22;
      features.push('color_match');
    }
  }

  for (const r of constraints.regionHints) {
    const hint = r.toLowerCase();
    const hay = bottleSearchBlob(bottle);
    if (hint.length >= 3 && hay.includes(hint)) {
      score += 12;
      features.push(`region:${hint}`);
      break;
    }
  }

  for (const g of constraints.grapeHints) {
    const hint = g.toLowerCase();
    if (hint.length >= 3 && grapeString(bottle).includes(hint)) {
      score += 12;
      features.push(`grape:${hint}`);
      break;
    }
  }

  if (constraints.wantsChampagne || constraints.wantsSparkling) {
    const hay = bottleSearchBlob(bottle);
    if (hay.includes('champagne') || hay.includes('sparkling') || bColor === 'sparkling') {
      score += 18;
      features.push('sparkling_match');
    }
  }

  // Light keyword overlap with user message (food / occasion)
  const hay = bottleSearchBlob(bottle);
  const keywords = [
    ...constraints.foodKeywords,
    ...constraints.occasionKeywords,
  ];
  for (const kw of keywords) {
    if (kw.length >= 3 && userMessageLower.includes(kw) && hay.includes(kw)) {
      score += 6;
      features.push(`kw:${kw}`);
    }
  }

  // Quantity: prefer bottles actually available
  const q = bottle.quantity ?? 1;
  if (q > 0) score += Math.min(5, q);

  score += applyPreferenceMemory(bottle, memory ?? null, features);
  score += applyPastOpensHistory(bottle, features);

  return { score, features };
}
