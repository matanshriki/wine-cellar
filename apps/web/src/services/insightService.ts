/**
 * Insight Service
 *
 * Derives one short, contextual, personalized wine insight per bottle
 * using exclusively existing DB fields — no new tables required.
 *
 * Priority waterfall: first matching rule wins, returns null when no
 * insight is meaningful enough to surface.
 */

import i18n from '../i18n/config';
import type { BottleWithWineInfo } from './bottleService';
import type { TasteProfile } from '../types/supabase';
import * as tasteProfileService from './tasteProfileService';
import * as wineProfileService from './wineProfileService';

export interface WineInsight {
  text: string;
  /** Single emoji used as the pill icon */
  icon: string;
  /** Stable key for analytics/debugging — not shown in UI */
  type: InsightType;
}

export type InsightType =
  | 'region_affinity'
  | 'grape_affinity'
  | 'structural_affinity'
  | 'drink_window'
  | 'past_openings'
  | 'color_bias'
  | 'educational';

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Minimum normalised weight (–1…1) to call a region/grape a "preference". */
const AFFINITY_THRESHOLD = 0.25;

/** Minimum bias value (–1…1) to surface a color preference insight. */
const COLOR_BIAS_THRESHOLD = 0.45;

/** Minimum past openings to surface the repeat-enjoyment insight. */
const MIN_PAST_OPENINGS = 2;

// ─── Educational appellation / style lookup ───────────────────────────────────
// Keyed by lowercase regional_wine_style or appellation substring.
// Each entry yields a short educational sentence (already translated via i18n keys).

const EDUCATIONAL_KEYS: { pattern: RegExp; key: string }[] = [
  // More-specific patterns must come before any that are substrings of them.
  { pattern: /\bdocg\b/i,             key: 'insights.educational.docg' },
  { pattern: /\bdoc\b/i,              key: 'insights.educational.doc' },
  { pattern: /\baoc\b|\baop\b/i,      key: 'insights.educational.aoc' },
  { pattern: /\bchampagne\b/i,        key: 'insights.educational.champagne' },
  { pattern: /\bcru classé\b|\bcru classe\b/i, key: 'insights.educational.cruClasse' },
  { pattern: /\bgrand cru\b/i,        key: 'insights.educational.grandCru' },
  { pattern: /\bpremier cru\b/i,      key: 'insights.educational.premierCru' },
  // gran reserva MUST precede reserva — "Gran Reserva" contains "Reserva"
  { pattern: /\bgran reserva\b/i,     key: 'insights.educational.granReserva' },
  { pattern: /\breserva\b/i,          key: 'insights.educational.reserva' },
  { pattern: /\bbiodinamic\b|\bbiodynamic\b/i, key: 'insights.educational.biodynamic' },
  // Require "wine" next to "natural" — avoid matching estate/blend names with "natural"
  { pattern: /\bnatural wine\b/i,     key: 'insights.educational.naturalWine' },
  { pattern: /\borganic\b/i,          key: 'insights.educational.organic' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options as any) as string;
}

