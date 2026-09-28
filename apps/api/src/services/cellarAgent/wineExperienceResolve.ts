/**
 * Resolve a free-text wine phrase against in-stock cellar bottles.
 */

import type { CellarBottleInput } from './types.js';

export type WineResolveCandidate = {
  bottleId: string;
  wineId: string | null;
  producer: string;
  wineName: string;
  vintage: number | null;
  score: number;
  label: string;
};

export type WineResolveResult =
  | {
      status: 'matched';
      bottle: WineResolveCandidate;
    }
  | {
      status: 'ambiguous';
      candidates: WineResolveCandidate[];
    }
  | {
      status: 'unresolved';
      displayLabel: string;
    };

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return norm(s)
    .split(' ')
    .filter((t) => t.length > 1);
}

function scorePhraseAgainstBottle(phrase: string, bottle: CellarBottleInput): number {
  const pToks = tokens(phrase);
  if (!pToks.length) return 0;
  const producer = bottle.producer || '';
  const wineName = bottle.wineName || '';
  const combined = `${producer} ${wineName}`.trim();
  const cNorm = norm(combined);
  const pNorm = norm(phrase);

  if (!cNorm) return 0;
  if (pNorm === cNorm) return 100;
  if (cNorm.includes(pNorm) || pNorm.includes(cNorm)) return 90;

  const cToks = new Set(tokens(combined));
  let hit = 0;
  for (const t of pToks) {
    if (cToks.has(t)) hit += 1;
    else if ([...cToks].some((c) => c.includes(t) || t.includes(c))) hit += 0.5;
  }
  const coverage = hit / pToks.length;
  let score = Math.round(coverage * 80);

  // Vintage bonus when phrase contains a year matching bottle
  const year = phrase.match(/\b(19|20)\d{2}\b/);
  if (year && bottle.vintage != null && String(bottle.vintage) === year[0]) {
    score += 8;
  } else if (year && bottle.vintage != null && String(bottle.vintage) !== year[0]) {
    score -= 15;
  }

  // Prefer producer token hits
  const prodToks = tokens(producer);
  if (prodToks.some((t) => pToks.includes(t))) score += 5;

  return score;
}

export function resolveWinePhraseInCellar(
  phrase: string,
  cellarBottles: CellarBottleInput[]
): WineResolveResult {
  const displayLabel = phrase.replace(/\s+/g, ' ').trim();
  if (!displayLabel || cellarBottles.length === 0) {
    return { status: 'unresolved', displayLabel };
  }

  // Deduplicate by wine_id (or bottle id if no wine id) keeping best score
  const scored: WineResolveCandidate[] = [];
  const bestByWine = new Map<string, WineResolveCandidate>();

  for (const b of cellarBottles) {
    const score = scorePhraseAgainstBottle(displayLabel, b);
    if (score < 45) continue;
    const label = [b.producer, b.wineName].filter(Boolean).join(' ').trim() || displayLabel;
    const cand: WineResolveCandidate = {
      bottleId: b.id,
      wineId: b.wineId ?? null,
      producer: b.producer || '',
      wineName: b.wineName || '',
      vintage: b.vintage ?? null,
      score,
      label,
    };
    const key = cand.wineId || `bottle:${cand.bottleId}`;
    const prev = bestByWine.get(key);
    if (!prev || cand.score > prev.score) bestByWine.set(key, cand);
  }

  scored.push(...bestByWine.values());
  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { status: 'unresolved', displayLabel };
  }

  const top = scored[0]!;
  const close = scored.filter((c) => c.score >= top.score - 8 && c.score >= 55);
  if (close.length > 1 && top.score < 92) {
    return { status: 'ambiguous', candidates: close.slice(0, 4) };
  }
  if (top.score < 55) {
    return { status: 'unresolved', displayLabel };
  }
  return { status: 'matched', bottle: top };
}
