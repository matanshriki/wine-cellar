/**
 * Weekly Summary Service
 *
 * Derives a "This Week with Sommi" summary from the last 7 days of activity
 * using only existing data sources (consumption_history + profiles.taste_profile).
 *
 * Priority waterfall — in order of interest:
 *   1. preference_trend  — color / region dominance this week
 *   2. top_signal        — best-rated region (conservative by sample size)
 *   3. explore_next      — profile-guided next direction
 *
 * Activity count is metadata for the card header meta line, NOT a bullet.
 *
 * Activity thresholds:
 *   none   (0 opens) → null — render nothing
 *   low    (1 open)  → top_signal (singleWine) + preference_trend if data exists
 *   medium (2–3)     → preference_trend + top_signal
 *   high   (4+)      → full 3-item summary
 *
 * IMPORTANT: Items carry i18n keys + interpolation params — NOT pre-translated
 * strings. Translation is done in the React component via useTranslation() so
 * the active locale is always correct.
 *
 * No new database tables required. Pure function: no async, no side effects.
 */

import type { TasteProfile } from '../types/supabase';
import type { WeeklyActivityEntry } from './historyService';

// ─── Output types ─────────────────────────────────────────────────────────────

export type ActivityLevel = 'none' | 'low' | 'medium' | 'high';

export type SummaryItemType =
  | 'preference_trend'
  | 'top_signal'
  | 'explore_next';

export interface WeeklySummaryItem {
  type: SummaryItemType;
  /** i18n key — translate in the component, not here */
  key: string;
  /** Interpolation params for the i18n key (e.g. { region: 'Tuscany' }) */
  params?: Record<string, unknown>;
  icon: string;
}

export interface WeeklySummary {
  items: WeeklySummaryItem[];
  activity_level: ActivityLevel;
  opens_count: number;
  period_start: Date;
  period_end: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Most-frequent element in an array, or null when array is empty. */
function mode<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  const counts = new Map<T, number>();
  let max = 0;
  let winner: T = arr[0];
  for (const item of arr) {
    const n = (counts.get(item) ?? 0) + 1;
    counts.set(item, n);
    if (n > max) { max = n; winner = item; }
  }
  return winner;
}

function getActivityLevel(count: number): ActivityLevel {
  if (count === 0) return 'none';
  if (count === 1) return 'low';
  if (count <= 3) return 'medium';
  return 'high';
}

/** Top-N keys from a positive-weight map, sorted descending */
function topKeys(map: Record<string, number>, n: number): string[] {
  return Object.entries(map)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Derive a WeeklySummary from the last-7-days activity and the user's taste
 * profile. Returns null for zero or one-open weeks (not enough signal).
 */
export function getWeeklySummary(
  entries: WeeklyActivityEntry[],
  tasteProfile: TasteProfile | null,
): WeeklySummary | null {
  const count = entries.length;
  const activityLevel = getActivityLevel(count);

  // Zero opens — nothing to say
  if (activityLevel === 'none') return null;

  const period_end = new Date();
  const period_start = new Date(period_end);
  period_start.setDate(period_start.getDate() - 7);

  const items: WeeklySummaryItem[] = [];

  // ── 1. Preference trend ───────────────────────────────────────────────────
  // Requires wine metadata. Shows color + regional dominance.
  {
    const withWine = entries.filter((e) => e.wine !== null);

    if (withWine.length > 0) {
      const colors = withWine.map((e) => e.wine!.color).filter(Boolean);
      const regions = withWine
        .map((e) => e.wine!.region)
        .filter((r): r is string => Boolean(r));

      const dominantColor = mode(colors);
      const dominantRegion = mode(regions);

      // Region is "strong" when it covers ≥60 % of wines that have a region
      const regionIsStrong =
        regions.length >= 2 &&
        dominantRegion !== null &&
        regions.filter((r) => r === dominantRegion).length >=
          Math.ceil(regions.length * 0.6);

      let trendKey: string | null = null;
      let trendParams: Record<string, unknown> | undefined;

      if (dominantColor && regionIsStrong && dominantRegion) {
        trendKey = `weeklySummary.preferenceTrend.${dominantColor}AndRegion`;
        trendParams = { region: dominantRegion };
      } else if (dominantColor) {
        trendKey = `weeklySummary.preferenceTrend.${dominantColor}Only`;
        trendParams = undefined;
      }

      if (trendKey) {
        items.push({ type: 'preference_trend', key: trendKey, params: trendParams, icon: '🍷' });
      }
    }
  }

  // ── 2. Top signal ─────────────────────────────────────────────────────────
  // Conservative: single-wine regions use softer phrasing.
  if (items.length < 3) {
    const ratedEntries = entries.filter(
      (e) => typeof e.user_rating === 'number' && e.user_rating > 0,
    );

    if (ratedEntries.length > 0) {
      // Group ratings by region
      const regionRatings: Record<string, { sum: number; count: number; topWine: string }> = {};
      for (const e of ratedEntries) {
        const region = e.wine?.region;
        if (!region) continue;
        if (!regionRatings[region]) {
          regionRatings[region] = { sum: 0, count: 0, topWine: e.wine?.wine_name ?? '' };
        }
        regionRatings[region].sum += e.user_rating!;
        regionRatings[region].count += 1;
      }

      // Build ranked list:
      //   single-wine entries: any positive rating qualifies (≥ 1)
      //   multi-wine entries:  avg ≥ 3.5 for a confident region-level claim
      const ranked = Object.entries(regionRatings)
        .map(([region, { sum, count }]) => ({
          region,
          avg: sum / count,
          count,
        }))
        .filter((r) => r.count === 1 ? r.avg >= 1 : r.avg >= 3.5)
        .sort((a, b) => b.avg - a.avg || b.count - a.count);

      const top = ranked[0];

      if (top) {
        const signalKey = top.count === 1
          ? 'weeklySummary.topSignal.singleWine'
          : 'weeklySummary.topSignal.regionPerformed';
        items.push({
          type: 'top_signal',
          key: signalKey,
          params: { region: top.region },
          icon: '✨',
        });
      }
    }
  }

  // ── 3. Explore next ───────────────────────────────────────────────────────
  // High activity + med/high profile confidence only — no overclaiming.
  if (
    activityLevel === 'high' &&
    tasteProfile !== null &&
    tasteProfile.confidence !== 'low' &&
    items.length < 3
  ) {
    const weekRegions = new Set(
      entries.map((e) => e.wine?.region).filter(Boolean) as string[],
    );

    const profileTopRegions = topKeys(tasteProfile.preferences.regions, 5);
    const suggestedRegion = profileTopRegions.find((r) => !weekRegions.has(r));

    if (suggestedRegion) {
      items.push({
        type: 'explore_next',
        key: 'weeklySummary.exploreNext.suggestion',
        params: { region: suggestedRegion },
        icon: '🧭',
      });
    } else {
      items.push({
        type: 'explore_next',
        key: 'weeklySummary.exploreNext.generic',
        icon: '🧭',
      });
    }
  }

  if (items.length === 0) return null;

  return {
    items: items.slice(0, 3),
    activity_level: activityLevel,
    opens_count: count,
    period_start,
    period_end,
  };
}
