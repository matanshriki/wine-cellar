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
    name: string;
    producer?: string;
    vintage?: number;
    style: 'red' | 'white' | 'rose' | 'sparkling';
    rating?: number;
    label_image_url?: string;
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
  
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Fetch all user's bottles with wine info
    const { data: bottles, error } = await supabase
      .from('bottles')
      .select(`
        id,
        wine_id,
        quantity,
        wine:wines(
          id,
          name,
          producer,
          vintage,
          style,
          rating,
          label_image_url
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('[duplicateDetection] Error fetching bottles:', error);
      throw error;
    }

    if (!bottles || bottles.length === 0) {
      console.log('[duplicateDetection] No bottles in cellar, no duplicates');
      return null;
    }

    console.log('[duplicateDetection] Checking against', bottles.length, 'bottles');

    // Map bottles to wine format for comparison
    const wines = bottles.map(b => ({
      id: b.wine_id,
      producer: b.wine?.producer,
      name: b.wine?.name,
      vintage: b.wine?.vintage,
      bottle: b,
    }));

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
