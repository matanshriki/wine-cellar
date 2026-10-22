import { describe, it, expect } from 'vitest';
import { describeBarrelAging } from './barrelAging';

describe('describeBarrelAging', () => {
  it('returns null when there is no barrel data', () => {
    expect(describeBarrelAging({})).toBeNull();
    expect(describeBarrelAging({ barrel_aging_note: '  ', barrel_aging_months_est: null })).toBeNull();
  });

  it('treats missing metadata as a medium-confidence estimate from general knowledge', () => {
    expect(describeBarrelAging({ barrel_aging_months_est: 12 })).toEqual({
      status: 'estimate',
      confidence: 'medium',
      source: null,
      note: null,
      months: 12,
    });
  });

  it('only marks verified when not estimated and high confidence', () => {
    const base = { barrel_aging_note: 'Aged in French oak' };
    expect(
      describeBarrelAging({ ...base, barrel_aging_metadata: { is_estimated: false, confidence: 'high', source: 'Producer tech sheet' } })?.status,
    ).toBe('verified');
    expect(
      describeBarrelAging({ ...base, barrel_aging_metadata: { is_estimated: false, confidence: 'medium', source: 'Producer tech sheet' } })?.status,
    ).toBe('estimate');
    expect(
      describeBarrelAging({ ...base, barrel_aging_metadata: { is_estimated: true, confidence: 'high', source: 'Producer tech sheet' } })?.status,
    ).toBe('estimate');
  });

  it('keeps a specific source and hides the generic AI source', () => {
    expect(
      describeBarrelAging({ barrel_aging_note: 'x', barrel_aging_metadata: { is_estimated: true, confidence: 'low', source: 'AI general knowledge' } })?.source,
    ).toBeNull();
    expect(
      describeBarrelAging({ barrel_aging_note: 'x', barrel_aging_metadata: { is_estimated: true, confidence: 'low', source: 'Winery website' } })?.source,
    ).toBe('Winery website');
    for (const generic of ['regional style norm', 'Regional norms', 'Typical practice for Barolo', 'General wine knowledge']) {
      expect(
        describeBarrelAging({ barrel_aging_note: 'x', barrel_aging_metadata: { is_estimated: true, confidence: 'medium', source: generic } })?.source,
      ).toBeNull();
    }
    expect(
      describeBarrelAging({ barrel_aging_note: 'x', barrel_aging_metadata: { is_estimated: false, confidence: 'high', source: 'Producer technical sheet' } })?.source,
    ).toBe('Producer technical sheet');
  });

  it('does not repeat months already stated in the note (EN and HE)', () => {
    expect(describeBarrelAging({ barrel_aging_note: '≈12–18 months American/French oak', barrel_aging_months_est: 15 })?.months).toBeNull();
    expect(describeBarrelAging({ barrel_aging_note: 'כ-18 חודשים בחביות עץ אלון', barrel_aging_months_est: 18 })?.months).toBeNull();
    expect(describeBarrelAging({ barrel_aging_note: 'French oak barriques', barrel_aging_months_est: 15 })?.months).toBe(15);
  });

  it('hides a zero-month line (no oak) but keeps the note', () => {
    const view = describeBarrelAging({ barrel_aging_note: 'Typically little or no oak', barrel_aging_months_est: 0 });
    expect(view?.months).toBeNull();
    expect(view?.note).toBe('Typically little or no oak');
  });
});
