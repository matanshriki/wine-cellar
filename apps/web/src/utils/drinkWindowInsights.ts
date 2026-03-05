/**
 * Drink Window Insights
 *
 * Computes bucket counts, momentum deltas, and tonight signal
 * for the Drink Window Timeline component.
 *
 * Confidence weighting (internal only — does NOT affect displayed counts):
 * Each bottle's readiness_label is weighted by its AI confidence so that
 * high-confidence assessments carry more signal when computing ratios/scores.
 *   high  → 1.0
 *   med   → 0.7
 *   low   → 0.4
 *   missing/unknown → 0.4  (treat as low, never zero)
 *
 * Guard: if fewer than 50% of analyzed bottles have a known confidence,
 * `weighted.isReliable` is false and callers should fall back to raw counts.
 */

import type { BottleWithWineInfo } from '../services/bottleService';

// ─── Dev logging (Vite only, never reaches production bundle) ─────────────────
const IS_DEV = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV === true;

export type ReadinessCategory = 'READY' | 'PEAK_SOON' | 'HOLD' | 'UNKNOWN';

export interface BucketCount {
  count: number;
  bottles: BottleWithWineInfo[];
}

/** Confidence-weighted distribution (computation only — UI always uses raw counts). */
export interface WeightedDistribution {
  HOLD: number;       // sum of per-bottle weights for HOLD bottles
  PEAK_SOON: number;
  READY: number;
  total: number;      // HOLD + PEAK_SOON + READY weighted sum
  coverage: number;   // fraction of analyzed bottles that have a known confidence (0–1)
  isReliable: boolean; // true when coverage >= 0.5 (enough signal to trust weighting)
}

export interface BucketInsights {
  HOLD: BucketCount & { delta?: number };
  PEAK_SOON: BucketCount & { delta?: number };
  READY: BucketCount & { delta?: number };
  totalAnalyzed: number;
  /** Confidence-weighted counts. Use for ratio/score calculations; never display directly. */
  weighted: WeightedDistribution;
}

export interface TonightSignal {
  count: number;
  threshold: number;
}

interface Snapshot {
  date: string; // ISO date
  HOLD: number;
  PEAK_SOON: number;
  READY: number;
}

const SNAPSHOT_KEY = 'drinkWindowSnapshots';
const SNAPSHOT_RETENTION_DAYS = 90; // Keep 90 days of history
const DEFAULT_RATING_THRESHOLD = 4.2;

/**
 * Categorize bottles by readiness
 */
export function categorizeBottles(bottles: BottleWithWineInfo[]): Record<ReadinessCategory, BottleWithWineInfo[]> {
  const categories: Record<ReadinessCategory, BottleWithWineInfo[]> = {
    HOLD: [],
    PEAK_SOON: [],
    READY: [],
    UNKNOWN: [],
  };

  bottles.forEach((bottle) => {
    const analysis = bottle as any;
    if (analysis.readiness_label) {
      const category = analysis.readiness_label as ReadinessCategory;
      if (categories[category]) {
        categories[category].push(bottle);
      } else {
        categories.UNKNOWN.push(bottle);
      }
    } else {
      categories.UNKNOWN.push(bottle);
    }
  });

  return categories;
}

// ─── Confidence weighting ─────────────────────────────────────────────────────

const CONFIDENCE_WEIGHTS: Record<string, number> = {
  // From AI analysis edge fn: stored uppercase
  high:   1.0, HIGH:   1.0,
  // 'medium' used internally by drinkWindowService; 'med' used by DB columns
  medium: 0.7, MEDIUM: 0.7,
  med:    0.7, MED:    0.7,
  low:    0.4, LOW:    0.4,
};
const WEIGHT_MISSING = 0.4; // treat absent confidence the same as LOW
const COVERAGE_THRESHOLD = 0.5; // minimum fraction of bottles with known confidence

/**
 * Resolve a single bottle's confidence weight.
 * Checks both `confidence` (uppercase, from AI analysis) and
 * `readiness_confidence` (lowercase, from backfill) fields.
 * Returns { weight, hasConfidence }.
 */
