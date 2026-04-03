// Supabase Edge Function: analyze-wine
// Generates AI-powered sommelier notes using ChatGPT

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  buildWineAnalysisSystemPrompt,
  buildWineAnalysisUserPrompt,
  normalizeBarrelFields,
} from '../_shared/wineAiAnalysis.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface WineData {
  wine_name: string
  producer?: string
  vintage?: number
  region?: string
  country?: string
  appellation?: string
  grapes?: string[]
  color: string
  notes?: string
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
  he_translations?: {
    wine_name?: string
    producer?: string
    region?: string
    country?: string
    appellation?: string
    grapes?: string[]
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Verify user JWT via service role key (most reliable pattern)
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

    // Parse request body
    const { bottle_id, wine_data, wine_id } = await req.json()
    
    if (!bottle_id || !wine_data) {
      throw new Error('Missing bottle_id or wine_data')
    }

    const wineData = wine_data as WineData
    const language = wineData.language || 'en' // Default to English

    console.log('[Analyze Wine] Generating analysis in language:', language)

    const currentYear = new Date().getFullYear()
    const systemPrompt = buildWineAnalysisSystemPrompt('single', language)
    const userPrompt = buildWineAnalysisUserPrompt(
      {
        wine_name: wineData.wine_name,
        producer: wineData.producer,
        vintage: wineData.vintage,
        region: wineData.region,
        country: wineData.country,
        appellation: wineData.appellation,
        grapes: wineData.grapes,
        color: wineData.color,
        notes: wineData.notes,
      },
      currentYear,
      language,
      'single',
    )

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
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
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text()
      console.error('OpenAI API error:', errorData)
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices[0]?.message?.content

    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Parse ChatGPT response
    const analysis: AnalysisResult = normalizeBarrelFields(JSON.parse(content) as Record<string, unknown>) as AnalysisResult

    // Validate response structure
    if (!analysis.analysis_summary || !analysis.analysis_reasons || !analysis.readiness_label) {
      throw new Error('Invalid response structure from ChatGPT')
    }

    // Persist wine-level fields (translations + barrel estimates)
    if (wine_id) {
      try {
        const { data: currentWine } = await supabaseAdmin
          .from('wines')
          .select('translations')
          .eq('id', wine_id)
          .single()

        const patch: Record<string, unknown> = {
          barrel_aging_note: analysis.barrel_aging_note ?? null,
          barrel_aging_months_est: analysis.barrel_aging_months_est ?? null,
        }

        if (analysis.he_translations) {
          const existingTranslations = (currentWine?.translations as Record<string, unknown>) || {}
          patch.translations = {
            ...existingTranslations,
            he: analysis.he_translations,
          }
        }

        await supabaseAdmin.from('wines').update(patch).eq('id', wine_id)
        console.log('[Analyze Wine] Updated wine profile fields:', wine_id)
      } catch (wineUpdateError) {
        console.error('[Analyze Wine] Failed to update wines row:', wineUpdateError)
      }
    }

    // Return analysis result
    return new Response(
      JSON.stringify({ success: true, analysis }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Edge function error:', error)
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

