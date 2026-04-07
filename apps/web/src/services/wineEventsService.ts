/**
 * Wine Events Service
 *
 * Fetches wine/grape celebration day events directly from Supabase.
 * Previously called an external Railway API; now queries the DB directly
 * via the already-deployed wine_events + user_event_states tables.
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

/** Show events within ±7 days of today (matches previous Railway API behaviour) */
const DAYS_WINDOW = 7;

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Get all active wine events for the current user.
 * Filters out events the user has already dismissed.
 */
export async function getActiveEvents(): Promise<WineEvent[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const today = new Date();
    const windowStart = new Date(today);
    windowStart.setDate(today.getDate() - DAYS_WINDOW);
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + DAYS_WINDOW);

    // Fetch events and dismissed states in parallel — they are independent queries
    const [eventsResult, statesResult] = await Promise.all([
      supabase
        .from('wine_events')
        .select('id, name, date, tags, type, description_short, source_name, source_url')
        .gte('date', toISODate(windowStart))
        .lte('date', toISODate(windowEnd))
        .order('date', { ascending: true }),
      supabase
        .from('user_event_states')
        .select('event_id')
        .eq('user_id', session.user.id)
        .not('dismissed_at', 'is', null),
    ]);

    const { data: events, error: eventsError } = eventsResult;
    const { data: userStates } = statesResult;

    if (eventsError || !events?.length) return [];

    const dismissedIds = new Set((userStates ?? []).map(s => s.event_id));

    const active = events
      .filter(e => !dismissedIds.has(e.id))
      .map(e => ({
        id: e.id,
        name: e.name,
        date: e.date as string,
        type: e.type as 'grape' | 'wine' | 'occasion',
        description: (e.description_short as string | null) ?? '',
        sourceName: (e.source_name as string | null) ?? null,
        sourceUrl: (e.source_url as string | null) ?? null,
        // matchCount is enriched client-side by CellarPage (bottle matching)
        matchCount: 0,
        filterTag: Array.isArray(e.tags) && e.tags.length > 0 ? String(e.tags[0]) : null,
      }));

    return active;
  } catch {
    return [];
  }
}

/**
 * Get the first active event (legacy helper used by some callers).
 */
export async function getActiveEvent(): Promise<WineEvent | null> {
  const events = await getActiveEvents();
  return events.length > 0 ? events[0] : null;
}

/**
 * Dismiss an event — user will not see it again.
 */
export async function dismissEvent(eventId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('user_event_states')
      .upsert(
        {
          user_id: session.user.id,
          event_id: eventId,
          dismissed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,event_id' },
      );

    if (error) throw error;
  } catch (error) {
    console.error('[WineEvents] Error dismissing event:', error);
    throw error;
  }
}

/**
 * Record that the user has seen an event (throttles re-display).
 */
export async function markEventSeen(eventId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const now = new Date().toISOString();
    await supabase
      .from('user_event_states')
      .upsert(
        {
          user_id: session.user.id,
          event_id: eventId,
          seen_at: now,
          last_shown_at: now,
        },
        { onConflict: 'user_id,event_id' },
      );
  } catch (error) {
    console.error('[WineEvents] Error marking event as seen:', error);
  }
}
