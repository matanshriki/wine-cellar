import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TasteProfile } from '../types/supabase';
import {
  getCalibrationOverrideVector,
  getCalibrationSliderValues,
  mergeCalibrationOverrideVector,
} from './tasteProfileCalibration';
import { attachPreservedOverrides } from './tasteProfileOverrides';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEq = vi.fn(() => ({ select: mockSelect }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({
  update: mockUpdate,
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn(),
    })),
  })),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  },
}));

vi.mock('./wineProfileService', () => ({
  getWineProfiles: vi.fn(async () => []),
}));

function baseProfile(overrides?: TasteProfile['overrides']): TasteProfile {
  return {
    version: 1,
    vector: {
      body: 0.4,
      tannin: 0.4,
      acidity: 0.5,
      oak: 0.3,
      sweetness: 0.2,
      power: 0.4,
    },
    preferences: {
      reds_bias: 0.2,
      whites_bias: -0.1,
      sparkling_bias: 0,
      style_tags: { bold: 0.5 },
      regions: { Bordeaux: 0.8 },
      grapes: { Merlot: 0.6 },
    },
    ...(overrides ? { overrides } : {}),
    confidence: 'med',
    data_points: { rated_count: 8, last_rated_at: '2026-01-01T00:00:00.000Z' },
  };
}

describe('calibration slider semantics (raw overrides)', () => {
  it('D: reopen uses saved overrides.vector, not inferred vector', () => {
    const profile = baseProfile({ vector: { body: 0.95, oak: 0.1 } });
    profile.vector.body = 0.2;
    profile.vector.oak = 0.8;

    const sliders = getCalibrationSliderValues(profile);
    expect(sliders.body).toBe(0.95);
    expect(sliders.oak).toBe(0.1);
    expect(sliders.tannin).toBe(0.5);
  });

  it('E: missing overrides fall back to slider defaults, not inferred', () => {
    const profile = baseProfile();
    delete profile.overrides;
    profile.vector.body = 0.12;

    const sliders = getCalibrationSliderValues(profile);
    expect(sliders.body).toBe(0.5);
    expect(getCalibrationOverrideVector(profile)).toEqual({});
  });

  it('B: mergeCalibrationOverrideVector writes selected values immutably', () => {
    const existing = { body: 0.2, tannin: 0.3 };
    const incoming = { body: 0.9, oak: 0.15 };
    const merged = mergeCalibrationOverrideVector(existing, incoming);

    expect(merged).toEqual({ body: 0.9, tannin: 0.3, oak: 0.15 });
    expect(existing).toEqual({ body: 0.2, tannin: 0.3 });
  });
});

