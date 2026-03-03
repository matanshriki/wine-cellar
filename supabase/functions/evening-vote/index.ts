/**
 * evening-vote — Public POST endpoint
 *
 * Adds or removes an anonymous guest vote for a wine in a shared evening lineup.
 * No authentication required. Rate-limited per session_id to prevent abuse.
 *
 * Body: { code: string, wine_id: string, session_id: string, action: 'add' | 'remove' }
 * Returns: { success: true, vote_counts: Record<wine_id, count> }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// ── Simple in-memory rate limiting ──────────────────────────────────────────
// Keyed by session_id. Resets every 60 seconds. Max 15 actions per window.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;

function isRateLimited(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(sessionId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: { code?: string; wine_id?: string; session_id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { code, wine_id, session_id, action } = body;

  if (!code || !wine_id || !session_id || !action) {
    return json({ error: 'Missing required fields: code, wine_id, session_id, action' }, 400);
  }

  if (action !== 'add' && action !== 'remove') {
    return json({ error: 'action must be "add" or "remove"' }, 400);
  }

  // session_id sanity check (max 64 chars to avoid abuse)
  if (session_id.length > 64) {
    return json({ error: 'Invalid session_id' }, 400);
  }

  if (isRateLimited(session_id)) {
    return json({ error: 'Rate limit exceeded — please wait before voting again.' }, 429);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Verify share is valid and active
  const { data: share, error: shareError } = await supabase
    .from('evening_plan_shares')
    .select('id')
    .eq('id', code)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (shareError) {
    console.error('[evening-vote] Share lookup error:', shareError.message);
    return json({ error: 'Database error' }, 500);
  }

  if (!share) {
    return json({ error: 'Share not found or expired' }, 404);
  }

  if (action === 'add') {
    const { error } = await supabase
      .from('evening_guest_votes')
      .upsert(
        {
          share_id: code,
          wine_id,
          voter_fingerprint: session_id,
          vote_type: 'favorite',
        },
        { onConflict: 'share_id,wine_id,voter_fingerprint' },
      );

    if (error) {
      console.error('[evening-vote] Error inserting vote:', error.message);
      return json({ error: 'Failed to record vote' }, 500);
    }
  } else {
    const { error } = await supabase
      .from('evening_guest_votes')
      .delete()
      .eq('share_id', code)
      .eq('wine_id', wine_id)
      .eq('voter_fingerprint', session_id);

    if (error) {
      console.error('[evening-vote] Error removing vote:', error.message);
      return json({ error: 'Failed to remove vote' }, 500);
    }
  }

  // Return refreshed vote counts for this share
  const { data: votes, error: votesError } = await supabase
    .from('evening_guest_votes')
    .select('wine_id')
    .eq('share_id', code);

  if (votesError) {
    console.error('[evening-vote] Error fetching updated votes:', votesError.message);
  }

  const voteCounts: Record<string, number> = {};
  for (const v of votes ?? []) {
    voteCounts[v.wine_id] = (voteCounts[v.wine_id] ?? 0) + 1;
  }

  return json({ success: true, vote_counts: voteCounts });
});
