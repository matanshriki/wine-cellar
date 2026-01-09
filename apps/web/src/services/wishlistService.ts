/**
 * Wishlist Service (Production-Ready)
 * 
 * Manages a wishlist of wines the user wants to buy later.
 * Uses Supabase database for storage with RLS security.
 * 
 * Feature-gated: Only accessible if user has wishlist_enabled flag set to true.
 */

import { supabase } from '../lib/supabase';

/**
 * WishlistItem interface (matches database schema)
 */
export interface WishlistItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  
  // Wine details
  producer: string;
  wineName: string;
  vintage: number | null;
  region: string | null;
  country: string | null;
  grapes: string | null;
  color: 'red' | 'white' | 'rose' | 'sparkling' | null;
  
  // Optional metadata
  imageUrl: string | null;
  restaurantName: string | null;
  note: string | null;
  vivinoUrl: string | null;
  
  // Source tracking
  source: string;
  
  // Confidence (stored as JSONB in database)
  extractionConfidence: any | null;
}

/**
 * Input type for creating a wishlist item (excludes auto-generated fields)
 */
export type CreateWishlistItemInput = Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt' | 'userId'>;

/**
 * Load all wishlist items for the current user from Supabase
 */
export async function loadWishlist(): Promise<WishlistItem[]> {
  try {
    console.log('[Wishlist] Loading items from Supabase...');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.warn('[Wishlist] No active session');
      return [];
    }
    
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[Wishlist] Error loading items:', error);
      throw new Error(`Failed to load wishlist: ${error.message}`);
    }
    
    // Map database columns to camelCase interface
    const items: WishlistItem[] = (data || []).map(dbItem => ({
      id: dbItem.id,
      createdAt: dbItem.created_at,
      updatedAt: dbItem.updated_at,
      userId: dbItem.user_id,
      producer: dbItem.producer,
      wineName: dbItem.wine_name,
      vintage: dbItem.vintage,
      region: dbItem.region,
      country: dbItem.country,
      grapes: dbItem.grapes,
      color: dbItem.color,
      imageUrl: dbItem.image_url,
      restaurantName: dbItem.restaurant_name,
      note: dbItem.note,
      vivinoUrl: dbItem.vivino_url,
      source: dbItem.source || 'wishlist-photo',
      extractionConfidence: dbItem.extraction_confidence,
    }));
    
    console.log('[Wishlist] ✅ Loaded items:', items.length);
    return items;
  } catch (error) {
    console.error('[Wishlist] Failed to load items:', error);
    throw error;
  }
}

/**
 * Add a new item to the wishlist
 */
export async function addWishlistItem(input: CreateWishlistItemInput): Promise<WishlistItem> {
  try {
    console.log('[Wishlist] Adding new item to Supabase...');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }
    
    // Map camelCase to database snake_case
    const dbInput = {
      user_id: session.user.id,
      producer: input.producer,
      wine_name: input.wineName,
      vintage: input.vintage,
      region: input.region,
      country: input.country,
      grapes: input.grapes,
      color: input.color,
      image_url: input.imageUrl,
      restaurant_name: input.restaurantName,
      note: input.note,
      vivino_url: input.vivinoUrl,
      source: input.source || 'wishlist-photo',
      extraction_confidence: input.extractionConfidence,
    };
    
    const { data, error } = await supabase
      .from('wishlist_items')
      .insert(dbInput)
      .select()
      .single();
    
    if (error) {
      console.error('[Wishlist] Error adding item:', error);
      throw new Error(`Failed to add wishlist item: ${error.message}`);
    }
    
    const newItem: WishlistItem = {
      id: data.id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      userId: data.user_id,
      producer: data.producer,
      wineName: data.wine_name,
      vintage: data.vintage,
      region: data.region,
      country: data.country,
      grapes: data.grapes,
      color: data.color,
      imageUrl: data.image_url,
      restaurantName: data.restaurant_name,
      note: data.note,
      vivinoUrl: data.vivino_url,
      source: data.source,
      extractionConfidence: data.extraction_confidence,
    };
    
    console.log('[Wishlist] ✅ Added item:', newItem.id);
    return newItem;
  } catch (error) {
    console.error('[Wishlist] Failed to add item:', error);
    throw error;
  }
}

/**
 * Update an existing wishlist item
 */
