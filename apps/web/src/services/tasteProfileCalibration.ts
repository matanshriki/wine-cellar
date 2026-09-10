/**
 * Pure helpers for Taste Profile calibration (overrides.vector).
 * Slider values are raw override targets — not effective blended scores.
 */

import type { TasteProfile, TasteProfileVector } from '../types/supabase';

/** Default slider seeds when a dimension has no saved override. */
export const CALIBRATION_SLIDER_DEFAULTS: Partial<TasteProfileVector> = {
  body: 0.5,
  tannin: 0.5,
  acidity: 0.5,
  oak: 0.5,
  sweetness: 0.2,
};

/**
 * Raw override vector for initializing calibration sliders.
 * Prefer persisted overrides; do not substitute inferred/effective values.
 */
export function getCalibrationOverrideVector(
  profile: TasteProfile | null | undefined
): Partial<TasteProfileVector> {
  const vector = profile?.overrides?.vector;
  if (!vector) return {};
  return { ...vector };
}

/**
 * Merge slider values into an existing overrides.vector (immutable).
 */
export function mergeCalibrationOverrideVector(
  existing: Partial<TasteProfileVector> | null | undefined,
  incoming: Partial<TasteProfileVector>
): Partial<TasteProfileVector> {
  return {
    ...(existing || {}),
    ...incoming,
  };
}

/**
 * Profile-card display vector: calibrated overrides win per dimension.
 * Falls back to the inferred/learned vector when a dimension has no override.
 * Used for UI bars/chips only — recommendation affinity still uses getEffectiveVector.
 */
export function getProfileCardDisplayVector(profile: TasteProfile): TasteProfileVector {
  const learned = profile.vector;
  const overrides = profile.overrides?.vector || {};
  return {
    body: overrides.body ?? learned.body,
    tannin: overrides.tannin ?? learned.tannin,
    acidity: overrides.acidity ?? learned.acidity,
    oak: overrides.oak ?? learned.oak,
    sweetness: overrides.sweetness ?? learned.sweetness,
    power: overrides.power ?? learned.power,
  };
}

/**
 * Slider display values: saved overrides win per-dimension; else defaults.
 * Never uses the inferred profile vector (calibration is raw overrides).
 */
export function getCalibrationSliderValues(
  profile: TasteProfile | null | undefined,
  draft?: Partial<TasteProfileVector> | null
): Partial<TasteProfileVector> {
  const saved = getCalibrationOverrideVector(profile);
  const source = draft && Object.keys(draft).length > 0 ? draft : saved;
  return {
    body: source.body ?? CALIBRATION_SLIDER_DEFAULTS.body,
    tannin: source.tannin ?? CALIBRATION_SLIDER_DEFAULTS.tannin,
    acidity: source.acidity ?? CALIBRATION_SLIDER_DEFAULTS.acidity,
    oak: source.oak ?? CALIBRATION_SLIDER_DEFAULTS.oak,
    sweetness: source.sweetness ?? CALIBRATION_SLIDER_DEFAULTS.sweetness,
  };
}
