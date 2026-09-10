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

/** Normalized structured profile used for scoring (version 1–2). */
export interface ExplicitPreferenceValue {
  id: string;
  confidence: number;
  updated_at?: string;
  source?: string;
  evidence_event_ids?: string[];
  label_en?: string;
  label_he?: string;
}

export interface ExplicitBodyPreference {
  value: 'light' | 'medium' | 'full';
  confidence: number;
  updated_at?: string;
  source?: string;
  evidence_event_ids?: string[];
}

export interface ExplicitTastePreferences {
  regions_liked: ExplicitPreferenceValue[];
  regions_disliked: ExplicitPreferenceValue[];
  grapes_liked: ExplicitPreferenceValue[];
  grapes_disliked: ExplicitPreferenceValue[];
  styles_liked: ExplicitPreferenceValue[];
  styles_disliked: ExplicitPreferenceValue[];
  body: ExplicitBodyPreference | null;
  updated_at?: string;
  /**
   * Phase 2B.1: after forget/remove, suppress stale legacy memory for these
   * dimensions/ids even if dual-write cleanup fails.
   */
  legacy_suppress?: {
    regions?: string[];
    grapes?: string[];
    body?: boolean;
  };
}

export interface StructuredTasteProfile {
  version: number;
  vector: TasteProfileVector;
  preferences: TasteProfilePreferences;
  overrides?: { vector?: Partial<TasteProfileVector> };
  explicit?: ExplicitTastePreferences;
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
 * Accepts document versions 1 and 2; rejects unknown future versions (>2).
 */
export function parseStructuredTasteProfile(raw: unknown): StructuredTasteProfile | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;

  const o = raw as Record<string, unknown>;
  const version = asNumber(o.version);
  if (version !== null && version > 2) return null;
  if (version !== null && version < 1) return null;
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

  const explicit = parseExplicit(o.explicit);
  const resolvedVersion = explicit ? Math.max(version ?? 1, 2) : version ?? 1;

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
    version: resolvedVersion,
    vector,
    preferences,
    ...(overrides ? { overrides } : {}),
    ...(explicit ? { explicit } : {}),
    confidence,
    data_points: { rated_count, last_rated_at },
  };
}

function parseExplicitTermList(raw: unknown): ExplicitPreferenceValue[] {
  if (!Array.isArray(raw)) return [];
  const out: ExplicitPreferenceValue[] = [];
  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.toLowerCase().trim() : '';
    if (!id || id.length > 64) continue;
    const confidence = clamp01(asNumber(o.confidence) ?? 0.5);
    out.push({
      id,
      confidence,
      updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined,
      source: typeof o.source === 'string' ? o.source : undefined,
      label_en: typeof o.label_en === 'string' ? o.label_en : undefined,
      label_he: typeof o.label_he === 'string' ? o.label_he : undefined,
    });
  }
  return out;
}

function parseExplicit(raw: unknown): ExplicitTastePreferences | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  let body: ExplicitBodyPreference | null = null;
  if (o.body && typeof o.body === 'object' && !Array.isArray(o.body)) {
    const b = o.body as Record<string, unknown>;
    const value = typeof b.value === 'string' ? b.value.toLowerCase() : '';
    if (value === 'light' || value === 'medium' || value === 'full') {
      body = {
        value,
        confidence: clamp01(asNumber(b.confidence) ?? 0.5),
        updated_at: typeof b.updated_at === 'string' ? b.updated_at : undefined,
        source: typeof b.source === 'string' ? b.source : undefined,
      };
    }
  }
  const explicit: ExplicitTastePreferences = {
    regions_liked: parseExplicitTermList(o.regions_liked),
    regions_disliked: parseExplicitTermList(o.regions_disliked),
    grapes_liked: parseExplicitTermList(o.grapes_liked),
    grapes_disliked: parseExplicitTermList(o.grapes_disliked),
    styles_liked: parseExplicitTermList(o.styles_liked),
    styles_disliked: parseExplicitTermList(o.styles_disliked),
    body,
    updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined,
  };
  if (o.legacy_suppress && typeof o.legacy_suppress === 'object' && !Array.isArray(o.legacy_suppress)) {
    const ls = o.legacy_suppress as Record<string, unknown>;
    const regions = Array.isArray(ls.regions)
      ? ls.regions.filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase())
      : undefined;
    const grapes = Array.isArray(ls.grapes)
      ? ls.grapes.filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase())
      : undefined;
    const bodySuppress = ls.body === true;
    if ((regions && regions.length) || (grapes && grapes.length) || bodySuppress) {
      explicit.legacy_suppress = {
        ...(regions && regions.length ? { regions } : {}),
        ...(grapes && grapes.length ? { grapes } : {}),
        ...(bodySuppress ? { body: true } : {}),
      };
    }
  }
  const any =
    explicit.regions_liked.length +
      explicit.regions_disliked.length +
      explicit.grapes_liked.length +
      explicit.grapes_disliked.length +
      explicit.styles_liked.length +
      explicit.styles_disliked.length >
      0 ||
    explicit.body != null ||
    !!explicit.legacy_suppress;
  return any ? explicit : undefined;
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
