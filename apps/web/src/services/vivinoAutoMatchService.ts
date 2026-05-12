/**
 * Vivino Auto-Match Service
 *
 * After an AI label scan, automatically searches Vivino, fuzzy-matches the
 * best result against extracted wine data, fetches full wine details, and
 * returns them so the form can be pre-filled without any manual steps.
 *
 * Flow:
 *   1. Call `search-vivino-wine` edge function → get best matching wine_id
 *   2. Call `fetch-vivino-data` edge function with that wine_id
 *   3. Return combined result, or null on failure / low confidence
 */

import { supabase } from '../lib/supabase';
import type { VivinoWineData } from './vivinoScraper';

export interface WineInputForMatch {
  producer?: string | null;
  wine_name?: string | null;
  vintage?: number | string | null;
  region?: string | null;
  grape?: string | null;
}

export interface VivinoAutoMatchResult {
  /** Vivino wine ID (numeric string) */
  wine_id: string;
  /** 0–1 confidence score from the fuzzy match */
  confidence: number;
  /** Vivino's display name for the wine */
  name?: string;
  /** Vivino's display name for the winery */
  winery?: string;
  /** Full wine page URL for direct linking / re-fetching */
  vivino_url: string;
  /** Full Vivino wine data fetched from the matched page */
  data: VivinoWineData;
}

/**
 * Search Vivino for the best match to the given AI-extracted wine data.
 * Returns the matched wine ID + confidence, or null if no confident match found.
 */
async function findVivinoMatch(
  input: WineInputForMatch,
): Promise<{ wine_id: string; confidence: number; name?: string; winery?: string } | null> {
  const { data, error } = await supabase.functions.invoke('search-vivino-wine', {
    body: {
      producer: input.producer,
      wine_name: input.wine_name,
      vintage: input.vintage,
      region: input.region,
      grape: input.grape,
    },
  });

  if (error) {
    console.warn('[VivinoAutoMatch] search-vivino-wine error:', error.message);
    return null;
  }

  if (!data?.success || !data?.match) {
    console.log('[VivinoAutoMatch] No confident match found');
    return null;
  }

  return data.match;
}

/**
 * Fetch full wine data for a given Vivino wine ID via the existing edge function.
 */
async function fetchWineById(wine_id: string): Promise<VivinoWineData | null> {
  const { data, error } = await supabase.functions.invoke('fetch-vivino-data', {
    body: { wine_id },
  });

  if (error || !data?.success) {
    console.warn('[VivinoAutoMatch] fetch-vivino-data error:', error?.message || data?.error);
    return null;
  }

  return data.data as VivinoWineData;
}

/**
 * Main entry point: auto-match Vivino wine from AI-extracted data.
 *
 * Runs the full pipeline:
 *   0. DB cache lookup (reuse existing vivino_wine_id for repeat scans — 0 API calls)
 *   1. search-vivino-wine edge function (slug + explore + winery drill-down)
 *   2. fetch-vivino-data for full details
 *
 * Returns null on any failure so callers can silently fall back to the
 * existing search-URL flow.
 *
 * @param input  AI-extracted wine fields
 * @returns      Full match result including fetched Vivino data, or null
 */
export async function autoMatchVivino(
  input: WineInputForMatch,
): Promise<VivinoAutoMatchResult | null> {
  try {
    console.log('[VivinoAutoMatch] Starting auto-match for:', {
      producer: input.producer,
      wine_name: input.wine_name,
      vintage: input.vintage,
    });

    // Step 0: Check if the current user already has this wine with a known vivino_wine_id.
    // This covers repeat scans of the same bottle already in the cellar — zero API calls.
    if (input.producer && input.wine_name) {
      const { data: existingWines } = await supabase
        .from('wines')
        .select('vivino_wine_id, vivino_url, rating')
        .eq('producer', input.producer)
        .ilike('wine_name', `%${input.wine_name}%`)
        .not('vivino_wine_id', 'is', null)
        .limit(1);

      const existing = existingWines?.[0];
      if (existing?.vivino_wine_id) {
        console.log('[VivinoAutoMatch] DB cache hit — reusing vivino_wine_id:', existing.vivino_wine_id);
        const cachedData = await fetchWineById(existing.vivino_wine_id);
        if (cachedData) {
          return {
            wine_id: existing.vivino_wine_id,
            confidence: 1.0,
            vivino_url: existing.vivino_url ?? `https://www.vivino.com/w/${existing.vivino_wine_id}`,
            data: cachedData,
          };
        }
      }
    }

    // Step 1: Find best Vivino match via edge function
    const match = await findVivinoMatch(input);
    if (!match) return null;

    console.log('[VivinoAutoMatch] Matched wine_id:', match.wine_id, 'confidence:', match.confidence);

    // Step 2: Fetch full wine data from the matched wine_id
    const wineData = await fetchWineById(match.wine_id);
    if (!wineData) return null;

    const vivino_url = `https://www.vivino.com/w/${match.wine_id}`;

    console.log('[VivinoAutoMatch] Successfully fetched Vivino data:', {
      name: wineData.name,
      rating: wineData.rating,
      region: wineData.region,
    });

    return {
      wine_id: match.wine_id,
      confidence: match.confidence,
      name: match.name,
      winery: match.winery,
      vivino_url,
      data: wineData,
    };
  } catch (err: any) {
    console.warn('[VivinoAutoMatch] Unexpected error (silent fallback):', err?.message);
    return null;
  }
}