describe('applyCalibration / saveTasteProfile persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetUser.mockReset();
    mockMaybeSingle.mockReset();
    mockSelect.mockClear();
    mockEq.mockClear();
    mockUpdate.mockClear();
    mockFrom.mockClear();

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSelect.mockImplementation(() => ({ maybeSingle: mockMaybeSingle }));
    mockEq.mockImplementation(() => ({ select: mockSelect }));
    mockUpdate.mockImplementation(() => ({ eq: mockEq }));
    mockFrom.mockImplementation(() => ({
      update: mockUpdate,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: { taste_profile: storedProfile },
            error: null,
          })),
        })),
      })),
    }));
  });

  let storedProfile: TasteProfile | null = null;

  it('A/B/C: slider values reach applyCalibration and persist overrides.vector', async () => {
    storedProfile = baseProfile();
    delete storedProfile.overrides;

    const sliderValues = {
      body: 0.85,
      tannin: 0.4,
      acidity: 0.55,
      oak: 0.25,
      sweetness: 0.1,
    };

    const persisted: TasteProfile = {
      ...storedProfile,
      overrides: { vector: { ...sliderValues } },
    };

    mockMaybeSingle.mockResolvedValue({
      data: { taste_profile: persisted },
      error: null,
    });

    const { applyCalibration } = await import('./tasteProfileService');
    const result = await applyCalibration(sliderValues);

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalled();
    const updateCalls = mockUpdate.mock.calls as unknown as Array<
      [{ taste_profile: TasteProfile }]
    >;
    const updatePayload = updateCalls[0]![0];
    expect(updatePayload.taste_profile.overrides?.vector).toEqual(sliderValues);
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
    expect(result?.overrides?.vector).toEqual(sliderValues);
  });

  it('C: successful save returns the persisted updated profile from Supabase', async () => {
    storedProfile = baseProfile({ vector: { body: 0.3 } });
    const persisted = baseProfile({ vector: { body: 0.88, tannin: 0.44 } });

    mockMaybeSingle.mockResolvedValue({
      data: { taste_profile: persisted },
      error: null,
    });

    const { applyCalibration } = await import('./tasteProfileService');
    const result = await applyCalibration({ body: 0.88, tannin: 0.44 });
    expect(result).toEqual(persisted);
    expect(result).not.toBe(storedProfile);
  });

  it('I: Supabase error does not produce a success result', async () => {
    storedProfile = baseProfile();
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    const { applyCalibration } = await import('./tasteProfileService');
    await expect(applyCalibration({ body: 0.9 })).rejects.toThrow('Failed to save taste profile');
  });

  it('J: zero updated rows do not produce a false success', async () => {
    storedProfile = baseProfile();
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const { applyCalibration } = await import('./tasteProfileService');
    await expect(applyCalibration({ body: 0.9 })).rejects.toThrow('Failed to save taste profile');
  });

  it('K: refetch after save sees saved calibration (ordering)', async () => {
    storedProfile = baseProfile();
    delete storedProfile.overrides;

    const saved = baseProfile({ vector: { body: 0.91, oak: 0.12 } });
    mockMaybeSingle.mockResolvedValue({
      data: { taste_profile: saved },
      error: null,
    });

    const mod = await import('./tasteProfileService');
    const afterSave = await mod.applyCalibration({ body: 0.91, oak: 0.12 });

    // Simulate subsequent getMyTasteProfile / page refresh reading DB
    mockFrom.mockImplementation(() => ({
      update: mockUpdate,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: { taste_profile: afterSave },
            error: null,
          })),
        })),
      })),
    }));

    const refetched = await mod.getMyTasteProfile();
    expect(refetched?.overrides?.vector).toEqual({ body: 0.91, oak: 0.12 });
    expect(getCalibrationSliderValues(refetched).body).toBe(0.91);
  });
});

describe('recompute / reset vs calibration', () => {
  it('F/G: rating-driven and manual recompute preserve overrides', () => {
    const previous = baseProfile({ vector: { body: 0.92, sweetness: 0.05 } });
    const computed = baseProfile();
    computed.vector.body = 0.5;
    delete computed.overrides;

    const kept = attachPreservedOverrides(computed, previous, true);
    expect(kept.overrides?.vector).toEqual({ body: 0.92, sweetness: 0.05 });
  });

  it('H: Reset removes overrides', () => {
    const previous = baseProfile({ vector: { body: 0.92 } });
    const computed = baseProfile();
    delete computed.overrides;

    const reset = attachPreservedOverrides(computed, previous, false);
    expect(reset.overrides).toBeUndefined();
  });
});

describe('UI wiring contract (stale-state regression)', () => {
  it('A: TasteProfileCard passes slider values into applyCalibration (not stale state)', () => {
    const src = readFileSync(
      resolve(__dirname, '../components/TasteProfileCard.tsx'),
      'utf8'
    );
    expect(src).toMatch(/handleSaveCalibration\(values\)/);
    expect(src).toMatch(/applyCalibration\(values\)/);
    expect(src).not.toMatch(/setCalibrationValues\(values\);\s*\n\s*handleSaveCalibration\(\)/);
    expect(src).not.toMatch(/applyCalibration\(calibrationValues\)/);
  });

  it('disables Save while request is pending', () => {
    const src = readFileSync(
      resolve(__dirname, '../components/TasteProfileCard.tsx'),
      'utf8'
    );
    expect(src).toMatch(/savingCalibration/);
    expect(src).toMatch(/disabled=\{saving\}/);
  });
});
