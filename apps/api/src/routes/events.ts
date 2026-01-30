import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { AuthRequest, authenticateSupabase } from '../middleware/auth.js';

export const eventsRouter = Router();

// Initialize Supabase client for events and bottles
const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

// Helper to match event tags with user's bottles
async function getMatchingBottles(userId: string, eventTags: string[]): Promise<{
  count: number;
  filterTag: string | null;
}> {
  try {
    // Get user's bottles from Supabase (with wine info for grapes)
    const { data: bottles, error } = await supabase
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

    if (error) {
      console.error('[Events] Error fetching bottles:', error);
      return { count: 0, filterTag: null };
    }

    if (!bottles || bottles.length === 0) {
      return { count: 0, filterTag: null };
    }

    // Check if any event tags match bottles
    let matchCount = 0;
    let bestMatchTag: string | null = null;

    for (const tag of eventTags) {
      const tagLower = tag.toLowerCase();
      
      for (const bottle of bottles) {
        if (!bottle.wine) continue;
        
        // Get grapes (can be array or string)
        const grapes = bottle.wine.grapes;
        const grapesStr = Array.isArray(grapes) 
          ? grapes.join(' ').toLowerCase() 
          : (grapes || '').toLowerCase();
        
        // Get color/style
        const color = (bottle.wine.color || '').toLowerCase();
        
        // Match against grapes or color
        if (grapesStr.includes(tagLower) || color.includes(tagLower)) {
          matchCount++;
          if (!bestMatchTag) {
            bestMatchTag = tag;
          }
        }
      }
    }

    return { count: matchCount, filterTag: bestMatchTag };
  } catch (error) {
    console.error('[Events] Error matching bottles:', error);
    return { count: 0, filterTag: null };
  }
}

// GET /api/events/active - Get the active event for current user
eventsRouter.get('/active', authenticateSupabase, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userId = req.userId;
    const daysWindow = 3; // Show events +/- 3 days

    // Calculate date range
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysWindow);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysWindow);

    // Get active events (within window, not dismissed, not shown today)
    const { data: events, error: eventsError } = await supabase
      .from('wine_events')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (eventsError) {
      console.error('[Events] Error fetching events:', eventsError);
      return res.status(500).json({ error: 'Failed to fetch events' });
    }

    if (!events || events.length === 0) {
      return res.json({ event: null });
    }

    // Get user's event states
    const { data: states, error: statesError } = await supabase
      .from('user_event_states')
      .select('*')
      .eq('user_id', userId)
      .in('event_id', events.map(e => e.id));

    if (statesError) {
      console.error('[Events] Error fetching user states:', statesError);
      // Continue anyway, just assume no states
    }

    const statesMap = new Map(
      (states || []).map(s => [s.event_id, s])
    );

    // Filter out dismissed events and events shown today
    const todayStr = today.toISOString().split('T')[0];
    const eligibleEvents = events.filter(event => {
      const state = statesMap.get(event.id);
      
      // Skip if dismissed
      if (state?.dismissed_at) {
        return false;
      }
      
      // Skip if shown today
      if (state?.last_shown_at) {
        const lastShown = new Date(state.last_shown_at).toISOString().split('T')[0];
        if (lastShown === todayStr) {
          return false;
        }
      }
      
      return true;
    });

    if (eligibleEvents.length === 0) {
      return res.json({ event: null });
    }

    // Pick the best event (closest to today)
    const bestEvent = eligibleEvents.reduce((best, current) => {
      const bestDiff = Math.abs(new Date(best.date).getTime() - today.getTime());
      const currentDiff = Math.abs(new Date(current.date).getTime() - today.getTime());
      return currentDiff < bestDiff ? current : best;
    });

    // Check for matching bottles
    const { count: matchCount, filterTag } = await getMatchingBottles(
      userId,
      bestEvent.tags || []
    );

    // Update last_shown_at and seen_at (upsert)
    const now = new Date().toISOString();
    const existingState = statesMap.get(bestEvent.id);

    if (existingState) {
      // Update existing state
      await supabase
        .from('user_event_states')
        .update({
          last_shown_at: now,
          seen_at: existingState.seen_at || now,
          updated_at: now,
        })
        .eq('id', existingState.id);
    } else {
      // Insert new state
      await supabase
        .from('user_event_states')
        .insert({
          user_id: userId,
          event_id: bestEvent.id,
          seen_at: now,
          last_shown_at: now,
        });
    }

    return res.json({
      event: {
        id: bestEvent.id,
        name: bestEvent.name,
        date: bestEvent.date,
        type: bestEvent.type,
        description: bestEvent.description_short,
        sourceName: bestEvent.source_name,
        sourceUrl: bestEvent.source_url,
        matchCount,
        filterTag,
      },
    });
  } catch (error: any) {
    console.error('[Events] Error in /active:', error);
    return res.status(500).json({ error: 'Failed to fetch active event' });
  }
});

// POST /api/events/:id/dismiss - Dismiss an event
eventsRouter.post('/:id/dismiss', authenticateSupabase, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userId = req.userId;
    const eventId = req.params.id;

    // Check if state exists
    const { data: existingState } = await supabase
      .from('user_event_states')
      .select('*')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .single();

    const now = new Date().toISOString();

    if (existingState) {
      // Update existing state
      const { error } = await supabase
        .from('user_event_states')
        .update({
          dismissed_at: now,
          updated_at: now,
        })
        .eq('id', existingState.id);

      if (error) {
        console.error('[Events] Error updating dismiss state:', error);
        return res.status(500).json({ error: 'Failed to dismiss event' });
      }
    } else {
      // Insert new state with dismissed_at
      const { error } = await supabase
        .from('user_event_states')
        .insert({
          user_id: userId,
          event_id: eventId,
          dismissed_at: now,
          seen_at: now,
        });

      if (error) {
        console.error('[Events] Error inserting dismiss state:', error);
        return res.status(500).json({ error: 'Failed to dismiss event' });
      }
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Events] Error in /dismiss:', error);
    return res.status(500).json({ error: 'Failed to dismiss event' });
  }
});

// POST /api/events/:id/seen - Mark event as seen
eventsRouter.post('/:id/seen', authenticateSupabase, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userId = req.userId;
    const eventId = req.params.id;

    // Check if state exists
    const { data: existingState } = await supabase
      .from('user_event_states')
      .select('*')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .single();

    const now = new Date().toISOString();

    if (existingState) {
      // Only update if seen_at is not already set
      if (!existingState.seen_at) {
        const { error } = await supabase
          .from('user_event_states')
          .update({
            seen_at: now,
            updated_at: now,
          })
          .eq('id', existingState.id);

        if (error) {
          console.error('[Events] Error updating seen state:', error);
          return res.status(500).json({ error: 'Failed to mark event as seen' });
        }
      }
    } else {
      // Insert new state with seen_at
      const { error } = await supabase
        .from('user_event_states')
        .insert({
          user_id: userId,
          event_id: eventId,
          seen_at: now,
        });

      if (error) {
        console.error('[Events] Error inserting seen state:', error);
        return res.status(500).json({ error: 'Failed to mark event as seen' });
      }
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Events] Error in /seen:', error);
    return res.status(500).json({ error: 'Failed to mark event as seen' });
  }
});
