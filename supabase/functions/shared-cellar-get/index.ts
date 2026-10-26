/**
 * shared-cellar-get — Public GET endpoint
 *
 * Returns share_data for a cellar share ID. No authentication required.
 * Uses the service role so guests can open links even when anon REST
 * access / RLS would block a direct table read.
 *
 * Usage: GET /functions/v1/shared-cellar-get?id=XXXXXXX
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
  const id = url.searchParams.get('id')?.trim();

  if (!id) {
    return json({ error: 'Missing required query param: id' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: share, error: shareError } = await supabase
    .from('shared_cellars')
    .select('share_data, expires_at, view_count')
    .eq('id', id)
    .maybeSingle();

  if (shareError) {
    console.error('[shared-cellar-get] DB error:', shareError.message);
    return json({ error: 'Database error' }, 500);
  }

  if (!share) {
    return json({ error: 'not_found' }, 404);
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return json({ error: 'expired' }, 410);
  }

  const shareData = share.share_data as Record<string, unknown> | null;
  if (
    !shareData ||
    typeof shareData.userId !== 'string' ||
    typeof shareData.userName !== 'string' ||
    !Array.isArray(shareData.bottles)
  ) {
    return json({ error: 'invalid' }, 422);
  }

  // Fire-and-forget view count (service role bypasses owner-only UPDATE RLS)
  void supabase
    .from('shared_cellars')
    .update({ view_count: (share.view_count || 0) + 1 })
    .eq('id', id);

  return json({ share_data: shareData, expires_at: share.expires_at });
});
