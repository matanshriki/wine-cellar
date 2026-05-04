/**
 * Supabase Edge Function: generate-food-pairing
 *
 * Generates AI-powered food pairing recommendations for a wine and
 * persists them to wines.food_pairing (jsonb). Called fire-and-forget
 * from the web app after a bottle is created, so users never wait for it.
 *
 * Request body:
 * {
 *   wine_id: string         — required; row to update in wines table
 *   wine_data: {
 *     wine_name, producer, vintage, country, region, appellation,
 *     color, grapes, rating, notes, regional_wine_style
 *   }
 *   trigger_source?: 'user_scan' | 'backfill' | 'manual'
 * }
 *
 * Response:
 * { success: true, food_pairing: FoodPairing }
 * { success: false, error: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { checkCreditAccess, logCreditUsage, insufficientCreditsResponse } from '../_shared/creditHelper.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface WineInput {
  wine_name: string
  producer?: string
  vintage?: number | null
  country?: string | null
  region?: string | null
  appellation?: string | null
  color: string
  grapes?: string[] | string | null
  rating?: number | null
  notes?: string | null
  regional_wine_style?: string | null
}

export interface FoodPairing {
  summary: string
  best_pairings: string[]
  everyday_pairings: string[]
  avoid: string[]
  pairing_logic: string
  occasion_fit: string[]
  confidence: 'low' | 'med' | 'high'
}

function formatGrapes(grapes: WineInput['grapes']): string {
  if (Array.isArray(grapes)) return grapes.join(', ') || 'Unknown'
  if (typeof grapes === 'string' && grapes.trim()) return grapes.trim()
  try {
    if (typeof grapes === 'string') {
      const parsed = JSON.parse(grapes)
      if (Array.isArray(parsed)) return parsed.join(', ')
    }
  } catch { /* not JSON */ }
  return 'Unknown'
}

function buildSystemPrompt(): string {
  return `You are an expert sommelier specializing in wine and food pairing.
You MUST respond with valid JSON only, using this exact structure:

{
  "summary": "2-sentence overview of why this wine pairs well with food and its ideal context",
  "best_pairings": ["3-5 premium or restaurant-quality dishes that shine with this wine"],
  "everyday_pairings": ["3-5 simple home dishes that are easy to prepare"],
  "avoid": ["2-4 food categories that clash with this wine"],
  "pairing_logic": "1-2 sentence explanation of the pairing science (tannin, acidity, fat, flavor matching)",
  "occasion_fit": ["3-5 occasion examples like BBQ, date night, family dinner, cheese board, aperitivo"],
  "confidence": "low" | "med" | "high"
}

RULES:
- Be SPECIFIC to the wine (producer, region, style) — do NOT give generic advice
- best_pairings: Use specific named dishes, not vague categories ("Braised short rib with truffle jus", not "red meat")
- everyday_pairings: Simple, accessible dishes a home cook can make ("Spaghetti with tomato meat sauce")
- avoid: Clear categories that would clash ("Vinegar-heavy salad dressings", "Very spicy curries")
- pairing_logic: Explain WHY in terms of the wine's structure (tannin vs fat, acidity vs richness, etc.)
- If data is missing, lower confidence and make clear you're estimating
- Respond in English only`
}

