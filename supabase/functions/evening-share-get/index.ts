/**
 * evening-share-get — Public GET endpoint
 *
 * Returns the share metadata, lineup snapshot, and aggregated vote counts
 * for a given share code. No authentication required.
 *
 * Usage: GET /functions/v1/evening-share-get?code=XXXXXXX
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code')?.trim();

  if (!code) {
    return json({ error: 'Missing required query param: code' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch the share record (service role bypasses RLS)
  const { data: share, error: shareError } = await supabase
    .from('evening_plan_shares')
    .select('id, evening_plan_id, occasion, plan_name, created_at, expires_at, lineup_snapshot')
    .eq('id', code)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (shareError) {
    console.error('[evening-share-get] DB error:', shareError.message);
    return json({ error: 'Database error' }, 500);
  }

  if (!share) {
    return json({ error: 'Share not found or expired' }, 404);
  }

  // Aggregate vote counts per wine_id
  const { data: votes, error: votesError } = await supabase
    .from('evening_guest_votes')
    .select('wine_id, voter_fingerprint')
    .eq('share_id', code);

  if (votesError) {
    console.error('[evening-share-get] Error fetching votes:', votesError.message);
  }

  const voteCounts: Record<string, number> = {};
  const voterSet = new Set<string>();

  for (const vote of votes ?? []) {
    voteCounts[vote.wine_id] = (voteCounts[vote.wine_id] ?? 0) + 1;
    voterSet.add(vote.voter_fingerprint);
  }

  return json({
    share: {
      id: share.id,
      evening_plan_id: share.evening_plan_id,
      occasion: share.occasion ?? null,
      plan_name: share.plan_name ?? null,
      created_at: share.created_at,
      expires_at: share.expires_at,
    },
    lineup: share.lineup_snapshot ?? [],
    vote_counts: voteCounts,
    total_votes: votes?.length ?? 0,
    unique_voters: voterSet.size,
  });
});
