// Supabase Edge Function: extract-wine-label
// Uses OpenAI Vision API to extract wine details from label photos

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ExtractedWineData {
  producer: string | null
  wine_name: string | null
  vintage: number | null
  country: string | null
  region: string | null
  wine_color: 'red' | 'white' | 'rose' | 'sparkling' | null
  grape: string | null
  bottle_size_ml: number | null
  confidence: {
    producer: 'high' | 'medium' | 'low'
    wine_name: 'high' | 'medium' | 'low'
    vintage: 'high' | 'medium' | 'low'
    overall: 'high' | 'medium' | 'low'
  }
  notes: string
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

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request
    const { image_url, image_base64 } = await req.json()
    
    if (!image_url && !image_base64) {
      throw new Error('Missing image_url or image_base64')
    }

    // Prepare image for OpenAI
    let imageData: string
    
    if (image_base64) {
      // Use base64 directly
      imageData = image_base64.startsWith('data:') 
        ? image_base64 
        : `data:image/jpeg;base64,${image_base64}`
    } else {
      // Use URL (OpenAI will fetch it)
      imageData = image_url
    }

    // Call OpenAI Vision API
    const systemPrompt = `You are a wine label data extractor. Analyze the wine label photo and extract structured information.

YOU MUST respond with ONLY valid JSON in this exact format:
{
  "producer": "string or null",
  "wine_name": "string or null",
  "vintage": number or null,
  "country": "string or null",
  "region": "string or null",
  "wine_color": "red" | "white" | "rose" | "sparkling" | null,
  "grape": "string or null (comma-separated if multiple)",
  "bottle_size_ml": number or null,
  "confidence": {
    "producer": "high" | "medium" | "low",
    "wine_name": "high" | "medium" | "low",
    "vintage": "high" | "medium" | "low",
    "overall": "high" | "medium" | "low"
  },
  "notes": "string (brief note about extraction quality or missing info)"
}

Rules:
- Extract text EXACTLY as it appears (preserve accents, capitalization)
- producer = winery/estate name
- wine_name = the specific wine's name (NOT including producer)
- vintage = year (as number, or null if not visible/N.V.)
- country = country name if visible
- region = region/appellation if visible
- wine_color = infer from label color, text, or bottle shape if possible
- grape = grape variety/varieties if listed
- bottle_size_ml = standard is 750, extract if different size shown
- confidence = your confidence level for each key field
- notes = brief explanation of what was clear vs. unclear

If you cannot read something, set it to null and note it in "notes".
RESPOND ONLY WITH JSON. NO OTHER TEXT.`

    const userPrompt = 'Analyze this wine label and extract all details into the JSON format specified.'

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageData,
                  detail: 'high', // High detail for better text extraction
                },
              },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.1, // Low temperature for consistent extraction
        response_format: { type: 'json_object' },
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices[0]?.message?.content

    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Parse extracted data
    const extractedData: ExtractedWineData = JSON.parse(content)

    // Validate structure
    if (!extractedData.confidence || !extractedData.notes) {
      throw new Error('Invalid response structure from OpenAI')
    }

    // Return extracted data
    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
      }),
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

