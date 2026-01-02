// Supabase Edge Function: analyze-wine
// Generates AI-powered sommelier notes using ChatGPT

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

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
      throw new Error('Missing authorization header')
    }

    // Create Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const { bottle_id, wine_data } = await req.json()
    
    if (!bottle_id || !wine_data) {
      throw new Error('Missing bottle_id or wine_data')
    }

    const wineData = wine_data as WineData
    const language = wineData.language || 'en' // Default to English

    console.log('[Analyze Wine] Generating analysis in language:', language)

    // Build ChatGPT prompt
    const currentYear = new Date().getFullYear()
    const age = wineData.vintage ? currentYear - wineData.vintage : null
    
    // Language-specific instructions
    const languageInstruction = language === 'he' 
      ? 'CRITICAL: You MUST write ALL text fields in HEBREW (עברית). The analysis_summary, analysis_reasons, and assumptions must be in Hebrew.'
      : 'Write all text fields in English.'
    
    const systemPrompt = `You are an expert sommelier analyzing wines. You MUST respond with valid JSON only, using this exact structure:

{
  "analysis_summary": "2-3 sentence sommelier note",
  "analysis_reasons": ["bullet 1", "bullet 2", "bullet 3"],
  "readiness_label": "READY" | "HOLD" | "PEAK_SOON",
  "serving_temp_c": number,
  "decant_minutes": number,
  "drink_window_start": number | null,
  "drink_window_end": number | null,
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "assumptions": "string or null"
}

IMPORTANT:
- Reference the SPECIFIC wine details (producer, region, vintage) in your analysis
- Do NOT use generic template language
- If data is missing, lower confidence and mention assumptions
- Analysis must be unique per bottle
- ${languageInstruction}`

    const userPrompt = language === 'he'
      ? `נתח את היין הזה וספק הערות סומלייה:

שם היין: ${wineData.wine_name}
יצרן: ${wineData.producer || 'לא ידוע'}
בציר: ${wineData.vintage || 'ללא בציר'}
גיל: ${age ? `${age} שנים` : 'לא ידוע'}
אזור: ${wineData.region || 'לא ידוע'}
ענבים: ${wineData.grapes?.join(', ') || 'לא ידוע'}
סגנון: ${wineData.color}
הערות משתמש: ${wineData.notes || 'אין'}

שנה נוכחית: ${currentYear}

ספק ניתוח מפורט וספציפי לבקבוק. התייחס ליצרן, לאזור ולבציר האמיתיים בסיכום שלך. אל תיתן עצות גנריות. כתוב הכל בעברית.`
      : `Analyze this wine and provide sommelier notes:

Wine Name: ${wineData.wine_name}
Producer: ${wineData.producer || 'Unknown'}
Vintage: ${wineData.vintage || 'NV'}
Age: ${age ? `${age} years` : 'Unknown'}
Region: ${wineData.region || 'Unknown'}
Grapes: ${wineData.grapes?.join(', ') || 'Unknown'}
Style: ${wineData.color}
User Notes: ${wineData.notes || 'None'}

Current Year: ${currentYear}

Provide a detailed, bottle-specific analysis. Reference the actual producer, region, and vintage in your summary. Do not give generic advice.`

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
    const analysis: AnalysisResult = JSON.parse(content)

    // Validate response structure
    if (!analysis.analysis_summary || !analysis.analysis_reasons || !analysis.readiness_label) {
      throw new Error('Invalid response structure from ChatGPT')
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

