import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

import type { WineProfile } from './wineProfileService';
import { differenceFromTop, groundedPairingReasons, mealContextFor, mealDetailOptions } from './mealPairing';

function profile(p: Partial<WineProfile>): WineProfile {
  return {
    body: 3, tannin: 3, acidity: 3, oak: 2, sweetness: 0, alcohol_est: 13, power: 5,
    style_tags: [], confidence: 'high', source: 'ai', updated_at: '',
    sweetness_basis: 'profile', sweetness_level: 'dry',
    ...p,
  };
}

describe('mealContextFor', () => {
  it('returns null when the detail is skipped, so scoring is unchanged', () => {
    expect(mealContextFor('pasta', undefined)).toBeNull();
    expect(mealContextFor('pasta', '')).toBeNull();
    expect(mealContextFor(undefined, 'tomato')).toBeNull();
  });

  it('rejects details that do not belong to the meal', () => {
    expect(mealContextFor('steak', 'pesto')).toBeNull();
  });

  it('maps pasta details to distinct food profiles', () => {
    expect(mealContextFor('pasta', 'tomato')?.food.sauce).toBe('tomato');
    expect(mealContextFor('pasta', 'creamy')?.food.sauce).toBe('creamy');
    expect(mealContextFor('pasta', 'seafood')?.food.protein).toBe('fish');
  });

  it('offers follow-ups only for broad meals', () => {
    expect(mealDetailOptions('pasta').length).toBeGreaterThan(0);
    expect(mealDetailOptions('custom')).toEqual([]);
    expect(mealDetailOptions('')).toEqual([]);
  });
});

describe('groundedPairingReasons', () => {
  it('cites acidity for tomato only when the profile is real data', () => {
    const ctx = mealContextFor('pasta', 'tomato')!;
    expect(groundedPairingReasons(profile({ acidity: 4 }), ctx).map((r) => r.key)).toContain('tomatoAcidity');
    expect(groundedPairingReasons(profile({ acidity: 4, source: 'heuristic', sweetness_basis: 'unknown' }), ctx)).toEqual([]);
  });

  it('flags tannic reds with fish as a trade-off', () => {
    const ctx = mealContextFor('fish', 'white_fish')!;
    const reasons = groundedPairingReasons(profile({ tannin: 4, body: 4 }), ctx);
    expect(reasons).toEqual([{ key: 'fishTannin', tone: 'caution' }]);
  });

  it('credits sweetness with heat only when sweetness is known', () => {
    const ctx = mealContextFor('spicy_asian', 'fiery')!;
    const known = profile({ sweetness: 3, sweetness_basis: 'label', sweetness_level: 'medium_sweet', source: 'heuristic' });
    const unknown = profile({ sweetness: 1, sweetness_basis: 'unknown', sweetness_level: null, source: 'heuristic' });
    expect(groundedPairingReasons(known, ctx).map((r) => r.key)).toEqual(['spiceSweet']);
    expect(groundedPairingReasons(unknown, ctx)).toEqual([]);
  });
});

describe('differenceFromTop', () => {
  const top = { color: 'red', profile: profile({ body: 4 }), readiness: 'READY' as const, vintage: 2018 };

  it('prefers color, then body differences', () => {
    expect(differenceFromTop({ ...top, color: 'white' }, top)).toBe('otherColor');
    expect(differenceFromTop({ ...top, profile: profile({ body: 2 }) }, top)).toBe('lighter');
  });

  it('does not compare body when either profile is a heuristic guess', () => {
    const guess = profile({ body: 2, source: 'heuristic', sweetness_basis: 'unknown', sweetness_level: null });
    expect(differenceFromTop({ ...top, profile: guess }, top)).not.toBe('lighter');
  });

  it('falls back to vintage and then a neutral note', () => {
    expect(differenceFromTop({ ...top, vintage: 2010 }, top)).toBe('older');
    expect(differenceFromTop(top, top)).toBe('closeAlternative');
  });
});
