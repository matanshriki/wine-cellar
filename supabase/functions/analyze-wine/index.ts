// Supabase Edge Function: analyze-wine
// Generates AI-powered sommelier notes using ChatGPT

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  type BarrelAgingMetadata,
  type ServingGuidance,
} from '../_shared/wineAiAnalysis.ts'
import { checkCreditAccess, logCreditUsage, insufficientCreditsResponse } from '../_shared/creditHelper.ts'
import {
  buildAnalysisDataSlice,
  mergeAnalysisDataJson,
  normalizeAnalysisDataLang,
} from '../_shared/bottleAnalysisData.ts'
import { generateWineAnalysisWithOpenAi, type WineDataForAnalysis } from '../_shared/wineAnalysisGenerationOpenAi.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface WineData extends WineDataForAnalysis {
  language?: string // 'en' or 'he'
}

interface AnalysisResult {
  analysis_summary: string
  analysis_reasons: string[]
  readiness_label: 'READY' | 'HOLD' | 'PEAK_SOON'
  serving_temp_c: number
  decant_minutes: number
  drink_window_start?: number
  drink_window_end?: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  assumptions?: string
  barrel_aging_note?: string | null
  barrel_aging_months_est?: number | null
  barrel_aging_confidence?: string | null
  barrel_aging_source?: string | null
  barrel_aging_metadata?: BarrelAgingMetadata | null
  serving?: ServingGuidance | null
  he_translations?: {
    wine_name?: string
    producer?: string
    region?: string
    country?: string
    appellation?: string
    grapes?: string[]
  }
}

function mapReadinessLabel(label: string): string {
  switch (label) {
    case 'READY':
      return 'InWindow'
    case 'PEAK_SOON':
      return 'Approaching'
    case 'HOLD':
      return 'TooYoung'
    default:
      return 'Unknown'
  }
}

