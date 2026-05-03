/**
 * Insight Cache
 *
 * Session-level in-memory dedupe cache for shown insights.
 * Prevents the same insight type from appearing in adjacent flows
 * (e.g. open-ritual Step 3 → post-rating Step) within a short window.
 *
 * Intentionally in-memory only — no localStorage or DB persistence required.
 * The 10-minute window covers sibling flows without persisting across sessions.
 */

import type { InsightType } from './insightService';

const DEDUPE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  type: InsightType;
  text: string;
  ts: number;
}

let _cache: CacheEntry[] = [];

function pruned(): CacheEntry[] {
  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  _cache = _cache.filter((e) => e.ts >= cutoff);
  return _cache;
}

/** Record that an insight was displayed to the user. Call after rendering the pill. */
export function recordShownInsight(insight: { type: InsightType; text: string }): void {
  pruned();
  _cache.push({ type: insight.type, text: insight.text, ts: Date.now() });
}

/**
 * Returns the set of InsightType values shown within the deduplication window.
 * Pass into getBottleInsight() as options.excludeTypes to skip already-shown types.
 */
export function getRecentlyShownTypes(): Set<InsightType> {
  return new Set(pruned().map((e) => e.type));
}

/** Clear the cache — useful on logout or in tests. */
export function clearInsightCache(): void {
  _cache = [];
}
