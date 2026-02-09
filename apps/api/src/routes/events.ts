import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { AuthRequest, authenticateSupabase } from '../middleware/auth.js';

export const eventsRouter = Router();

// Initialize Supabase client for events and bottles
const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

// Helper to match event tags with user's bottles
async function getMatchingBottles(
  userId: string, 
  eventTags: string[],
  userSupabase: any // Authenticated Supabase client
): Promise<{
  count: number;
  filterTag: string | null;
}> {
  try {
    console.log('[Events] 🔍 Matching bottles for user:', userId.substring(0, 8));
    console.log('[Events] 🔍 Event tags:', eventTags);
    
    // Get user's bottles from Supabase (with wine info for grapes)
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

    if (error) {
      console.error('[Events] ❌ Error fetching bottles from Supabase:', error);
      return { count: 0, filterTag: null };
    }

    console.log('[Events] ✅ Found', bottles?.length || 0, 'bottles in Supabase');
    if (bottles && bottles.length > 0) {
      const sample = bottles[0] as any;
      console.log('[Events] 📦 Sample bottle:', {
        id: sample.id,
        grapes: sample.wine?.grapes,
        color: sample.wine?.color
      });
    }

    if (!bottles || bottles.length === 0) {
      console.log('[Events] ⚠️ No bottles found for user');
      return { count: 0, filterTag: null };
    }

    // Check if any event tags match bottles
    // CRITICAL FIX: Use Set to avoid double-counting bottles when multiple tags match the same bottle
    const matchedBottleIds = new Set<string>();
    const tagMatchCounts: Record<string, number> = {}; // Track which tag matches most bottles

    // Prioritize grape-specific tags over color tags
    const grapeTags = eventTags.filter(tag => !['red', 'white', 'rose', 'rosé', 'sparkling'].includes(tag.toLowerCase()));
    const colorTags = eventTags.filter(tag => ['red', 'white', 'rose', 'rosé', 'sparkling'].includes(tag.toLowerCase()));
    
    // Use grape tags if available, otherwise fall back to color tags
    const tagsToMatch = grapeTags.length > 0 ? grapeTags : colorTags;
    
    console.log('[Events] 🔍 Grape tags:', grapeTags);
    console.log('[Events] 🔍 Color tags:', colorTags);
    console.log('[Events] 🔍 Using tags for matching:', tagsToMatch);

    // Initialize counts for each tag
    for (const tag of tagsToMatch) {
      tagMatchCounts[tag] = 0;
    }

    for (const tag of tagsToMatch) {
      const tagLower = tag.toLowerCase();
      console.log('[Events] 🔍 Checking tag:', tagLower);
      
      for (const bottle of bottles) {
        const b = bottle as any; // Type assertion for nested data
        if (!b.wine) {
          console.log('[Events] ⚠️ Bottle', b.id?.substring(0, 8), 'has no wine data');
          continue;
        }
        
        // Get grapes (can be array or string)
        const grapes = b.wine.grapes;
        const grapesStr = Array.isArray(grapes) 
          ? grapes.join(' ').toLowerCase() 
          : (grapes || '').toLowerCase();
        
        // Get color/style
        const color = (b.wine.color || '').toLowerCase();
        
        // Match against grapes or color (depending on which tags we're using)
        const matches = grapeTags.length > 0 
          ? grapesStr.includes(tagLower) // Only match grapes if grape tags exist
          : (grapesStr.includes(tagLower) || color.includes(tagLower)); // Match both if only color tags
        
        if (matches) {
          console.log('[Events] ✅ MATCH! Bottle', b.id?.substring(0, 8), 'for tag', tag, ':', { grapes: grapesStr, color });
          matchedBottleIds.add(b.id); // Add to set (prevents double-counting)
          tagMatchCounts[tag]++; // Count matches for this specific tag
        }
      }
    }

    // Return ALL tags that matched at least one bottle (pipe-separated for frontend multi-match)
    // This ensures the frontend filter will find ALL matching bottles, not just one variant
    const matchingTags = Object.entries(tagMatchCounts)
      .filter(([_, count]) => count > 0)
      .map(([tag, _]) => tag);
    
    const filterTag = matchingTags.length > 0 
      ? matchingTags.join('|')  // Use pipe separator so frontend can split and search for any
      : null;

    const matchCount = matchedBottleIds.size; // Count unique bottles only
    console.log('[Events] 🎯 Tag match counts:', tagMatchCounts);
    console.log('[Events] 🎯 Final result:', { 
      matchCount, 
      uniqueBottles: matchCount, 
      filterTag, 
      matchingTags,
    });
    return { count: matchCount, filterTag };
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
    const daysWindow = 7; // Show events +/- 7 days (full week before/after)

    // Get user's auth token from request header
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      console.error('[Events] No auth token provided');
      return res.status(401).json({ error: 'Authentication token required' });
    }

    // Create authenticated Supabase client for this user (to bypass RLS)
    const userSupabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Calculate date range
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysWindow);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysWindow);

    // Get active events (within window, not dismissed, not shown today)
    const { data: events, error: eventsError } = await userSupabase
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
    const { data: states, error: statesError } = await userSupabase
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
      return res.json({ events: [] });
    }

    // Sort events by date (closest to today first)
    const sortedEvents = eligibleEvents.sort((a, b) => {
      const aDiff = Math.abs(new Date(a.date).getTime() - today.getTime());
      const bDiff = Math.abs(new Date(b.date).getTime() - today.getTime());
      return aDiff - bDiff;
    });

    // Process ALL eligible events (not just one)
    const processedEvents = await Promise.all(
      sortedEvents.map(async (event) => {
        // Check for matching bottles
        const { count: matchCount, filterTag } = await getMatchingBottles(
          userId,
          event.tags || [],
          userSupabase
        );

        // Update last_shown_at and seen_at (upsert)
        const now = new Date().toISOString();
        const existingState = statesMap.get(event.id);

        if (existingState) {
          // Update existing state
          await userSupabase
            .from('user_event_states')
            .update({
              last_shown_at: now,
              seen_at: existingState.seen_at || now,
              updated_at: now,
            })
            .eq('id', existingState.id);
        } else {
          // Insert new state
          await userSupabase
            .from('user_event_states')
            .insert({
              user_id: userId,
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

    // Return ALL events (frontend will handle carousel)
    return res.json({
      events: processedEvents,
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
