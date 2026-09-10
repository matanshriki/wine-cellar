/**
 * Taste-profile shortlist scoring (Phase 1 read-path unification).
 *
 * Soft ranking only — never a hard filter. Agent memory remains active;
 * when both cover the same dimension, memory wins (no naïve double bonus).
 */

import type { CellarBottleInput, ExtractedConstraints } from './types.js';
import type { SommelierPreferenceMemory } from './sommelierTypes.js';
import {
  getEffectiveTasteVector,
  hasVectorOverride,
  type StructuredTasteProfile,
  type TasteConfidence,
} from './tasteProfileTypes.js';

/** Scoring version stamped on recommendation explainability. */
export const TASTE_SHORTLIST_SCORING_VERSION = 'taste_shortlist_v1';

/**
 * Kill-switch: set TASTE_SHORTLIST_SCORING=0 to disable structured taste boosts
 * (agent memory + existing heuristics unchanged). Default: enabled.
 */
export function isTasteShortlistScoringEnabled(): boolean {
  const v = (process.env.TASTE_SHORTLIST_SCORING || '1').trim().toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}

/** Bounded weights — all taste contributions stay within these caps. */
export const TASTE_SHORTLIST_WEIGHTS = {
  regionPositiveMax: 6,
  grapePositiveMax: 6,
  regionNegativeMax: -3,
  grapeNegativeMax: -3,
  bodyMax: 4,
  colorBiasMax: 3,
  /** Minimum |affinity| to apply a region/grape nudge */
  affinityFloor: 0.25,
  confidenceScale: {
    low: 0.4,
    med: 0.7,
    high: 1.0,
  } as Record<TasteConfidence, number>,
} as const;

/** Agent memory weights (existing) — kept here for merge visibility. */
export const AGENT_MEMORY_WEIGHTS = {
  region: 8,
  grape: 8,
  body: 5,
  avoidHeavy: -6,
  avoidAcid: -4,
} as const;

export type PreferenceDimension = 'region' | 'grape' | 'body' | 'color';

/** Valid agent-memory bodyPreference values that own the body dimension for a request. */
export type MemoryBodyPreference = 'light' | 'full';

/**
 * Normalize agent-memory bodyPreference. Invalid/missing → null (does not suppress taste).
 */
export function resolveMemoryBodyPreference(
  memory: SommelierPreferenceMemory | null | undefined
): MemoryBodyPreference | null {
  const raw = (memory?.bodyPreference || '').toLowerCase().trim();
  if (raw === 'light' || raw === 'full') return raw;
  return null;
}

