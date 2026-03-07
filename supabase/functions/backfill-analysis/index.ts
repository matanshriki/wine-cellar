/**
 * Backfill Analysis Edge Function
 *
 * Admin-only: generates AI sommelier notes for ALL bottles across ALL users.
 * Paginated and resumable — call repeatedly with increasing `offset` until
 * `isComplete: true` is returned.
 *
 * Request body:
 * {
 *   mode?:      'missing_only' | 'stale_only' | 'force_all'  (default: missing_only)
 *   batchSize?: number   — bottles fetched per call (default: 50, max: 100)
 *   offset?:    number   — resume from this row offset (default: 0)
 * }
 *
 * Response:
 * {
 *   processedCount, skippedCount, failedCount,
 *   fetchedCount,   — rows fetched this call (< batchSize means last page)
 *   nextOffset,     — pass back as offset to continue
 *   isComplete      — true when fetchedCount < batchSize
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY         = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_BATCH_SIZE    = 100;
const DEFAULT_BATCH     = 50;
const MAX_CONCURRENT    = 3;
const STALE_DAYS        = 30;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: require a valid user JWT ───────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token    = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // ── Admin check ───────────────────────────────────────────────────────────
    const { data: adminRow } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminRow) return json({ error: 'Admin access required' }, 403);

    // ── Parse request ─────────────────────────────────────────────────────────
    const body       = await req.json().catch(() => ({}));
    const mode       = (body.mode as string) || 'missing_only';
    const batchSize  = Math.min(body.batchSize ?? DEFAULT_BATCH, MAX_BATCH_SIZE);
    const offset     = body.offset ?? 0;

    console.log(`[backfill-analysis] mode=${mode} batchSize=${batchSize} offset=${offset}`);

    // ── Fetch a page of bottles across ALL users ──────────────────────────────
    const { data: bottles, error: fetchError } = await supabase
      .from('bottles')
      .select(`
        id,
        user_id,
        analyzed_at,
        analysis_summary,
        readiness_label,
        wine:wines(wine_name, producer, vintage, region, grapes, color)
      `)
      .gt('quantity', 0)
      .order('created_at', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      console.error('[backfill-analysis] Fetch error:', fetchError);
      return json({ error: 'Failed to fetch bottles' }, 500);
    }

    const fetched = bottles?.length ?? 0;

    // ── Filter by mode ────────────────────────────────────────────────────────
    const now = Date.now();
    const eligible = (bottles ?? []).filter((b: any) => {
      if (mode === 'missing_only') {
        return !b.analysis_summary || !b.readiness_label;
      }
      if (mode === 'stale_only') {
        if (!b.analyzed_at) return true;
        const ageDays = (now - new Date(b.analyzed_at).getTime()) / 86_400_000;
        return ageDays > STALE_DAYS;
      }
      return true; // force_all
    });

    console.log(`[backfill-analysis] fetched=${fetched} eligible=${eligible.length}`);

    // ── Process in concurrent chunks ──────────────────────────────────────────
    let processedCount = 0, skippedCount = fetched - eligible.length, failedCount = 0;

    for (let i = 0; i < eligible.length; i += MAX_CONCURRENT) {
      const chunk   = eligible.slice(i, i + MAX_CONCURRENT);
      const results = await Promise.all(chunk.map((b: any) => analyzeBottle(b, supabase)));
      for (const r of results) {
        if (r === 'success')  processedCount++;
        else if (r === 'skip') skippedCount++;
        else                   failedCount++;
      }
    }

    const isComplete = fetched < batchSize;

    console.log(`[backfill-analysis] done — processed=${processedCount} skipped=${skippedCount} failed=${failedCount} complete=${isComplete}`);

    return json({
      processedCount,
      skippedCount,
      failedCount,
      fetchedCount: fetched,
      nextOffset:   offset + fetched,
      isComplete,
    });

  } catch (err: any) {
    console.error('[backfill-analysis] Fatal:', err);
    return json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────

async function analyzeBottle(bottle: any, supabase: any): Promise<'success' | 'skip' | 'fail'> {
  try {
    const wine = bottle.wine;
    if (!wine?.wine_name) return 'skip';

    const analysis = await callOpenAI({
      wine_name: wine.wine_name,
      producer:  wine.producer,
      vintage:   wine.vintage,
      region:    wine.region,
      grapes:    Array.isArray(wine.grapes) ? wine.grapes.join(', ') : (wine.grapes ?? ''),
      color:     wine.color,
    });

    const { error } = await supabase
      .from('bottles')
      .update({
        analysis_summary:  analysis.analysis_summary,
        analysis_reasons:  analysis.analysis_reasons,
        readiness_label:   analysis.readiness_label,
        readiness_status:  labelToStatus(analysis.readiness_label),
        readiness_score:   labelToScore(analysis.readiness_label),
        readiness_version: 2,
        serve_temp_c:      analysis.serving_temp_c,
        decant_minutes:    analysis.decant_minutes,
        drink_window_start: analysis.drink_window_start,
        drink_window_end:   analysis.drink_window_end,
        confidence:         analysis.confidence,
        assumptions:        analysis.assumptions,
        analyzed_at:        new Date().toISOString(),
      })
      .eq('id', bottle.id);

    if (error) {
      console.error('[backfill-analysis] DB update failed:', bottle.id, error.message);
      return 'fail';
    }

    console.log(`[backfill-analysis] ✅ ${wine.wine_name}`);
    return 'success';
  } catch (err: any) {
    console.error('[backfill-analysis] analyzeBottle error:', bottle.id, err.message);
    return 'fail';
  }
}

async function callOpenAI(wine: any): Promise<any> {
  if (!OPENAI_API_KEY) return fallback(wine);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert sommelier providing professional wine analysis. Respond with valid JSON only.' },
          { role: 'user', content: buildPrompt(wine) },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) return fallback(wine);
    const data    = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return content ? JSON.parse(content) : fallback(wine);
  } catch {
    return fallback(wine);
  }
}

function buildPrompt(w: any): string {
  return `Analyze this wine and return a JSON object:
- Name: ${w.wine_name}
- Producer: ${w.producer || 'Unknown'}
- Vintage: ${w.vintage || 'NV'}
- Region: ${w.region || 'Unknown'}
- Grapes: ${w.grapes || 'Unknown'}
- Color: ${w.color}

Return JSON with keys:
analysis_summary (2-3 sentence sommelier note),
analysis_reasons (array of 3-4 bullet strings),
readiness_label ("READY" | "HOLD" | "PEAK_SOON"),
serving_temp_c (number),
decant_minutes (number),
drink_window_start (year or null),
drink_window_end (year or null),
confidence ("LOW" | "MEDIUM" | "HIGH"),
assumptions (string or null)`;
}

function fallback(w: any): any {
  const age   = w.vintage ? new Date().getFullYear() - w.vintage : 0;
  const color = (w.color || 'red').toLowerCase();
  const label = color === 'red' && age < 3 ? 'HOLD'
    : color === 'red' && age >= 3           ? 'READY'
    : 'READY';
  return {
    analysis_summary:  `${w.wine_name} — ${label === 'HOLD' ? 'still developing, benefit from further ageing' : 'in a good drinking window'}.`,
    analysis_reasons:  label === 'HOLD'
      ? ['Young red wine', 'Tannins still developing', 'Consider 2–5 more years']
      : ['Good structure', 'Well-integrated tannins', 'Ready to enjoy'],
    readiness_label:   label,
    serving_temp_c:    color === 'white' ? 10 : color === 'sparkling' ? 6 : 16,
    decant_minutes:    color === 'red' ? 30 : 0,
    drink_window_start: null,
    drink_window_end:   null,
    confidence:        'MEDIUM',
    assumptions:       'Fallback — based on general ageing principles.',
  };
}

function labelToStatus(label: string): string {
  return label === 'READY' ? 'InWindow' : label === 'PEAK_SOON' ? 'Approaching' : 'TooYoung';
}

function labelToScore(label: string): number {
  return label === 'READY' ? 90 : label === 'PEAK_SOON' ? 75 : 60;
}
