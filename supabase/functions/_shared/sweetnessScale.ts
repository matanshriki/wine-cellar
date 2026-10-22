/**
 * Interpreting wines.wine_profile.sweetness (0–5).
 *
 * Profiles written before `sweetness_scale` existed came from prompts that
 * defined the scale differently:
 * - generate-wine-profile (Feb 2026): 0 bone dry, 1–2 off-dry, 3–4 medium sweet, 5 very sweet
 * - backfill-wine-profiles (Mar 2026): 0 bone dry, 5 very sweet, nothing in between
 * Version 2 (written as `sweetness_scale: 2`): 0 bone dry, 1 dry, 2 off-dry,
 * 3 medium sweet, 4 sweet, 5 very sweet.
 *
 * Keep in sync with apps/web/src/utils/sweetness.ts.
 */

export const SWEETNESS_SCALE_VERSION = 2;

export const SWEETNESS_PROMPT_DEFINITION =
  "sweetness (0-5 integer, residual sugar only — NOT fruitiness): 0=bone dry, 1=dry, 2=off-dry, 3=medium sweet, 4=sweet, 5=very sweet. " +
  "Label terms decide this: Amabile/Abboccato/Demi-Sec/Spätlese/Moscato d'Asti ≥3; Dolce/Doux/Passito/Late Harvest/Sauternes/Port/Ice Wine ≥4; " +
  "Halbtrocken/Feinherb/Extra Dry = 2; Brut/Trocken/Secco ≤1";

const V2_WORDS = ["bone dry", "dry", "off-dry", "medium-sweet", "sweet", "very sweet"] as const;

// Only what every legacy definition supports: 1 is "off-dry" in one prompt and
// undefined in the other; 4 is at least medium sweet.
const LEGACY_WORDS = ["bone dry", null, "off-dry", "medium-sweet", "medium-sweet or sweeter", "very sweet"] as const;

/** Words describing a stored score, or null when its meaning cannot be established. */
export function describeStoredSweetness(score: unknown, scaleVersion?: unknown): string | null {
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 5) return null;
  return (scaleVersion === SWEETNESS_SCALE_VERSION ? V2_WORDS : LEGACY_WORDS)[score];
}
