/**
 * History Service
 * 
 * Data access layer for consumption history and statistics.
 */

import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import * as tasteProfileService from './tasteProfileService';

type ConsumptionHistory = Database['public']['Tables']['consumption_history']['Row'];
type ConsumptionHistoryInsert = Database['public']['Tables']['consumption_history']['Insert'];

export interface ConsumptionHistoryWithDetails extends ConsumptionHistory {
  bottle: {
    wine: {
      producer: string;
      wine_name: string;
      vintage: number | null;
      color: string;
      region: string | null;
    };
  } | null;
}

/**
 * List consumption history for the current user
 */
export async function listHistory(): Promise<ConsumptionHistoryWithDetails[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('consumption_history')
    .select(`
      *,
      bottle:bottles(
        wine:wines(
          producer,
          wine_name,
          vintage,
          color,
          region
        )
      )
    `)
    .eq('user_id', user.id)
    .order('opened_at', { ascending: false });

  if (error) {
    console.error('Error fetching history:', error);
    throw new Error('Failed to fetch consumption history');
  }

  return data as ConsumptionHistoryWithDetails[];
}

/**
 * Mark a bottle as opened (creates consumption history + decrements quantity)
 */
export interface MarkBottleOpenedInput {
  bottle_id: string;
  opened_count?: number; // Number of bottles to open (default: 1)
  occasion?: string;
  meal_type?: string;
  vibe?: string;
  user_rating?: number;
  tasting_notes?: string;
  meal_notes?: string;
}

export async function markBottleOpened(input: MarkBottleOpenedInput): Promise<ConsumptionHistory> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Validate opened_count (default to 1 if not provided)
  const openedCount = input.opened_count || 1;
  if (openedCount < 1) {
    throw new Error('Opened count must be at least 1');
  }

  // First, get the bottle to get wine_id and check quantity
  const { data: bottle, error: bottleError } = await supabase
    .from('bottles')
    .select('id, wine_id, quantity')
    .eq('id', input.bottle_id)
    .eq('user_id', user.id)
    .single() as any;

  if (bottleError || !bottle) {
    console.error('Error fetching bottle:', bottleError);
    throw new Error('Bottle not found');
  }

  if (bottle.quantity <= 0) {
    throw new Error('No bottles left to open');
  }

  if (openedCount > bottle.quantity) {
    throw new Error(`Cannot open ${openedCount} bottles - only ${bottle.quantity} available`);
  }

  // Create consumption history entry with opened_quantity
  const historyData: ConsumptionHistoryInsert = {
    user_id: user.id,
    bottle_id: input.bottle_id,
    wine_id: bottle.wine_id,
    opened_quantity: openedCount,
    occasion: input.occasion || null,
    meal_type: input.meal_type || null,
    vibe: input.vibe || null,
    user_rating: input.user_rating || null,
    tasting_notes: input.tasting_notes || null,
    meal_notes: input.meal_notes || null,
  };

  const { data: history, error: historyError } = await supabase
    .from('consumption_history')
    .insert(historyData as any)
    .select()
    .single();

  if (historyError) {
    console.error('Error creating consumption history:', historyError);
    throw new Error('Failed to record consumption');
  }

  // Decrement bottle quantity by opened_count
  const newQuantity = bottle.quantity - openedCount;
  // @ts-ignore - Supabase type inference issue
  const { error: updateError } = await supabase
    .from('bottles')
    .update({ quantity: newQuantity })
    .eq('id', input.bottle_id)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('Error decrementing bottle quantity:', updateError);
    // Note: History entry was created but quantity wasn't decremented
    // In production, this should be a transaction
    throw new Error('Failed to update bottle quantity');
  }

  // Trigger taste profile recompute if a rating was provided
  if (input.user_rating) {
    tasteProfileService.recomputeMyTasteProfile().catch(err => {
      console.log('[HistoryService] Failed to recompute taste profile:', err);
    });
  }

  return history;
}

/**
 * Update an existing consumption history entry
 */
export interface UpdateConsumptionHistoryInput {
  occasion?: string;
  meal_type?: string;
  vibe?: string;
  user_rating?: number;
  tasting_notes?: string;
  meal_notes?: string;
  notes?: string;
}

export async function updateConsumptionHistory(
  historyId: string, 
  updates: UpdateConsumptionHistoryInput
): Promise<ConsumptionHistory> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('consumption_history')
    .update(updates)
    .eq('id', historyId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating consumption history:', error);
    throw new Error('Failed to update consumption history');
  }

  // Trigger taste profile recompute if rating was updated
  if (updates.user_rating !== undefined) {
    tasteProfileService.recomputeMyTasteProfile().catch(err => {
      console.log('[HistoryService] Failed to recompute taste profile:', err);
    });
  }

  return data;
}

/**
 * Get consumption statistics for the current user
 */
export interface ConsumptionStats {
  total_opens: number;
  average_rating: number;
  favorite_color: string | null;
  favorite_region: string | null;
  opens_per_month: { month: string; count: number }[];
  top_regions: { region: string; count: number }[];
}

