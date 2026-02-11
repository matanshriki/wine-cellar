/**
 * Wine Events Edge Function
 * 
 * Replaces Railway API for Wine World Moments feature.
 * 
 * Endpoints:
 * - GET /wine-events - Get active events for user
 * - POST /wine-events/dismiss/:id - Dismiss an event
 * - POST /wine-events/seen/:id - Mark event as seen
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function corsResponse(body: any, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

// Helper to match event tags with user's bottles
async function getMatchingBottles(
  userId: string,
  eventTags: string[],
  userSupabase: any
): Promise<{ count: number; filterTag: string | null }> {
  try {
    console.log('[Events] Matching bottles for user:', userId.substring(0, 8));
    console.log('[Events] Event tags:', eventTags);

    // Get user's bottles
    const { data: bottles, error } = await userSupabase
      .from('bottles')
      .select(`
        id,
        wine:wines (
          grapes,
          color
        )
      `)
      .eq('user_id', userId)
      .gt('quantity', 0);

    if (error || !bottles || bottles.length === 0) {
      console.log('[Events] No bottles found');
      return { count: 0, filterTag: null };
    }

    console.log('[Events] Found', bottles.length, 'bottles');

    // Match bottles against tags
    const matchedBottleIds = new Set<string>();
    const tagMatchCounts: Record<string, number> = {};

    // Prioritize grape tags over color tags
    const grapeTags = eventTags.filter(
      tag => !['red', 'white', 'rose', 'rosé', 'sparkling'].includes(tag.toLowerCase())
    );
    const colorTags = eventTags.filter(
      tag => ['red', 'white', 'rose', 'rosé', 'sparkling'].includes(tag.toLowerCase())
    );

    const tagsToMatch = grapeTags.length > 0 ? grapeTags : colorTags;

    // Initialize counts
    for (const tag of tagsToMatch) {
      tagMatchCounts[tag] = 0;
    }

    // Match bottles
    for (const tag of tagsToMatch) {
      const tagLower = tag.toLowerCase();

      for (const bottle of bottles) {
        const b = bottle as any;
        if (!b.wine) continue;

        const grapes = b.wine.grapes;
        const grapesStr = Array.isArray(grapes)
          ? grapes.join(' ').toLowerCase()
          : (grapes || '').toLowerCase();

        const color = (b.wine.color || '').toLowerCase();

        const matches = grapeTags.length > 0
          ? grapesStr.includes(tagLower)
          : (grapesStr.includes(tagLower) || color.includes(tagLower));

        if (matches) {
          matchedBottleIds.add(b.id);
          tagMatchCounts[tag]++;
        }
      }
    }

    // Return pipe-separated tags for frontend multi-match
    const matchingTags = Object.entries(tagMatchCounts)
      .filter(([_, count]) => count > 0)
      .map(([tag, _]) => tag);

    const filterTag = matchingTags.length > 0 ? matchingTags.join('|') : null;
    const matchCount = matchedBottleIds.size;

    console.log('[Events] Match result:', { matchCount, filterTag });
    return { count: matchCount, filterTag };
  } catch (error) {
    console.error('[Events] Error matching bottles:', error);
    return { count: 0, filterTag: null };
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Missing authorization header' }, 401);
    }

    // Create auth client
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return corsResponse({ error: 'Unauthorized' }, 401);
    }

    console.log('[Events] User authenticated:', user.id.substring(0, 8));

    // Create user-scoped client
    const userSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Parse URL and request body
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Parse body for POST requests
    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    // GET /wine-events - Get active events
    if (req.method === 'GET') {
      console.log('[Events] GET /active');

      const daysWindow = 7; // Show events +/- 7 days
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - daysWindow);
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + daysWindow);

      // Get active events
      const { data: events, error: eventsError } = await userSupabase
        .from('wine_events')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (eventsError) {
        console.error('[Events] Error fetching events:', eventsError);
        return corsResponse({ error: 'Failed to fetch events' }, 500);
      }

      if (!events || events.length === 0) {
        return corsResponse({ events: [] });
      }

      // Get user's event states
      const { data: states, error: statesError } = await userSupabase
        .from('user_event_states')
        .select('*')
        .eq('user_id', user.id)
        .in('event_id', events.map((e: any) => e.id));

      const statesMap = new Map(
        (states || []).map((s: any) => [s.event_id, s])
      );

      // Filter out dismissed events and events shown today
      const todayStr = today.toISOString().split('T')[0];
      const eligibleEvents = events.filter((event: any) => {
        const state = statesMap.get(event.id);

        // Skip if dismissed
        if (state?.dismissed_at) return false;

        // Skip if shown today
        if (state?.last_shown_at) {
          const lastShown = new Date(state.last_shown_at).toISOString().split('T')[0];
          if (lastShown === todayStr) return false;
        }

        return true;
      });

      if (eligibleEvents.length === 0) {
        return corsResponse({ events: [] });
      }

      // Sort by closest to today
      const sortedEvents = eligibleEvents.sort((a: any, b: any) => {
        const aDiff = Math.abs(new Date(a.date).getTime() - today.getTime());
        const bDiff = Math.abs(new Date(b.date).getTime() - today.getTime());
        return aDiff - bDiff;
      });

      // Process events (match bottles + update states)
      const processedEvents = await Promise.all(
        sortedEvents.map(async (event: any) => {
          const { count: matchCount, filterTag } = await getMatchingBottles(
            user.id,
            event.tags || [],
            userSupabase
          );

          // Update last_shown_at
          const now = new Date().toISOString();
          const existingState = statesMap.get(event.id);

          if (existingState) {
            await userSupabase
              .from('user_event_states')
              .update({
                last_shown_at: now,
                seen_at: existingState.seen_at || now,
                updated_at: now,
              })
              .eq('id', existingState.id);
          } else {
            await userSupabase
              .from('user_event_states')
              .insert({
                user_id: user.id,
                event_id: event.id,
                seen_at: now,
                last_shown_at: now,
              });
          }

          return {
            id: event.id,
            name: event.name,
            date: event.date,
            type: event.type,
            description: event.description_short,
            sourceName: event.source_name,
            sourceUrl: event.source_url,
            matchCount,
            filterTag,
          };
        })
      );

      return corsResponse({ events: processedEvents });
    }

    // POST /wine-events - Handle dismiss/seen actions
    if (req.method === 'POST' && body.action === 'dismiss') {
      const eventId = body.eventId;
      console.log('[Events] POST /dismiss', eventId);

      // Check if state exists
      const { data: existingState } = await userSupabase
        .from('user_event_states')
        .select('*')
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .single();

      const now = new Date().toISOString();

      if (existingState) {
        const { error } = await userSupabase
          .from('user_event_states')
          .update({
            dismissed_at: now,
            updated_at: now,
          })
          .eq('id', existingState.id);

        if (error) {
          return corsResponse({ error: 'Failed to dismiss event' }, 500);
        }
      } else {
        const { error } = await userSupabase
          .from('user_event_states')
          .insert({
            user_id: user.id,
            event_id: eventId,
            dismissed_at: now,
            seen_at: now,
          });

        if (error) {
          return corsResponse({ error: 'Failed to dismiss event' }, 500);
        }
      }

      return corsResponse({ success: true });
    }

    // POST /wine-events - Handle seen action
    if (req.method === 'POST' && body.action === 'seen') {
      const eventId = body.eventId;
      console.log('[Events] POST /seen', eventId);

      // Check if state exists
      const { data: existingState } = await userSupabase
        .from('user_event_states')
        .select('*')
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .single();

      const now = new Date().toISOString();

      if (existingState) {
        if (!existingState.seen_at) {
          const { error } = await userSupabase
            .from('user_event_states')
            .update({
              seen_at: now,
              updated_at: now,
            })
            .eq('id', existingState.id);

          if (error) {
            return corsResponse({ error: 'Failed to mark as seen' }, 500);
          }
        }
      } else {
        const { error } = await userSupabase
          .from('user_event_states')
          .insert({
            user_id: user.id,
            event_id: eventId,
            seen_at: now,
          });

        if (error) {
          return corsResponse({ error: 'Failed to mark as seen' }, 500);
        }
      }

      return corsResponse({ success: true });
    }

    return corsResponse({ error: 'Not found' }, 404);

  } catch (error: any) {
    console.error('[Events] Error:', error);
    return corsResponse({ error: error.message || 'Internal error' }, 500);
  }
});
