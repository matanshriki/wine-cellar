/**
 * admin-backfill-analysis-locales
 *
 * Admin-only: fill missing `bottles.analysis_data.en` or `.he` via OpenAI.
 * Does NOT charge credits, does NOT update legacy flat columns or wines.barrel_*.
 * Only merges the new locale slice into existing analysis_data.
 *
 * Auth: user JWT must exist in public.admins (same pattern as backfill-analysis).
 *
 * POST JSON:
 * {
 *   "target_language": "he" | "en",
 *   "limit": 25,           // default 10, max 50 per invocation
 *   "dry_run": true,
 *   "after": "<uuid>" | null   // resume: last bottle_id from previous response next_after
 * }
 *
 * Response:
 * {
 *   success, dry_run, target_language,
 *   processed_count, skipped_count, failed_count,
 *   has_more, next_after,
 *   sample_bottle_ids, results: [{ bottle_id, status, error? }],
 *   errors?: string[]
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  buildAnalysisDataSlice,
  mergeAnalysisDataJson,
  normalizeAnalysisDataLang,
  isValidLangSlice,
  type AnalysisDataLangKey,
} from '../_shared/bottleAnalysisData.ts'
import { generateWineAnalysisWithOpenAi } from '../_shared/wineAnalysisGenerationOpenAi.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function grapesToArray(grapes: unknown): string[] | undefined {
  if (Array.isArray(grapes)) return grapes.map(String)
  if (typeof grapes === 'string' && grapes.trim()) {
    return grapes.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return undefined
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405)

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ success: false, error: 'Server configuration error' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ success: false, error: 'Missing authorization header' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return json({ success: false, error: 'Unauthorized' }, 401)

  const { data: adminRow } = await admin
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow) return json({ success: false, error: 'Admin access required' }, 403)

  let body: {
    target_language?: string
    limit?: number
    dry_run?: boolean
    after?: string | null
  } = {}
  try {
    body = await req.json()
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400)
  }

  const targetLang = normalizeAnalysisDataLang(body.target_language ?? 'he')
  const dryRun = body.dry_run === true
  const limit = Math.min(MAX_LIMIT, Math.max(1, body.limit ?? DEFAULT_LIMIT))
  const afterUuid = body.after && typeof body.after === 'string' ? body.after : null

  const { data: pickRows, error: pickErr } = await admin.rpc('admin_pick_bottles_missing_analysis_locale', {
    p_target: targetLang,
    p_limit: limit,
    p_after: afterUuid,
  })

  if (pickErr) {
    console.error('[admin-backfill-analysis-locales] RPC error:', pickErr)
    return json({ success: false, error: pickErr.message }, 500)
  }

  const bottleIds = (pickRows ?? [])
    .map((r: { bottle_id?: string }) => r.bottle_id)
    .filter((id): id is string => !!id)

  const sample_bottle_ids = bottleIds.slice(0, 10)
  const has_more = bottleIds.length >= limit
  const next_after = bottleIds.length > 0 ? bottleIds[bottleIds.length - 1] : null

  if (bottleIds.length === 0) {
    return json({
      success: true,
      dry_run: dryRun,
      target_language: targetLang,
      processed_count: 0,
      skipped_count: 0,
      failed_count: 0,
      candidate_count: 0,
      sample_bottle_ids: [],
      has_more: false,
      next_after: null,
      results: [],
    })
  }

  if (dryRun) {
    return json({
      success: true,
      dry_run: true,
      target_language: targetLang,
      processed_count: 0,
      skipped_count: 0,
      failed_count: 0,
      candidate_count: bottleIds.length,
      sample_bottle_ids,
      has_more,
      next_after,
      results: [],
    })
  }

  if (!OPENAI_API_KEY) {
    return json({ success: false, error: 'OPENAI_API_KEY not configured' }, 500)
  }

  const { data: bottleRows, error: fetchErr } = await admin
    .from('bottles')
    .select(`
      id,
      wine_id,
      notes,
      analysis_data,
      serving_guidance,
      wine:wines (
        wine_name,
        producer,
        vintage,
        region,
        country,
        appellation,
        grapes,
        color,
        regional_wine_style,
        wine_profile,
        rating,
        vivino_wine_id
      )
    `)
    .in('id', bottleIds)

  if (fetchErr || !bottleRows) {
    return json({ success: false, error: fetchErr?.message ?? 'Failed to load bottles' }, 500)
  }

  const byId = new Map<string, (typeof bottleRows)[0]>()
  for (const row of bottleRows) {
    byId.set(row.id as string, row)
  }

  const results: Array<{ bottle_id: string; status: 'processed' | 'skipped' | 'failed'; error?: string }> = []
  let processed_count = 0
  let skipped_count = 0
  let failed_count = 0
  const errors: string[] = []

  for (const bid of bottleIds) {
    const row = byId.get(bid)
    if (!row) {
      skipped_count++
      results.push({ bottle_id: bid, status: 'skipped', error: 'Row not found after fetch' })
      continue
    }

    const wine = row.wine as Record<string, unknown> | null | undefined
    if (!wine || typeof wine.wine_name !== 'string') {
      failed_count++
      const msg = 'Missing wine join'
      errors.push(`${bid}: ${msg}`)
      results.push({ bottle_id: bid, status: 'failed', error: msg })
      continue
    }

    try {
      const { data: fresh, error: freshErr } = await admin
        .from('bottles')
        .select('id, analysis_data')
        .eq('id', bid)
        .single()

      if (freshErr || !fresh) {
        failed_count++
        const msg = freshErr?.message ?? 'Re-read failed'
        errors.push(`${bid}: ${msg}`)
        results.push({ bottle_id: bid, status: 'failed', error: msg })
        continue
      }

      const ad = fresh.analysis_data as Record<string, unknown> | null | undefined
      if (isValidLangSlice(ad?.[targetLang])) {
        skipped_count++
        results.push({ bottle_id: bid, status: 'skipped', error: 'Target locale already populated' })
        continue
      }

      const gen = await generateWineAnalysisWithOpenAi({
        openaiApiKey: OPENAI_API_KEY,
        wineData: {
          wine_name: wine.wine_name as string,
          producer: (wine.producer as string | undefined) ?? undefined,
          vintage: (wine.vintage as number | null | undefined) ?? undefined,
          region: (wine.region as string | undefined) ?? undefined,
          country: (wine.country as string | undefined) ?? undefined,
          appellation: (wine.appellation as string | undefined) ?? undefined,
          grapes: grapesToArray(wine.grapes),
          color: String(wine.color ?? 'red'),
          notes: (row.notes as string | null | undefined) ?? undefined,
        },
        wineEnrichment: {
          regional_wine_style: (wine.regional_wine_style as string | null | undefined) ?? null,
          wine_profile: (wine.wine_profile as Record<string, unknown> | null | undefined) ?? null,
          rating: (wine.rating as number | null | undefined) ?? null,
          vivino_wine_id: (wine.vivino_wine_id as string | null | undefined) ?? null,
        },
        language: targetLang === 'he' ? 'he' : 'en',
        existingServingForFallback: row.serving_guidance as Record<string, unknown> | null | undefined,
        mode: 'single',
      })

      const a = gen.analysis
      const slice = buildAnalysisDataSlice({
        analysis_summary: a.analysis_summary,
        analysis_reasons: a.analysis_reasons,
        assumptions: a.assumptions ?? null,
        serving_guidance: a.serving as unknown as Record<string, unknown>,
      })

      const merged = mergeAnalysisDataJson(
        ad as Record<string, unknown> | null | undefined,
        targetLang as AnalysisDataLangKey,
        slice,
      )

      const { error: upErr } = await admin
        .from('bottles')
        .update({ analysis_data: merged })
        .eq('id', bid)

      if (upErr) {
        failed_count++
        errors.push(`${bid}: ${upErr.message}`)
        results.push({ bottle_id: bid, status: 'failed', error: upErr.message })
        continue
      }

      processed_count++
      results.push({ bottle_id: bid, status: 'processed' })
    } catch (e: unknown) {
      failed_count++
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${bid}: ${msg}`)
      results.push({ bottle_id: bid, status: 'failed', error: msg })
    }
  }

  return json({
    success: true,
    dry_run: false,
    target_language: targetLang,
    processed_count,
    skipped_count,
    failed_count,
    candidate_count: bottleIds.length,
    sample_bottle_ids,
    has_more,
    next_after,
    results,
    errors: errors.length ? errors : undefined,
  })
})
