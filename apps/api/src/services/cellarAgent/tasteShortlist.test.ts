/**
 * Phase 1: structured taste_profile shortlist scoring tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scoreBottleHeuristically } from './heuristics.js';
import { shortlistCandidates } from './candidateSelection.js';
import { findSimilarCandidates } from './similarBottles.js';
import {
  parseStructuredTasteProfile,
  getEffectiveTasteVector,
  type StructuredTasteProfile,
} from './tasteProfileTypes.js';
import { loadUserTasteProfile } from './tasteProfileRepo.js';
import {
  detectRequestBodyPreference,
  TASTE_SHORTLIST_SCORING_VERSION,
  AGENT_MEMORY_WEIGHTS,
  TASTE_SHORTLIST_WEIGHTS,
} from './tasteScoring.js';
import type { CellarBottleInput, ExtractedConstraints } from './types.js';
import type { SommelierPreferenceMemory } from './sommelierTypes.js';
import type { TasteScoreContext } from './tasteScoring.js';

const emptyConstraints = (): ExtractedConstraints => ({
  requestedCount: null,
  colors: [],
  regionHints: [],
  grapeHints: [],
  foodKeywords: [],
  occasionKeywords: [],
  wantsSparkling: false,
  wantsChampagne: false,
  priceSort: null,
});

function fullBodiedRedLoverProfile(
  overrides?: Partial<StructuredTasteProfile>
): StructuredTasteProfile {
  return {
    version: 1,
    vector: {
      body: 0.85,
      tannin: 0.8,
      acidity: 0.45,
      oak: 0.7,
      sweetness: 0.1,
      power: 0.8,
    },
    preferences: {
      reds_bias: 0.9,
      whites_bias: -0.2,
      sparkling_bias: 0,
      style_tags: { structured: 0.8 },
      regions: { Bordeaux: 0.95, Napa: 0.7, Loire: -0.6 },
      grapes: { Cabernet: 0.9, Merlot: 0.5, 'Pinot Noir': -0.55 },
    },
    confidence: 'high',
    data_points: { rated_count: 20, last_rated_at: '2026-09-01T00:00:00.000Z' },
    ...overrides,
  };
}

const bordeauxCab: CellarBottleInput = {
  id: 'b-bordeaux',
  producer: 'Château Test',
  wineName: 'Grand Vin',
  region: 'Bordeaux',
  country: 'France',
  grapes: ['Cabernet Sauvignon', 'Merlot'],
  color: 'red',
  quantity: 2,
  readinessStatus: 'ready',
};

const pinotBurgundy: CellarBottleInput = {
  id: 'b-pinot',
  producer: 'Domaine Light',
  wineName: 'Village Pinot',
  region: 'Burgundy',
  country: 'France',
  grapes: ['Pinot Noir'],
  color: 'red',
  quantity: 2,
  readinessStatus: 'ready',
};

const loireCabFranc: CellarBottleInput = {
  id: 'b-loire',
  producer: 'Loire Co',
  wineName: 'Chinon',
  region: 'Loire',
  country: 'France',
  grapes: ['Cabernet Franc'],
  color: 'red',
  quantity: 1,
  readinessStatus: 'ready',
};

const whiteRiesling: CellarBottleInput = {
  id: 'b-riesling',
  producer: 'Mosel Haus',
  wineName: 'Kabinett',
  region: 'Mosel',
  country: 'Germany',
  grapes: ['Riesling'],
  color: 'white',
  quantity: 2,
  readinessStatus: 'ready',
};

describe('parseStructuredTasteProfile', () => {
  it('11: null / empty is a no-op parse', () => {
    expect(parseStructuredTasteProfile(null)).toBeNull();
    expect(parseStructuredTasteProfile(undefined)).toBeNull();
  });

  it('12: malformed / partial JSON degrades safely', () => {
    expect(parseStructuredTasteProfile('not-json')).toBeNull();
    expect(parseStructuredTasteProfile([])).toBeNull();
    const partial = parseStructuredTasteProfile({
      version: 1,
      vector: { body: 2, tannin: 'x', acidity: 0.4 },
      preferences: { regions: { Bordeaux: 5, '': 1 }, grapes: null },
      confidence: 'weird',
    });
    expect(partial).not.toBeNull();
    expect(partial!.vector.body).toBe(1); // clamped
    expect(partial!.vector.tannin).toBe(0.5); // fallback
    expect(partial!.preferences.regions.Bordeaux).toBe(1); // clamped
    expect(partial!.confidence).toBe('low');
  });

  it('13: unsupported profile version degrades safely', () => {
    expect(
      parseStructuredTasteProfile({
        version: 99,
        vector: { body: 0.9 },
        preferences: {},
      })
    ).toBeNull();
  });
});

describe('taste shortlist scoring', () => {
  const prevEnv = process.env.TASTE_SHORTLIST_SCORING;

  beforeEach(() => {
    process.env.TASTE_SHORTLIST_SCORING = '1';
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.TASTE_SHORTLIST_SCORING;
    else process.env.TASTE_SHORTLIST_SCORING = prevEnv;
  });

  function score(
    bottle: CellarBottleInput,
    opts: {
      message?: string;
      constraints?: ExtractedConstraints;
      memory?: SommelierPreferenceMemory | null;
      taste?: StructuredTasteProfile | null;
      recent?: Set<string> | null;
    } = {}
  ) {
    const message = opts.message ?? 'what should I open tonight?';
    const tasteCtx: TasteScoreContext | null = {
      tasteProfile: opts.taste ?? null,
      requestBodyPreference: detectRequestBodyPreference(message.toLowerCase()),
    };
    return scoreBottleHeuristically(
      bottle,
      opts.constraints ?? emptyConstraints(),
      message.toLowerCase(),
      opts.memory ?? null,
      opts.recent ?? null,
      tasteCtx
    );
  }

  it('1: favorite region increases matching candidate rank', () => {
    const profile = fullBodiedRedLoverProfile();
    const withTaste = score(bordeauxCab, { taste: profile });
    const without = score(bordeauxCab, { taste: null });
    expect(withTaste.score).toBeGreaterThan(without.score);
    expect(withTaste.features.some((f) => f.startsWith('taste_region:'))).toBe(true);
  });

  it('2: favorite grape increases matching candidate rank', () => {
    const profile = fullBodiedRedLoverProfile({
      preferences: {
        ...fullBodiedRedLoverProfile().preferences,
        regions: {},
      },
    });
    const withTaste = score(bordeauxCab, { taste: profile });
    const without = score(bordeauxCab, { taste: null });
    expect(withTaste.score).toBeGreaterThan(without.score);
    expect(withTaste.features.some((f) => f.startsWith('taste_grape:'))).toBe(true);
  });

  it('3: negative region/grape affinity modestly reduces ranking', () => {
    const regionOnlyNeg = fullBodiedRedLoverProfile({
      vector: {
        body: 0.5,
        tannin: 0.5,
        acidity: 0.5,
        oak: 0.5,
        sweetness: 0.2,
        power: 0.5,
      },
      preferences: {
        reds_bias: 0,
        whites_bias: 0,
        sparkling_bias: 0,
        style_tags: {},
        regions: { Loire: -0.9 },
        grapes: {},
      },
    });
    const loire = score(loireCabFranc, { taste: regionOnlyNeg });
    const baseline = score(loireCabFranc, { taste: null });
    expect(loire.score).toBeLessThan(baseline.score);
    expect(baseline.score - loire.score).toBeLessThanOrEqual(
      Math.abs(TASTE_SHORTLIST_WEIGHTS.regionNegativeMax) + 0.01
    );

    const grapeOnlyNeg = fullBodiedRedLoverProfile({
      vector: {
        body: 0.5,
        tannin: 0.5,
        acidity: 0.5,
        oak: 0.5,
        sweetness: 0.2,
        power: 0.5,
      },
      preferences: {
        reds_bias: 0,
        whites_bias: 0,
        sparkling_bias: 0,
        style_tags: {},
        regions: {},
        grapes: { 'Pinot Noir': -0.8 },
      },
    });
    const pinot = score(pinotBurgundy, { taste: grapeOnlyNeg });
    const pinotBase = score(pinotBurgundy, { taste: null });
    expect(pinot.score).toBeLessThan(pinotBase.score);
  });

  it('4: structural body preference boosts compatible grape styles', () => {
    const profile = fullBodiedRedLoverProfile({
      preferences: {
        reds_bias: 0,
        whites_bias: 0,
        sparkling_bias: 0,
        style_tags: {},
        regions: {},
        grapes: {},
      },
    });
    const cab = score(bordeauxCab, { taste: profile });
    const pinot = score(pinotBurgundy, { taste: profile });
    expect(cab.score).toBeGreaterThan(pinot.score);
    expect(cab.features.some((f) => f.includes('taste_body:full'))).toBe(true);
  });

  it('5: manual body override takes precedence over inferred body', () => {
    // Inferred is full-bodied, but override says light
    const profile = fullBodiedRedLoverProfile({
      overrides: { vector: { body: 0.15 } },
      preferences: {
        reds_bias: 0,
        whites_bias: 0,
        sparkling_bias: 0,
        style_tags: {},
        regions: {},
        grapes: {},
      },
    });
    const pinot = score(pinotBurgundy, { taste: profile });
    const cab = score(bordeauxCab, { taste: profile });
    expect(pinot.features.some((f) => f.startsWith('taste_override_body:light'))).toBe(
      true
    );
    expect(cab.features.some((f) => f.includes('taste_body:full'))).toBe(false);
    expect(cab.features.some((f) => f.includes('taste_override_body:full'))).toBe(false);
    expect(pinot.score).toBeGreaterThan(cab.score - 1); // pinot gets light boost
  });

  it('6: explicit request for light wine outranks stable full-body preference', () => {
    const profile = fullBodiedRedLoverProfile({
      preferences: {
        reds_bias: 0,
        whites_bias: 0,
        sparkling_bias: 0,
        style_tags: {},
        regions: {},
        grapes: {},
      },
    });
    const msg = 'something lighter tonight please';
    const pinot = score(pinotBurgundy, { taste: profile, message: msg });
    const cab = score(bordeauxCab, { taste: profile, message: msg });
    expect(pinot.features).toContain('request_body:light');
    expect(cab.features.some((f) => f.includes('taste_body:full'))).toBe(false);
    expect(pinot.score).toBeGreaterThan(cab.score);
  });

  it('7: explicit color/region/grape request is not overridden by the profile', () => {
    const profile = fullBodiedRedLoverProfile();
    const constraints: ExtractedConstraints = {
      ...emptyConstraints(),
      colors: ['white'],
      regionHints: ['mosel'],
      grapeHints: ['riesling'],
    };
    const white = score(whiteRiesling, {
      taste: profile,
      constraints,
      message: 'a white riesling from mosel',
    });
    const red = score(bordeauxCab, {
      taste: profile,
      constraints,
      message: 'a white riesling from mosel',
    });
    // Constraint matches (+22 color +12 region +12 grape) dwarf taste region boost (~6)
    expect(white.score).toBeGreaterThan(red.score);
    expect(white.features).toContain('color_match');
  });

  it('8+9: overlapping agent memory region does not double-count; memory wins', () => {
    const regionOnlyProfile = fullBodiedRedLoverProfile({
      vector: {
        body: 0.5,
        tannin: 0.5,
        acidity: 0.5,
        oak: 0.5,
        sweetness: 0.2,
        power: 0.5,
      },
      preferences: {
        reds_bias: 0,
        whites_bias: 0,
        sparkling_bias: 0,
        style_tags: {},
        regions: { Bordeaux: 0.95 },
        grapes: {},
      },
    });
    const memory: SommelierPreferenceMemory = {
      version: 1,
      favoriteRegions: ['bordeaux'],
    };
    const both = score(bordeauxCab, { taste: regionOnlyProfile, memory });
    const memOnly = score(bordeauxCab, { taste: null, memory });
    // Same memory bonus; taste region must not add on top
    expect(both.features).toContain('agent_memory_region');
    expect(both.features.some((f) => f.startsWith('taste_region:'))).toBe(false);
    expect(Math.abs(both.score - memOnly.score)).toBeLessThan(0.2);
    // Memory weight is larger than taste region max
    expect(AGENT_MEMORY_WEIGHTS.region).toBeGreaterThan(
      TASTE_SHORTLIST_WEIGHTS.regionPositiveMax
    );
  });

  it('memory light body globally suppresses taste full-body on unmatched bottles', () => {
    const profile = fullBodiedRedLoverProfile({
      preferences: {
        reds_bias: 0,
        whites_bias: 0,
        sparkling_bias: 0,
        style_tags: {},
        regions: {},
        grapes: {},
      },
    });
    const memory: SommelierPreferenceMemory = { version: 1, bodyPreference: 'light' };
    const cab = score(bordeauxCab, { taste: profile, memory });
    const pinot = score(pinotBurgundy, { taste: profile, memory });
    expect(cab.features.some((f) => f.startsWith('taste_body:'))).toBe(false);
    expect(cab.features.some((f) => f.startsWith('taste_override_body:'))).toBe(false);
    expect(cab.features).toContain('taste_body_suppressed_by_memory');
    expect(cab.features).toContain('body_source:agent_memory_owns_dimension');
    expect(pinot.features).toContain('body_source:agent_memory');
    expect(pinot.score).toBeGreaterThan(cab.score);
  });

  it('10: low-confidence profile has less influence than high-confidence', () => {
    const high = fullBodiedRedLoverProfile({ confidence: 'high' });
    const low = fullBodiedRedLoverProfile({ confidence: 'low' });
    const base = score(bordeauxCab, { taste: null }).score;
    const highDelta = score(bordeauxCab, { taste: high }).score - base;
    const lowDelta = score(bordeauxCab, { taste: low }).score - base;
    expect(highDelta).toBeGreaterThan(lowDelta);
  });

  it('11: empty/null profile is a no-op vs baseline heuristics', () => {
    const a = score(bordeauxCab, { taste: null });
    const b = score(bordeauxCab, { taste: null, memory: null });
    expect(a.score).toBe(b.score);
    expect(a.features.some((f) => f.startsWith('taste_'))).toBe(false);
  });

  it('kill-switch disables taste boosts', () => {
    process.env.TASTE_SHORTLIST_SCORING = '0';
    const profile = fullBodiedRedLoverProfile();
    const withTaste = score(bordeauxCab, { taste: profile });
    const without = score(bordeauxCab, { taste: null });
    expect(withTaste.score).toBe(without.score);
  });

  it('14: reserved-wine exclusion remains unchanged', () => {
    const reserved = { ...bordeauxCab, id: 'reserved', isReserved: true };
    const pool = [reserved, pinotBurgundy];
    const { scored, reservedExcluded } = shortlistCandidates(
      pool,
      emptyConstraints(),
      'tonight',
      null,
      null,
      false,
      { tasteProfile: fullBodiedRedLoverProfile(), requestBodyPreference: null }
    );
    expect(reservedExcluded).toBe(1);
    expect(scored.every((s) => s.bottle.id !== 'reserved')).toBe(true);
  });

  it('15: diversity / recent-recommendation penalty remains active', () => {
    const recent = new Set([bordeauxCab.id]);
    const penalized = score(bordeauxCab, {
      taste: fullBodiedRedLoverProfile(),
      recent,
    });
    expect(penalized.features).toContain('recently_recommended');
    const clear = score(bordeauxCab, { taste: fullBodiedRedLoverProfile() });
    expect(clear.score - penalized.score).toBeCloseTo(12, 5);
  });

  it('16: similar recommendations use taste signals and exclude reserved by default', () => {
    const bottles = [
      bordeauxCab,
      pinotBurgundy,
      loireCabFranc,
      { ...bordeauxCab, id: 'reserved-bdx', isReserved: true },
    ];
    const scored = findSimilarCandidates(
      pinotBurgundy.id,
      bottles,
      emptyConstraints(),
      'what else like this?',
      null,
      5,
      { tasteProfile: fullBodiedRedLoverProfile(), requestBodyPreference: null },
      false
    );
    expect(scored.length).toBeGreaterThan(0);
    expect(scored.every((s) => s.bottle.id !== 'reserved-bdx')).toBe(true);
    const bordeaux = scored.find((s) => s.bottle.id === bordeauxCab.id);
    expect(bordeaux?.features.some((f) => f.startsWith('taste_'))).toBe(true);
  });

  it('16b: similar recommendations include reserved when explicitly requested', () => {
    const bottles = [
      pinotBurgundy,
      { ...bordeauxCab, id: 'reserved-bdx', isReserved: true, readinessStatus: 'peak' },
    ];
    const scored = findSimilarCandidates(
      pinotBurgundy.id,
      bottles,
      emptyConstraints(),
      'what else like this include reserved',
      null,
      5,
      { tasteProfile: fullBodiedRedLoverProfile(), requestBodyPreference: null },
      true
    );
    expect(scored.some((s) => s.bottle.id === 'reserved-bdx')).toBe(true);
  });

  it('scoring version constant is stable for observability', () => {
    expect(TASTE_SHORTLIST_SCORING_VERSION).toBe('taste_shortlist_v1');
  });
});

describe('loadUserTasteProfile security', () => {
  it('17: queries only the provided userId (cannot load another user via helper args)', async () => {
    const calls: { table?: string; eq?: unknown[] }[] = [];
    const fakeSupabase = {
      from(table: string) {
        calls.push({ table });
        return {
          select() {
            return {
              eq(col: string, val: string) {
                calls.push({ eq: [col, val] });
                return {
                  async maybeSingle() {
                    return { data: { taste_profile: null }, error: null };
                  },
                };
              },
            };
          },
        };
      },
    };

    const userId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    await loadUserTasteProfile(userId, fakeSupabase as never);
    expect(calls.some((c) => c.table === 'profiles')).toBe(true);
    expect(calls.some((c) => c.eq?.[0] === 'id' && c.eq?.[1] === userId)).toBe(true);
    // Helper has no parameter to pass another user's profile JSON
    expect(loadUserTasteProfile.length).toBe(2);
  });
});

describe('detectRequestBodyPreference', () => {
  it('detects light and full asks', () => {
    expect(detectRequestBodyPreference('something lighter please')).toBe('light');
    expect(detectRequestBodyPreference('a bold fuller-bodied red')).toBe('full');
    expect(detectRequestBodyPreference('what for steak tonight')).toBeNull();
  });
});

describe('getEffectiveTasteVector', () => {
  it('blends overrides without mutating inputs', () => {
    const p = fullBodiedRedLoverProfile({
      confidence: 'low',
      overrides: { vector: { body: 0.1 } },
    });
    const snap = structuredClone(p);
    const v = getEffectiveTasteVector(p);
    expect(v.body).toBeLessThan(p.vector.body);
    expect(p).toEqual(snap);
  });
});
