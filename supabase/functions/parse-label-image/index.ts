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
    console.log('[Parse Label] ========== REQUEST START ==========');
    console.log('[Parse Label] Method:', req.method);
    console.log('[Parse Label] URL:', req.url);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[Parse Label] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'SERVER_CONFIG_ERROR',
          message: 'AI service not configured',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Create Supabase client (uses Authorization header automatically)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[Parse Label] No authorization header');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AUTH_REQUIRED',
          message: 'Authentication required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');
    console.log('[Parse Label] Token received (length:', token.length, ')');
    
    // Verify the JWT token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[Parse Label] Auth error:', authError?.message || 'No user');
      throw new Error('Unauthorized');
    }

    console.log('[Parse Label] ✅ User authenticated:', user.id);

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      console.error('[Parse Label] Invalid JSON in request body:', e);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'Request body must be valid JSON',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { imageUrl, imagePath, mode } = requestBody;
    const isMultiBottle = mode === 'multi-bottle';
    console.log('[Parse Label] Request params:', { 
      hasImageUrl: !!imageUrl, 
      hasImagePath: !!imagePath, 
      mode: mode || 'single' 
    });

    // Validate input
    if (!imageUrl && !imagePath) {
      console.error('[Parse Label] Missing required parameter: imageUrl or imagePath');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'MISSING_PARAMETER',
          message: 'Either imageUrl or imagePath is required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Get image URL (if path provided, get public URL)
    let finalImageUrl = imageUrl;
    if (imagePath && !imageUrl) {
      const { data } = supabaseClient.storage
        .from('wine-labels')
        .getPublicUrl(imagePath);
      finalImageUrl = data.publicUrl;
    }

    console.log('[Parse Label] Final image URL:', finalImageUrl);

    // Test image URL accessibility
    try {
      console.log('[Parse Label] Testing image URL accessibility...');
      const testResponse = await fetch(finalImageUrl, { method: 'HEAD' });
      if (!testResponse.ok) {
        console.error('[Parse Label] Image URL not accessible:', testResponse.status, testResponse.statusText);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'IMAGE_NOT_ACCESSIBLE',
            message: `Cannot access image (HTTP ${testResponse.status}). Please ensure the storage bucket is configured correctly.`,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }
      console.log('[Parse Label] ✅ Image URL is accessible');
    } catch (e) {
      console.error('[Parse Label] Failed to test image URL:', e);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'IMAGE_FETCH_FAILED',
          message: 'Cannot reach image URL. Check network and storage configuration.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Step 1: OCR + AI Parsing using OpenAI Vision
    console.log('[Parse Label] Calling OpenAI Vision API...');
    console.log('[Parse Label] Model: gpt-4o-mini');
    console.log('[Parse Label] Mode:', isMultiBottle ? 'multi-bottle (with receipt detection)' : 'single');
    
    let openaiResponse;
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              ? `You are a wine image classifier and data extraction expert.

STEP 1 - CLASSIFY IMAGE TYPE:
Analyze the image and determine its type:
- "label": Wine bottle label(s) visible (bottles on shelf, in hand, close-up of labels)
- "receipt": Invoice, receipt, or purchase document showing wine line items with prices
- "unknown": Cannot confidently determine

STEP 2 - EXTRACT DATA based on image type:

If "label":
- Detect ALL visible wine bottles in the image
- Extract wine details for each bottle
- Return array of bottles

If "receipt":
- Extract line items from receipt/invoice
- Each line item should include: producer, name, vintage, quantity, price (if visible)
- Return array of receipt_items

CRITICAL RULES:
- Return ONLY valid JSON, no markdown, no explanations
- Use null for any field you cannot confidently determine
- Do NOT hallucinate or guess missing information
- Assign confidence: "high" (clearly visible), "medium" (partially visible), "low" (uncertain)
- For style, choose ONLY from: "red", "white", "rose", "sparkling", or null

Return JSON in this exact format:
{
  "image_type": "label" | "receipt" | "unknown",
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
  ],
  "receipt_items": [
    {
      "producer": { "value": "Producer Name" or null, "confidence": "high"|"medium"|"low" },
      "name": { "value": "Wine Name" or null, "confidence": "high"|"medium"|"low" },
      "vintage": { "value": 2022 or null, "confidence": "high"|"medium"|"low" },
      "quantity": { "value": 2 or null, "confidence": "high"|"medium"|"low" },
      "price": { "value": 45.99 or null, "confidence": "high"|"medium"|"low" },
      "style": { "value": "red"|"white"|"rose"|"sparkling" or null, "confidence": "high"|"medium"|"low" }
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
    } catch (e) {
      console.error('[Parse Label] OpenAI fetch failed:', e);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AI_SERVICE_UNREACHABLE',
          message: 'Cannot reach AI service. Please try again later.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 503,
        }
      );
    }

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[Parse Label] OpenAI error response:', errorText);
      console.error('[Parse Label] OpenAI status:', openaiResponse.status);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AI_EXTRACTION_FAILED',
          message: `AI service error (${openaiResponse.status}). Please try again.`,
          details: openaiResponse.status === 429 ? 'Rate limit exceeded' : undefined,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    let openaiData;
    try {
      openaiData = await openaiResponse.json();
      console.log('[Parse Label] OpenAI response received, choice count:', openaiData.choices?.length);
    } catch (e) {
      console.error('[Parse Label] Failed to parse OpenAI response as JSON:', e);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'INVALID_AI_RESPONSE',
          message: 'AI service returned invalid response',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

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

    const imageType = parsedData.image_type || 'label';
    console.log('[Parse Label] Image type detected:', imageType);

    // Handle receipt mode
    if (imageType === 'receipt' && parsedData.receipt_items && Array.isArray(parsedData.receipt_items)) {
      const validatedItems = parsedData.receipt_items.map((item: any) => ({
        producer: item.producer?.value || null,
        name: item.name?.value || null,
        vintage: item.vintage?.value || null,
        quantity: item.quantity?.value || null,
        price: item.price?.value || null,
        color: item.style?.value || null, // Note: using 'color' for consistency with database
        confidence: item.producer?.confidence || item.name?.confidence || 'low',
      }));

      console.log('[Parse Label] ✅ Receipt detected with', validatedItems.length, 'items');

      return new Response(
        JSON.stringify({
          success: true,
          image_type: 'receipt',
          receipt_items: validatedItems,
          count: validatedItems.length,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Handle multi-bottle mode (labels)
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
          image_type: 'label',
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
        image_type: 'label',
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
    console.error('[Parse Label] ========== UNHANDLED ERROR ==========');
    console.error('[Parse Label] Error:', error);
    console.error('[Parse Label] Message:', error.message);
    console.error('[Parse Label] Stack:', error.stack);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'UNEXPECTED_ERROR',
        message: error.message || 'Failed to parse label image',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message === 'Unauthorized' ? 401 : 500,
      }
    );
  }
});