function resolveWeight(bottle: BottleWithWineInfo): { weight: number; hasConfidence: boolean } {
  const b = bottle as any;
  // Prefer readiness_confidence (more granular backfill field), fall back to confidence
  const raw: string | undefined = b.readiness_confidence ?? b.confidence;
  if (raw && CONFIDENCE_WEIGHTS[raw] !== undefined) {
    return { weight: CONFIDENCE_WEIGHTS[raw], hasConfidence: true };
  }
  return { weight: WEIGHT_MISSING, hasConfidence: false };
}

/**
 * Compute confidence-weighted distribution across the three readiness buckets.
 * Safe against empty inputs (never NaN / division by zero).
 */
function computeWeighted(
  categorized: Record<ReadinessCategory, BottleWithWineInfo[]>,
  totalAnalyzed: number,
): WeightedDistribution {
  // Fallback when nothing is analyzed
  if (totalAnalyzed === 0) {
    return { HOLD: 0, PEAK_SOON: 0, READY: 0, total: 0, coverage: 0, isReliable: false };
  }

  let wHold = 0, wPeak = 0, wReady = 0;
  let countWithConfidence = 0;

  const tally = (bottles: BottleWithWineInfo[], acc: (w: number) => void) => {
    bottles.forEach((b) => {
      const { weight, hasConfidence } = resolveWeight(b);
      if (hasConfidence) countWithConfidence++;
      acc(weight);
    });
  };

  tally(categorized.HOLD,      (w) => { wHold  += w; });
  tally(categorized.PEAK_SOON, (w) => { wPeak  += w; });
  tally(categorized.READY,     (w) => { wReady += w; });

  const total    = wHold + wPeak + wReady;
  const coverage = countWithConfidence / totalAnalyzed;
  const isReliable = coverage >= COVERAGE_THRESHOLD;

  return { HOLD: wHold, PEAK_SOON: wPeak, READY: wReady, total, coverage, isReliable };
}

/**
 * Get bucket insights with counts and optional deltas.
 * UI always renders raw counts; weighted distribution is returned for
 * internal callers (health score, recommendation scoring, agent context).
 */
export function getBucketInsights(bottles: BottleWithWineInfo[]): BucketInsights {
  const categorized = categorizeBottles(bottles);
  const totalAnalyzed = categorized.HOLD.length + categorized.PEAK_SOON.length + categorized.READY.length;

  // Get deltas from last snapshot (30 days ago)
  const deltas = calculateDeltas({
    HOLD: categorized.HOLD.length,
    PEAK_SOON: categorized.PEAK_SOON.length,
    READY: categorized.READY.length,
  });

  // Compute confidence-weighted distribution (internal use only)
  const weighted = computeWeighted(categorized, totalAnalyzed);

  if (IS_DEV) {
    const rawTotal = totalAnalyzed || 1; // avoid /0 in log
    console.group('[drinkWindowInsights] Readiness distribution');
    console.log('Total analyzed:', totalAnalyzed);
    console.log(
      'Raw:     HOLD=%d  PEAK_SOON=%d  READY=%d',
      categorized.HOLD.length, categorized.PEAK_SOON.length, categorized.READY.length,
    );
    console.log(
      'Raw %%:  HOLD=%.0f%%  PEAK_SOON=%.0f%%  READY=%.0f%%',
      (categorized.HOLD.length / rawTotal) * 100,
      (categorized.PEAK_SOON.length / rawTotal) * 100,
      (categorized.READY.length / rawTotal) * 100,
    );
    console.log(
      'Weighted: HOLD=%.2f  PEAK_SOON=%.2f  READY=%.2f  total=%.2f',
      weighted.HOLD, weighted.PEAK_SOON, weighted.READY, weighted.total,
    );
    if (weighted.total > 0) {
      console.log(
        'Weighted %%: HOLD=%.0f%%  PEAK_SOON=%.0f%%  READY=%.0f%%',
        (weighted.HOLD / weighted.total) * 100,
        (weighted.PEAK_SOON / weighted.total) * 100,
        (weighted.READY / weighted.total) * 100,
      );
    }
    console.log(
      'Confidence coverage: %.0f%%  isReliable: %s',
      weighted.coverage * 100,
      weighted.isReliable ? 'YES' : 'NO (fallback to raw)',
    );
    console.groupEnd();
  }

  return {
    HOLD: {
      count: categorized.HOLD.length,
      bottles: categorized.HOLD,
      delta: deltas.HOLD,
    },
    PEAK_SOON: {
      count: categorized.PEAK_SOON.length,
      bottles: categorized.PEAK_SOON,
      delta: deltas.PEAK_SOON,
    },
    READY: {
      count: categorized.READY.length,
      bottles: categorized.READY,
      delta: deltas.READY,
    },
    totalAnalyzed,
    weighted,
  };
}

