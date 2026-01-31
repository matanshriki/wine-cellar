/**
 * Drink Window Insights
 * 
 * Computes bucket counts, momentum deltas, and tonight signal
 * for the Drink Window Timeline component
 */

import type { BottleWithWineInfo } from '../services/bottleService';

export type ReadinessCategory = 'READY' | 'PEAK_SOON' | 'HOLD' | 'UNKNOWN';

export interface BucketCount {
  count: number;
  bottles: BottleWithWineInfo[];
}

export interface BucketInsights {
  HOLD: BucketCount & { delta?: number };
  PEAK_SOON: BucketCount & { delta?: number };
  READY: BucketCount & { delta?: number };
  totalAnalyzed: number;
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

/**
 * Get bucket insights with counts and optional deltas
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
