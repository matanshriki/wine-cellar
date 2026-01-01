/**
 * Bottle Service
 * 
 * Data access layer for wine bottles and inventory.
 * Separates wines (catalog) from bottles (inventory).
 */

import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

type Wine = Database['public']['Tables']['wines']['Row'];
type WineInsert = Database['public']['Tables']['wines']['Insert'];
type Bottle = Database['public']['Tables']['bottles']['Row'];
type BottleInsert = Database['public']['Tables']['bottles']['Insert'];
type BottleUpdate = Database['public']['Tables']['bottles']['Update'];

export interface BottleWithWineInfo extends Bottle {
  wine: Wine;
}

/**
 * List all bottles for the current user (with wine info)
 * Analysis data is stored directly in the bottles table
 */
export async function listBottles(): Promise<BottleWithWineInfo[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('bottles')
    .select(`
      *,
      wine:wines(*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false});

  if (error) {
    console.error('Error fetching bottles:', error);
    throw new Error('Failed to fetch bottles');
  }

  // Analysis data is already in the bottles table, no need to flatten
  return data as BottleWithWineInfo[];
}

/**
 * Get a single bottle by ID
 */
export async function getBottle(id: string): Promise<BottleWithWineInfo | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('bottles')
    .select(`
      *,
      wine:wines(*)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching bottle:', error);
    throw new Error('Failed to fetch bottle');
  }

  return data as BottleWithWineInfo;
}

/**
 * Create a new bottle (wine + bottle instance)
 * This handles both creating the wine entry and the bottle entry
 */
export interface CreateBottleInput {
  // Wine info
  producer: string;
  wine_name: string;
  vintage?: number | null;
  country?: string | null;
  region?: string | null;
  regional_wine_style?: string | null;
  appellation?: string | null;
  color: 'red' | 'white' | 'rose' | 'sparkling';
  grapes?: string[] | null;
  vivino_wine_id?: string | null;
  rating?: number | null;
  vivino_url?: string | null;
  wine_notes?: string | null;
  
  // Bottle info
  quantity?: number;
  purchase_date?: string | null;
  purchase_price?: number | null;
  purchase_location?: string | null;
  storage_location?: string | null;
  bottle_size_ml?: number;
  notes?: string | null;
  image_url?: string | null;
  tags?: string[] | null;
}

export async function createBottle(input: CreateBottleInput): Promise<BottleWithWineInfo> {
  console.log('[bottleService] ========== CREATE BOTTLE ==========');
  console.log('[bottleService] Input:', JSON.stringify(input, null, 2));
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('[bottleService] ❌ Not authenticated');
    throw new Error('Not authenticated');
  }
  
  console.log('[bottleService] User ID:', user.id);

  // First, try to find or create the wine
  const wineData: WineInsert = {
    user_id: user.id,
    producer: input.producer,
    wine_name: input.wine_name,
    vintage: input.vintage || null,
    country: input.country || null,
    region: input.region || null,
    regional_wine_style: input.regional_wine_style || null,
    appellation: input.appellation || null,
    color: input.color,
    grapes: input.grapes ? input.grapes : null,
    vivino_wine_id: input.vivino_wine_id || null,
    rating: input.rating || null,
    vivino_url: input.vivino_url || null,
    image_url: input.image_url || null,
    notes: input.wine_notes || null,
  };
  
  console.log('[bottleService] Wine data:', JSON.stringify(wineData, null, 2));

  // Try to insert wine, or get existing if conflict
  console.log('[bottleService] Upserting wine...');
  const { data: wine, error: wineError } = await supabase
    .from('wines')
    .upsert(wineData as any, {
      onConflict: 'user_id,producer,wine_name,vintage',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (wineError) {
    console.error('[bottleService] ❌ Error creating/finding wine:', wineError);
    throw new Error('Failed to create wine entry');
  }
  
  console.log('[bottleService] ✅ Wine created/found, ID:', wine.id);

  // Now create the bottle
  const bottleData: BottleInsert = {
    user_id: user.id,
    wine_id: wine.id,
    quantity: input.quantity || 1,
    purchase_date: input.purchase_date || null,
    purchase_price: input.purchase_price || null,
    purchase_location: input.purchase_location || null,
    storage_location: input.storage_location || null,
    bottle_size_ml: input.bottle_size_ml || 750,
    notes: input.notes || null,
    image_url: input.image_url || null,
    tags: input.tags ? input.tags : null,
  };
  
  console.log('[bottleService] Bottle data:', JSON.stringify(bottleData, null, 2));

  console.log('[bottleService] Inserting bottle...');
  const { data: bottle, error: bottleError } = await supabase
    .from('bottles')
    .insert(bottleData as any)
    .select()
    .single();

  if (bottleError) {
    console.error('[bottleService] ❌ Error creating bottle:', bottleError);
    throw new Error('Failed to create bottle');
  }
  
  console.log('[bottleService] ✅ Bottle created successfully, ID:', bottle.id);

  const result = {
    ...(bottle as any),
    wine,
  } as BottleWithWineInfo;
  
  console.log('[bottleService] Returning bottle with wine info');
  return result;
}

/**
 * Update a bottle
 */
export async function updateBottle(id: string, updates: BottleUpdate): Promise<BottleWithWineInfo> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  // @ts-ignore - Supabase type inference issue
  const { data, error } = await supabase
    .from('bottles')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(`
      *,
      wine:wines(*)
    `)
    .single();

  if (error) {
    console.error('Error updating bottle:', error);
    throw new Error('Failed to update bottle');
  }

  return data as any as BottleWithWineInfo;
}

/**
 * Delete a bottle
 */
export async function deleteBottle(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('bottles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting bottle:', error);
    throw new Error('Failed to delete bottle');
  }
}

/**
 * Update bottle analysis (AI-generated readiness info)
 */
export async function updateBottleAnalysis(
  id: string,
  analysis: {
    readiness_status?: string;
    readiness_score?: number;
    drink_window_start?: number;
    drink_window_end?: number;
    serve_temp_c?: number;
    decant_minutes?: number;
    analysis_notes?: string;
  }
): Promise<BottleWithWineInfo> {
  return updateBottle(id, {
    ...analysis,
    analyzed_at: new Date().toISOString(),
  } as any);
}

/**
 * Update wine information
 * Updates wine-level fields (vintage, producer, region, etc.)
 */
export interface UpdateWineInput {
  wine_name?: string;
  producer?: string;
  vintage?: number | null;
  region?: string | null;
  country?: string | null;
  color?: 'red' | 'white' | 'rose' | 'sparkling';
  grapes?: string[] | null;
  vivino_url?: string | null;
}

export async function updateWineInfo(
  wineId: string,
  updates: UpdateWineInput
): Promise<Wine> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  console.log('[bottleService] Updating wine info:', { wineId, updates });

  const { data, error } = await supabase
    .from('wines')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', wineId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('[bottleService] Error updating wine:', error);
    throw new Error('Failed to update wine information');
  }

  console.log('[bottleService] ✅ Wine updated successfully:', data);
  return data as Wine;
}

/**
 * Update wine image URL
 * User-driven image management (ToS compliant)
 */
export async function updateWineImage(
  wineId: string,
  imageUrl: string | null
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Update the wine's image_url
  const { error } = await supabase
    .from('wines')
    .update({ 
      image_url: imageUrl || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', wineId)
    .eq('user_id', user.id); // Ensure user owns this wine

  if (error) {
    console.error('Error updating wine image:', error);
    throw new Error('Failed to update wine image');
  }
}