/**
 * Compute tonight signal (highly-rated ready wines)
 */
export function computeTonightSignal(
  readyBottles: BottleWithWineInfo[],
  ratingThreshold: number = DEFAULT_RATING_THRESHOLD
): TonightSignal {
  const count = readyBottles.filter((bottle) => {
    const wine = bottle.wine || bottle;
    const rating = (wine as any).vivino_rating || (wine as any).rating || 0;
    return rating >= ratingThreshold;
  }).length;

  return {
    count,
    threshold: ratingThreshold,
  };
}

/**
 * Save current snapshot to localStorage
 */
export function saveSnapshot(counts: { HOLD: number; PEAK_SOON: number; READY: number }): void {
  try {
    const snapshots = getSnapshots();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Add new snapshot
    snapshots.push({
      date: today,
      ...counts,
    });

    // Keep only recent snapshots (last 90 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - SNAPSHOT_RETENTION_DAYS);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const filtered = snapshots.filter((snap) => snap.date >= cutoffStr);

    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[drinkWindowInsights] Error saving snapshot:', error);
  }
}

/**
 * Get all snapshots from localStorage
 */
function getSnapshots(): Snapshot[] {
  try {
    const stored = localStorage.getItem(SNAPSHOT_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('[drinkWindowInsights] Error reading snapshots:', error);
    return [];
  }
}

/**
 * Calculate deltas from ~30 days ago
 */
function calculateDeltas(current: {
  HOLD: number;
  PEAK_SOON: number;
  READY: number;
}): { HOLD?: number; PEAK_SOON?: number; READY?: number } {
  const snapshots = getSnapshots();
  if (snapshots.length === 0) return {};

  // Find snapshot closest to 30 days ago
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 30);
  const targetStr = targetDate.toISOString().split('T')[0];

  // Find closest snapshot
  let closestSnapshot: Snapshot | null = null;
  let closestDiff = Infinity;

  snapshots.forEach((snap) => {
    const diff = Math.abs(new Date(snap.date).getTime() - new Date(targetStr).getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closestSnapshot = snap;
    }
  });

  if (!closestSnapshot) return {};

  // Calculate deltas (only if difference > 0)
  const deltas: { HOLD?: number; PEAK_SOON?: number; READY?: number } = {};

  const holdDelta = current.HOLD - closestSnapshot.HOLD;
  const peakSoonDelta = current.PEAK_SOON - closestSnapshot.PEAK_SOON;
  const readyDelta = current.READY - closestSnapshot.READY;

  if (holdDelta !== 0) deltas.HOLD = holdDelta;
  if (peakSoonDelta !== 0) deltas.PEAK_SOON = peakSoonDelta;
  if (readyDelta !== 0) deltas.READY = readyDelta;

  return deltas;
}

/**
 * Check if we should save a snapshot (once per day)
 */
export function shouldSaveSnapshot(): boolean {
  const snapshots = getSnapshots();
  if (snapshots.length === 0) return true;

  const today = new Date().toISOString().split('T')[0];
  const lastSnapshot = snapshots[snapshots.length - 1];

  return lastSnapshot.date !== today;
}
