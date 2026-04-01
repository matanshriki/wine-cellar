/**
 * Bottle Service
 * 
 * Data access layer for wine bottles and inventory.
 * Separates wines (catalog) from bottles (inventory).
 */

import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import {
  normalizeWineMetadataStrings,
  planWineMetadataEnrichment,
} from '@wine/wine-enrichment';

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
 * 
 * @param options.offset - Starting index for pagination (default: 0)
 * @param options.limit - Maximum number of bottles to return (default: all)
 */
export async function listBottles(options?: { 
  offset?: number; 
  limit?: number;
}): Promise<BottleWithWineInfo[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  let query = supabase
    .from('bottles')
    .select(`
      *,
      wine:wines(*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false});

  // Apply pagination if specified
  if (options?.offset !== undefined && options?.limit !== undefined) {
    query = query.range(options.offset, options.offset + options.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching bottles:', error);
    throw new Error('Failed to fetch bottles');
  }

  // Analysis data is already in the bottles table, no need to flatten
  return data as BottleWithWineInfo[];
}

/**
 * Get total bottle count for the current user
 */
export async function getBottleCount(): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { count, error } = await supabase
    .from('bottles')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching bottle count:', error);
    throw new Error('Failed to fetch bottle count');
  }

  return count || 0;
}

/**
 * Get a single bottle by ID
 */
export async function getBottle(id: string): Promise<BottleWithWineInfo | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  
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
  purchase_price_currency?: string | null;
  purchase_location?: string | null;
  storage_location?: string | null;
  bottle_size_ml?: number;
  notes?: string | null;
  
  // Image storage (NEW: stable paths preferred)
  image_path?: string | null;           // Stable storage path (e.g., "labels/userId/uuid.jpg")
  label_image_path?: string | null;     // Stable storage path for label
  image_url?: string | null;            // Legacy: direct URL (external or temporary)
  
  tags?: string[] | null;

  /** How the wine was added — stored on the wines row for analytics/filtering */
  entry_source?: 'manual' | 'ai_scan' | 'csv_import' | 'vivino' | null;

  /** Keep / Reserve feature */
  is_reserved?: boolean;
  reserved_for?: string | null;
  reserved_date?: string | null;
  reserved_note?: string | null;
}

/**
 * Derive a permanent public URL from a label storage path.
 * The "labels" bucket is public so this URL never expires.
 * Falls back to null if the path is empty.
 */
function getLabelPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from('labels').getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export async function createBottle(input: CreateBottleInput): Promise<BottleWithWineInfo> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Resolve a permanent public URL from the storage path so it's visible in the DB.
  // Signed URLs expire; public URLs for the "labels" bucket do not.
  const storagePath = input.label_image_path || input.image_path || null;
  const publicLabelUrl = getLabelPublicUrl(storagePath);

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
    notes: input.wine_notes || null,
    entry_source: input.entry_source || null,
  };

  // Only include image fields when this bottle actually has an image.
  // Omitting them from the payload prevents the upsert from overwriting an
  // existing wine's image with null when a second bottle (without a photo)
  // is added for the same wine.
  if (input.image_path) (wineData as any).image_path = input.image_path;
  if (input.label_image_path) (wineData as any).label_image_path = input.label_image_path;
  const wineImageUrl = publicLabelUrl || input.image_url || null;
  if (wineImageUrl) (wineData as any).image_url = wineImageUrl;
  
  // Try to insert wine, or get existing if conflict
  const { data: wineRow, error: wineError } = await supabase
    .from('wines')
    .upsert(wineData as any, {
      onConflict: 'user_id,producer,wine_name,vintage',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (wineError) {
    throw new Error('Failed to create wine entry');
  }

  let wine = wineRow as Wine;

  // Internal: rule-based grape / style enrichment (conservative; no user-visible UI)
  try {
    const enrichmentInput = normalizeWineMetadataStrings({
      producer: wine.producer,
      wine_name: wine.wine_name,
      vintage: wine.vintage,
      country: (wine as any).country ?? null,
      region: (wine as any).region ?? null,
      appellation: (wine as any).appellation ?? null,
      regional_wine_style: (wine as any).regional_wine_style ?? null,
      color: (wine as any).color,
      grapes: (wine as any).grapes,
      entry_source: (wine as any).entry_source ?? null,
    });
    const plan = planWineMetadataEnrichment(enrichmentInput);
    if (plan.hasUpdates && Object.keys(plan.updates).length > 0) {
      plan.logLines.forEach((line) => console.log(`[bottleService] ${line}`));
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (plan.updates.grapes !== undefined) patch.grapes = plan.updates.grapes;
      if (plan.updates.regional_wine_style !== undefined) {
        patch.regional_wine_style = plan.updates.regional_wine_style;
      }
      const { data: enrichedWine, error: enrichErr } = await supabase
        .from('wines')
        .update(patch as any)
        .eq('id', wine.id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (enrichErr) {
        console.error('[bottleService] Wine metadata enrichment update failed:', enrichErr);
      } else if (enrichedWine) {
        wine = enrichedWine as any;
      }
    }
  } catch (enrichEx) {
    console.error('[bottleService] Wine metadata enrichment error:', enrichEx);
  }

  // Now create the bottle
  const bottleData: BottleInsert = {
    user_id: user.id,
    wine_id: wine.id,
    quantity: input.quantity || 1,
    purchase_date: input.purchase_date || null,
    purchase_price: input.purchase_price || null,
    purchase_price_currency: input.purchase_price_currency || null,
    purchase_location: input.purchase_location || null,
    storage_location: input.storage_location || null,
    bottle_size_ml: input.bottle_size_ml || 750,
    notes: input.notes || null,
    // Stable storage paths (preferred for runtime URL generation)
    image_path: input.image_path || null,
    label_image_path: input.label_image_path || null,
    // Permanent public URL — visible directly in the DB and never expires
    image_url: publicLabelUrl || input.image_url || null,
    tags: input.tags ? input.tags : null,
    // Keep / Reserve feature
    is_reserved: input.is_reserved ?? false,
    reserved_for: input.is_reserved ? (input.reserved_for ?? null) : null,
    reserved_date: input.is_reserved ? (input.reserved_date ?? null) : null,
    reserved_note: input.is_reserved ? (input.reserved_note ?? null) : null,
  };
  
  const { data: bottle, error: bottleError } = await supabase
    .from('bottles')
    .insert(bottleData as any)
    .select()
    .single();

  if (bottleError) {
    throw new Error('Failed to create bottle');
  }

  // Notify the PWA install prompt that the user now has at least one bottle.
  // Dispatched after a successful creation so the prompt can show for the first time.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bottleCreated'));
  }

  return {
    ...(bottle as any),
    wine,
  } as BottleWithWineInfo;
}

/**
 * Update a bottle
 */
export async function updateBottle(id: string, updates: BottleUpdate): Promise<BottleWithWineInfo> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  
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
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  
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
  rating?: number | null; // Vivino rating (0-5 scale)
}

export async function updateWineInfo(
  wineId: string,
  updates: UpdateWineInput
): Promise<Wine> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  
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
    console.error('[bottleService] Error code:', error.code);
    console.error('[bottleService] Error details:', error.details);
    console.error('[bottleService] Error hint:', error.hint);
    
    // If it's a unique constraint violation, provide a more helpful message
    if (error.code === '23505') {
      throw new Error('A wine with these details already exists in your cellar. Please check the wine name, producer, and vintage.');
    }
    
    throw new Error(`Failed to update wine information: ${error.message}`);
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
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  
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

/**
 * Update wine image from Supabase Storage path
 * Stores the stable storage path and derives the public URL.
 * Preferred over updateWineImage for user-uploaded photos.
 */
export async function updateWineStorageImage(
  wineId: string,
  storagePath: string | null,
  bucket: string = 'labels'
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    throw new Error('Not authenticated');
  }

  let publicUrl: string | null = null;
  if (storagePath) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    publicUrl = data.publicUrl;
  }

  const { error } = await supabase
    .from('wines')
    .update({
      label_image_path: storagePath,
      image_url: publicUrl,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', wineId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error updating wine storage image:', error);
    throw new Error('Failed to update wine image');
  }
}

