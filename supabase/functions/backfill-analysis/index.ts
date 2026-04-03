/**
 * Backfill Analysis Edge Function
 *
 * Admin-only: generates AI sommelier notes for ALL bottles across ALL users.
 * Paginated and resumable — call repeatedly with increasing `offset` until
 * `isComplete: true` is returned.
 *
 * Request body:
 * {
 *   mode?:      'missing_only' | 'stale_only' | 'force_all' | 'already_analyzed'
 *   batchSize?: number   — bottles fetched per call (default: 50, max: 100)
 *   offset?:    number   — resume from this row offset (default: 0)
 *   pipeline?:  'legacy' | 'modern'  — modern = same prompts as app + barrel on wines
 *   language?:  'en' | 'he'          — only for modern pipeline (default: en)
 * }
 *
 * already_analyzed + modern: only bottles that already have analysis_summary + readiness_label
 *   (for rolling out barrel / new prompts without re-touching never-analyzed bottles).
 *
 * Response:
 * {
 *   processedCount, skippedCount, failedCount,
 *   fetchedCount, nextOffset, isComplete,
 *   pipeline
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildWineAnalysisSystemPrompt,
  buildWineAnalysisUserPrompt,
  normalizeBarrelFields,
  type WineAnalysisInput,
} from '../_shared/wineAiAnalysis.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_BATCH_SIZE = 100;
const DEFAULT_BATCH = 50;
const MAX_CONCURRENT_LEGACY = 3;
const MAX_CONCURRENT_MODERN = 2;
const STALE_DAYS = 30;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: adminRow } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminRow) return json({ error: 'Admin access required' }, 403);

    const body = await req.json().catch(() => ({}));
    const mode = (body.mode as string) || 'missing_only';
    const batchSize = Math.min(body.batchSize ?? DEFAULT_BATCH, MAX_BATCH_SIZE);
    const offset = body.offset ?? 0;
    const pipeline = body.pipeline === 'modern' ? 'modern' : 'legacy';
    const language = body.language === 'he' ? 'he' : 'en';

    if (mode === 'already_analyzed' && pipeline !== 'modern') {
      return json({ error: 'mode "already_analyzed" requires pipeline: "modern"' }, 400);
    }

    const validModes = ['missing_only', 'stale_only', 'force_all', 'already_analyzed'];
    if (!validModes.includes(mode)) {
      return json({ error: `Invalid mode. Use one of: ${validModes.join(', ')}` }, 400);
    }

    console.log(`[backfill-analysis] mode=${mode} batchSize=${batchSize} offset=${offset} pipeline=${pipeline}`);

    const selectLegacy = `
      id,
      user_id,
      analyzed_at,
      analysis_summary,
      readiness_label,
      wine:wines(wine_name, producer, vintage, region, grapes, color)
    `;

    const selectModern = `
      id,
      user_id,
      wine_id,
      notes,
      analyzed_at,
      analysis_summary,
      readiness_label,
      wine:wines(wine_name, producer, vintage, region, country, appellation, grapes, color)
    `;

    const { data: bottles, error: fetchError } = await supabase
      .from('bottles')
      .select(pipeline === 'modern' ? selectModern : selectLegacy)
      .gt('quantity', 0)
      .order('created_at', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      console.error('[backfill-analysis] Fetch error:', fetchError);
      return json({ error: 'Failed to fetch bottles' }, 500);
    }

    const fetched = bottles?.length ?? 0;
    const now = Date.now();

    const eligible = (bottles ?? []).filter((b: Record<string, unknown>) =>
      isEligible(b, mode, pipeline, now)
    );

    console.log(`[backfill-analysis] fetched=${fetched} eligible=${eligible.length}`);

    let processedCount = 0;
    let skippedCount = fetched - eligible.length;
    let failedCount = 0;

    const maxConcurrent = pipeline === 'modern' ? MAX_CONCURRENT_MODERN : MAX_CONCURRENT_LEGACY;

    for (let i = 0; i < eligible.length; i += maxConcurrent) {
      const chunk = eligible.slice(i, i + maxConcurrent);
      const results = await Promise.all(
        chunk.map((b: Record<string, unknown>) =>
          pipeline === 'modern'
            ? analyzeBottleModern(b as any, supabase, language)
            : analyzeBottleLegacy(b as any, supabase),
        ),
      );
      for (const r of results) {
        if (r === 'success') processedCount++;
        else if (r === 'skip') skippedCount++;
        else failedCount++;
      }
    }

    const isComplete = fetched < batchSize;

    console.log(`[backfill-analysis] done — processed=${processedCount} skipped=${skippedCount} failed=${failedCount} complete=${isComplete}`);

    return json({
      processedCount,
      skippedCount,
      failedCount,
      fetchedCount: fetched,
      nextOffset: offset + fetched,
      isComplete,
      pipeline,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[backfill-analysis] Fatal:', err);
    return json({ error: message }, 500);
  }
});

function isEligible(
  b: Record<string, unknown>,
  mode: string,
  pipeline: string,
  now: number,
): boolean {
  const hasAnalysis = !!(b.analysis_summary && b.readiness_label);

  if (pipeline === 'legacy') {
    if (mode === 'missing_only') return !hasAnalysis;
    if (mode === 'stale_only') {
      if (!b.analyzed_at) return true;
      const ageDays = (now - new Date(b.analyzed_at as string).getTime()) / 86_400_000;
      return ageDays > STALE_DAYS;
    }
    if (mode === 'already_analyzed') return false;
    return true;
  }

  if (mode === 'already_analyzed') return hasAnalysis;
  if (mode === 'missing_only') return !hasAnalysis;
  if (mode === 'stale_only') {
    if (!b.analyzed_at) return true;
    const ageDays = (now - new Date(b.analyzed_at as string).getTime()) / 86_400_000;
    return ageDays > STALE_DAYS;
  }
  return true;
}

async function analyzeBottleLegacy(bottle: any, supabase: any): Promise<'success' | 'skip' | 'fail'> {
  try {
    const wine = bottle.wine;
    if (!wine?.wine_name) return 'skip';

    const analysis = await callOpenAILegacy({
      wine_name: wine.wine_name,
      producer: wine.producer,
      vintage: wine.vintage,
      region: wine.region,
      grapes: Array.isArray(wine.grapes) ? wine.grapes.join(', ') : (wine.grapes ?? ''),
      color: wine.color,
    });

    const { error } = await supabase
      .from('bottles')
      .update({
        analysis_summary: analysis.analysis_summary,
        analysis_reasons: analysis.analysis_reasons,
        readiness_label: analysis.readiness_label,
        readiness_status: labelToStatus(analysis.readiness_label),
        readiness_score: labelToScore(analysis.readiness_label),
        readiness_version: 2,
        serve_temp_c: analysis.serving_temp_c,
        decant_minutes: analysis.decant_minutes,
        drink_window_start: analysis.drink_window_start,
        drink_window_end: analysis.drink_window_end,
        confidence: analysis.confidence,
        assumptions: analysis.assumptions,
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', bottle.id);

    if (error) {
      console.error('[backfill-analysis] DB update failed:', bottle.id, error.message);
      return 'fail';
    }

    console.log(`[backfill-analysis] ✅ ${wine.wine_name}`);
    return 'success';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[backfill-analysis] analyzeBottle error:', bottle.id, msg);
    return 'fail';
  }
}

async function analyzeBottleModern(
  bottle: any,
  supabase: any,
  language: string,
): Promise<'success' | 'skip' | 'fail'> {
  try {
    const wine = bottle.wine;
    if (!wine?.wine_name) return 'skip';

    const wineInput: WineAnalysisInput = {
      wine_name: wine.wine_name,
      producer: wine.producer,
      vintage: wine.vintage,
      region: wine.region,
      country: wine.country,
      appellation: wine.appellation,
      grapes: wine.grapes,
      color: wine.color,
      notes: bottle.notes,
    };

    const analysis = await generateModernOpenAI(wineInput, language);

    const { error: updateError } = await supabase
      .from('bottles')
      .update({
        analysis_summary: analysis.analysis_summary,
        analysis_reasons: analysis.analysis_reasons,
        readiness_label: analysis.readiness_label,
        readiness_status: labelToStatus(analysis.readiness_label),
        readiness_score: labelToScore(analysis.readiness_label),
        readiness_version: 2,
        serve_temp_c: analysis.serving_temp_c,
        decant_minutes: analysis.decant_minutes,
        drink_window_start: analysis.drink_window_start,
        drink_window_end: analysis.drink_window_end,
        confidence: analysis.confidence,
        assumptions: analysis.assumptions,
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', bottle.id);

    if (updateError) {
      console.error('[backfill-analysis] modern DB update failed:', bottle.id, updateError.message);
      return 'fail';
    }

    if (bottle.wine_id) {
      const { error: wineErr } = await supabase
        .from('wines')
        .update({
          barrel_aging_note: analysis.barrel_aging_note ?? null,
          barrel_aging_months_est: analysis.barrel_aging_months_est ?? null,
        })
        .eq('id', bottle.wine_id);
      if (wineErr) {
        console.warn('[backfill-analysis] wine barrel update failed:', bottle.wine_id, wineErr);
      }
    }

    console.log(`[backfill-analysis] ✅ modern ${wine.wine_name}`);
    return 'success';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[backfill-analysis] modern analyze error:', bottle.id, msg);
    return 'fail';
  }
}

async function generateModernOpenAI(wine: WineAnalysisInput, language: string): Promise<any> {
  if (!OPENAI_API_KEY) {
    return modernFallback(wine);
  }

  const currentYear = new Date().getFullYear();
  const systemPrompt = buildWineAnalysisSystemPrompt('cellar', language);
  const userPrompt = buildWineAnalysisUserPrompt(wine, currentYear, language, 'cellar');

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) return modernFallback(wine);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return modernFallback(wine);
    return normalizeBarrelFields(JSON.parse(content) as Record<string, unknown>);
  } catch {
    return modernFallback(wine);
  }
}

function modernFallback(wineInfo: WineAnalysisInput): any {
  const currentYear = new Date().getFullYear();
  const age = wineInfo.vintage ? currentYear - wineInfo.vintage : 0;
  const color = wineInfo.color || 'red';

  let readinessLabel = 'READY';
  let servingTemp = 16;
  let decantMinutes = 30;
  let summary = `This ${wineInfo.wine_name} is ready to enjoy.`;
  let reasons = ['Based on age and type', 'Suitable for current consumption'];
  let confidence = 'MEDIUM';

  if (color === 'red' && age < 3) {
    readinessLabel = 'HOLD';
    summary = `This ${wineInfo.wine_name} is still young and would benefit from additional aging.`;
    reasons = ['Young red wine', 'Tannins still developing', 'Consider aging 2–5 more years'];
  } else if (color === 'red' && age >= 3 && age < 10) {
    readinessLabel = 'READY';
    summary = `This ${wineInfo.wine_name} is in its prime drinking window with excellent balance.`;
    reasons = ['Optimal maturity', 'Well-integrated tannins', 'Complex aromatics'];
  } else if (color === 'white' || color === 'rose') {
    servingTemp = color === 'white' ? 10 : 12;
    decantMinutes = 0;
    readinessLabel = 'READY';
    summary = `This ${wineInfo.wine_name} is ready to enjoy with bright, fresh characteristics.`;
    reasons = ['Fresh and vibrant', 'Ideal serving temperature', 'No decanting needed'];
  } else if (color === 'sparkling') {
    servingTemp = 6;
    decantMinutes = 0;
    readinessLabel = 'READY';
    summary = `This ${wineInfo.wine_name} is ready to enjoy chilled.`;
    reasons = ['Sparkling wines best enjoyed young', 'Serve well-chilled', 'No decanting'];
  }

  return {
    analysis_summary: summary,
    analysis_reasons: reasons,
    readiness_label: readinessLabel,
    serving_temp_c: servingTemp,
    decant_minutes: decantMinutes,
    drink_window_start: null,
    drink_window_end: null,
    confidence,
    assumptions: 'Fallback — based on general ageing principles.',
    barrel_aging_note: null,
    barrel_aging_months_est: null,
  };
}

async function callOpenAILegacy(wine: any): Promise<any> {
  if (!OPENAI_API_KEY) return fallbackLegacy(wine);

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
          { role: 'user', content: buildPromptLegacy(wine) },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) return fallbackLegacy(wine);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return content ? JSON.parse(content) : fallbackLegacy(wine);
  } catch {
    return fallbackLegacy(wine);
  }
}

function buildPromptLegacy(w: any): string {
  const currentYear = new Date().getFullYear();
  const age = w.vintage ? currentYear - w.vintage : null;
  const ageStr = age !== null ? `${age} years old` : 'Unknown age';

  return `You are an expert sommelier. Analyze this wine and return a JSON object.

Wine details:
- Name: ${w.wine_name}
- Producer: ${w.producer || 'Unknown'}
- Vintage: ${w.vintage || 'NV'}
- Current year: ${currentYear}
- Age: ${ageStr}
- Region: ${w.region || 'Unknown'}
- Grapes: ${w.grapes || 'Unknown'}
- Color: ${w.color}

Readiness label rules — follow these strictly based on age:
- "HOLD": Wine is too young; tannins unintegrated. Typically reds under 5 years, structured whites under 2 years.
- "PEAK_SOON": Wine is approaching but has not yet reached optimal drinking; 5–15 years for most quality reds.
- "READY": Wine is in its drinking window now. Use this for any wine 15+ years old. For wines 30+ years old, ALWAYS use "READY" — very old wines are either at their peak or already declining and should be drunk soon. NEVER label a wine over 20 years old as "HOLD" or "PEAK_SOON".

Return JSON with keys:
analysis_summary (2-3 sentence sommelier note that explicitly mentions the wine's age and current drinking status),
analysis_reasons (array of 3-4 bullet strings),
readiness_label ("READY" | "HOLD" | "PEAK_SOON"),
serving_temp_c (number),
decant_minutes (number),
drink_window_start (year or null),
drink_window_end (year or null),
confidence ("LOW" | "MEDIUM" | "HIGH"),
assumptions (string or null)`;
}

function fallbackLegacy(w: any): any {
  const age = w.vintage ? new Date().getFullYear() - w.vintage : 0;
  const color = (w.color || 'red').toLowerCase();
  const label = color === 'red' && age < 3 ? 'HOLD'
    : color === 'red' && age >= 3 ? 'READY'
    : 'READY';
  return {
    analysis_summary: `${w.wine_name} — ${label === 'HOLD' ? 'still developing, benefit from further ageing' : 'in a good drinking window'}.`,
    analysis_reasons: label === 'HOLD'
      ? ['Young red wine', 'Tannins still developing', 'Consider 2–5 more years']
      : ['Good structure', 'Well-integrated tannins', 'Ready to enjoy'],
    readiness_label: label,
    serving_temp_c: color === 'white' ? 10 : color === 'sparkling' ? 6 : 16,
    decant_minutes: color === 'red' ? 30 : 0,
    drink_window_start: null,
    drink_window_end: null,
    confidence: 'MEDIUM',
    assumptions: 'Fallback — based on general ageing principles.',
  };
}

function labelToStatus(label: string): string {
  return label === 'READY' ? 'InWindow' : label === 'PEAK_SOON' ? 'Approaching' : 'TooYoung';
}

function labelToScore(label: string): number {
  return label === 'READY' ? 90 : label === 'PEAK_SOON' ? 75 : 60;
}
