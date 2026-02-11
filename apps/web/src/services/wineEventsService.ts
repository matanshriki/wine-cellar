/**
 * Wine Events Service
 * 
 * Manages wine/grape celebration day events
 */

import { supabase } from '../lib/supabase';

export interface WineEvent {
  id: string;
  name: string;
  date: string;
  type: 'grape' | 'wine' | 'occasion';
  description: string;
  sourceName: string | null;
  sourceUrl: string | null;
  matchCount: number;
  filterTag: string | null;
}

/**
 * Get all active wine events for the user
 */
export async function getActiveEvents(): Promise<WineEvent[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Silent return - no session is normal on initial load
      return [];
    }

    console.log('[WineEvents] Fetching active events via Supabase Edge Function');

    // Call Supabase Edge Function (replaces Railway API)
    const { data, error } = await supabase.functions.invoke('wine-events', {
      method: 'GET',
    });

    if (error) {
      console.log('[WineEvents] Edge function error:', error.message);
      return [];
    }

    if (!data || !data.events) {
      console.log('[WineEvents] No events returned');
      return [];
    }

    console.log('[WineEvents] 🍷 Received', data.events.length, 'active events');
    return data.events;
  } catch (error: any) {
    // Silent fail - events are optional feature
    console.log('[WineEvents] Error fetching events:', error.message);
    return [];
  }
}

/**
 * Get the currently active wine event for the user (legacy - returns first event)
 */
export async function getActiveEvent(): Promise<WineEvent | null> {
  const events = await getActiveEvents();
  return events.length > 0 ? events[0] : null;
}

/**
 * Dismiss an event (user clicked "Don't show again")
 */
export async function dismissEvent(eventId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Not authenticated');
    }

    console.log('[WineEvents] Dismissing event:', eventId);

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('wine-events', {
      method: 'POST',
      body: { action: 'dismiss', eventId },
    });

    if (error) {
      console.error('[WineEvents] Error dismissing event:', error);
      throw new Error('Failed to dismiss event');
    }

    console.log('[WineEvents] ✅ Event dismissed');
  } catch (error) {
    console.error('[WineEvents] Error dismissing event:', error);
    throw error;
  }
}

/**
 * Mark event as seen
 */
export async function markEventSeen(eventId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return;
    }

    console.log('[WineEvents] Marking event as seen:', eventId);

    // Call Supabase Edge Function
    await supabase.functions.invoke('wine-events', {
      method: 'POST',
      body: { action: 'seen', eventId },
    });
  } catch (error) {
    console.error('[WineEvents] Error marking event as seen:', error);
  }
}
