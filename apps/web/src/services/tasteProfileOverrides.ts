/**
 * Pure helpers for taste-profile override preservation on recompute.
 * Kept separate from tasteProfileService so unit tests need no Supabase/DOM.
 */

import type { TasteProfile } from '../types/supabase';

export interface RecomputeTasteProfileOptions {
  /**
   * When true (default), keep the user's existing calibration `overrides`
   * on the saved profile. Pass false for an intentional Reset.
   */
  preserveOverrides?: boolean;
}

/**
 * Attach previous calibration overrides onto a freshly computed profile.
 * Does not mutate `computed` or `previous`. Used by recompute so rating-driven
 * updates do not wipe manual calibration.
 */
export function attachPreservedOverrides(
  computed: TasteProfile,
  previous: TasteProfile | null | undefined,
  preserveOverrides: boolean
): TasteProfile {
  const next: TasteProfile = {
    version: computed.version,
    vector: { ...computed.vector },
    preferences: {
      ...computed.preferences,
      style_tags: { ...computed.preferences.style_tags },
      regions: { ...computed.preferences.regions },
      grapes: { ...computed.preferences.grapes },
    },
    confidence: computed.confidence,
    data_points: { ...computed.data_points },
  };

  if (!preserveOverrides) {
    return next;
  }

  const previousOverrides = previous?.overrides;
  if (!previousOverrides) {
    return next;
  }

  next.overrides = {
    ...previousOverrides,
    ...(previousOverrides.vector
      ? { vector: { ...previousOverrides.vector } }
      : {}),
  };
  return next;
}
