/**
 * Vivino / community wine rating helpers.
 *
 * Canonical storage: `wines.rating` (DECIMAL 0–5 community score).
 * There is no `vivino_rating` DB column — older call sites used that name as an
 * alias; prefer this helper so personal `user_rating` is never mixed in.
 */

export type WineRatingSource = {
  rating?: number | string | null;
  /** Phantom alias — never a personal rating; ignored unless `rating` is absent. */
  vivino_rating?: number | string | null;
};

/**
 * Normalize a Vivino community rating to a finite number in (0, 5], or null.
 * Rejects null, 0, NaN, non-numeric strings, and out-of-range values.
 * Does not read personal/user ratings.
 */
export function parseVivinoRating(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 5) return null;
  return n;
}

/** Vivino community rating for a wine row (or bottle.wine). */
export function getVivinoRating(wine: WineRatingSource | null | undefined): number | null {
  if (!wine) return null;
  // Prefer canonical `rating`; accept legacy phantom only as fallback.
  return parseVivinoRating(wine.rating) ?? parseVivinoRating(wine.vivino_rating);
}

/** Numeric score for comparisons; missing → 0 (never treat as a rated bottle). */
export function vivinoRatingOrZero(wine: WineRatingSource | null | undefined): number {
  return getVivinoRating(wine) ?? 0;
}