export interface TasteScoreContext {
  tasteProfile: StructuredTasteProfile | null;
  /** Request-level body ask parsed from the user message (outranks stable profile). */
  requestBodyPreference: 'light' | 'full' | null;
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
    b.producerHe,
    b.wineNameHe,
    b.regionHe,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

const LIGHT_GRAPE_RE = /pinot|gamay|barbera|grenache|valpolicella|riesling|albarino|albariño|muscadet/;
const FULL_GRAPE_RE = /cabernet|syrah|nebbiolo|malbec|petit\s*verdot|tannat|mourvedre|mourvèdre/;

/**
 * Detect an explicit one-time body request in the user message.
 * Used so "something lighter" outranks a stable full-body profile.
 */
export function detectRequestBodyPreference(userMessageLower: string): 'light' | 'full' | null {
  const t = userMessageLower;
  if (
    /\b(lighter|light(er)?\s+(red|white|wine|bottle|something)|delicate|something\s+light)\b/.test(t) ||
    /\b(not\s+(too\s+)?(heavy|big|full))\b/.test(t)
  ) {
    return 'light';
  }
  if (
    /\b(heavier|full(er)?[-\s]?bodied|bold(er)?|something\s+(big|bold|heavy|full))\b/.test(t)
  ) {
    return 'full';
  }
  return null;
}

function confidenceScale(c: TasteConfidence): number {
  return TASTE_SHORTLIST_WEIGHTS.confidenceScale[c] ?? 0.4;
}

function topAffinityEntries(
  map: Record<string, number>,
  preferPositive: boolean
): { key: string; weight: number }[] {
  return Object.entries(map)
    .map(([key, weight]) => ({ key: key.toLowerCase(), weight }))
    .filter(({ key, weight }) => {
      if (key.length < 3) return false;
      if (preferPositive) return weight >= TASTE_SHORTLIST_WEIGHTS.affinityFloor;
      return weight <= -TASTE_SHORTLIST_WEIGHTS.affinityFloor;
    })
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}

export interface PreferenceScoreResult {
  score: number;
  features: string[];
  /** Dimensions already claimed by agent memory (for observability). */
  memoryClaimed: PreferenceDimension[];
  /** Taste feature keys that actually moved the score. */
  tasteSignalKeys: string[];
}

/**
 * Apply agent memory + structured taste with explicit precedence:
 * request constraints (handled elsewhere) > agent memory dimension > taste override/inferred.
 * Overlapping region/grape: memory match blocks taste bonus for that dimension (not summed).
 */
export function applyPreferenceScores(
  bottle: CellarBottleInput,
  memory: SommelierPreferenceMemory | null | undefined,
  tasteCtx: TasteScoreContext | null | undefined,
  features: string[]
): PreferenceScoreResult {
  let score = 0;
  const tasteSignalKeys: string[] = [];
  const memoryClaimed: PreferenceDimension[] = [];

  const hay = bottleSearchBlob(bottle);
  const region = (bottle.region || '').toLowerCase();
  const gs = grapeString(bottle);
  const color = (bottle.color || '').toLowerCase();

  // ── Agent memory (existing behavior) ──────────────────────────────────────
  let memoryRegionHit = false;
  let memoryGrapeHit = false;
  /** True when memory declares a valid bodyPreference for this whole request. */
  const memoryBodyPreference = resolveMemoryBodyPreference(memory);
  const memoryOwnsBodyDimension = memoryBodyPreference !== null;
  /** Explicit current-message body ask outranks memory and taste for this dimension. */
  const requestBody = tasteCtx?.requestBodyPreference ?? null;

  if (memory) {
    for (const r of memory.favoriteRegions || []) {
      const rl = r.toLowerCase();
      if (rl.length >= 3 && (region.includes(rl) || hay.includes(rl))) {
        score += AGENT_MEMORY_WEIGHTS.region;
        features.push(`mem_region:${rl}`);
        features.push('agent_memory_region');
        memoryRegionHit = true;
        memoryClaimed.push('region');
        break;
      }
    }
    for (const g of memory.favoriteGrapes || []) {
      const gl = g.toLowerCase();
      if (gl.length >= 3 && gs.includes(gl)) {
        score += AGENT_MEMORY_WEIGHTS.grape;
        features.push(`mem_grape:${gl}`);
        features.push('agent_memory_grape');
        memoryGrapeHit = true;
        memoryClaimed.push('grape');
        break;
      }
    }

    // Memory body bonuses only when the current message did not claim the body dimension.
    if (!requestBody && memoryBodyPreference === 'light' && LIGHT_GRAPE_RE.test(gs)) {
      score += AGENT_MEMORY_WEIGHTS.body;
      features.push('mem_body:light');
      features.push('agent_memory_body');
      features.push('body_source:agent_memory');
      if (!memoryClaimed.includes('body')) memoryClaimed.push('body');
    } else if (!requestBody && memoryBodyPreference === 'full' && FULL_GRAPE_RE.test(gs)) {
      score += AGENT_MEMORY_WEIGHTS.body;
      features.push('mem_body:full');
      features.push('agent_memory_body');
      features.push('body_source:agent_memory');
      if (!memoryClaimed.includes('body')) memoryClaimed.push('body');
    } else if (!requestBody && memoryOwnsBodyDimension) {
      // Dimension owned even when this bottle does not match the memory proxy.
      if (!memoryClaimed.includes('body')) memoryClaimed.push('body');
      features.push('body_source:agent_memory_owns_dimension');
    }

    for (const d of memory.dislikedProfiles || []) {
      const dl = d.toLowerCase();
      if (dl.includes('heavy') && /cabernet|nebbiolo|barolo|napa\s*cab/.test(gs)) {
        score += AGENT_MEMORY_WEIGHTS.avoidHeavy;
        features.push('mem_avoid:heavy');
      }
      if (dl.includes('acid') && /sangiovese|barbera|riesling|sauvignon/.test(gs)) {
        score += AGENT_MEMORY_WEIGHTS.avoidAcid;
        features.push('mem_avoid:acid');
      }
    }
  }

  // ── Structured taste profile (soft; skipped when disabled / absent) ───────
  if (
    !isTasteShortlistScoringEnabled() ||
    !tasteCtx?.tasteProfile ||
    !tasteCtx.tasteProfile
  ) {
    return { score, features, memoryClaimed, tasteSignalKeys };
  }

  const profile = tasteCtx.tasteProfile;
  const scale = confidenceScale(profile.confidence);
  const W = TASTE_SHORTLIST_WEIGHTS;

  // Region affinities — skip if memory already claimed region
  if (!memoryRegionHit) {
    for (const { key, weight } of topAffinityEntries(profile.preferences.regions, true)) {
      if (region.includes(key) || hay.includes(key)) {
        const boost = Math.min(W.regionPositiveMax, weight * W.regionPositiveMax) * scale;
        if (boost > 0.05) {
          score += boost;
          features.push(`taste_region:${key}`);
          tasteSignalKeys.push('taste_region');
        }
        break;
      }
    }
    for (const { key, weight } of topAffinityEntries(profile.preferences.regions, false)) {
      if (region.includes(key) || hay.includes(key)) {
        const pen =
          Math.max(W.regionNegativeMax, weight * Math.abs(W.regionNegativeMax)) * scale;
        if (pen < -0.05) {
          score += pen;
          features.push(`taste_region_neg:${key}`);
          tasteSignalKeys.push('taste_region');
        }
        break;
      }
    }
  }

  // Grape affinities — skip if memory already claimed grape
  if (!memoryGrapeHit) {
    for (const { key, weight } of topAffinityEntries(profile.preferences.grapes, true)) {
      if (gs.includes(key)) {
        const boost = Math.min(W.grapePositiveMax, weight * W.grapePositiveMax) * scale;
        if (boost > 0.05) {
          score += boost;
          features.push(`taste_grape:${key}`);
          tasteSignalKeys.push('taste_grape');
        }
        break;
      }
    }
    for (const { key, weight } of topAffinityEntries(profile.preferences.grapes, false)) {
      if (gs.includes(key)) {
        const pen =
          Math.max(W.grapeNegativeMax, weight * Math.abs(W.grapeNegativeMax)) * scale;
        if (pen < -0.05) {
          score += pen;
          features.push(`taste_grape_neg:${key}`);
          tasteSignalKeys.push('taste_grape');
        }
        break;
      }
    }
  }

  // Body — request > valid memory bodyPreference (global) > taste override > inferred
  if (requestBody === 'light') {
    if (LIGHT_GRAPE_RE.test(gs)) {
      score += W.bodyMax * scale;
      features.push('request_body:light');
      features.push('body_source:request');
      tasteSignalKeys.push('request_body');
    }
    // Do not apply memory or taste body when user asked for light
  } else if (requestBody === 'full') {
    if (FULL_GRAPE_RE.test(gs)) {
      score += W.bodyMax * scale;
      features.push('request_body:full');
      features.push('body_source:request');
      tasteSignalKeys.push('request_body');
    }
  } else if (memoryOwnsBodyDimension) {
    // Valid agent-memory bodyPreference owns the whole body dimension for this request.
    // Matching bottles already received mem_body above; never apply taste body here.
    features.push('taste_body_suppressed_by_memory');
  } else {
    const overrideBody = hasVectorOverride(profile, 'body');
    // When a manual calibration exists for body, use that value for light/full
    // preference (takes precedence over the rating-inferred vector).
    const bodyForPref = overrideBody
      ? (profile.overrides!.vector!.body as number)
      : getEffectiveTasteVector(profile).body;
    if (bodyForPref >= 0.62 && FULL_GRAPE_RE.test(gs)) {
      const boost = W.bodyMax * scale;
      score += boost;
      const key = overrideBody ? 'taste_override_body' : 'taste_body';
      features.push(`${key}:full`);
      features.push(overrideBody ? 'body_source:taste_override' : 'body_source:taste_inferred');
      tasteSignalKeys.push(key);
    } else if (bodyForPref <= 0.38 && LIGHT_GRAPE_RE.test(gs)) {
      const boost = W.bodyMax * scale;
      score += boost;
      const key = overrideBody ? 'taste_override_body' : 'taste_body';
      features.push(`${key}:light`);
      features.push(overrideBody ? 'body_source:taste_override' : 'body_source:taste_inferred');
      tasteSignalKeys.push(key);
    }
  }

  // Soft color bias — only when request did not already constrain color
  // (caller passes constraints; we only nudge when no explicit color ask)
  // Applied here only if tasteCtx carries a flag — see apply with constraints helper.

  return { score, features, memoryClaimed, tasteSignalKeys };
}

/**
 * Soft color bias from profile — only when the request has no explicit color constraint.
 */
export function applyTasteColorBias(
  bottle: CellarBottleInput,
  constraints: ExtractedConstraints,
  tasteProfile: StructuredTasteProfile | null,
  features: string[],
  tasteSignalKeys: string[]
): number {
  if (!isTasteShortlistScoringEnabled() || !tasteProfile) return 0;
  if (constraints.colors.length > 0) return 0;
  if (constraints.wantsSparkling || constraints.wantsChampagne) return 0;

  const color = (bottle.color || '').toLowerCase();
  if (!color) return 0;

  const scale = confidenceScale(tasteProfile.confidence);
  const W = TASTE_SHORTLIST_WEIGHTS;
  const p = tasteProfile.preferences;
  let boost = 0;

  if (color === 'red' && p.reds_bias >= TASTE_SHORTLIST_WEIGHTS.affinityFloor) {
    boost = Math.min(W.colorBiasMax, p.reds_bias * W.colorBiasMax) * scale;
  } else if (
    (color === 'white' || color === 'blanc') &&
    p.whites_bias >= TASTE_SHORTLIST_WEIGHTS.affinityFloor
  ) {
    boost = Math.min(W.colorBiasMax, p.whites_bias * W.colorBiasMax) * scale;
  } else if (
    color === 'sparkling' &&
    p.sparkling_bias >= TASTE_SHORTLIST_WEIGHTS.affinityFloor
  ) {
    boost = Math.min(W.colorBiasMax, p.sparkling_bias * W.colorBiasMax) * scale;
  } else if (color === 'red' && p.reds_bias <= -TASTE_SHORTLIST_WEIGHTS.affinityFloor) {
    boost = Math.max(-W.colorBiasMax, p.reds_bias * W.colorBiasMax) * scale;
  }

  if (Math.abs(boost) > 0.05) {
    features.push(`taste_color:${color}`);
    tasteSignalKeys.push('taste_color');
  }
  return boost;
}

export function collectTasteSignalKeysFromFeatures(features: string[]): string[] {
  const keys = new Set<string>();
  for (const f of features) {
    if (f.startsWith('taste_region')) keys.add('taste_region');
    else if (f.startsWith('taste_grape')) keys.add('taste_grape');
    else if (f.startsWith('taste_override_body')) keys.add('taste_override_body');
    else if (f.startsWith('taste_body')) keys.add('taste_body');
    else if (f.startsWith('taste_color')) keys.add('taste_color');
    else if (f.startsWith('request_body')) keys.add('request_body');
    else if (f.startsWith('agent_memory_region') || f.startsWith('mem_region:'))
      keys.add('agent_memory_region');
    else if (f.startsWith('agent_memory_grape') || f.startsWith('mem_grape:'))
      keys.add('agent_memory_grape');
    else if (f.startsWith('agent_memory_body') || f.startsWith('mem_body:'))
      keys.add('agent_memory_body');
  }
  return [...keys];
}