export async function getConsumptionStats(): Promise<ConsumptionStats> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Get all history with wine details
  const history = await listHistory();

  // Calculate stats
  const totalOpens = history.length;
  
  const ratingsCount = history.filter(h => h.user_rating).length;
  const averageRating = ratingsCount > 0
    ? history.reduce((sum, h) => sum + (h.user_rating || 0), 0) / ratingsCount
    : 0;

  // Favorite color
  const colorCounts = history.reduce((acc, h) => {
    const color = h.bottle?.wine?.color;
    if (color) {
      acc[color] = (acc[color] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const favoriteColor = Object.keys(colorCounts).length > 0
    ? Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  // Favorite region
  const regionCounts = history.reduce((acc, h) => {
    const region = h.bottle?.wine?.region;
    if (region) {
      acc[region] = (acc[region] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const favoriteRegion = Object.keys(regionCounts).length > 0
    ? Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  // Top regions
  const topRegions = Object.entries(regionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([region, count]) => ({ region, count }));

  // Opens per month (last 6 months)
  const monthCounts = history.reduce((acc, h) => {
    const month = new Date(h.opened_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const opensPerMonth = Object.entries(monthCounts)
    .map(([month, count]) => ({ month, count }))
    .slice(0, 6)
    .reverse();

  return {
    total_opens: totalOpens,
    average_rating: Math.round(averageRating * 10) / 10,
    favorite_color: favoriteColor,
    favorite_region: favoriteRegion,
    opens_per_month: opensPerMonth,
    top_regions: topRegions,
  };
}

/**
 * Undo marking a bottle as opened (send back to cellar)
 * Deletes consumption history entry and increments bottle quantity back by 1
 */
export async function undoBottleOpened(historyId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  // First, get the history entry to get bottle_id
  const { data: history, error: historyFetchError } = await supabase
    .from('consumption_history')
    .select('bottle_id')
    .eq('id', historyId)
    .eq('user_id', user.id)
    .single();

  if (historyFetchError || !history) {
    console.error('Error fetching history entry:', historyFetchError);
    throw new Error('History entry not found');
  }

  // Get the bottle to check if it still exists
  const { data: bottle, error: bottleError } = await supabase
    .from('bottles')
    .select('id, quantity')
    .eq('id', history.bottle_id)
    .eq('user_id', user.id)
    .single() as any;

  if (bottleError || !bottle) {
    console.error('Error fetching bottle:', bottleError);
    throw new Error('Bottle not found - it may have been deleted');
  }

  // Delete consumption history entry
  const { error: deleteError } = await supabase
    .from('consumption_history')
    .delete()
    .eq('id', historyId)
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('Error deleting consumption history:', deleteError);
    throw new Error('Failed to remove from history');
  }

  // Increment bottle quantity back by 1
  const { error: updateError } = await supabase
    .from('bottles')
    .update({ quantity: bottle.quantity + 1 })
    .eq('id', history.bottle_id)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('Error incrementing bottle quantity:', updateError);
    // Note: History entry was deleted but quantity wasn't incremented
    // In production, this should be a transaction
    throw new Error('Failed to update bottle quantity');
  }
}

/** Aggregated opens from History for a wine — used by Cellar Sommelier context */
export interface WineHistoryInsight {
  avgRating: number | null;
  /** Opens that had a 1–5 star rating */
  ratingCount: number;
  /** Total consumption_history rows for this wine */
  openCount: number;
  /** Combined snippets from tasting_notes, meal_notes, notes (truncated) */
  notesSummary: string | null;
}

const WINE_ID_CHUNK = 80;

/**
 * Load per-wine ratings and notes from consumption_history for the given wine IDs.
 * Safe to call with empty array; fails soft (empty map).
 */
export async function fetchWineHistoryInsightsForWineIds(
  wineIds: string[]
): Promise<Map<string, WineHistoryInsight>> {
  const out = new Map<string, WineHistoryInsight>();
  const unique = [...new Set(wineIds.filter(Boolean))];
  if (unique.length === 0) return out;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return out;

  const rows: Array<{
    wine_id: string;
    user_rating: number | null;
    tasting_notes: string | null;
    meal_notes: string | null;
    notes: string | null;
    opened_at: string;
  }> = [];

  for (let i = 0; i < unique.length; i += WINE_ID_CHUNK) {
    const chunk = unique.slice(i, i + WINE_ID_CHUNK);
    const { data, error } = await supabase
      .from('consumption_history')
      .select('wine_id, user_rating, tasting_notes, meal_notes, notes, opened_at')
      .eq('user_id', user.id)
      .in('wine_id', chunk)
      .order('opened_at', { ascending: false });

    if (error) {
      console.warn('[HistoryService] fetchWineHistoryInsightsForWineIds:', error.message);
      continue;
    }
    if (data?.length) rows.push(...(data as typeof rows));
  }

  const byWine = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byWine.get(r.wine_id) ?? [];
    list.push(r);
    byWine.set(r.wine_id, list);
  }

  const MAX_SNIPPETS = 3;
  const MAX_SNIP = 120;

  for (const [wineId, list] of byWine) {
    const ratings = list
      .map((r) => r.user_rating)
      .filter((x): x is number => typeof x === 'number' && x >= 1 && x <= 5);
    const avgRating =
      ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;

    const snippets: string[] = [];
    for (const r of list) {
      if (snippets.length >= MAX_SNIPPETS) break;
      const parts = [r.tasting_notes, r.meal_notes, r.notes].filter(Boolean) as string[];
      const joined = parts.join(' · ').trim();
      if (joined) snippets.push(joined.slice(0, MAX_SNIP));
    }
    let notesSummary = snippets.length ? snippets.join(' | ') : null;
    if (notesSummary && notesSummary.length > 480) {
      notesSummary = `${notesSummary.slice(0, 477)}...`;
    }

    out.set(wineId, {
      avgRating,
      ratingCount: ratings.length,
      openCount: list.length,
      notesSummary,
    });
  }

  return out;
}