/** Return top-N entries from a weight map filtered to positive weights only. */
function topEntries(map: Record<string, number>, n: number): string[] {
  return Object.entries(map)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/** Normalise grapes field — DB stores JSONB which may be string[], string, or null. */
function parseGrapes(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((g): g is string => typeof g === 'string');
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return [raw]; }
  }
  return [];
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Derive one personalized insight for a bottle.
 *
 * All data comes from arguments — no async calls, no side effects.
 * Returns null when no meaningful insight can be generated (e.g. new user
 * with no taste profile, no relevant data match).
 *
 * @param bottle       Full bottle + wine row (as returned by bottleService)
 * @param tasteProfile Current user taste profile (null for new users)
 * @param options      Optional config:
 *   - excludeTypes: skip insight types already shown recently (used for
 *     post-rating deduplication so adjacent steps don't repeat the same pill)
 */
export function getBottleInsight(
  bottle: BottleWithWineInfo,
  tasteProfile: TasteProfile | null,
  options?: { excludeTypes?: Set<InsightType> },
): WineInsight | null {
  const wine = bottle.wine;
  const b = bottle as any; // access fields added via migrations not yet in generated types

  /** Returns the insight only when its type is not in the exclusion set. */
  function candidate(insight: WineInsight): WineInsight | null {
    return options?.excludeTypes?.has(insight.type) ? null : insight;
  }

  // ── 1. Region affinity ───────────────────────────────────────────────────
  if (tasteProfile && wine.region) {
    const regionWeight = tasteProfile.preferences.regions[wine.region];
    const topRegions = topEntries(tasteProfile.preferences.regions, 3);
    if (
      typeof regionWeight === 'number' &&
      regionWeight >= AFFINITY_THRESHOLD &&
      topRegions.includes(wine.region)
    ) {
      const r = candidate({
        type: 'region_affinity',
        icon: '📍',
        text: t('insights.regionAffinity', { region: wine.region }),
      });
      if (r) return r;
    }
  }

  // ── 2. Grape affinity ────────────────────────────────────────────────────
  if (tasteProfile) {
    const wineGrapes = parseGrapes(wine.grapes);
    const topGrapes = topEntries(tasteProfile.preferences.grapes, 3);
    const matchingGrape = wineGrapes.find(
      (g) =>
        topGrapes.includes(g) &&
        (tasteProfile.preferences.grapes[g] ?? 0) >= AFFINITY_THRESHOLD,
    );
    if (matchingGrape) {
      const r = candidate({
        type: 'grape_affinity',
        icon: '🍇',
        text: t('insights.grapeAffinity', { grape: matchingGrape }),
      });
      if (r) return r;
    }
  }

  // ── 3. Structural affinity (body / tannin / acidity / oak) ──────────────
  if (tasteProfile) {
    const wineProfile = wineProfileService.getWineProfile(wine as any);
    const structuralReason = tasteProfileService.generateAffinityReason(wineProfile, tasteProfile);
    if (structuralReason) {
      const r = candidate({
        type: 'structural_affinity',
        icon: '✨',
        text: structuralReason,
      });
      if (r) return r;
    }
  }

  // ── 4. Drink window ──────────────────────────────────────────────────────
  const readinessLabel: string | undefined = b.readiness_label;
  const readinessStatus: string | undefined = b.readiness_status;

  if (readinessLabel === 'READY') {
    const r = candidate({ type: 'drink_window', icon: '⏱️', text: t('insights.drinkWindowReady') });
    if (r) return r;
  }
  if (readinessLabel === 'PEAK_SOON') {
    const r = candidate({ type: 'drink_window', icon: '⏳', text: t('insights.drinkWindowPeakSoon') });
    if (r) return r;
  }
  // DB-computed status fallback (when AI label not available)
  if (
    typeof readinessStatus === 'string' &&
    ['peak', 'inwindow'].includes(readinessStatus.toLowerCase())
  ) {
    const r = candidate({ type: 'drink_window', icon: '⏱️', text: t('insights.drinkWindowReady') });
    if (r) return r;
  }

  // ── 5. Past openings ─────────────────────────────────────────────────────
  const pastOpenings: number = b.past_openings_count ?? 0;
  if (pastOpenings >= MIN_PAST_OPENINGS) {
    const r = candidate({
      type: 'past_openings',
      icon: '🔁',
      text: t('insights.pastOpenings', { count: pastOpenings }),
    });
    if (r) return r;
  }

  // ── 6. Color bias ────────────────────────────────────────────────────────
  if (tasteProfile) {
    const prefs = tasteProfile.preferences;
    const color = wine.color;
    if (color === 'red' && prefs.reds_bias >= COLOR_BIAS_THRESHOLD) {
      const r = candidate({ type: 'color_bias', icon: '🍷', text: t('insights.colorBiasRed') });
      if (r) return r;
    }
    if (color === 'white' && prefs.whites_bias >= COLOR_BIAS_THRESHOLD) {
      const r = candidate({ type: 'color_bias', icon: '🥂', text: t('insights.colorBiasWhite') });
      if (r) return r;
    }
    if (color === 'sparkling' && prefs.sparkling_bias >= COLOR_BIAS_THRESHOLD) {
      const r = candidate({ type: 'color_bias', icon: '🍾', text: t('insights.colorBiasSparkling') });
      if (r) return r;
    }
  }

  // ── 7. Educational (appellation / regional style) ─────────────────────────
  // regional_wine_style was added via migration and is not yet in the generated Wine type;
  // access it safely via the runtime object rather than the stale TS interface.
  const anyWine = wine as any;
  const searchStr = [anyWine.regional_wine_style as string | null, wine.appellation, wine.region]
    .filter(Boolean)
    .join(' ');
  if (searchStr) {
    for (const { pattern, key } of EDUCATIONAL_KEYS) {
      if (pattern.test(searchStr)) {
        const translated = t(key);
        // If key not yet in locale file, i18n returns the raw key — skip it
        if (translated && translated !== key) {
          const r = candidate({ type: 'educational', icon: '📖', text: translated });
          if (r) return r;
        }
      }
    }
  }

  return null;
}
