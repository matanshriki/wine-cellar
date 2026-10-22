import { describe, it, expect } from 'vitest';
import {
  hasDrinkWindowAnalysis,
  matchesReadinessChip,
} from './cellarReadinessFilters';
import {
  categorizeBottles,
  computeTonightSignal,
  DEFAULT_RATING_THRESHOLD,
} from './drinkWindowInsights';

// Re-export check — threshold must stay local to the signal, not Orbit.
describe('DEFAULT_RATING_THRESHOLD', () => {
  it('is 4.2 for Perfect-for-tonight only', () => {
    expect(DEFAULT_RATING_THRESHOLD).toBe(4.2);
  });
});

describe('matchesReadinessChip (aligned with Drink Window counts)', () => {
  it('matches READY / PEAK_SOON / HOLD by readiness_label only', () => {
    expect(matchesReadinessChip({ readiness_label: 'READY' }, 'ready')).toBe(true);
    expect(matchesReadinessChip({ readiness_label: 'PEAK_SOON' }, 'peakSoon')).toBe(true);
    expect(matchesReadinessChip({ readiness_label: 'HOLD' }, 'aging')).toBe(true);
  });

  it('does not match legacy status alone when label is missing', () => {
    expect(
      matchesReadinessChip({ readiness_status: 'InWindow', readiness_label: null }, 'ready'),
    ).toBe(false);
    expect(
      matchesReadinessChip({ readiness_status: 'Approaching', readiness_label: undefined }, 'peakSoon'),
    ).toBe(false);
    expect(
      matchesReadinessChip({ readiness_status: 'TooYoung' }, 'aging'),
    ).toBe(false);
  });

  it('when label and status disagree, label wins', () => {
    expect(
      matchesReadinessChip(
        { readiness_status: 'TooYoung', readiness_label: 'READY' },
        'ready',
      ),
    ).toBe(true);
    expect(
      matchesReadinessChip(
        { readiness_status: 'InWindow', readiness_label: 'HOLD' },
        'ready',
      ),
    ).toBe(false);
    expect(
      matchesReadinessChip(
        { readiness_status: 'InWindow', readiness_label: 'HOLD' },
        'aging',
      ),
    ).toBe(true);
  });

  it('pastPeak still uses legacy status', () => {
    expect(matchesReadinessChip({ readiness_status: 'PastPeak' }, 'pastPeak')).toBe(true);
    expect(matchesReadinessChip({ readiness_label: 'READY' }, 'pastPeak')).toBe(false);
  });
});

describe('hasDrinkWindowAnalysis / count consistency', () => {
  it('counts only labeled HOLD|PEAK_SOON|READY rows', () => {
    expect(hasDrinkWindowAnalysis({ readiness_label: 'READY' })).toBe(true);
    expect(hasDrinkWindowAnalysis({ readiness_label: 'HOLD' })).toBe(true);
    expect(hasDrinkWindowAnalysis({ readiness_status: 'InWindow' })).toBe(false);
    expect(hasDrinkWindowAnalysis({ readiness_label: null })).toBe(false);
  });

  it('bucket counts match chip filters for the same pool', () => {
    const bottles = [
      { id: '1', quantity: 2, readiness_label: 'READY', readiness_status: 'InWindow' },
      { id: '2', quantity: 1, readiness_label: 'READY', readiness_status: 'Peak' },
      { id: '3', quantity: 3, readiness_label: 'HOLD', readiness_status: 'TooYoung' },
      { id: '4', quantity: 1, readiness_label: null, readiness_status: 'InWindow' }, // status-only
      { id: '5', quantity: 1, readiness_label: 'PEAK_SOON', readiness_status: 'Approaching' },
    ] as any[];

    const cats = categorizeBottles(bottles);
    expect(cats.READY).toHaveLength(2);
    expect(cats.HOLD).toHaveLength(1);
    expect(cats.PEAK_SOON).toHaveLength(1);
    // Multi-quantity still counts as one wine row
    expect(cats.READY.every((b) => matchesReadinessChip(b, 'ready'))).toBe(true);
    expect(bottles.filter((b) => matchesReadinessChip(b, 'ready'))).toHaveLength(cats.READY.length);
    expect(bottles.filter((b) => matchesReadinessChip(b, 'aging'))).toHaveLength(cats.HOLD.length);
    expect(bottles.filter((b) => matchesReadinessChip(b, 'peakSoon'))).toHaveLength(
      cats.PEAK_SOON.length,
    );
    // Status-only InWindow is not in READY count or ready chip
    expect(matchesReadinessChip(bottles[3], 'ready')).toBe(false);
  });
});

describe('computeTonightSignal (Perfect for tonight)', () => {
  it('requires READY label and Vivino rating ≥ 4.2; 4.1 / null / 0 excluded', () => {
    const ready = [
      { wine: { rating: 4.2 } },
      { wine: { rating: 4.1 } },
      { wine: { vivino_rating: 4.5 } }, // phantom alias only — still counts
      { wine: { rating: 3.9 } },
      { wine: { rating: null } },
      { wine: { rating: 0 } },
      { wine: { rating: '4.3' } },
      { wine: { rating: 'nope' } },
    ] as any[];
    const signal = computeTonightSignal(ready);
    expect(signal.threshold).toBe(4.2);
    expect(signal.count).toBe(3); // 4.2, phantom 4.5, string 4.3
  });

  it('prefers canonical wines.rating over phantom vivino_rating when they conflict', () => {
    // rating 4.5 wins → included; if phantom won (4.0) it would be excluded
    expect(computeTonightSignal([{ wine: { vivino_rating: 4.0, rating: 4.5 } }] as any[]).count).toBe(1);
    expect(computeTonightSignal([{ wine: { vivino_rating: 4.5, rating: 4.0 } }] as any[]).count).toBe(0);
  });
});
