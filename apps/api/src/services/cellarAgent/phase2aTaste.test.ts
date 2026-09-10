/**
 * Phase 2A: preference extraction + kill-switch + scoring precedence tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  extractPreferenceEvidence,
  buildIdempotencyKey,
} from './preferenceExtractRules.js';
import {
  isCanonicalTasteWritesEnabled,
  preferenceAckMessage,
} from './canonicalTasteWrite.js';
import { parseStructuredTasteProfile } from './tasteProfileTypes.js';
import {
  applyPreferenceScores,
  EXPLICIT_PREFERENCE_WEIGHTS,
  AGENT_MEMORY_WEIGHTS,
  type TasteScoreContext,
} from './tasteScoring.js';
import type { CellarBottleInput } from './types.js';
import type { SommelierPreferenceMemory } from './sommelierTypes.js';

const riojaBottle: CellarBottleInput = {
  id: 'rioja-1',
  producer: 'Lopez',
  wineName: 'Crianza',
  region: 'Rioja',
  country: 'Spain',
  grapes: ['Tempranillo'],
  color: 'red',
  quantity: 1,
  readinessStatus: 'ready',
};

const cabBottle: CellarBottleInput = {
  id: 'cab-1',
  producer: 'Napa Cellars',
  wineName: 'Cabernet',
  region: 'Napa',
  country: 'USA',
  grapes: ['Cabernet Sauvignon'],
  color: 'red',
  quantity: 1,
  readinessStatus: 'ready',
};

const pinotBottle: CellarBottleInput = {
  id: 'pinot-1',
  producer: 'Burgundy',
  wineName: 'Village',
  region: 'Burgundy',
  country: 'France',
  grapes: ['Pinot Noir'],
  color: 'red',
  quantity: 1,
  readinessStatus: 'ready',
};

describe('preferenceExtractRules Phase 2A', () => {
  it('8: HE/EN remember normalize identically for Rioja', () => {
    const en = extractPreferenceEvidence('Remember that I like Rioja');
    const he = extractPreferenceEvidence('תזכור שאני אוהב ריוחה');
    expect(en?.class).toBe('stable_remember');
    expect(he?.class).toBe('stable_remember');
    expect(en?.valueId).toBe('rioja');
    expect(he?.valueId).toBe('rioja');
    expect(en?.applyCanonical).toBe(true);
    expect(he?.applyCanonical).toBe(true);
  });

  it('9: explicit stable remember applies when enabled (flag on candidate)', () => {
    const c = extractPreferenceEvidence('Please remember I prefer full-bodied wines');
    expect(c?.class).toBe('stable_remember');
    expect(c?.dimension).toBe('body');
    expect(c?.valueId).toBe('full');
    expect(c?.applyCanonical).toBe(true);
  });

  it('10: general I like Rioja creates no canonical mutation flag', () => {
    const c = extractPreferenceEvidence('I like Rioja');
    expect(c?.class).toBe('stable_general');
    expect(c?.applyCanonical).toBe(false);
    expect(c?.scope).toBe('stable_candidate');
  });

  it('11: Tonight I prefer light is session-only', () => {
    const c = extractPreferenceEvidence('Tonight I prefer light wine');
    expect(c?.class).toBe('session');
    expect(c?.applyCanonical).toBe(false);
    expect(c?.scope).toBe('session');
  });

  it('12: Hebrew evening prefer light is session-only', () => {
    const c = extractPreferenceEvidence('הערב בא לי יין קל');
    expect(c?.class).toBe('session');
    expect(c?.applyCanonical).toBe(false);
  });

  it('13: bottle too heavy is evidence-only', () => {
    const c = extractPreferenceEvidence('This bottle was too heavy');
    expect(c?.class).toBe('bottle');
    expect(c?.applyCanonical).toBe(false);
  });

  it('14: negation classified as dislike without canonical', () => {
    const c = extractPreferenceEvidence("I don't like Bordeaux");
    expect(c?.polarity).toBe('dislike');
    expect(c?.applyCanonical).toBe(false);
  });

  it('15: ambiguous statements do not mutate', () => {
    const c = extractPreferenceEvidence('Interesting wine');
    expect(c).toBeNull();
  });

  it('16: unknown terms do not mutate', () => {
    const c = extractPreferenceEvidence('Remember that I like XYZUnknownRegion');
    expect(c?.class).toBe('ambiguous');
    expect(c?.applyCanonical).toBe(false);
  });

  it('17: contradiction/retraction do not mutate in 2A', () => {
    const forget = extractPreferenceEvidence('Forget that I like Rioja');
    expect(forget?.class).toBe('retraction');
    expect(forget?.applyCanonical).toBe(false);
    expect(forget?.status).toBe('pending_unsupported');
  });

  it('idempotency key is stable for same message', () => {
    const c = extractPreferenceEvidence('Remember that I like Rioja')!;
    const a = buildIdempotencyKey({ userId: 'u1', message: 'Remember that I like Rioja', candidate: c });
    const b = buildIdempotencyKey({ userId: 'u1', message: 'Remember that I like Rioja', candidate: c });
    expect(a).toBe(b);
  });
});

describe('CANONICAL_TASTE_WRITES kill switch', () => {
  const prev = process.env.CANONICAL_TASTE_WRITES;

  afterEach(() => {
    if (prev === undefined) delete process.env.CANONICAL_TASTE_WRITES;
    else process.env.CANONICAL_TASTE_WRITES = prev;
  });

  it('32: missing/invalid value is OFF', () => {
    delete process.env.CANONICAL_TASTE_WRITES;
    expect(isCanonicalTasteWritesEnabled()).toBe(false);
    process.env.CANONICAL_TASTE_WRITES = '';
    expect(isCanonicalTasteWritesEnabled()).toBe(false);
    process.env.CANONICAL_TASTE_WRITES = 'maybe';
    expect(isCanonicalTasteWritesEnabled()).toBe(false);
    process.env.CANONICAL_TASTE_WRITES = '0';
    expect(isCanonicalTasteWritesEnabled()).toBe(false);
    process.env.CANONICAL_TASTE_WRITES = 'false';
    expect(isCanonicalTasteWritesEnabled()).toBe(false);
  });

  it('34: ON permits eligible writes', () => {
    process.env.CANONICAL_TASTE_WRITES = '1';
    expect(isCanonicalTasteWritesEnabled()).toBe(true);
    process.env.CANONICAL_TASTE_WRITES = 'true';
    expect(isCanonicalTasteWritesEnabled()).toBe(true);
    process.env.CANONICAL_TASTE_WRITES = 'on';
    expect(isCanonicalTasteWritesEnabled()).toBe(true);
  });

  it('35: OFF/ON acks do not falsely claim wrong state', () => {
    const c = extractPreferenceEvidence('Remember that I like Rioja')!;
    const offAck = preferenceAckMessage('remember_disabled', c, 'en');
    const onAck = preferenceAckMessage('remember_saved', c, 'en');
    expect(offAck).not.toMatch(/I'll remember that you prefer/i);
    expect(onAck).toMatch(/I'll remember that you prefer/i);
    expect(preferenceAckMessage('remember_saved', c, 'he')).toMatch(/אזכור/);
  });
});

describe('explicit scoring precedence Phase 2A', () => {
  const prev = process.env.TASTE_SHORTLIST_SCORING;
  beforeEach(() => {
    process.env.TASTE_SHORTLIST_SCORING = '1';
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.TASTE_SHORTLIST_SCORING;
    else process.env.TASTE_SHORTLIST_SCORING = prev;
  });

  function ctx(explicit: NonNullable<ReturnType<typeof parseStructuredTasteProfile>>['explicit']): TasteScoreContext {
    return {
      tasteProfile: {
        version: 2,
        vector: { body: 0.5, tannin: 0.5, acidity: 0.5, oak: 0.5, sweetness: 0.2, power: 0.5 },
        preferences: {
          reds_bias: 0,
          whites_bias: 0,
          sparkling_bias: 0,
          style_tags: {},
          regions: { Bordeaux: 0.9 },
          grapes: { Cabernet: 0.9 },
        },
        explicit: explicit ?? undefined,
        confidence: 'high',
        data_points: { rated_count: 5, last_rated_at: null },
      },
      requestBodyPreference: null,
    };
  }

  it('18/19: v1 readable; v2 with explicit parses', () => {
    const v1 = parseStructuredTasteProfile({
      version: 1,
      vector: { body: 0.5 },
      preferences: {},
    });
    expect(v1?.version).toBe(1);
    expect(v1?.explicit).toBeUndefined();

    const v2 = parseStructuredTasteProfile({
      version: 2,
      vector: { body: 0.5 },
      preferences: {},
      explicit: {
        regions_liked: [{ id: 'rioja', confidence: 0.9 }],
        regions_disliked: [],
        grapes_liked: [],
        grapes_disliked: [],
        styles_liked: [],
        styles_disliked: [],
        body: null,
      },
    });
    expect(v2?.version).toBe(2);
    expect(v2?.explicit?.regions_liked[0]?.id).toBe('rioja');
  });

  it('21: future unknown version cannot be scored as write-safe read', () => {
    expect(parseStructuredTasteProfile({ version: 99, vector: {}, preferences: {} })).toBeNull();
  });

  it('23: explicit region/grape/body affects shortlist', () => {
    const features: string[] = [];
    const r = applyPreferenceScores(
      riojaBottle,
      null,
      ctx({
        regions_liked: [{ id: 'rioja', confidence: 0.9 }],
        regions_disliked: [],
        grapes_liked: [],
        grapes_disliked: [],
        styles_liked: [],
        styles_disliked: [],
        body: { value: 'full', confidence: 0.9 },
      }),
      features
    );
    expect(r.features).toContain('explicit_preference_region');
    expect(r.score).toBeGreaterThanOrEqual(EXPLICIT_PREFERENCE_WEIGHTS.region);

    const bodyFeatures: string[] = [];
    const body = applyPreferenceScores(
      cabBottle,
      null,
      ctx({
        regions_liked: [],
        regions_disliked: [],
        grapes_liked: [],
        grapes_disliked: [],
        styles_liked: [],
        styles_disliked: [],
        body: { value: 'full', confidence: 0.9 },
      }),
      bodyFeatures
    );
    expect(body.features).toContain('explicit_body:full');
  });

  it('24: explicit blocks overlapping legacy memory/taste bonuses', () => {
    const memory: SommelierPreferenceMemory = {
      version: 1,
      favoriteRegions: ['rioja'],
    };
    const features: string[] = [];
    const r = applyPreferenceScores(
      riojaBottle,
      memory,
      ctx({
        regions_liked: [{ id: 'rioja', confidence: 0.9 }],
        regions_disliked: [],
        grapes_liked: [],
        grapes_disliked: [],
        styles_liked: [],
        styles_disliked: [],
        body: null,
      }),
      features
    );
    expect(r.features).toContain('explicit_preference_region');
    expect(r.features).not.toContain('agent_memory_region');
    expect(r.features.some((f) => f.startsWith('taste_region:'))).toBe(false);
    expect(EXPLICIT_PREFERENCE_WEIGHTS.region).toBeGreaterThan(AGENT_MEMORY_WEIGHTS.region - 1);
  });

  it('25: current request beats explicit body', () => {
    const features: string[] = [];
    const r = applyPreferenceScores(
      pinotBottle,
      null,
      {
        ...ctx({
          regions_liked: [],
          regions_disliked: [],
          grapes_liked: [],
          grapes_disliked: [],
          styles_liked: [],
          styles_disliked: [],
          body: { value: 'full', confidence: 0.9 },
        }),
        requestBodyPreference: 'light',
      },
      features
    );
    expect(r.features).toContain('body_source:request');
    expect(r.features).not.toContain('explicit_body:full');
    expect(r.features).toContain('request_body:light');
  });
});
