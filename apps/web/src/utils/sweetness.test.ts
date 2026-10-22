import { describe, expect, it } from 'vitest';
import {
  assessWineSweetness,
  inferSweetnessFromText,
  isKnownDry,
  isKnownSweeterThanDry,
  levelFromStoredScore,
  SWEETNESS_SCALE_VERSION,
} from './sweetness';
import {
  describeStoredSweetness,
  SWEETNESS_SCALE_VERSION as EDGE_SCALE_VERSION,
} from '../../../../supabase/functions/_shared/sweetnessScale';

describe('inferSweetnessFromText', () => {
  it.each([
    ['Lambrusco Amabile', 'medium_sweet'],
    ['Aglianico Amabile', 'medium_sweet'],
    ['Champagne Demi-Sec', 'medium_sweet'],
    ["Moscato d'Asti", 'medium_sweet'],
    ['Riesling Spätlese', 'medium_sweet'],
    ['Recioto della Valpolicella', 'sweet'],
    ['Château Suduiraut Sauternes', 'sweet'],
    ['Tokaji Aszú 5 Puttonyos', 'sweet'],
    ['Late Harvest Gewürztraminer', 'sweet'],
    ['Vintage Port', 'sweet'],
    ['Riesling Halbtrocken', 'off_dry'],
    ['Prosecco Extra Dry', 'off_dry'],
    ['Champagne Brut', 'dry'],
    ['Riesling Spätlese Trocken', 'dry'],
    ['Riesling Auslese Feinherb', 'off_dry'],
  ])('%s → %s', (text, level) => {
    expect(inferSweetnessFromText(text)?.level).toBe(level);
  });

  it.each([
    'Aglianico del Vulture',
    'Dry Creek Valley Zinfandel',
    'Barbera d\'Asti',
    'Tokaji Furmint',
    'Portugal Douro Tinto',
    'Southern Italy Red',
  ])('%s has no sweetness term', (text) => {
    expect(inferSweetnessFromText(text)).toBeNull();
  });
});