function buildUserPrompt(wine: WineInput): string {
  const grapes = formatGrapes(wine.grapes)
  const age = wine.vintage ? new Date().getFullYear() - wine.vintage : null

  return `Generate food pairing recommendations for this wine:

Wine: ${wine.wine_name}
Producer: ${wine.producer ?? 'Unknown'}
Vintage: ${wine.vintage ?? 'NV'}${age !== null ? ` (${age} years old)` : ''}
Country: ${wine.country ?? 'Unknown'}
Region: ${wine.region ?? 'Unknown'}
Appellation: ${wine.appellation ?? 'Unknown'}
Style: ${wine.color}
Grapes: ${grapes}
Regional Style: ${wine.regional_wine_style ?? 'Unknown'}
Vivino Rating: ${wine.rating ? `${wine.rating}/5` : 'Not rated'}
User Notes: ${wine.notes?.trim() ? wine.notes : 'None'}

Provide specific, memorable food pairing recommendations grounded in this wine's actual character. Reference the producer and region where relevant.`
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

    const { wine_id, wine_data, trigger_source } = await req.json()
    if (!wine_id || !wine_data) {
      throw new Error('Missing wine_id or wine_data')
    }

    const wineData = wine_data as WineInput

    // Skip generation if food_pairing already exists and this isn't a forced regeneration
    if (trigger_source !== 'force') {
      const { data: existing } = await supabaseAdmin
        .from('wines')
        .select('food_pairing')
        .eq('id', wine_id)
        .single()

      if (existing?.food_pairing) {
        console.log('[generate-food-pairing] Already exists, skipping:', wine_id)
        return new Response(
          JSON.stringify({ success: true, food_pairing: existing.food_pairing, cached: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )
      }
    }

    // Credit check — food pairing is system-triggered so we keep cost at 1
    // but the credit system is fail-open during dark launch anyway.
    const creditCheck = await checkCreditAccess(supabaseAdmin, user.id, 'food_pairing_generation', 1)
    if (!creditCheck.allowed) {
      await logCreditUsage(supabaseAdmin, {
        userId: user.id,
        actionType: 'food_pairing_generation',
        creditsRequired: 1,
        requestStatus: 'error',
        metadata: { blocked: true, reason: creditCheck.reason, trigger_source: trigger_source ?? 'user_scan' },
      })
      return insufficientCreditsResponse(creditCheck.effectiveBalance ?? 0, 1, corsHeaders)
    }

    console.log('[generate-food-pairing] Generating for:', wineData.wine_name)

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(wineData) },
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' },
        max_tokens: 700,
      }),
    })

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text()
      console.error('[generate-food-pairing] OpenAI error:', errText)
      await logCreditUsage(supabaseAdmin, {
        userId: user.id,
        actionType: 'food_pairing_generation',
        creditsRequired: 1,
        requestStatus: 'failed',
        modelName: 'gpt-4o-mini',
        metadata: { openai_status: openaiResponse.status, trigger_source: trigger_source ?? 'user_scan' },
      })
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices[0]?.message?.content
    if (!content) throw new Error('No response from OpenAI')

    const raw = JSON.parse(content) as Record<string, unknown>

    // Validate and sanitize
    const foodPairing: FoodPairing = {
      summary: String(raw.summary ?? ''),
      best_pairings: Array.isArray(raw.best_pairings) ? raw.best_pairings.map(String) : [],
      everyday_pairings: Array.isArray(raw.everyday_pairings) ? raw.everyday_pairings.map(String) : [],
      avoid: Array.isArray(raw.avoid) ? raw.avoid.map(String) : [],
      pairing_logic: String(raw.pairing_logic ?? ''),
      occasion_fit: Array.isArray(raw.occasion_fit) ? raw.occasion_fit.map(String) : [],
      confidence: (['low', 'med', 'high'] as const).includes(raw.confidence as any)
        ? (raw.confidence as FoodPairing['confidence'])
        : 'med',
    }

    if (!foodPairing.summary || foodPairing.best_pairings.length === 0) {
      throw new Error('Invalid food pairing structure from OpenAI')
    }

    // Persist to wines table
    const { error: updateError } = await supabaseAdmin
      .from('wines')
      .update({
        food_pairing: foodPairing,
        food_pairing_updated_at: new Date().toISOString(),
        food_pairing_confidence: foodPairing.confidence,
      })
      .eq('id', wine_id)

    if (updateError) {
      console.error('[generate-food-pairing] DB update failed:', updateError)
      throw updateError
    }

    console.log('[generate-food-pairing] ✅ Saved for:', wineData.wine_name)

    await logCreditUsage(supabaseAdmin, {
      userId: user.id,
      actionType: 'food_pairing_generation',
      creditsRequired: 1,
      requestStatus: 'success',
      modelName: 'gpt-4o-mini',
      inputTokens: openaiData.usage?.prompt_tokens ?? null,
      outputTokens: openaiData.usage?.completion_tokens ?? null,
      metadata: {
        wine_name: wineData.wine_name,
        wine_id,
        trigger_source: trigger_source ?? 'user_scan',
      },
    })

    return new Response(
      JSON.stringify({ success: true, food_pairing: foodPairing }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    console.error('[generate-food-pairing] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
