/**
 * Deterministic scoring — the model explains; the server ranks.
 *
 * Scores are comparable only within one request. They bias shortlisting toward
 * readiness, constraint match, and simple text overlap (no embeddings in Phase 1).
 */

import type { CellarBottleInput, ExtractedConstraints } from './types.js';

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
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function colorNormalized(b: CellarBottleInput): string {
  return (b.color || '').toLowerCase();
}

/**
 * Heuristic score for one bottle vs. extracted constraints and user message intent.
 */
export function scoreBottleHeuristically(
  bottle: CellarBottleInput,
  constraints: ExtractedConstraints,
  userMessageLower: string
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

  return { score, features };
}
