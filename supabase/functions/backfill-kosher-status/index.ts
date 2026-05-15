/**
 * Supabase Edge Function: backfill-kosher-status
 *
 * Admin-only function that enriches existing wine rows with Kosher data using
 * the same rule + Perplexity pipeline as detect-kosher-status, but targeting
 * wines that were never enriched or have low-confidence data.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Safety guarantees:
 *   - Admin-only (profiles.is_admin = true)
 *   - Explicit limit per run (max 10, default 5)
 *   - dry_run mode returns a full plan without touching DB or calling any API
 *   - Respects all guards: skip logic, Perplexity trigger filter, daily limit,
 *     90-day Perplexity cooldown, per-wine deduplication
 *   - Each wine is processed independently; one failure does not abort the batch
 *   - No cron, no automatic scheduling
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Priority passes (processed in order, up to the requested limit):
 *
 *   Pass 1 — Israeli wines never enriched
 *             kosher_updated_at IS NULL AND country ILIKE '%israel%'
 *
 *   Pass 2 — Rule=med candidates for Perplexity upgrade
 *             kosher_enrichment_method = 'rule' AND kosher_confidence = 'med'
 *
 *   Pass 3 — AI=null wines that pass the trigger filter
 *             kosher_enrichment_method = 'ai' AND is_kosher IS NULL
 *
 *   Pass 4 — All other never-enriched wines that pass the trigger filter
 *             kosher_updated_at IS NULL (non-Israeli, filtered in code)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Request body:
 * {
 *   limit?:    number  — max wines to process (1–10, default 5)
 *   dry_run?:  boolean — plan only, no DB writes, no API calls (default false)
 *   force_refresh?: boolean — bypass skip logic (default false);
 *                            still respects daily limit and deduplication
 * }
 *
 * Response:
 * {
 *   success: true,
 *   dry_run: boolean,
 *   processed: ProcessedWine[],
 *   skipped:   SkippedWine[],
 *   daily_usage: { used: number, limit: number },
 *   estimated_perplexity_calls: number
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  detectKosherByProducerRule,
  shouldSkipKosherEnrichment,
  KOSHER_UNKNOWN,
  type KosherResult,
  type KosherEnrichmentState,
} from '../_shared/wineKosherDetection.ts'
import {
  queryPerplexityForKosher,
  shouldRunPerplexity,
  type WineData,
} from '../_shared/wineKosherPerplexity.ts'
import {
  checkAndRecordPerplexityCall,
  peekDailyUsage,
  findDuplicateKosherData,
} from '../_shared/wineKosherUsage.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-kosher-backfill-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_LIMIT = 10
const DEFAULT_LIMIT = 5
// Fetch this many candidates per pass; excess is filtered in code
const CANDIDATE_MULTIPLIER = 5

type EnrichmentMethod = 'rule' | 'ai' | 'perplexity' | 'manual'

interface WineRow {
  id: string
  user_id: string
  producer: string
  wine_name: string
  vintage: number | null
  country: string | null
  region: string | null
  appellation: string | null
  color: string | null
  is_kosher: boolean | null
  kosher_updated_at: string | null
  kosher_confidence: string | null
  kosher_enrichment_method: string | null
  kosher_source_url: string | null
}

interface ProcessedWine {
  wine_id: string
  producer: string
  wine_name: string
  pass: number
  trigger_reason: string
  method: EnrichmentMethod | 'dedup'
  is_kosher: boolean | null
  confidence: string | null
  source_url: string | null
  dedup_used: boolean
  dry_run: boolean
}

interface SkippedWine {
  wine_id: string
  producer: string
  wine_name: string
  pass: number
  skipped_reason: string
}

// ── Persistence ───────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function persistKosherResult(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  wine_id: string,
  result: KosherResult,
  method: EnrichmentMethod,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('wines')
    .update({
      is_kosher: result.is_kosher,
      kosher_for_passover: result.kosher_for_passover,
      mevushal: result.mevushal,
      kosher_certification: result.kosher_certification,
      kosher_confidence: result.kosher_confidence,
      kosher_source_url: result.kosher_source_url,
      kosher_source_name: result.kosher_source_name,
      kosher_notes: result.kosher_notes,
      kosher_enrichment_method: method,
      kosher_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', wine_id)

  if (error) {
    console.error(`[backfill] DB update failed for wine=${wine_id}:`, error.message)
  }
}

// ── Process one wine ──────────────────────────────────────────────────────────

interface ProcessOneResult {
  processed?: ProcessedWine
  skipped?: SkippedWine
  dailyLimitReached?: boolean
}

async function processWine(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  wine: WineRow,
  pass: number,
  opts: {
    isDryRun: boolean
    forceRefresh: boolean
    perplexityApiKey: string | null
    dailyLimit: number
  },
): Promise<ProcessOneResult> {
  const { isDryRun, forceRefresh, perplexityApiKey, dailyLimit } = opts

  const wineData: WineData = {
    producer: wine.producer,
    wine_name: wine.wine_name,
    vintage: wine.vintage,
    country: wine.country,
    region: wine.region,
    appellation: wine.appellation,
    color: wine.color,
  }

  const enrichmentState: KosherEnrichmentState = {
    kosher_updated_at: wine.kosher_updated_at,
    kosher_confidence: wine.kosher_confidence,
    kosher_enrichment_method: wine.kosher_enrichment_method,
    is_kosher: wine.is_kosher,
    kosher_source_url: wine.kosher_source_url,
  }

  // Skip check (unless force_refresh)
  if (!forceRefresh && shouldSkipKosherEnrichment(enrichmentState)) {
    return {
      skipped: {
        wine_id: wine.id,
        producer: wine.producer,
        wine_name: wine.wine_name,
        pass,
        skipped_reason: `already_reliable (method=${wine.kosher_enrichment_method} confidence=${wine.kosher_confidence})`,
      },
    }
  }

  // Layer 1: rule engine (free, deterministic)
  const ruleResult = detectKosherByProducerRule(wine.producer, wine.wine_name)
  const ruleConfidence = ruleResult.is_kosher !== null ? ruleResult.kosher_confidence : null

  if (ruleResult.is_kosher !== null && ruleConfidence === 'high') {
    if (!isDryRun) {
      await persistKosherResult(supabaseAdmin, wine.id, ruleResult, 'rule')
    }
    return {
      processed: {
        wine_id: wine.id,
        producer: wine.producer,
        wine_name: wine.wine_name,
        pass,
        trigger_reason: 'rule_high',
        method: 'rule',
        is_kosher: ruleResult.is_kosher,
        confidence: 'high',
        source_url: ruleResult.kosher_source_url,
        dedup_used: false,
        dry_run: isDryRun,
      },
    }
  }

  // Check if Perplexity trigger filter fires (signal-based, no key check)
  const perplexityWanted = shouldRunPerplexity(wineData, ruleConfidence)

  // Trigger reason label (used in both dry_run and real paths)
  const triggerReason = ruleConfidence === 'med'
    ? 'rule_med_upgrade'
    : wine.country?.toLowerCase().includes('israel')
    ? 'country_israel'
    : 'positive_signal'

  // ── DRY-RUN EXIT POINT ────────────────────────────────────────────────────
  // Returns a simulation of what WOULD happen if Perplexity were configured,
  // regardless of whether PERPLEXITY_API_KEY is actually set.
  // Nothing is written to the DB or called from any external API.
  if (isDryRun) {
    if (perplexityWanted) {
      return {
        processed: {
          wine_id: wine.id,
          producer: wine.producer,
          wine_name: wine.wine_name,
          pass,
          trigger_reason: `[DRY_RUN] ${triggerReason}`,
          method: 'perplexity',
          is_kosher: null,
          confidence: null,
          source_url: null,
          dedup_used: false,
          dry_run: true,
        },
      }
    }
    // Perplexity trigger filter says no signal
    if (ruleResult.is_kosher !== null) {
      return {
        processed: {
          wine_id: wine.id,
          producer: wine.producer,
          wine_name: wine.wine_name,
          pass,
          trigger_reason: 'rule_kept_no_perplexity_signal',
          method: 'rule',
          is_kosher: ruleResult.is_kosher,
          confidence: ruleResult.kosher_confidence,
          source_url: ruleResult.kosher_source_url,
          dedup_used: false,
          dry_run: true,
        },
      }
    }
    return {
      skipped: {
        wine_id: wine.id,
        producer: wine.producer,
        wine_name: wine.wine_name,
        pass,
        skipped_reason: 'no_positive_signal',
      },
    }
  }

  // ── REAL EXECUTION PATH ───────────────────────────────────────────────────
  if (!perplexityWanted || !perplexityApiKey) {
    // Perplexity not triggered (no signal) or key not configured → persist rule result if any
    if (ruleResult.is_kosher !== null) {
      await persistKosherResult(supabaseAdmin, wine.id, ruleResult, 'rule')
      return {
        processed: {
          wine_id: wine.id,
          producer: wine.producer,
          wine_name: wine.wine_name,
          pass,
          trigger_reason: !perplexityWanted ? 'rule_kept_no_perplexity_signal' : 'rule_kept_no_perplexity_key',
          method: 'rule',
          is_kosher: ruleResult.is_kosher,
          confidence: ruleResult.kosher_confidence,
          source_url: ruleResult.kosher_source_url,
          dedup_used: false,
          dry_run: false,
        },
      }
    }
    return {
      skipped: {
        wine_id: wine.id,
        producer: wine.producer,
        wine_name: wine.wine_name,
        pass,
        skipped_reason: !perplexityApiKey ? 'perplexity_key_not_configured' : 'no_positive_signal',
      },
    }
  }

  // Cost guard 1: per-wine deduplication
  const deduped = await findDuplicateKosherData(
    supabaseAdmin, wine.id, wine.producer, wine.wine_name,
  )
  if (deduped) {
    await persistKosherResult(supabaseAdmin, wine.id, deduped, 'perplexity')
    console.log(JSON.stringify({
      fn: 'backfill',
      wine_id: wine.id,
      producer: wine.producer,
      wine_name: wine.wine_name,
      action: 'dedup_reuse',
      dedup_used: true,
    }))
    return {
      processed: {
        wine_id: wine.id,
        producer: wine.producer,
        wine_name: wine.wine_name,
        pass,
        trigger_reason: triggerReason,
        method: 'dedup',
        is_kosher: deduped.is_kosher,
        confidence: deduped.kosher_confidence,
        source_url: deduped.kosher_source_url,
        dedup_used: true,
        dry_run: false,
      },
    }
  }

  // Cost guard 2: daily limit (fails closed)
  const usage = await checkAndRecordPerplexityCall(supabaseAdmin, dailyLimit)
  if (!usage.allowed) {
    // Persist rule result if available so we don't lose it
    if (ruleResult.is_kosher !== null) {
      await persistKosherResult(supabaseAdmin, wine.id, ruleResult, 'rule')
    }
    console.log(JSON.stringify({
      fn: 'backfill',
      wine_id: wine.id,
      producer: wine.producer,
      wine_name: wine.wine_name,
      action: 'skip_daily_limit',
      usage_count: usage.currentCount,
      usage_limit: usage.limit,
    }))
    return { dailyLimitReached: true }
  }

  // Call Perplexity
  console.log(JSON.stringify({
    fn: 'backfill',
    wine_id: wine.id,
    producer: wine.producer,
    wine_name: wine.wine_name,
    country: wine.country ?? null,
    action: 'perplexity_call',
    trigger_reason: triggerReason,
    usage_count: usage.currentCount,
    usage_limit: usage.limit,
  }))

  const perplexityResult = await queryPerplexityForKosher(wineData, perplexityApiKey)

  if (perplexityResult.is_kosher !== null && perplexityResult.kosher_confidence !== 'low') {
    await persistKosherResult(supabaseAdmin, wine.id, perplexityResult, 'perplexity')
    return {
      processed: {
        wine_id: wine.id,
        producer: wine.producer,
        wine_name: wine.wine_name,
        pass,
        trigger_reason: triggerReason,
        method: 'perplexity',
        is_kosher: perplexityResult.is_kosher,
        confidence: perplexityResult.kosher_confidence,
        source_url: perplexityResult.kosher_source_url,
        dedup_used: false,
        dry_run: false,
      },
    }
  }

  // Perplexity ran but returned null or low. Stamp method='perplexity' so the
  // 90-day cooldown prevents future retries, regardless of whether we have rule
  // data. The is_kosher/confidence values from the rule (if any) are preserved.
  const finalResult = ruleResult.is_kosher !== null ? ruleResult : KOSHER_UNKNOWN
  await persistKosherResult(supabaseAdmin, wine.id, finalResult, 'perplexity')

  return {
    processed: {
      wine_id: wine.id,
      producer: wine.producer,
      wine_name: wine.wine_name,
      pass,
      trigger_reason: triggerReason,
      method: 'perplexity',
      is_kosher: finalResult.is_kosher,
      confidence: finalResult.kosher_confidence,
      source_url: finalResult.kosher_source_url,
      dedup_used: false,
      dry_run: false,
    },
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }

    const backfillSecret = (Deno.env.get('BACKFILL_ADMIN_SECRET') ?? '').trim()
    const serviceRoleKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
    const headerBackfillSecret = (req.headers.get('x-kosher-backfill-secret') ?? '').trim()
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
    )

    // Auth: accepts any of:
    //   a) A valid user JWT whose profile has is_admin = true  (browser / normal path)
    //   b) Authorization: Bearer BACKFILL_ADMIN_SECRET — server scripts (same as before)
    //   c) Authorization: Bearer <anon or service JWT> + header x-kosher-backfill-secret
    //      equal to BACKFILL_ADMIN_SECRET — for curl where the gateway expects a normal JWT
    //      but you still want server-only backfill auth (secret never in browser code).
    //   d) Authorization: Bearer equal to this project's service role JWT — trusted
    //      local/CI only (same privilege as direct DB access). Never from browser clients.
    const isAdminBearer = backfillSecret !== '' && token === backfillSecret
    const isServiceRoleBearer = serviceRoleKey !== '' && token === serviceRoleKey
    const isHeaderSecret = backfillSecret !== '' && headerBackfillSecret === backfillSecret

    if (!isAdminBearer && !isServiceRoleBearer && !isHeaderSecret) {
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
      if (userError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
        )
      }
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      if (profileError || !profile?.is_admin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Admin access required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 },
        )
      }
    }

    const body = await req.json().catch(() => ({}))
    const rawLimit: number = typeof body.limit === 'number' ? body.limit : DEFAULT_LIMIT
    const effectiveLimit = Math.min(Math.max(1, rawLimit), MAX_LIMIT)
    const isDryRun: boolean = body.dry_run === true
    const forceRefresh: boolean = body.force_refresh === true

    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY') ?? null
    const dailyLimit = Math.max(1, parseInt(Deno.env.get('KOSHER_PERPLEXITY_DAILY_LIMIT') ?? '50', 10))

    console.log(JSON.stringify({
      fn: 'backfill',
      action: 'start',
      limit: effectiveLimit,
      dry_run: isDryRun,
      force_refresh: forceRefresh,
      perplexity_available: perplexityApiKey !== null,
      daily_limit: dailyLimit,
    }))

    // ── Collect candidates per priority pass ──────────────────────────────────

    const fetchSize = effectiveLimit * CANDIDATE_MULTIPLIER
    const seen = new Set<string>()
    const passedCandidates: Array<{ wine: WineRow; pass: number }> = []

    // Pass 1: Israeli wines never enriched
    {
      const { data } = await supabaseAdmin
        .from('wines')
        .select(
          'id, user_id, producer, wine_name, vintage, country, region, appellation, color,' +
          ' is_kosher, kosher_updated_at, kosher_confidence, kosher_enrichment_method, kosher_source_url',
        )
        .is('kosher_updated_at', null)
        .ilike('country', '%israel%')
        .limit(fetchSize)

      for (const row of (data ?? []) as WineRow[]) {
        if (!seen.has(row.id)) {
          seen.add(row.id)
          passedCandidates.push({ wine: row, pass: 1 })
        }
      }
    }

    // Pass 2: rule=med upgrade candidates
    {
      const { data } = await supabaseAdmin
        .from('wines')
        .select(
          'id, user_id, producer, wine_name, vintage, country, region, appellation, color,' +
          ' is_kosher, kosher_updated_at, kosher_confidence, kosher_enrichment_method, kosher_source_url',
        )
        .eq('kosher_enrichment_method', 'rule')
        .eq('kosher_confidence', 'med')
        .limit(fetchSize)

      for (const row of (data ?? []) as WineRow[]) {
        if (!seen.has(row.id)) {
          seen.add(row.id)
          passedCandidates.push({ wine: row, pass: 2 })
        }
      }
    }

    // Pass 3: ai=null wines — filter by trigger in code
    {
      const { data } = await supabaseAdmin
        .from('wines')
        .select(
          'id, user_id, producer, wine_name, vintage, country, region, appellation, color,' +
          ' is_kosher, kosher_updated_at, kosher_confidence, kosher_enrichment_method, kosher_source_url',
        )
        .eq('kosher_enrichment_method', 'ai')
        .is('is_kosher', null)
        .limit(fetchSize)

      for (const row of (data ?? []) as WineRow[]) {
        if (!seen.has(row.id)) {
          const wineData: WineData = {
            producer: row.producer, wine_name: row.wine_name, vintage: row.vintage,
            country: row.country, region: row.region, appellation: row.appellation, color: row.color,
          }
          const ruleResult = detectKosherByProducerRule(row.producer, row.wine_name)
          const rc = ruleResult.is_kosher !== null ? ruleResult.kosher_confidence : null
          if (shouldRunPerplexity(wineData, rc)) {
            seen.add(row.id)
            passedCandidates.push({ wine: row, pass: 3 })
          }
        }
      }
    }

    // Pass 4: all other never-enriched wines — filter by trigger in code
    {
      const { data } = await supabaseAdmin
        .from('wines')
        .select(
          'id, user_id, producer, wine_name, vintage, country, region, appellation, color,' +
          ' is_kosher, kosher_updated_at, kosher_confidence, kosher_enrichment_method, kosher_source_url',
        )
        .is('kosher_updated_at', null)
        .limit(fetchSize)

      for (const row of (data ?? []) as WineRow[]) {
        if (!seen.has(row.id)) {
          const wineData: WineData = {
            producer: row.producer, wine_name: row.wine_name, vintage: row.vintage,
            country: row.country, region: row.region, appellation: row.appellation, color: row.color,
          }
          const ruleResult = detectKosherByProducerRule(row.producer, row.wine_name)
          const rc = ruleResult.is_kosher !== null ? ruleResult.kosher_confidence : null
          if (shouldRunPerplexity(wineData, rc)) {
            seen.add(row.id)
            passedCandidates.push({ wine: row, pass: 4 })
          }
        }
      }
    }

    // ── Process candidates up to effectiveLimit ───────────────────────────────

    const processed: ProcessedWine[] = []
    const skipped: SkippedWine[] = []
    let estimatedPerplexityCalls = 0
    let dailyLimitHit = false

    for (const { wine, pass } of passedCandidates) {
      if (processed.length >= effectiveLimit) break
      if (dailyLimitHit) break

      const result = await processWine(supabaseAdmin, wine, pass, {
        isDryRun,
        forceRefresh,
        perplexityApiKey,
        dailyLimit,
      })

      if (result.dailyLimitReached) {
        dailyLimitHit = true
        skipped.push({
          wine_id: wine.id,
          producer: wine.producer,
          wine_name: wine.wine_name,
          pass,
          skipped_reason: 'daily_limit_reached',
        })
        break
      }

      if (result.processed) {
        processed.push(result.processed)
        if (
          result.processed.method === 'perplexity' ||
          result.processed.trigger_reason.includes('DRY_RUN')
        ) {
          estimatedPerplexityCalls++
        }
      } else if (result.skipped) {
        skipped.push(result.skipped)
      }
    }

    const daily_usage = await peekDailyUsage(supabaseAdmin, dailyLimit)

    const summary = {
      success: true,
      dry_run: isDryRun,
      limit: effectiveLimit,
      processed_count: processed.length,
      skipped_count: skipped.length,
      estimated_perplexity_calls: estimatedPerplexityCalls,
      daily_usage,
      daily_limit_hit: dailyLimitHit,
      processed,
      skipped,
    }

    console.log(JSON.stringify({
      fn: 'backfill',
      action: 'complete',
      dry_run: isDryRun,
      processed_count: processed.length,
      skipped_count: skipped.length,
      perplexity_calls: estimatedPerplexityCalls,
      daily_usage,
    }))

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[backfill] Unhandled error:', message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
