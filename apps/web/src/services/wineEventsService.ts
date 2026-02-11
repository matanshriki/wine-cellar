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

    const apiUrl = import.meta.env.VITE_API_URL || '';
    
    // If no API URL configured, skip events feature silently
    if (!apiUrl) {
      console.log('[WineEvents] No API URL configured, skipping events feature');
      return [];
    }
    
    const endpoint = `${apiUrl}/api/events/active`;

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Silent fail - events are optional feature
      console.log('[WineEvents] Events API not available (status:', response.status, ')');
      return [];
    }

    const data = await response.json();
    console.log('[WineEvents] 🍷 Received', data.events?.length || 0, 'active events');
    return data.events || [];
  } catch (error: any) {
    // Silent fail - events are optional, don't spam console
    if (error.name === 'AbortError') {
      console.log('[WineEvents] Events API timeout (network issue)');
    } else if (error.message?.includes('CORS') || error.message?.includes('fetch')) {
      console.log('[WineEvents] Events API not reachable (CORS or network issue)');
    } else {
      console.log('[WineEvents] Events API unavailable:', error.message);
    }
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