function mapReadinessScore(label: string): number {
  switch (label) {
    case 'READY':
      return 90
    case 'PEAK_SOON':
      return 75
    case 'HOLD':
      return 60
    default:
      return 50
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      console.error('[Analyze Wine] Auth failed:', userError?.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { bottle_id, wine_data, wine_id, trigger_source } = await req.json()

    if (!bottle_id || !wine_data) {
      throw new Error('Missing bottle_id or wine_data')
    }

    // ── Ownership check ───────────────────────────────────────────────────────
    // Load the bottle and verify it belongs to the calling user.
    // Also fetch created_at + analysis sentinel fields needed for the
    // system_background eligibility check below.
    const { data: bottleRow, error: bottleOwnerErr } = await supabaseAdmin
      .from('bottles')
      .select(
        'id, user_id, wine_id, created_at, readiness_label, analysis_summary, serving_guidance, serve_temp_c, decant_minutes, analysis_data',
      )
      .eq('id', bottle_id)
      .single()

    if (bottleOwnerErr || !bottleRow) {
      console.warn('[Analyze Wine] Bottle not found:', bottle_id)
      return new Response(
        JSON.stringify({ success: false, error: 'Bottle not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    if (bottleRow.user_id !== user.id) {
      console.warn('[Analyze Wine] Ownership check failed: bottle', bottle_id,
        'belongs to', bottleRow.user_id, 'not', user.id)
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // If caller supplied a wine_id, it must match the bottle's wine to prevent
    // a cross-wine update (e.g., overwriting another wine's barrel fields).
    const resolvedWineId: string | null = wine_id ?? bottleRow.wine_id ?? null
    if (wine_id && bottleRow.wine_id && bottleRow.wine_id !== wine_id) {
      console.warn('[Analyze Wine] wine_id mismatch for bottle', bottle_id)
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const wineData = wine_data as WineData
    const language = wineData.language || 'en'
    const analysisLangKey = normalizeAnalysisDataLang(language)

    // ── Enrich wine data from DB ───────────────────────────────────────────────
    // Load additional fields (wine_profile, regional_wine_style, rating, vivino_wine_id)
    // from the wines row to improve prompt quality. Best-effort: failures are non-fatal.
    // This query runs early so the resolved wine ID is already available.
    let wineEnrichment: {
      regional_wine_style?: string | null
      wine_profile?: Record<string, unknown> | null
      rating?: number | null
      vivino_wine_id?: string | null
    } = {}

    if (resolvedWineId) {
      try {
        const { data: enrichedWine } = await supabaseAdmin
          .from('wines')
          .select('regional_wine_style, wine_profile, rating, vivino_wine_id')
          .eq('id', resolvedWineId)
          .single()
        if (enrichedWine) {
          wineEnrichment = enrichedWine
        }
      } catch (_enrichErr) {
        // Non-fatal — analysis continues with base wine_data fields
      }
    }

    // ── Credit action type ────────────────────────────────────────────────────
    // system_background is only accepted when ALL of the following hold:
    //   1. bottle.created_at is within the last 5 minutes (recency window).
    //      This is the primary defence: even if a user clears translations.he,
    //      they cannot claim system_background outside the creation window.
    //   2. The wine has no Hebrew translations yet  OR  the bottle has no
    //      initial analysis (readiness_label / analysis_summary). This ensures
    //      the 0-credit path is never granted for a re-analysis request.
    // Any condition that fails → fall back to wine_bottle_analysis (1 credit).
    let creditActionType = 'wine_bottle_analysis'
    let creditCost = 1

    if (trigger_source === 'system_background' && resolvedWineId) {
      const SYSTEM_BG_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

      // Condition 1 — recency
      const bottleAgeMs = Date.now() - new Date(bottleRow.created_at).getTime()
      const isRecentBottle = bottleAgeMs <= SYSTEM_BG_WINDOW_MS

      if (isRecentBottle) {
        // Condition 2 — data is genuinely missing
        const { data: wineTransRow } = await supabaseAdmin
          .from('wines')
          .select('translations')
          .eq('id', resolvedWineId)
          .single()

        const existingHe = (wineTransRow?.translations as Record<string, unknown> | null)?.he
        const heIsEmpty = !existingHe || Object.keys(existingHe as object).length === 0
        const analysisIsMissing = !bottleRow.readiness_label && !bottleRow.analysis_summary
        const dataIsMissing = heIsEmpty || analysisIsMissing

        if (dataIsMissing) {
          // Both conditions satisfied — no credit charge
          creditActionType = 'system_analysis'
          creditCost = 0
          console.log(`[Analyze Wine] Confirmed system background: bottle age ${Math.round(bottleAgeMs / 1000)}s, heEmpty=${heIsEmpty}, analysisNew=${analysisIsMissing}`)
        } else {
          console.log('[Analyze Wine] system_background declined: data already exists, charging normally')
        }
      } else {
        console.log(`[Analyze Wine] system_background declined: bottle age ${Math.round(bottleAgeMs / 1000)}s exceeds ${SYSTEM_BG_WINDOW_MS / 1000}s window, charging normally`)
      }
    }

    const creditCheck = await checkCreditAccess(supabaseAdmin, user.id, creditActionType, creditCost)
    if (!creditCheck.allowed) {
      await logCreditUsage(supabaseAdmin, {
        userId: user.id,
        actionType: creditActionType,
        creditsRequired: creditCost,
        requestStatus: 'error',
        metadata: { blocked: true, reason: creditCheck.reason, trigger_source: trigger_source ?? 'user' },
      })
      return insufficientCreditsResponse(creditCheck.effectiveBalance ?? 0, creditCost, corsHeaders)
    }

    const enrichmentLog = {
      hasWineProfile: !!wineEnrichment.wine_profile,
      hasRegionalStyle: !!wineEnrichment.regional_wine_style,
      hasVivinoRating: wineEnrichment.rating != null,
      hasVivinoId: !!wineEnrichment.vivino_wine_id,
    }
    console.log('[Analyze Wine] Generating analysis in language:', language, 'for wine:', wineData.wine_name)
    console.log('[Analyze Wine] Enrichment fields:', JSON.stringify(enrichmentLog))

    let analysis: AnalysisResult
    let openaiUsage: { prompt_tokens: number | null; completion_tokens: number | null }
    try {
      const gen = await generateWineAnalysisWithOpenAi({
        openaiApiKey,
        wineData,
        wineEnrichment,
        language,
        existingServingForFallback: (bottleRow as { serving_guidance?: Record<string, unknown> | null })
          .serving_guidance,
        mode: 'single',
      })
      analysis = gen.analysis as AnalysisResult
      openaiUsage = gen.usage
    } catch (openAiErr: unknown) {
      const msg = openAiErr instanceof Error ? openAiErr.message : String(openAiErr)
      await logCreditUsage(supabaseAdmin, {
        userId: user.id,
        actionType: creditActionType,
        creditsRequired: creditCost,
        requestStatus: 'failed',
        modelName: 'gpt-4o-mini',
        metadata: { error: msg.slice(0, 500), trigger_source: trigger_source ?? 'user' },
      })
      throw openAiErr
    }

    const servingConf = analysis.serving?.confidence ?? 'low'
    console.log('[Analyze Wine] Serving guidance confidence:', servingConf, '| Readiness:', analysis.readiness_label)

    const analysisDataSlice = buildAnalysisDataSlice({
      analysis_summary: analysis.analysis_summary,
      analysis_reasons: analysis.analysis_reasons,
      assumptions: analysis.assumptions ?? null,
      serving_guidance: analysis.serving as unknown as Record<string, unknown>,
    })
    const mergedAnalysisData = mergeAnalysisDataJson(
      bottleRow.analysis_data as Record<string, unknown> | null | undefined,
      analysisLangKey,
      analysisDataSlice,
    )

    // Persist bottle-level fields (serving_guidance + scalar compat fields + per-locale analysis_data)
    const bottlePatch: Record<string, unknown> = {
      analysis_summary: analysis.analysis_summary,
      analysis_reasons: analysis.analysis_reasons,
      readiness_label: analysis.readiness_label,
      readiness_status: mapReadinessLabel(analysis.readiness_label),
      readiness_score: mapReadinessScore(analysis.readiness_label),
      readiness_version: 2,
      serve_temp_c: analysis.serving.temp_min,
      decant_minutes: analysis.serving.decant_min,
      serving_guidance: analysis.serving,
      drink_window_start: analysis.drink_window_start ?? null,
      drink_window_end: analysis.drink_window_end ?? null,
      confidence: analysis.confidence,
      assumptions: analysis.assumptions ?? null,
      analyzed_at: new Date().toISOString(),
      analysis_notes: analysis.analysis_summary,
      analysis_data: mergedAnalysisData,
    }

    const { error: bottleErr } = await supabaseAdmin
      .from('bottles')
      .update(bottlePatch)
      .eq('id', bottle_id)

    if (bottleErr) {
      console.error('[Analyze Wine] Failed to persist serving_guidance to bottle:', bottleErr.message)
    } else {
      console.log('[Analyze Wine] Persisted serving_guidance to bottle:', bottle_id)
    }

    // Persist wine-level fields (translations + barrel estimates + barrel metadata)
    if (resolvedWineId) {
      try {
        const { data: currentWine } = await supabaseAdmin
          .from('wines')
          .select('translations')
          .eq('id', resolvedWineId)
          .single()

        const patch: Record<string, unknown> = {
          barrel_aging_note: analysis.barrel_aging_note ?? null,
          barrel_aging_months_est: analysis.barrel_aging_months_est ?? null,
          barrel_aging_metadata: (analysis.barrel_aging_metadata as BarrelAgingMetadata) ?? null,
        }

        if (analysis.he_translations) {
          const existingTranslations = (currentWine?.translations as Record<string, unknown>) || {}
          patch.translations = {
            ...existingTranslations,
            he: analysis.he_translations,
          }
        }

        await supabaseAdmin.from('wines').update(patch).eq('id', resolvedWineId)
        console.log('[Analyze Wine] Updated wine barrel + metadata fields:', wine_id)
      } catch (wineUpdateError) {
        console.error('[Analyze Wine] Failed to update wines row:', wineUpdateError)
      }
    }

    await logCreditUsage(supabaseAdmin, {
      userId: user.id,
      actionType: creditActionType,
      creditsRequired: creditCost,
      requestStatus: 'success',
      modelName: 'gpt-4o-mini',
      inputTokens: openaiUsage.prompt_tokens,
      outputTokens: openaiUsage.completion_tokens,
      metadata: {
        language,
        trigger_source: trigger_source ?? 'user',
        wine_name: wineData.wine_name,
        serving_confidence: servingConf,
        readiness_label: analysis.readiness_label,
      },
    })

    return new Response(
      JSON.stringify({ success: true, analysis }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[Analyze Wine] Edge function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
