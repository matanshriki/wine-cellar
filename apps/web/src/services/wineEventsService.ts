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
      console.warn('[WineEvents] No session, skipping events fetch');
      return [];
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
      console.error('[WineEvents] Failed to fetch active events:', response.status);
      return [];
    }

    const data = await response.json();
    console.log('[WineEvents] 🍷 Received events from API:', data.events);
    return data.events || [];
  } catch (error) {
    console.error('[WineEvents] Error fetching active events:', error);
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
