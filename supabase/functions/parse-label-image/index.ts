import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedWineData {
  producer: { value: string | null; confidence: 'low' | 'medium' | 'high' } | null;
  name: { value: string | null; confidence: 'low' | 'medium' | 'high' } | null;
  vintage: { value: number | null; confidence: 'low' | 'medium' | 'high' } | null;
  region: { value: string | null; confidence: 'low' | 'medium' | 'high' } | null;
  country: { value: string | null; confidence: 'low' | 'medium' | 'high' } | null;
  style: { value: 'red' | 'white' | 'rose' | 'sparkling' | null; confidence: 'low' | 'medium' | 'high' } | null;
  grapes: { value: string[] | null; confidence: 'low' | 'medium' | 'high' } | null;
  alcohol: { value: number | null; confidence: 'low' | 'medium' | 'high' } | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Parse Label] Request received');

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Create Supabase client from the request (automatically handles auth)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('[Parse Label] Auth error:', authError?.message || 'No user');
      throw new Error('Unauthorized');
    }

    console.log('[Parse Label] ✅ User authenticated:', user.id);

    // Parse request body
    const { imageUrl, imagePath, mode } = await req.json();
    const isMultiBottle = mode === 'multi-bottle';
    console.log('[Parse Label] Image URL:', imageUrl);
    console.log('[Parse Label] Image path:', imagePath);
    console.log('[Parse Label] Mode:', mode || 'single');

    if (!imageUrl && !imagePath) {
      throw new Error('Either imageUrl or imagePath is required');
    }

    // Get image URL (if path provided, get public URL)
    let finalImageUrl = imageUrl;
    if (imagePath && !imageUrl) {
      const { data } = supabaseClient.storage
        .from('wine-labels')
        .getPublicUrl(imagePath);
      finalImageUrl = data.publicUrl;
    }

    console.log('[Parse Label] Using image URL:', finalImageUrl);

    // Step 1: OCR + AI Parsing using OpenAI Vision
    console.log('[Parse Label] Calling OpenAI Vision API...');
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: isMultiBottle 
              ? `You are a wine label OCR and data extraction expert.
Analyze wine bottle label images and extract structured data for MULTIPLE bottles visible in the image.

CRITICAL RULES:
- Return ONLY valid JSON, no markdown, no explanations
- Detect ALL visible wine bottles in the image (look for multiple labels)
- Return an array of bottle data, one entry per visible bottle
- Use null for any field you cannot confidently determine
- Do NOT hallucinate or guess missing information
- Assign confidence: "high" (clearly visible), "medium" (partially visible), "low" (uncertain)
- For style, choose ONLY from: "red", "white", "rose", "sparkling", or null
- Extract vintage as a number (year) or null if not found
- For grapes, return array of grape names or null
- For alcohol, extract numeric percentage or null

Return JSON as an array in this exact format:
{
  "bottles": [
    {
      "producer": { "value": "Producer Name" or null, "confidence": "high"|"medium"|"low" },
      "name": { "value": "Wine Name" or null, "confidence": "high"|"medium"|"low" },
      "vintage": { "value": 2022 or null, "confidence": "high"|"medium"|"low" },
      "region": { "value": "Region" or null, "confidence": "high"|"medium"|"low" },
      "country": { "value": "Country" or null, "confidence": "high"|"medium"|"low" },
      "style": { "value": "red"|"white"|"rose"|"sparkling" or null, "confidence": "high"|"medium"|"low" },
      "grapes": { "value": ["Grape1", "Grape2"] or null, "confidence": "high"|"medium"|"low" },
      "alcohol": { "value": 13.5 or null, "confidence": "high"|"medium"|"low" }
    }
  ]
}`
              : `You are a wine label OCR and data extraction expert. 
Analyze wine bottle label images and extract structured data.

CRITICAL RULES:
- Return ONLY valid JSON, no markdown, no explanations
- Use null for any field you cannot confidently determine
- Do NOT hallucinate or guess missing information
- Assign confidence: "high" (clearly visible), "medium" (partially visible), "low" (uncertain)
- For style, choose ONLY from: "red", "white", "rose", "sparkling", or null
- Extract vintage as a number (year) or null if not found
- For grapes, return array of grape names or null
- For alcohol, extract numeric percentage or null

Return JSON in this exact format:
{
  "producer": { "value": "Producer Name" or null, "confidence": "high"|"medium"|"low" },
  "name": { "value": "Wine Name" or null, "confidence": "high"|"medium"|"low" },
  "vintage": { "value": 2022 or null, "confidence": "high"|"medium"|"low" },
  "region": { "value": "Region" or null, "confidence": "high"|"medium"|"low" },
  "country": { "value": "Country" or null, "confidence": "high"|"medium"|"low" },
  "style": { "value": "red"|"white"|"rose"|"sparkling" or null, "confidence": "high"|"medium"|"low" },
  "grapes": { "value": ["Grape1", "Grape2"] or null, "confidence": "high"|"medium"|"low" },
  "alcohol": { "value": 13.5 or null, "confidence": "high"|"medium"|"low" }
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: isMultiBottle 
                  ? 'Extract wine data from ALL bottles visible in this image. Detect multiple wine bottles and return an array with one entry per bottle. Return only the JSON response.'
                  : 'Extract wine data from this bottle label image. Return only the JSON response.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: finalImageUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1, // Low temperature for consistent extraction
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[Parse Label] OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('[Parse Label] OpenAI response:', JSON.stringify(openaiData, null, 2));

    // Extract the parsed data from OpenAI response
    const aiContent = openaiData.choices?.[0]?.message?.content;
    if (!aiContent) {
      throw new Error('No content in OpenAI response');
    }

    // Parse the JSON (remove markdown code blocks if present)
    let cleanContent = aiContent.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/```\n?/g, '');
    }

    const parsedData = JSON.parse(cleanContent);
    console.log('[Parse Label] Parsed data:', JSON.stringify(parsedData, null, 2));

    // Handle multi-bottle mode
    if (isMultiBottle && parsedData.bottles && Array.isArray(parsedData.bottles)) {
      // Validate each bottle
      const validatedBottles = parsedData.bottles.map((bottle: any) => ({
        producer: bottle.producer?.value ? bottle.producer : null,
        name: bottle.name?.value ? bottle.name : null,
        vintage: bottle.vintage?.value ? bottle.vintage : null,
        region: bottle.region?.value ? bottle.region : null,
        country: bottle.country?.value ? bottle.country : null,
        style: bottle.style?.value ? bottle.style : null,
        grapes: bottle.grapes?.value && Array.isArray(bottle.grapes.value) && bottle.grapes.value.length > 0 
          ? bottle.grapes 
          : null,
        alcohol: bottle.alcohol?.value ? bottle.alcohol : null,
      }));

      console.log('[Parse Label] ✅ Success! Detected', validatedBottles.length, 'bottles');

      return new Response(
        JSON.stringify({
          success: true,
          bottles: validatedBottles,
          count: validatedBottles.length,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Single bottle mode (original behavior)
    const validatedData: ParsedWineData = {
      producer: parsedData.producer?.value ? parsedData.producer : null,
      name: parsedData.name?.value ? parsedData.name : null,
      vintage: parsedData.vintage?.value ? parsedData.vintage : null,
      region: parsedData.region?.value ? parsedData.region : null,
      country: parsedData.country?.value ? parsedData.country : null,
      style: parsedData.style?.value ? parsedData.style : null,
      grapes: parsedData.grapes?.value && Array.isArray(parsedData.grapes.value) && parsedData.grapes.value.length > 0 
        ? parsedData.grapes 
        : null,
      alcohol: parsedData.alcohol?.value ? parsedData.alcohol : null,
    };

    // Calculate overall confidence
    const allFields = Object.values(validatedData).filter(field => field !== null);
    const highConfidenceCount = allFields.filter(field => field?.confidence === 'high').length;
    const totalFields = allFields.length;
    
    const overallConfidence = totalFields === 0 
      ? 'low' 
      : highConfidenceCount / totalFields > 0.6 
        ? 'high' 
        : highConfidenceCount / totalFields > 0.3 
          ? 'medium' 
          : 'low';

    console.log('[Parse Label] ✅ Success! Overall confidence:', overallConfidence);

    return new Response(
      JSON.stringify({
        success: true,
        data: validatedData,
        overallConfidence,
        fieldsExtracted: totalFields,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('[Parse Label] ❌ Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to parse label image',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message === 'Unauthorized' ? 401 : 500,
      }
    );
  }
});

