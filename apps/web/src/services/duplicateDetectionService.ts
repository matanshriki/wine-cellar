/**
 * Duplicate Detection Service
 * 
 * Checks if a wine already exists in the user's cellar before adding.
 * Uses wine identity matching to find duplicates.
 */

import { supabase } from '../lib/supabase';
import { findDuplicateWine } from '../utils/wineIdentity';
import type { Database } from '../types/supabase';

type Bottle = Database['public']['Tables']['bottles']['Row'];
type Wine = Database['public']['Tables']['wines']['Row'];

export interface ExistingBottle {
  id: string;
  wine_id: string;
  quantity: number;
  wine: {
    id: string;
    wine_name: string;
    producer?: string;
    vintage?: number;
    color: 'red' | 'white' | 'rose' | 'sparkling';
    rating?: number;
    label_image_url?: string;
    image_url?: string; // Fallback for older schema
  };
}

export interface CandidateWine {
  producer?: string | null;
  name?: string | null;
  vintage?: number | null;
}

/**
 * Check if a wine already exists in the user's cellar
 * 
 * @param candidate - Wine data to check for duplicates
 * @returns Existing bottle info if found, null otherwise
 */
export async function checkForDuplicate(
  candidate: CandidateWine
): Promise<ExistingBottle | null> {
  console.log('[duplicateDetection] Checking for duplicate:', candidate);
  
  // Validate candidate - need at least producer and name
  if (!candidate.producer && !candidate.name) {
    console.warn('[duplicateDetection] ⚠️ Candidate missing both producer and name, skipping check');
    return null;
  }
  
  if (!candidate.name) {
    console.warn('[duplicateDetection] ⚠️ Candidate missing name (only has producer), duplicate detection may be inaccurate');
  }
  
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Fetch all user's bottles with wine info
    // Use * to select all fields (robust against schema changes)
    const { data: bottles, error } = await supabase
      .from('bottles')
      .select(`
        id,
        wine_id,
        quantity,
        wine:wines(*)
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('[duplicateDetection] Error fetching bottles:', error);
      console.error('[duplicateDetection] Error details:', JSON.stringify(error, null, 2));
      // Don't throw - return null to allow adding even if check fails
      return null;
    }

    if (!bottles || bottles.length === 0) {
      console.log('[duplicateDetection] No bottles in cellar, no duplicates');
      return null;
    }

    console.log('[duplicateDetection] Checking against', bottles.length, 'bottles');

    // Map bottles to wine format for comparison
    const wines = bottles.map(b => {
      const wine = b.wine as Wine;
      return {
        id: b.wine_id,
        producer: wine?.producer || null,
        name: wine?.wine_name || null,
        vintage: wine?.vintage || null,
        bottle: b,
      };
    });

    // Log sample for debugging
    if (wines.length > 0) {
      console.log('[duplicateDetection] Sample cellar wine:', wines[0]);
    }

    // Find duplicate using wine identity matching
    const duplicate = findDuplicateWine(candidate, wines);

    if (duplicate && duplicate.bottle) {
      const result: ExistingBottle = {
        id: duplicate.bottle.id,
        wine_id: duplicate.bottle.wine_id,
        quantity: duplicate.bottle.quantity,
        wine: duplicate.bottle.wine as any,
      };
      
      console.log('[duplicateDetection] ✅ Found duplicate bottle:', result);
      return result;
    }

    console.log('[duplicateDetection] No duplicate found');
    return null;
  } catch (error) {
    console.error('[duplicateDetection] Error:', error);
    // Don't throw - allow adding even if duplicate check fails
    return null;
  }
}

/**
 * Increment quantity of an existing bottle
 * 
 * @param bottleId - ID of the bottle to update
 * @param quantityToAdd - Number of bottles to add
 * @returns Updated bottle
 */
export async function incrementBottleQuantity(
  bottleId: string,
  quantityToAdd: number
): Promise<Bottle> {
  console.log('[duplicateDetection] Incrementing bottle', bottleId, 'by', quantityToAdd);
  
  // Get current quantity
  const { data: bottle, error: fetchError } = await supabase
    .from('bottles')
    .select('quantity')
    .eq('id', bottleId)
    .single();

  if (fetchError || !bottle) {
    console.error('[duplicateDetection] Error fetching bottle:', fetchError);
    throw new Error('Failed to fetch bottle');
  }

  const newQuantity = bottle.quantity + quantityToAdd;

  // Update quantity
  const { data, error } = await supabase
    .from('bottles')
    .update({ 
      quantity: newQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bottleId)
    .select()
    .single();

  if (error) {
    console.error('[duplicateDetection] Error updating quantity:', error);
    throw error;
  }

  console.log('[duplicateDetection] ✅ Updated quantity to', newQuantity);
  return data;
}
