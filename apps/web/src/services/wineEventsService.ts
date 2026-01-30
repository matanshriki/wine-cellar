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
 * Get the currently active wine event for the user
 */
export async function getActiveEvent(): Promise<WineEvent | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.warn('[WineEvents] No session, skipping event fetch');
      return null;
    }

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const endpoint = apiUrl ? `${apiUrl}/api/events/active` : '/api/events/active';

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('[WineEvents] Failed to fetch active event:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[WineEvents] 🍷 Received event from API:', data.event);
    return data.event || null;
  } catch (error) {
    console.error('[WineEvents] Error fetching active event:', error);
    return null;
  }
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

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const endpoint = apiUrl ? `${apiUrl}/api/events/${eventId}/dismiss` : `/api/events/${eventId}/dismiss`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to dismiss event');
    }
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

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const endpoint = apiUrl ? `${apiUrl}/api/events/${eventId}/seen` : `/api/events/${eventId}/seen`;

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      credentials: 'include',
    });
  } catch (error) {
    console.error('[WineEvents] Error marking event as seen:', error);
  }
}