export async function updateWishlistItem(id: string, updates: Partial<CreateWishlistItemInput>): Promise<WishlistItem> {
  try {
    console.log('[Wishlist] Updating item:', id);
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }
    
    // Map camelCase updates to database snake_case
    const dbUpdates: any = {};
    if (updates.producer !== undefined) dbUpdates.producer = updates.producer;
    if (updates.wineName !== undefined) dbUpdates.wine_name = updates.wineName;
    if (updates.vintage !== undefined) dbUpdates.vintage = updates.vintage;
    if (updates.region !== undefined) dbUpdates.region = updates.region;
    if (updates.country !== undefined) dbUpdates.country = updates.country;
    if (updates.grapes !== undefined) dbUpdates.grapes = updates.grapes;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
    if (updates.restaurantName !== undefined) dbUpdates.restaurant_name = updates.restaurantName;
    if (updates.note !== undefined) dbUpdates.note = updates.note;
    if (updates.vivinoUrl !== undefined) dbUpdates.vivino_url = updates.vivinoUrl;
    if (updates.source !== undefined) dbUpdates.source = updates.source;
    if (updates.extractionConfidence !== undefined) dbUpdates.extraction_confidence = updates.extractionConfidence;
    
    const { data, error } = await supabase
      .from('wishlist_items')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', session.user.id) // Ensure user owns this item
      .select()
      .single();
    
    if (error) {
      console.error('[Wishlist] Error updating item:', error);
      throw new Error(`Failed to update wishlist item: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('Wishlist item not found');
    }
    
    const updatedItem: WishlistItem = {
      id: data.id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      userId: data.user_id,
      producer: data.producer,
      wineName: data.wine_name,
      vintage: data.vintage,
      region: data.region,
      country: data.country,
      grapes: data.grapes,
      color: data.color,
      imageUrl: data.image_url,
      restaurantName: data.restaurant_name,
      note: data.note,
      vivinoUrl: data.vivino_url,
      source: data.source,
      extractionConfidence: data.extraction_confidence,
    };
    
    console.log('[Wishlist] ✅ Updated item:', id);
    return updatedItem;
  } catch (error) {
    console.error('[Wishlist] Failed to update item:', error);
    throw error;
  }
}

/**
 * Remove an item from the wishlist
 */
export async function removeWishlistItem(id: string): Promise<void> {
  try {
    console.log('[Wishlist] Removing item:', id);
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }
    
    const { error } = await supabase
      .from('wishlist_items')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id); // Ensure user owns this item
    
    if (error) {
      console.error('[Wishlist] Error removing item:', error);
      throw new Error(`Failed to remove wishlist item: ${error.message}`);
    }
    
    console.log('[Wishlist] ✅ Removed item:', id);
  } catch (error) {
    console.error('[Wishlist] Failed to remove item:', error);
    throw error;
  }
}

/**
 * Get a single wishlist item by ID
 */
export async function getWishlistItem(id: string): Promise<WishlistItem | null> {
  try {
    console.log('[Wishlist] Getting item:', id);
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return null;
    }
    
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    const item: WishlistItem = {
      id: data.id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      userId: data.user_id,
      producer: data.producer,
      wineName: data.wine_name,
      vintage: data.vintage,
      region: data.region,
      country: data.country,
      grapes: data.grapes,
      color: data.color,
      imageUrl: data.image_url,
      restaurantName: data.restaurant_name,
      note: data.note,
      vivinoUrl: data.vivino_url,
      source: data.source,
      extractionConfidence: data.extraction_confidence,
    };
    
    return item;
  } catch (error) {
    console.error('[Wishlist] Failed to get item:', error);
    return null;
  }
}

/**
 * Search wishlist items by producer, wine name, or restaurant
 * Client-side search for simplicity
 */
export async function searchWishlist(query: string): Promise<WishlistItem[]> {
  try {
    const items = await loadWishlist();
    
    if (!query.trim()) return items;
    
    const lowerQuery = query.toLowerCase();
    
    return items.filter(item => {
      const producer = (item.producer || '').toLowerCase();
      const wineName = (item.wineName || '').toLowerCase();
      const restaurant = (item.restaurantName || '').toLowerCase();
      
      return producer.includes(lowerQuery) || 
             wineName.includes(lowerQuery) ||
             restaurant.includes(lowerQuery);
    });
  } catch (error) {
    console.error('[Wishlist] Failed to search:', error);
    return [];
  }
}

/**
 * Clear all wishlist items for current user (for testing)
 */
export async function clearWishlist(): Promise<void> {
  try {
    console.log('[Wishlist] Clearing all items...');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }
    
    const { error } = await supabase
      .from('wishlist_items')
      .delete()
      .eq('user_id', session.user.id);
    
    if (error) {
      console.error('[Wishlist] Error clearing items:', error);
      throw new Error(`Failed to clear wishlist: ${error.message}`);
    }
    
    console.log('[Wishlist] ✅ Cleared all items');
  } catch (error) {
    console.error('[Wishlist] Failed to clear wishlist:', error);
    throw error;
  }
}

