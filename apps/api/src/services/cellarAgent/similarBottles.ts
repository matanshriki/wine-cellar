/**
 * Deterministic "similar bottles" search within the cellar (no embeddings in Phase 2).
 */

import type { CellarBottleInput, ExtractedConstraints, ScoredCandidate } from './types.js';
import type { SommelierPreferenceMemory } from './sommelierTypes.js';
import { scoreBottleHeuristically } from './heuristics.js';

function grapeStr(b: CellarBottleInput): string {
  const g = b.grapes;
  if (Array.isArray(g)) return g.join(' ').toLowerCase();
  return (g || '').toLowerCase();
}

function similarityToAnchor(a: CellarBottleInput, b: CellarBottleInput): number {
  let s = 0;
  const c1 = (a.color || '').toLowerCase();
  const c2 = (b.color || '').toLowerCase();
  if (c1 && c2 && c1 === c2) s += 25;

  const r1 = (a.region || '').toLowerCase();
  const r2 = (b.region || '').toLowerCase();
  if (r1 && r2 && (r1 === r2 || r1.includes(r2) || r2.includes(r1))) s += 20;

  const g1 = grapeStr(a);
  const g2 = grapeStr(b);
  if (g1 && g2) {
    const tokens = g1.split(/[\s,]+/).filter((x) => x.length > 2);
    for (const tok of tokens) {
      if (g2.includes(tok)) {
        s += 15;
        break;
      }
    }
  }

  if (a.country && b.country && a.country === b.country) s += 8;

  const v1 = a.vintage;
  const v2 = b.vintage;
  if (v1 && v2 && Math.abs(v1 - v2) <= 3) s += 5;

  return s;
}

/**
 * Rank bottles by similarity to anchor, excluding anchor id, then blend with global heuristic score.
 */
export function findSimilarCandidates(
  anchorId: string,
  bottles: CellarBottleInput[],
  constraints: ExtractedConstraints,
  userMessageLower: string,
  memory: SommelierPreferenceMemory | null,
  cap: number
): ScoredCandidate[] {
  const anchor = bottles.find((b) => b.id === anchorId);
  if (!anchor) return [];

  const others = bottles.filter((b) => b.id !== anchorId);
  const scored: ScoredCandidate[] = others.map((bottle) => {
    const sim = similarityToAnchor(anchor, bottle);
    const { score: hScore, features } = scoreBottleHeuristically(
      bottle,
      constraints,
      userMessageLower,
      memory
    );
    const score = sim * 1.2 + hScore;
    return { bottle, score, features: [...features, `similarity:${Math.round(sim)}`] };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, cap);
}