describe('assessWineSweetness', () => {
  it('label terms win over a contradicting stored profile', () => {
    const a = assessWineSweetness({
      wine_name: 'Lambrusco Amabile',
      wine_profile: { sweetness: 0, source: 'ai' },
    });
    expect(a).toMatchObject({ level: 'medium_sweet', basis: 'label' });
  });

  it('heuristic profiles are unknown, never dry', () => {
    const a = assessWineSweetness({ wine_name: 'Chianti', wine_profile: { sweetness: 0, source: 'heuristic' } });
    expect(a).toEqual({ level: null, basis: 'unknown' });
    expect(isKnownDry(a)).toBe(false);
  });

  it('missing data is unknown', () => {
    expect(assessWineSweetness({ wine_name: 'Chianti' }).basis).toBe('unknown');
    expect(assessWineSweetness(null).basis).toBe('unknown');
  });

  it('AI profile score 0 is a dry estimate; 3 is medium-sweet', () => {
    expect(assessWineSweetness({ wine_profile: { sweetness: 0, source: 'ai' } })).toEqual({ level: 'dry', basis: 'profile' });
    expect(assessWineSweetness({ wine_profile: { sweetness: 3, source: 'ai' } })).toEqual({ level: 'medium_sweet', basis: 'profile' });
  });

  it('ambiguous legacy score 1 is unknown (old prompt called it off-dry)', () => {
    const a = assessWineSweetness({ wine_profile: { sweetness: 1, source: 'ai' } });
    expect(a.basis).toBe('unknown');
    expect(isKnownDry(a)).toBe(false);
    expect(isKnownSweeterThanDry(a)).toBe(false);
  });

  it('score 1 is dry only when the profile declares the v2 scale', () => {
    expect(assessWineSweetness({ wine_profile: { sweetness: 1, source: 'ai', sweetness_scale: SWEETNESS_SCALE_VERSION } }))
      .toEqual({ level: 'dry', basis: 'profile' });
    expect(assessWineSweetness({ wine_profile: { sweetness: 1, source: 'ai', sweetness_scale: 1 } }).basis).toBe('unknown');
  });

  it('profiles from sources that never defined this scale are unknown', () => {
    expect(assessWineSweetness({ wine_profile: { sweetness: 3, source: 'vivino' } }).basis).toBe('unknown');
    expect(assessWineSweetness({ wine_profile: { sweetness: 0 } }).basis).toBe('unknown');
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['fractional', 0.5],
    ['negative', -1],
    ['above 5', 6],
    ['string', '2'],
    ['NaN', Number.NaN],
  ])('%s stored score is unknown', (_name, sweetness) => {
    const a = assessWineSweetness({ wine_profile: { sweetness: sweetness as number, source: 'ai' } });
    expect(a).toEqual({ level: null, basis: 'unknown' });
  });

  describe('conflicting evidence', () => {
    it('a dry label term beats a sweet stored score', () => {
      expect(assessWineSweetness({ wine_name: 'Prosecco Brut', wine_profile: { sweetness: 4, source: 'ai' } }))
        .toMatchObject({ level: 'dry', basis: 'label' });
    });

    it('a sweet label term beats an ambiguous legacy score', () => {
      expect(assessWineSweetness({ wine_name: 'Equinox Campania Rosso Amabile', wine_profile: { sweetness: 1, source: 'ai' } }))
        .toMatchObject({ level: 'medium_sweet', basis: 'label', term: 'amabile' });
    });

    it('the sweeter label term wins when a name carries both', () => {
      expect(assessWineSweetness({ wine_name: 'Champagne Demi-Sec', regional_wine_style: 'Champagne Brut style' }).level)
        .toBe('medium_sweet');
    });

    it('label terms in regional_wine_style count; heuristic placeholders never do', () => {
      expect(assessWineSweetness({ wine_name: 'Rosso', regional_wine_style: 'Lambrusco Amabile', wine_profile: { sweetness: 0, source: 'heuristic' } }))
        .toMatchObject({ level: 'medium_sweet', basis: 'label' });
    });
  });

  it('producer names do not leak sweetness terms', () => {
    // "Sweet Valley" producer, plain red wine name
    const a = assessWineSweetness({ wine_name: 'Cabernet Sauvignon', regional_wine_style: null });
    expect(a.basis).toBe('unknown');
  });
});

describe('levelFromStoredScore', () => {
  it.each([
    // score, unversioned (legacy prompts), v2
    [0, 'dry', 'dry'],
    [1, null, 'dry'],
    [2, 'off_dry', 'off_dry'],
    [3, 'medium_sweet', 'medium_sweet'],
    [4, 'medium_sweet', 'sweet'],
    [5, 'sweet', 'sweet'],
  ])('%i → legacy %s, v2 %s', (score, legacy, v2) => {
    expect(levelFromStoredScore(score)).toBe(legacy);
    expect(levelFromStoredScore(score, SWEETNESS_SCALE_VERSION)).toBe(v2);
  });

  it('web and edge functions read every stored value the same way', () => {
    for (const version of [undefined, 1, SWEETNESS_SCALE_VERSION]) {
      for (const score of [-1, 0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, null, '1']) {
        const web = levelFromStoredScore(score, version);
        const edge = describeStoredSweetness(score, version);
        expect({ score, version, known: web !== null }).toEqual({ score, version, known: edge !== null });
        if (web === 'dry') expect(edge).toMatch(/dry/);
        if (web === 'off_dry') expect(edge).toBe('off-dry');
        if (web === 'medium_sweet') expect(edge).toMatch(/^medium-sweet/);
      }
    }
    expect(EDGE_SCALE_VERSION).toBe(SWEETNESS_SCALE_VERSION);
  });
});
