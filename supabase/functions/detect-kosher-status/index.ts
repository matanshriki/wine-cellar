/**
 * Supabase Edge Function: detect-kosher-status
 *
 * Determines whether a wine is Kosher using a three-layer strategy:
 *
 *   Layer 1 — Rule engine (deterministic, no API cost, no hallucination risk)
 *             Checks the producer against a curated table of known certified
 *             Kosher wineries. Returns high or med confidence, or null.
 *
 *   Layer 2 — Perplexity web search (source-backed, real-time citations)
 *             Runs only when the rule engine returned null or med, AND the
 *             wine passes the Perplexity trigger filter (Israeli wine, Kosher
 *             keyword signal, partial-Kosher producer, or rule=med upgrade).
 *             Skipped if PERPLEXITY_API_KEY is absent.
 *
 *   Layer 3 — Conservative OpenAI fallback (gpt-4o-mini)
 *             Runs only when Layers 1 and 2 both returned null or were skipped.
 *             Defaults to null for any uncertainty.
 *
 * The function is invoked fire-and-forget from bottleService.createBottle()
 * and never blocks bottle creation.
 *
 * Request body:
 * {
 *   wine_id:        string   — wines table row to update
 *   wine_data: {
 *     producer, wine_name, vintage, country, region, appellation, color
 *   }
 *   trigger_source?: 'system_background' | 'manual' | 'backfill'
 *   force_refresh?:  boolean — bypass skip check (used by Phase 2B backfill)
 * }
 *
 * Response:
 * { success: true,  kosher: KosherResult, method: 'rule' | 'perplexity' | 'ai' | 'skip' }
 * { success: false, error: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { withSentry, setSentryWineContext } from '../_shared/sentry.ts'
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
  findDuplicateKosherData,
} from '../_shared/wineKosherUsage.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── OpenAI prompt ─────────────────────────────────────────────────────────────

function buildKosherSystemPrompt(): string {
  return `You are a wine certification expert. Given wine metadata, determine whether the wine is Kosher.

HARD RULES — read these carefully before responding:
1. DEFAULT to is_kosher: null. Only deviate if you have HIGH certainty from specific, reliable knowledge.
2. Return is_kosher: true ONLY for producers that are definitively and publicly known as certified Kosher wineries — e.g., major Israeli Kosher wineries, clearly labelled Kosher lines from European or American producers.
3. Return is_kosher: false ONLY when you have SPECIFIC knowledge that this exact wine or producer is certified NOT Kosher.
4. Return is_kosher: null for all cases where you are not fully certain. Uncertainty is always the safe choice.
5. Return kosher_confidence: "low" unless you have very specific, reliable, verifiable knowledge. For most non-Israeli wines, return "low".
6. DO NOT guess. DO NOT hallucinate. Unknown is the correct and safe answer.
7. For Israeli wines: many but NOT all Israeli wineries are Kosher. Boutique wineries may or may not be certified.
8. Only return kosher_for_passover: true / mevushal: true when you are certain of those specific facts.
9. kosher_source_name: name the reliable source of your knowledge (e.g., winery website, OU registry). Return null if you cannot name a specific verifiable source.

Return valid JSON only, using this exact structure:
{
  "is_kosher": true | false | null,
  "kosher_for_passover": true | false | null,
  "mevushal": true | false | null,
  "kosher_certification": "certification body string or null",
  "kosher_confidence": "low" | "med" | "high",
  "kosher_source_name": "source name string or null",
  "kosher_notes": "brief note or null"
}`
}

function buildKosherUserPrompt(wine: WineData): string {
  const parts: string[] = [
    `Producer: ${wine.producer}`,
    `Wine name: ${wine.wine_name}`,
    `Vintage: ${wine.vintage ?? 'NV'}`,
    `Country: ${wine.country ?? 'Unknown'}`,
    `Region: ${wine.region ?? 'Unknown'}`,
  ]
  if (wine.appellation) parts.push(`Appellation: ${wine.appellation}`)
  if (wine.color) parts.push(`Color: ${wine.color}`)

  // Provide Hebrew certification terminology as context for the model
  const hebrewContext = wine.country?.toLowerCase().includes('israel')
    ? '\nIsraeli Kosher certification terms for reference: כשר (Kosher), כשר לפסח (Kosher for Passover), מבושל (Mevushal), הכשר (certification), בד"ץ (Badatz), רבנות (Rabanut).'
    : ''

  return `Determine whether the following wine is Kosher. Only return known-certain information; return null for anything uncertain.${hebrewContext}

${parts.join('\n')}`
}

// ── Validate + normalise OpenAI response ──────────────────────────────────────

function parseAiKosherResponse(raw: string): KosherResult | null {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null

    const validConfidences = new Set(['low', 'med', 'high'])
    const rawConfidence = validConfidences.has(parsed.kosher_confidence)
      ? (parsed.kosher_confidence as 'low' | 'med' | 'high')
      : 'low'

    // Safety rule: is_kosher: false is accepted ONLY when confidence is 'high'.
    // At lower confidence the AI is asserting "Not Kosher" merely because it
    // found no evidence of Kosher status — that is uncertainty, not a
    // confirmed non-Kosher determination. Coerce to null in those cases.
    let isKosher: boolean | null
    if (parsed.is_kosher === true) {
      isKosher = true
    } else if (parsed.is_kosher === false) {
      isKosher = rawConfidence === 'high' ? false : null
    } else {
      isKosher = null
    }

    const kfp =
      parsed.kosher_for_passover === true ? true
        : parsed.kosher_for_passover === false ? false
        : null

    const mev =
      parsed.mevushal === true ? true
        : parsed.mevushal === false ? false
        : null

    return {
      is_kosher: isKosher,
      kosher_for_passover: kfp,
      mevushal: mev,
      kosher_certification:
        typeof parsed.kosher_certification === 'string' && parsed.kosher_certification.trim()
          ? parsed.kosher_certification.trim()
          : null,
      kosher_confidence: isKosher === null ? null : rawConfidence,
      kosher_source_name:
        typeof parsed.kosher_source_name === 'string' && parsed.kosher_source_name.trim()
          ? parsed.kosher_source_name.trim()
          : null,
      kosher_source_url: null, // OpenAI cannot reliably provide live URLs
      kosher_notes:
        typeof parsed.kosher_notes === 'string' && parsed.kosher_notes.trim()
          ? parsed.kosher_notes.trim()
          : null,
    }
  } catch {
    return null
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(withSentry('detect-kosher-status', async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // PERPLEXITY_API_KEY is optional: if absent, Layer 2 is silently skipped
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY') ?? null

    // Daily Perplexity call limit — default 50/day, override via env var
    const dailyLimit = Math.max(1, parseInt(Deno.env.get('KOSHER_PERPLEXITY_DAILY_LIMIT') ?? '50', 10))

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }

    const { wine_id, wine_data, trigger_source, force_refresh } = await req.json()

    setSentryWineContext({ user_id: user.id, wine_id, operation: 'detect_kosher', provider: 'openai' })

    if (!wine_id || !wine_data) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing wine_id or wine_data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const wineData = wine_data as WineData
    if (!wineData.producer || !wineData.wine_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'wine_data must include producer and wine_name' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // force_refresh=true bypasses the skip check — used by Phase 2B backfill
    const forceRefresh = force_refresh === true

    console.log(
      `[detect-kosher-status] wine=${wine_id} producer="${wineData.producer}"` +
      ` trigger=${trigger_source ?? 'unknown'} force_refresh=${forceRefresh}` +
      ` perplexity=${perplexityApiKey ? 'enabled' : 'disabled'}`,
    )

    // ── Fetch current wine row ───────────────────────────────────────────────
    const { data: currentWine, error: fetchError } = await supabaseAdmin
      .from('wines')
      .select(
        'user_id, kosher_updated_at, kosher_confidence, kosher_enrichment_method,' +
        ' is_kosher, kosher_source_url',
      )
      .eq('id', wine_id)
      .single()

    if (fetchError || !currentWine) {
      return new Response(
        JSON.stringify({ success: false, error: 'Wine not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      )
    }

    // ── Ownership check ──────────────────────────────────────────────────────
    if (currentWine.user_id !== user.id) {
      console.warn(`[detect-kosher-status] Ownership mismatch: wine=${wine_id}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 },
      )
    }

    // ── Skip if already reliably enriched (bypassed when force_refresh=true) ─
    const enrichmentState = currentWine as KosherEnrichmentState
    if (!forceRefresh && shouldSkipKosherEnrichment(enrichmentState)) {
      console.log(JSON.stringify({
        fn: 'detect-kosher-status',
        wine_id,
        producer: wineData.producer,
        wine_name: wineData.wine_name,
        country: wineData.country ?? null,
        action: 'skip',
        skipped_reason: 'already_reliable',
        existing_method: currentWine.kosher_enrichment_method ?? null,
        existing_confidence: currentWine.kosher_confidence ?? null,
      }))
      return new Response(
        JSON.stringify({ success: true, method: 'skip', kosher: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Layer 1: rule-based producer lookup ──────────────────────────────────
    const ruleResult = detectKosherByProducerRule(wineData.producer, wineData.wine_name)
    const ruleConfidence = ruleResult.is_kosher !== null ? ruleResult.kosher_confidence : null

    // Rule matched at HIGH confidence → authoritative, no need for web search
    if (ruleResult.is_kosher !== null && ruleConfidence === 'high') {
      console.log(JSON.stringify({
        fn: 'detect-kosher-status',
        wine_id,
        producer: wineData.producer,
        wine_name: wineData.wine_name,
        country: wineData.country ?? null,
        action: 'rule_high',
        is_kosher: ruleResult.is_kosher,
        confidence: 'high',
      }))
      await persistKosherResult(supabaseAdmin, wine_id, ruleResult, 'rule')
      return new Response(
        JSON.stringify({ success: true, method: 'rule', kosher: ruleResult }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Layer 2: Perplexity web search ───────────────────────────────────────
    // Runs when:
    //   a) rule returned null AND wine passes the trigger filter, OR
    //   b) rule returned med (upgrade attempt — shouldRunPerplexity always true for med)
    // Skipped silently if PERPLEXITY_API_KEY is not configured.

    const perplexityTriggered = perplexityApiKey !== null && shouldRunPerplexity(wineData, ruleConfidence)

    if (perplexityTriggered && perplexityApiKey) {
      // Cost guard 1: per-wine deduplication across all users
      const deduped = await findDuplicateKosherData(
        supabaseAdmin, wine_id, wineData.producer, wineData.wine_name,
      )
      if (deduped) {
        console.log(JSON.stringify({
          fn: 'detect-kosher-status',
          wine_id,
          producer: wineData.producer,
          wine_name: wineData.wine_name,
          country: wineData.country ?? null,
          action: 'dedup_reuse',
          dedup_used: true,
          confidence: deduped.kosher_confidence,
          source_url: deduped.kosher_source_url,
        }))
        await persistKosherResult(supabaseAdmin, wine_id, deduped, 'perplexity')
        return new Response(
          JSON.stringify({ success: true, method: 'perplexity', kosher: deduped, dedup: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Cost guard 2: hard daily call limit (fails closed on any error)
      const usage = await checkAndRecordPerplexityCall(supabaseAdmin, dailyLimit)
      if (!usage.allowed) {
        console.log(JSON.stringify({
          fn: 'detect-kosher-status',
          wine_id,
          producer: wineData.producer,
          wine_name: wineData.wine_name,
          country: wineData.country ?? null,
          action: 'skip_perplexity',
          skipped_reason: 'daily_limit_reached',
          daily_limit_reached: true,
          usage_count: usage.currentCount,
          usage_limit: usage.limit,
          existing_method: currentWine.kosher_enrichment_method ?? null,
        }))
        // Fall through: if rule has a med result, keep it; otherwise go to OpenAI
        if (ruleResult.is_kosher !== null) {
          await persistKosherResult(supabaseAdmin, wine_id, ruleResult, 'rule')
          return new Response(
            JSON.stringify({ success: true, method: 'rule', kosher: ruleResult }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
        // fall through to OpenAI
      } else {
        // All guards passed — call Perplexity
        console.log(JSON.stringify({
          fn: 'detect-kosher-status',
          wine_id,
          producer: wineData.producer,
          wine_name: wineData.wine_name,
          country: wineData.country ?? null,
          action: 'perplexity_call',
          trigger_reason: ruleConfidence === 'med' ? 'rule_med_upgrade' : 'positive_signal',
          rule_confidence: ruleConfidence ?? null,
          usage_count: usage.currentCount,
          usage_limit: usage.limit,
        }))

        const perplexityResult = await queryPerplexityForKosher(wineData, perplexityApiKey)

        if (perplexityResult.is_kosher !== null) {
          const perplexityIsUseful = perplexityResult.kosher_confidence !== 'low'

          if (perplexityIsUseful) {
            console.log(JSON.stringify({
              fn: 'detect-kosher-status',
              wine_id,
              producer: wineData.producer,
              wine_name: wineData.wine_name,
              country: wineData.country ?? null,
              action: 'perplexity_result',
              is_kosher: perplexityResult.is_kosher,
              confidence: perplexityResult.kosher_confidence,
              source_url: perplexityResult.kosher_source_url ?? null,
            }))
            await persistKosherResult(supabaseAdmin, wine_id, perplexityResult, 'perplexity')
            return new Response(
              JSON.stringify({ success: true, method: 'perplexity', kosher: perplexityResult }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            )
          }
          // low-confidence Perplexity result — not useful enough to overwrite rule=med
        }

        // Perplexity ran but returned null or low — keep rule data, but stamp
        // method='perplexity' so the 90-day cooldown prevents future retries.
        // (Data provenance stays visible via is_kosher/confidence from the rule.)
        if (ruleResult.is_kosher !== null) {
          console.log(JSON.stringify({
            fn: 'detect-kosher-status',
            wine_id,
            producer: wineData.producer,
            wine_name: wineData.wine_name,
            country: wineData.country ?? null,
            action: 'rule_med_kept',
            reason: 'perplexity_null_or_low',
            persisted_method: 'perplexity',
          }))
          await persistKosherResult(supabaseAdmin, wine_id, ruleResult, 'perplexity')
          return new Response(
            JSON.stringify({ success: true, method: 'perplexity', kosher: ruleResult }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }

        // rule=null + Perplexity=null → fall through to OpenAI
      }
    } else if (!perplexityApiKey && shouldRunPerplexity(wineData, ruleConfidence)) {
      // Perplexity would be triggered but API key is not configured
      console.log(JSON.stringify({
        fn: 'detect-kosher-status',
        wine_id,
        producer: wineData.producer,
        wine_name: wineData.wine_name,
        country: wineData.country ?? null,
        action: 'skip_perplexity',
        skipped_reason: 'api_key_not_configured',
      }))
      if (ruleResult.is_kosher !== null) {
        await persistKosherResult(supabaseAdmin, wine_id, ruleResult, 'rule')
        return new Response(
          JSON.stringify({ success: true, method: 'rule', kosher: ruleResult }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    } else {
      // Perplexity trigger filter said no (no positive signal) — skip for cost control
      if (ruleResult.is_kosher !== null) {
        await persistKosherResult(supabaseAdmin, wine_id, ruleResult, 'rule')
        return new Response(
          JSON.stringify({ success: true, method: 'rule', kosher: ruleResult }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    // ── Layer 3: conservative OpenAI fallback ────────────────────────────────
    // Only reaches here when:
    //   - rule returned null (no producer match), AND
    //   - Perplexity was skipped (trigger filter said no) OR Perplexity returned null
    console.log(`[detect-kosher-status] Layer 3 OpenAI: producer="${wineData.producer}" wine="${wineData.wine_name}"`)

    let aiResult: KosherResult = KOSHER_UNKNOWN

    try {
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 300,
          messages: [
            { role: 'system', content: buildKosherSystemPrompt() },
            { role: 'user', content: buildKosherUserPrompt(wineData) },
          ],
        }),
      })

      if (!aiResponse.ok) {
        const errText = await aiResponse.text()
        console.warn(`[detect-kosher-status] OpenAI error ${aiResponse.status}: ${errText}`)
      } else {
        const aiData = await aiResponse.json()
        const rawContent: string = aiData.choices?.[0]?.message?.content ?? ''
        const parsed = parseAiKosherResponse(rawContent)

        if (parsed) {
          aiResult = parsed
          console.log(
            `[detect-kosher-status] OpenAI result: is_kosher=${aiResult.is_kosher}` +
            ` confidence=${aiResult.kosher_confidence}`,
          )
        } else {
          console.warn('[detect-kosher-status] Could not parse OpenAI response — storing null')
        }
      }
    } catch (aiErr) {
      console.warn('[detect-kosher-status] OpenAI call failed (storing null):', aiErr)
    }

    // Always persist even when result is all-null — sets kosher_updated_at to
    // prevent repeated failed lookups for wines with no available data.
    await persistKosherResult(supabaseAdmin, wine_id, aiResult, 'ai')

    return new Response(
      JSON.stringify({ success: true, method: 'ai', kosher: aiResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[detect-kosher-status] Unhandled error:', message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
}))

// ── Persistence helper ────────────────────────────────────────────────────────

type EnrichmentMethod = 'rule' | 'ai' | 'perplexity' | 'manual'

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
    console.error('[detect-kosher-status] DB update failed:', error.message)
  }
}
