/**
 * API-side taste profile types + defensive parser.
 * Duplicates the web TasteProfile shape (no shared package in this monorepo).
 * Used for shortlist scoring only — not for writes.
 */

export type TasteConfidence = 'low' | 'med' | 'high';

export interface TasteProfileVector {
  body: number;
  tannin: number;
  acidity: number;
  oak: number;
  sweetness: number;
  power: number;
}

export interface TasteProfilePreferences {
  reds_bias: number;
  whites_bias: number;
  sparkling_bias: number;
  style_tags: Record<string, number>;
  regions: Record<string, number>;
  grapes: Record<string, number>;
}

/** Normalized structured profile used for scoring (version 1 only). */
export interface StructuredTasteProfile {
  version: number;
  vector: TasteProfileVector;
  preferences: TasteProfilePreferences;
  overrides?: { vector?: Partial<TasteProfileVector> };
  confidence: TasteConfidence;
  data_points: { rated_count: number; last_rated_at: string | null };
}

const VECTOR_KEYS: (keyof TasteProfileVector)[] = [
  'body',
  'tannin',
  'acidity',
  'oak',
  'sweetness',
  'power',
];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function clampSigned(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function parseWeightMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = asNumber(v);
    if (n === null || !k.trim()) continue;
    out[k] = clampSigned(n);
  }
  return out;
}

function parseVector(raw: unknown, fallback: TasteProfileVector): TasteProfileVector {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...fallback };
  const o = raw as Record<string, unknown>;
  const next = { ...fallback };
  for (const key of VECTOR_KEYS) {
    const n = asNumber(o[key]);
    if (n !== null) next[key] = clamp01(n);
  }
  return next;
}

function parsePartialVector(raw: unknown): Partial<TasteProfileVector> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Partial<TasteProfileVector> = {};
  let any = false;
  for (const key of VECTOR_KEYS) {
    const n = asNumber(o[key]);
    if (n !== null) {
      out[key] = clamp01(n);
      any = true;
    }
  }
  return any ? out : undefined;
}

const DEFAULT_VECTOR: TasteProfileVector = {
  body: 0.5,
  tannin: 0.5,
  acidity: 0.5,
  oak: 0.5,
  sweetness: 0.2,
  power: 0.5,
};

/**
 * Parse unknown JSON into a structured profile.
 * Returns null for missing/unsupported/unusable payloads (never throws).
 */
export function parseStructuredTasteProfile(raw: unknown): StructuredTasteProfile | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;

  const o = raw as Record<string, unknown>;
  const version = asNumber(o.version);
  // Only version 1 is supported for scoring; unknown/missing version → degrade
  if (version !== null && version !== 1) return null;
  if (version === null && o.vector == null && o.preferences == null) return null;

  const vector = parseVector(o.vector, DEFAULT_VECTOR);
  const prefsRaw =
    o.preferences && typeof o.preferences === 'object' && !Array.isArray(o.preferences)
      ? (o.preferences as Record<string, unknown>)
      : {};

  const preferences: TasteProfilePreferences = {
    reds_bias: clampSigned(asNumber(prefsRaw.reds_bias) ?? 0),
    whites_bias: clampSigned(asNumber(prefsRaw.whites_bias) ?? 0),
    sparkling_bias: clampSigned(asNumber(prefsRaw.sparkling_bias) ?? 0),
    style_tags: parseWeightMap(prefsRaw.style_tags),
    regions: parseWeightMap(prefsRaw.regions),
    grapes: parseWeightMap(prefsRaw.grapes),
  };

  let overrides: StructuredTasteProfile['overrides'];
  if (o.overrides && typeof o.overrides === 'object' && !Array.isArray(o.overrides)) {
    const ov = o.overrides as Record<string, unknown>;
    const ovVector = parsePartialVector(ov.vector);
    if (ovVector) overrides = { vector: ovVector };
  }

  const confRaw = typeof o.confidence === 'string' ? o.confidence : 'low';
  const confidence: TasteConfidence =
    confRaw === 'high' || confRaw === 'med' || confRaw === 'low' ? confRaw : 'low';

  let rated_count = 0;
  let last_rated_at: string | null = null;
  if (o.data_points && typeof o.data_points === 'object' && !Array.isArray(o.data_points)) {
    const dp = o.data_points as Record<string, unknown>;
    const rc = asNumber(dp.rated_count);
    if (rc !== null) rated_count = Math.max(0, Math.floor(rc));
    if (typeof dp.last_rated_at === 'string') last_rated_at = dp.last_rated_at;
    else if (dp.last_rated_at === null) last_rated_at = null;
  }

  return {
    version: 1,
    vector,
    preferences,
    ...(overrides ? { overrides } : {}),
    confidence,
    data_points: { rated_count, last_rated_at },
  };
}

/**
 * Effective structural vector: learned + calibration overrides (mirrors web getEffectiveVector).
 */
export function getEffectiveTasteVector(profile: StructuredTasteProfile): TasteProfileVector {
  const learnedWeight =
    profile.confidence === 'low' ? 0.7 : profile.confidence === 'med' ? 0.85 : 0.9;
  const overrideWeight = 1 - learnedWeight;
  const learned = profile.vector;
  const overrides = profile.overrides?.vector || {};

  const blend = (key: keyof TasteProfileVector): number => {
    const o = overrides[key];
    if (typeof o !== 'number') return learned[key];
    return clamp01(learned[key] * learnedWeight + o * overrideWeight);
  };

  return {
    body: blend('body'),
    tannin: blend('tannin'),
    acidity: blend('acidity'),
    oak: blend('oak'),
    sweetness: blend('sweetness'),
    power: blend('power'),
  };
}

/** True when a manual override exists for the given vector dimension. */
export function hasVectorOverride(
  profile: StructuredTasteProfile,
  key: keyof TasteProfileVector
): boolean {
  return typeof profile.overrides?.vector?.[key] === 'number';
}
