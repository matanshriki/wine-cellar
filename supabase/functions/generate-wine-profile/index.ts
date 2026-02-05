// Supabase Edge Function: generate-wine-profile
// Generates structured wine profiles (body, tannin, acidity, etc.) using OpenAI
// with strict JSON schema validation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface WineProfileInput {
  wine_id?: string
  name: string
  producer?: string
  region?: string
  country?: string
  grapes?: string[] | string
  color: 'red' | 'white' | 'rose' | 'sparkling'
  regional_wine_style?: string
  vintage?: number
  vivino_fields?: {
    rating?: number
    notes?: string
    abv?: number
  }
  sommelier_notes?: string
}

interface WineProfile {
  body: number // 1-5
  tannin: number // 1-5
  acidity: number // 1-5
  oak: number // 1-5
  sweetness: number // 0-5
  alcohol_est: number | null
  power: number // 1-10 (computed server-side)
  style_tags: string[]
  confidence: 'low' | 'med' | 'high'
  source: 'ai'
  updated_at: string
}

/**
 * Compute wine power deterministically
 * Formula: (body*2 + tannin*1.5 + oak*1 + acidity*0.8 + sweetness*0.2) / 2.0
 * Clamped to 1-10, rounded
 */
function computePower(profile: {
  body: number
  tannin: number
  oak: number
  acidity: number
  sweetness: number
}): number {
  const base =
    profile.body * 2 +
    profile.tannin * 1.5 +
    profile.oak * 1 +
    profile.acidity * 0.8 +
    profile.sweetness * 0.2

  const power = base / 2.0
  return Math.round(Math.max(1, Math.min(10, power)))
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Parse request body
    const input: WineProfileInput = await req.json()

    if (!input.name || !input.color) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Missing required fields: name, color' },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Build context for OpenAI
    const grapesStr = Array.isArray(input.grapes) ? input.grapes.join(', ') : input.grapes || 'Unknown'
    const vintageStr = input.vintage ? ` (${input.vintage})` : ''
    const producerStr = input.producer ? ` by ${input.producer}` : ''
    const regionStr = input.region ? ` from ${input.region}` : ''
    const countryStr = input.country ? `, ${input.country}` : ''
    const styleStr = input.regional_wine_style ? `\nRegional Style: ${input.regional_wine_style}` : ''
    const abvStr = input.vivino_fields?.abv ? `\nABV: ${input.vivino_fields.abv}%` : ''
    const ratingStr = input.vivino_fields?.rating ? `\nVivino Rating: ${input.vivino_fields.rating}/5` : ''
    const vivinoNotesStr = input.vivino_fields?.notes ? `\nVivino Notes: ${input.vivino_fields.notes}` : ''
    const sommelierNotesStr = input.sommelier_notes ? `\nSommelier Analysis: ${input.sommelier_notes}` : ''

    const wineContext = `Wine: ${input.name}${vintageStr}${producerStr}${regionStr}${countryStr}
Color: ${input.color}
Grapes: ${grapesStr}${styleStr}${abvStr}${ratingStr}${vivinoNotesStr}${sommelierNotesStr}`

    console.log('[generate-wine-profile] Generating profile for:', input.name)

    // Call OpenAI with STRICT JSON schema
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional sommelier. Analyze wines and provide structured profiles.

For each wine, provide:
- body (1-5): 1=very light, 3=medium, 5=very full
- tannin (1-5): 1=low/none, 3=medium, 5=very high (mainly for reds; whites/rosés typically 1-2)
- acidity (1-5): 1=very low, 3=medium, 5=very high
- oak (1-5): 1=none/unoaked, 3=moderate, 5=heavily oaked
- sweetness (0-5): 0=bone dry, 1-2=off-dry, 3-4=medium sweet, 5=very sweet
- alcohol_est (number or null): Estimated ABV if not provided
- style_tags (array of 3-8 short kebab-case descriptors)
- confidence (low|med|high): Your confidence in this assessment

Base your analysis on:
- Grape varieties and their typical characteristics
- Region and terroir
- Vintage (if provided)
- Wine style descriptors
- Any provided tasting notes or ratings`,
          },
          {
            role: 'user',
            content: `Analyze this wine and provide its profile:\n\n${wineContext}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'wine_profile',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                body: { type: 'integer', minimum: 1, maximum: 5 },
                tannin: { type: 'integer', minimum: 1, maximum: 5 },
                acidity: { type: 'integer', minimum: 1, maximum: 5 },
                oak: { type: 'integer', minimum: 1, maximum: 5 },
                sweetness: { type: 'integer', minimum: 0, maximum: 5 },
                alcohol_est: { 
                  anyOf: [
                    { type: 'number' },
                    { type: 'null' }
                  ]
                },
                style_tags: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 3,
                  maxItems: 8,
                },
                confidence: {
                  type: 'string',
                  enum: ['low', 'med', 'high'],
                },
              },
              required: ['body', 'tannin', 'acidity', 'oak', 'sweetness', 'alcohol_est', 'style_tags', 'confidence'],
              additionalProperties: false,
            },
          },
        },
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('[generate-wine-profile] OpenAI error:', errorText)
      throw new Error(`OpenAI API error: ${openaiResponse.status} ${errorText}`)
    }

    const openaiData = await openaiResponse.json()
    const aiProfile = JSON.parse(openaiData.choices[0].message.content)

    console.log('[generate-wine-profile] ✅ AI profile generated:', aiProfile)

    // Compute power deterministically
    const power = computePower(aiProfile)

    // Build final profile
    const profile: WineProfile = {
      ...aiProfile,
      power,
      source: 'ai',
      updated_at: new Date().toISOString(),
    }

    // Persist to database if wine_id provided
    if (input.wine_id) {
      console.log('[generate-wine-profile] Persisting profile to DB for wine:', input.wine_id)

      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase configuration missing')
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      const { error: updateError } = await supabase
        .from('wines')
        .update({
          wine_profile: profile,
          wine_profile_updated_at: new Date().toISOString(),
          wine_profile_source: 'ai',
          wine_profile_confidence: profile.confidence,
        })
        .eq('id', input.wine_id)

      if (updateError) {
        console.error('[generate-wine-profile] DB update error:', updateError)
        throw updateError
      }

      console.log('[generate-wine-profile] ✅ Profile persisted to DB')
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        profile,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[generate-wine-profile] Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: error.message || 'Failed to generate wine profile',
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
