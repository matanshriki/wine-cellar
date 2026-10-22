/**
 * Regression: "Amabile" (medium-sweet) wines were shown as
 * "Matches your taste: dry & balanced" because the heuristic profile sets
 * sweetness = 0 for every red and the affinity check trusted it.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

import i18n from '../i18n/config';
import type { TasteProfile } from '../types/supabase';
import type { BottleWithWineInfo } from './bottleService';
import { calculateAffinity, generateAffinityReason } from './tasteProfileService';
import { getWineProfile, hasKnownResidualSugar, calculateFoodPairingScore } from './wineProfileService';
import { getBottleInsight } from './insightService';
import { findExplicitDislike, isSweetnessMismatch } from './tasteMatch';
import { differenceFromTop, groundedPairingReasons, mealContextFor } from './mealPairing';
import { SWEETNESS_SCALE_VERSION } from '../utils/sweetness';

function dryLover(extra?: Partial<TasteProfile>): TasteProfile {
  return {
    version: 1,
    // Mid body (0.5 ≈ body 3) so the "dry & balanced" branch is reachable.
    vector: { body: 0.5, tannin: 0.5, acidity: 0.5, oak: 0.25, sweetness: 0.1, power: 0.5 },
    preferences: { reds_bias: 0, whites_bias: 0, sparkling_bias: 0, style_tags: {}, regions: {}, grapes: {} },
    confidence: 'high',
    data_points: { rated_count: 12, last_rated_at: '2026-01-01T00:00:00.000Z' },
    ...extra,
  };
}

const recent = new Date().toISOString();

function wine(partial: Record<string, unknown>) {
  return {
    id: 'w1',
    wine_name: 'Test',
    producer: 'Producer',
    color: 'red',
    region: 'Campania',
    grapes: ['Aglianico'],
    regional_wine_style: null,
    vintage: 2019,
    ...partial,
  };
}

function bottle(w: Record<string, unknown>): BottleWithWineInfo {
  return { id: 'b1', quantity: 1, wine: w } as unknown as BottleWithWineInfo;
}

const DRY_BALANCED = () => i18n.t('recommendation.generated.affinityDryBalanced');

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

describe('sweetness never reads as dry', () => {
  it('Amabile with no stored profile is not "dry & balanced" and is disclosed as sweeter', () => {
    const w = wine({ wine_name: 'Aglianico Amabile' });
    const profile = getWineProfile(w);
    expect(profile.sweetness_basis).toBe('label');
    expect(profile.sweetness_level).toBe('medium_sweet');

    const reason = generateAffinityReason(profile, dryLover(), w);
    expect(reason).not.toBe(DRY_BALANCED());
    expect(reason).toBe(i18n.t('recommendation.generated.affinitySweeterThanUsual.medium_sweet'));
  });

  it('Amabile with a contradicting stored AI profile (sweetness 0) is still not dry', () => {
    const w = wine({
      wine_name: 'Lambrusco Amabile',
      wine_profile: { body: 3, tannin: 3, acidity: 3, oak: 1, sweetness: 0, power: 5, style_tags: [], source: 'ai', confidence: 'med', alcohol_est: 11, updated_at: recent },
      wine_profile_updated_at: recent,
    });
    const reason = generateAffinityReason(getWineProfile(w), dryLover(), w);
    expect(reason).not.toBe(DRY_BALANCED());
  });

  it('unknown sweetness (heuristic only) never claims dry', () => {
    const w = wine({ wine_name: 'Aglianico del Vulture' });
    const profile = getWineProfile(w);
    expect(profile.sweetness_basis).toBe('unknown');
    expect(generateAffinityReason(profile, dryLover(), w)).not.toBe(DRY_BALANCED());
  });

  it('a verified dry wine can still match "dry & balanced"', () => {
    const w = wine({
      wine_name: 'Aglianico del Vulture',
      wine_profile: { body: 3, tannin: 3, acidity: 3, oak: 2, sweetness: 0, power: 5, style_tags: [], source: 'ai', confidence: 'high', alcohol_est: 14, updated_at: recent },
      wine_profile_updated_at: recent,
    });
    expect(generateAffinityReason(getWineProfile(w), dryLover(), w)).toBe(DRY_BALANCED());
  });

  it('fruit-forward style tags do not imply residual sugar', () => {
    const w = wine({
      wine_name: 'Zinfandel',
      wine_profile: { body: 4, tannin: 3, acidity: 3, oak: 2, sweetness: 0, power: 7, style_tags: ['fruit-forward', 'jammy'], source: 'ai', confidence: 'high', alcohol_est: 15, updated_at: recent },
      wine_profile_updated_at: recent,
    });
    expect(hasKnownResidualSugar(getWineProfile(w))).toBe(false);
  });

  it('heuristic sparkling (placeholder sweetness 1) gets no "sweetness tames the heat" bonus', () => {
    const w = wine({ color: 'sparkling', wine_name: 'Cava', grapes: [] });
    const profile = getWineProfile(w);
    expect(hasKnownResidualSugar(profile)).toBe(false);
    const spicy = { protein: 'chicken', fat: 'med', sauce: 'none', spice: 'high', smoke: 'low' } as const;
    const sweetCava = getWineProfile({ ...w, wine_name: 'Cava Semi-Seco' });
    expect(calculateFoodPairingScore(sweetCava, spicy) - calculateFoodPairingScore(profile, spicy)).toBe(15);
  });
});

describe('one source of truth across insight surfaces', () => {
  it('bottle insight (details, cards, Tonight) leads with the sweetness disclosure', () => {
    const w = wine({ wine_name: 'Aglianico Amabile', region: 'Campania' });
    const profile = dryLover({
      preferences: { reds_bias: 0, whites_bias: 0, sparkling_bias: 0, style_tags: {}, regions: { Campania: 0.9 }, grapes: {} },
    });
    const insight = getBottleInsight(bottle(w), profile);
    expect(insight?.type).toBe('taste_caution');
    expect(insight?.text).toBe(i18n.t('recommendation.generated.affinitySweeterThanUsual.medium_sweet'));
  });

  it('users who like sweetness are not warned', () => {
    expect(isSweetnessMismatch(0.7, { level: 'sweet', basis: 'label' })).toBe(false);
    expect(isSweetnessMismatch(0.1, { level: null, basis: 'unknown' })).toBe(false);
  });
});

describe('legacy stored profiles across every caller', () => {
  const stored = (sweetness: number | undefined, extra: Record<string, unknown> = {}) =>
    wine({
      wine_name: 'Aglianico del Vulture',
      wine_profile: { body: 3, tannin: 2, acidity: 4, oak: 2, sweetness, power: 5, style_tags: [], source: 'ai', confidence: 'high', alcohol_est: 13, updated_at: recent, ...extra },
      wine_profile_updated_at: recent,
    });
  const regionFan = dryLover({
    preferences: { reds_bias: 0, whites_bias: 0, sparkling_bias: 0, style_tags: {}, regions: { Campania: 0.9 }, grapes: {} },
  });
  const spicy = mealContextFor('spicy_asian', 'fiery')!;

  it('legacy 1: unknown, so no dry claim, no sweeter warning, no sweet pairing reason', () => {
    const w = stored(1);
    const p = getWineProfile(w);
    expect(p.sweetness_basis).toBe('unknown');
    // Plan Evening + insight fallback
    expect(generateAffinityReason(p, dryLover(), w)).not.toBe(DRY_BALANCED());
    // Details, Open ritual and Recommendations insight
    expect(getBottleInsight(bottle(w), regionFan)?.type).not.toBe('taste_caution');
    // Recommendation scoring and grounded reasons
    expect(hasKnownResidualSugar(p)).toBe(false);
    expect(groundedPairingReasons(p, spicy).map((r) => r.key)).not.toContain('spiceSweet');
  });

  it('legacy 1: the sweetness dimension is left out of the affinity score', () => {
    expect(calculateAffinity(getWineProfile(stored(1)), dryLover()))
      .toBe(calculateAffinity(getWineProfile(stored(undefined)), dryLover()));
  });

  it('v2 profile with 1 can be called dry', () => {
    const w = stored(1, { sweetness_scale: SWEETNESS_SCALE_VERSION });
    expect(getWineProfile(w).sweetness_level).toBe('dry');
    expect(generateAffinityReason(getWineProfile(w), dryLover(), w)).toBe(DRY_BALANCED());
  });

  it('legacy 4 is disclosed as medium-sweet, not "sweet"', () => {
    const w = stored(4);
    expect(getBottleInsight(bottle(w), regionFan)?.text)
      .toBe(i18n.t('recommendation.generated.affinitySweeterThanUsual.medium_sweet'));
  });

  it('missing sweetness on a stored profile stays unknown', () => {
    expect(getWineProfile(stored(undefined)).sweetness_basis).toBe('unknown');
  });

  it('Amabile label beats a legacy 1 on every caller', () => {
    const w = { ...stored(1), wine_name: 'Equinox Campania Rosso Amabile' };
    const p = getWineProfile(w);
    expect(p.sweetness_level).toBe('medium_sweet');
    expect(getBottleInsight(bottle(w), regionFan)?.type).toBe('taste_caution');
    expect(groundedPairingReasons(p, spicy).map((r) => r.key)).toContain('spiceSweet');
  });

  it('"how options differ" never says drier or sweeter against an unknown', () => {
    const asDiff = (w: Record<string, unknown>) => ({ color: 'red', profile: getWineProfile(w), readiness: null, vintage: 2019 });
    const amabile = asDiff({ ...stored(1), wine_name: 'Lambrusco Amabile' });
    const unknown = asDiff(stored(1));
    expect(differenceFromTop(unknown, amabile)).not.toBe('drier');
    expect(differenceFromTop(amabile, unknown)).not.toBe('sweeter');
  });
});

describe('explicit exclusions', () => {
  const profile = dryLover({
    explicit: { grapes_disliked: [{ id: 'aglianico', confidence: 1, label_en: 'Aglianico', label_he: 'אליאניקו' }] },
  });

  it('matches grape dislikes case- and accent-insensitively', () => {
    expect(findExplicitDislike(wine({ grapes: ['Aglianico'] }), profile)?.label).toBe('Aglianico');
    expect(findExplicitDislike(wine({ grapes: ['Merlot'], wine_name: 'Merlot' }), profile)).toBeNull();
  });

  it('dislike wins over learned region affinity in the insight', () => {
    const p = { ...profile, preferences: { ...profile.preferences, regions: { Campania: 0.9 } } };
    const insight = getBottleInsight(bottle(wine({})), p);
    expect(insight?.type).toBe('taste_caution');
    expect(insight?.text).toContain('Aglianico');
  });
});
