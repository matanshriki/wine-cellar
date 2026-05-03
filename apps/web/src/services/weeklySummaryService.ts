/**
 * Weekly Summary Service
 *
 * Derives a structured "This Week with Sommi" summary from the user's
 * last-7-days activity using only existing data sources:
 *   – consumption_history (via fetchWeeklyActivity)
 *   – profiles.taste_profile (via getMyTasteProfile)
 *
 * Pure function: getWeeklySummary() has no side effects and is fully
 * deterministic for a given input, making it easy to test and maintain.
 *
 * No new database tables or columns are required.
 */

import i18n from '../i18n/config';
import type { TasteProfile } from '../types/supabase';
import type { WeeklyActivityEntry } from './historyService';

// ─── Output types ─────────────────────────────────────────────────────────────

export type ActivityLevel = 'none' | 'low' | 'medium' | 'high';
// none   → 0 opens — render nothing
// low    → 1 open  — activity item only (no overclaiming)
// medium → 2-3     — activity + preference trend
// high   → 4+      — full 3-item summary

export type SummaryItemType =
  | 'activity'
  | 'preference_trend'
  | 'top_signal'
  | 'explore_next';

export interface WeeklySummaryItem {
  type: SummaryItemType;
  text: string;
  icon: string;
}

export interface WeeklySummary {
  /** Localised in the calling component, not here */
  items: WeeklySummaryItem[];
  activity_level: ActivityLevel;
  period_start: Date;
  period_end: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options as any) as string;
}

/** Normalise grapes JSONB field */
function parseGrapes(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((g): g is string => typeof g === 'string');
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return [raw]; }
  }
  return [];
}

/** Most-frequent element in an array, or null if array is empty. */
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
 * Derive a WeeklySummary from the last-7-days activity and the current taste profile.
 *
 * Returns null when activity_level is 'none' (zero opens).
 * All logic is rule-based; no OpenAI dependency.
 */
export function getWeeklySummary(
  entries: WeeklyActivityEntry[],
  tasteProfile: TasteProfile | null,
): WeeklySummary | null {
  const count = entries.length;
  const activityLevel = getActivityLevel(count);

  if (activityLevel === 'none') return null;

  const period_end = new Date();
  const period_start = new Date(period_end);
  period_start.setDate(period_start.getDate() - 7);

  const items: WeeklySummaryItem[] = [];

  // ── 1. Activity ───────────────────────────────────────────────────────────
  // Always produced for any non-zero activity.
  {
    let activityText: string;
    if (count === 1) {
      activityText = t('weeklySummary.activity.one');
    } else if (count <= 3) {
      activityText = t('weeklySummary.activity.few', { count });
    } else {
      activityText = t('weeklySummary.activity.busy', { count });
    }
    items.push({ type: 'activity', text: activityText, icon: '🍾' });
  }

  // ── 2. Preference trend ───────────────────────────────────────────────────
  // Requires wine metadata. Shows color + region dominance.
  if (activityLevel !== 'low') {
    const withWine = entries.filter((e) => e.wine !== null);
    if (withWine.length > 0) {
      const colors = withWine.map((e) => e.wine!.color).filter(Boolean);
      const regions = withWine
        .map((e) => e.wine!.region)
        .filter((r): r is string => Boolean(r));

      const dominantColor = mode(colors);
      const dominantRegion = mode(regions);

      // Region is "strong" when it represents ≥60 % of wines with a region
      const regionIsStrong =
        regions.length >= 2 &&
        dominantRegion !== null &&
        regions.filter((r) => r === dominantRegion).length >= Math.ceil(regions.length * 0.6);

      let trendText: string | null = null;

      // Preferred: color + region combination
      if (dominantColor && regionIsStrong && dominantRegion) {
        const key = `weeklySummary.preferenceTrend.${dominantColor}AndRegion`;
        const translated = t(key, { region: dominantRegion });
        if (translated !== key) trendText = translated;
      }

      // Fallback: color only
      if (!trendText && dominantColor) {
        const key = `weeklySummary.preferenceTrend.${dominantColor}Only`;
        const translated = t(key);
        if (translated !== key) trendText = translated;
      }

      if (trendText) {
        items.push({ type: 'preference_trend', text: trendText, icon: '🍷' });
      }
    }
  }

  // ── 3. Top signal ─────────────────────────────────────────────────────────
  // Medium/high activity only. Uses ratings to surface the strongest insight.
  if ((activityLevel === 'medium' || activityLevel === 'high') && items.length < 3) {
    const ratedEntries = entries.filter(
      (e) => typeof e.user_rating === 'number' && e.user_rating > 0,
    );

    if (ratedEntries.length > 0) {
      // Which region had the best average rating this week?
      const regionRatings: Record<string, number[]> = {};
      for (const e of ratedEntries) {
        const region = e.wine?.region;
        if (region) {
          (regionRatings[region] ??= []).push(e.user_rating!);
        }
      }
      const rankedRegions = Object.entries(regionRatings)
        .map(([region, ratings]) => ({
          region,
          avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
          count: ratings.length,
        }))
        // At least avg ≥ 4 to claim "stood out"
        .filter((r) => r.avg >= 4)
        .sort((a, b) => b.avg - a.avg || b.count - a.count);

      if (rankedRegions[0]) {
        items.push({
          type: 'top_signal',
          text: t('weeklySummary.topSignal.regionPerformed', {
            region: rankedRegions[0].region,
          }),
          icon: '✨',
        });
      } else if (tasteProfile) {
        // No stand-out region yet — use profile-level reinforcement
        items.push({
          type: 'top_signal',
          text: t('weeklySummary.topSignal.profileMatch'),
          icon: '✨',
        });
      }
    }
  }

  // ── 4. Explore next ───────────────────────────────────────────────────────
  // High activity + profile confidence med/high only.
  // Cross-references taste profile's favourite regions against this week's
  // explored regions, then suggests a fresh direction.
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

    // First profile top-region NOT seen this week → suggest it
    const suggestedRegion = profileTopRegions.find((r) => !weekRegions.has(r));

    if (suggestedRegion) {
      items.push({
        type: 'explore_next',
        text: t('weeklySummary.exploreNext.suggestion', { region: suggestedRegion }),
        icon: '🧭',
      });
    } else {
      // All top regions were explored — celebrate diversity
      items.push({
        type: 'explore_next',
        text: t('weeklySummary.exploreNext.generic'),
        icon: '🧭',
      });
    }
  }

  return {
    items: items.slice(0, 3),
    activity_level: activityLevel,
    period_start,
    period_end,
  };
}
