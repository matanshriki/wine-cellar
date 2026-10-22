import { describe, it, expect } from 'vitest';
import { getVivinoRating, parseVivinoRating, vivinoRatingOrZero } from './wineRating';

describe('parseVivinoRating', () => {
  it('accepts finite scores in (0, 5]', () => {
    expect(parseVivinoRating(4.2)).toBe(4.2);
    expect(parseVivinoRating(5)).toBe(5);
    expect(parseVivinoRating('3.9')).toBe(3.9);
  });

  it('rejects null, zero, empty, NaN, out-of-range, and invalid strings', () => {
    expect(parseVivinoRating(null)).toBeNull();
    expect(parseVivinoRating(undefined)).toBeNull();
    expect(parseVivinoRating('')).toBeNull();
    expect(parseVivinoRating(0)).toBeNull();
    expect(parseVivinoRating(-1)).toBeNull();
    expect(parseVivinoRating(5.1)).toBeNull();
    expect(parseVivinoRating(Number.NaN)).toBeNull();
    expect(parseVivinoRating('abc')).toBeNull();
    expect(parseVivinoRating({})).toBeNull();
  });
});

describe('getVivinoRating', () => {
  it('reads canonical wines.rating (community / Vivino), not a personal score', () => {
    expect(getVivinoRating({ rating: 4.5 })).toBe(4.5);
  });

  it('falls back to phantom vivino_rating only when rating is absent', () => {
    expect(getVivinoRating({ vivino_rating: 4.2 })).toBe(4.2);
    expect(getVivinoRating({ rating: null, vivino_rating: 4.1 })).toBe(4.1);
  });

  it('prefers canonical rating when both conflict', () => {
    expect(getVivinoRating({ rating: 4.5, vivino_rating: 4.0 })).toBe(4.5);
  });

  it('vivinoRatingOrZero never invents a positive score', () => {
    expect(vivinoRatingOrZero(null)).toBe(0);
    expect(vivinoRatingOrZero({ rating: 0 })).toBe(0);
    expect(vivinoRatingOrZero({ rating: 4.2 })).toBe(4.2);
  });
});
