/**
 * Kosher Detection Service
 *
 * Client-side helper for triggering Kosher enrichment on wines.
 * Invokes the detect-kosher-status Supabase Edge Function fire-and-forget —
 * never blocks bottle creation or the UI.
 *
 * Reads the cached Kosher result directly from the wine row
 * (which is already loaded as part of the bottles query).
 */

import { supabase } from '../lib/supabase';
import type { BottleWithWineInfo } from './bottleService';

// ── Types ─────────────────────────────────────────────────────────────────────

export type KosherConfidence = 'low' | 'med' | 'high';

export interface KosherInfo {
  is_kosher: boolean | null;
  kosher_for_passover: boolean | null;
  mevushal: boolean | null;
  kosher_certification: string | null;
  kosher_confidence: KosherConfidence | null;
  kosher_source_url: string | null;
  kosher_source_name: string | null;
  kosher_notes: string | null;
  kosher_updated_at: string | null;
}

// ── Read helpers ──────────────────────────────────────────────────────────────

/**
 * Extract the Kosher info from a bottle's wine row.
 * All fields are nullable; null means "not yet determined".
 */
export function readKosherInfo(wine: Record<string, unknown>): KosherInfo {
  return {
    is_kosher: (wine.is_kosher as boolean | null) ?? null,
    kosher_for_passover: (wine.kosher_for_passover as boolean | null) ?? null,
    mevushal: (wine.mevushal as boolean | null) ?? null,
    kosher_certification: (wine.kosher_certification as string | null) ?? null,
    kosher_confidence: (wine.kosher_confidence as KosherConfidence | null) ?? null,
    kosher_source_url: (wine.kosher_source_url as string | null) ?? null,
    kosher_source_name: (wine.kosher_source_name as string | null) ?? null,
    kosher_notes: (wine.kosher_notes as string | null) ?? null,
    kosher_updated_at: (wine.kosher_updated_at as string | null) ?? null,
  };
}

// ── Fire-and-forget trigger ───────────────────────────────────────────────────

/**
 * Trigger Kosher detection for a newly created bottle's wine, fire-and-forget.
 * Skipped automatically when:
 *   - The wine already has reliable (med/high confidence) Kosher data
 *   - The wine row is missing a wine_id
 *
 * Errors are swallowed — this must never break bottle creation.
 */
export function triggerKosherDetection(
  bottle: BottleWithWineInfo,
  triggerSource: 'system_background' | 'manual' | 'backfill' = 'system_background',
): void {
  const wine = bottle.wine as Record<string, unknown>;

  // Skip if the wine already has reliable Kosher data
  const existingConfidence = wine.kosher_confidence as string | null;
  const existingUpdatedAt = wine.kosher_updated_at as string | null;
  if (existingUpdatedAt && (existingConfidence === 'med' || existingConfidence === 'high')) {
    return;
  }

  const wineId = bottle.wine_id;
  if (!wineId) return;

  const wineData = {
    producer: wine.producer as string,
    wine_name: wine.wine_name as string,
    vintage: (wine.vintage as number | null) ?? null,
    country: (wine.country as string | null) ?? null,
    region: (wine.region as string | null) ?? null,
    appellation: (wine.appellation as string | null) ?? null,
    color: (wine.color as string | null) ?? null,
  };

  supabase.functions
    .invoke('detect-kosher-status', {
      body: {
        wine_id: wineId,
        wine_data: wineData,
        trigger_source: triggerSource,
      },
    })
    .then(({ error }) => {
      if (error) {
        console.warn('[kosherService] detect-kosher-status returned error:', error);
      }
    })
    .catch((err) => {
      console.warn('[kosherService] detect-kosher-status invocation failed:', err);
    });
}
