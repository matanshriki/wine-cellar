// Supabase Edge Function: Generate AI Label Art
// LEGAL: Generates ORIGINAL artwork only, no scraping or trademark infringement

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  wineId: string;
  bottleId: string;
  prompt: string;
  promptHash: string;
  style: 'classic' | 'modern';
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[AI Label] Edge Function invoked');

    // Get Authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('[AI Label] ❌ Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    console.log('[AI Label] ✅ Authorization header present');

    // Create TWO Supabase clients:
    // 1. Service role client for database operations (bypasses RLS)
    // 2. User client for authentication verification
    
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      console.error('[AI Label] ❌ SUPABASE_SERVICE_ROLE_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Service role client (for DB operations)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('[AI Label] 🔐 Verifying user authentication with admin client...');

    // When using --no-verify-jwt, we need to manually verify the token
    // Use the admin client to get the user from the JWT
    const token = authHeader.replace('Bearer ', '');
    
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError) {
      console.error('[AI Label] ❌ Auth error:', authError.message);
      return new Response(
        JSON.stringify({ error: `Authentication failed: ${authError.message}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    if (!user) {
      console.error('[AI Label] ❌ No user found in token');
      return new Response(
        JSON.stringify({ error: 'Not authenticated - invalid token' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    console.log('[AI Label] ✅ User authenticated:', user.id, '(' + user.email + ')');

    // Parse request body
    console.log('[AI Label] 📦 Parsing request body...');
    let body: GenerateRequest;
    
    try {
      const rawBody = await req.text();
      console.log('[AI Label] 📋 Raw body received, length:', rawBody.length);
      body = JSON.parse(rawBody);
      console.log('[AI Label] ✅ Body parsed successfully');
    } catch (parseError) {
      console.error('[AI Label] ❌ JSON parse error:', parseError.message);
      return new Response(
        JSON.stringify({ error: 'Invalid request body format' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }
    
    const { wineId, bottleId, prompt, promptHash, style } = body;
    console.log('[AI Label] 📋 Request params:', { wineId, bottleId, style, promptHashPreview: promptHash?.substring(0, 8) });

    if (!wineId || !prompt || !promptHash) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Check if wine belongs to user (use admin client to bypass RLS)
    console.log('[AI Label] 🔍 Fetching wine:', wineId);
    const { data: wine, error: wineError } = await supabaseAdmin
      .from('wines')
      .select('id, generated_image_prompt_hash, generated_image_path, user_id')
      .eq('id', wineId)
      .single();

    if (wineError || !wine) {
      console.error('[AI Label] ❌ Wine not found:', wineError?.message);
      return new Response(
        JSON.stringify({ error: 'Wine not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    console.log('[AI Label] ✅ Wine found, owner:', wine.user_id);

    if (wine.user_id !== user.id) {
      console.error('[AI Label] ❌ Unauthorized: Wine belongs to', wine.user_id, 'but user is', user.id);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - this wine does not belong to you' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    console.log('[AI Label] ✅ Authorization verified');

    // Check for idempotency: if prompt hash matches and image exists, return cached
    if (wine.generated_image_prompt_hash === promptHash && wine.generated_image_path) {
      console.log('[AI Label] 🎨 Returning cached image:', wine.generated_image_path);
      
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('generated-labels')
        .getPublicUrl(wine.generated_image_path);

      return new Response(
        JSON.stringify({
          success: true,
          imagePath: wine.generated_image_path,
          imageUrl: publicUrlData.publicUrl,
          cached: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Check if OpenAI is configured
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI image generation not configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 503,
        }
      );
    }

    // Call OpenAI to generate image
    console.log('[AI Label] 🎨 Calling OpenAI DALL-E 3 to generate label art...');
    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: Deno.env.get('AI_IMAGE_MODEL') || 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: Deno.env.get('AI_IMAGE_SIZE') || '1024x1024',
        quality: 'standard',
        response_format: 'url',
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[AI Label] ❌ OpenAI error:', openaiResponse.status, errorText);
      
      // Check if it's a billing/credit issue
      if (openaiResponse.status === 429 || errorText.includes('insufficient_quota') || errorText.includes('billing')) {
        return new Response(
          JSON.stringify({ 
            error: 'OpenAI API quota exceeded. Please add credits to your OpenAI account at platform.openai.com/account/billing',
            details: errorText 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 402, // Payment Required
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate image', details: errorText }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const openaiData = await openaiResponse.json();
    const generatedImageUrl = openaiData.data[0].url;
    console.log('[AI Label] ✅ OpenAI generated image');

    // Download the generated image
    console.log('[AI Label] ⬇️ Downloading image from OpenAI...');
    const imageResponse = await fetch(generatedImageUrl);
    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();
    console.log('[AI Label] ✅ Image downloaded, size:', imageBuffer.byteLength, 'bytes');

    // Upload to Supabase Storage (use admin client)
    const filename = `${wineId}-${style}-${promptHash.slice(0, 8)}.png`;
    const storagePath = `${user.id}/${filename}`;
    
    console.log('[AI Label] ⬆️ Uploading to storage:', storagePath);
    const { error: uploadError } = await supabaseAdmin.storage
      .from('generated-labels')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('[AI Label] ❌ Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to store image', details: uploadError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }
    
    console.log('[AI Label] ✅ Image uploaded to storage');

    // Update wine record with generated image metadata (use admin client)
    console.log('[AI Label] 💾 Updating wine record...');
    const { error: updateError } = await supabaseAdmin
      .from('wines')
      .update({
        generated_image_path: storagePath,
        generated_image_prompt_hash: promptHash,
        generated_at: new Date().toISOString(),
      })
      .eq('id', wineId);

    if (updateError) {
      console.error('[AI Label] ❌ Database update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update wine record', details: updateError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }
    
    console.log('[AI Label] ✅ Wine record updated');

    // Get public URL (use admin client)
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('generated-labels')
      .getPublicUrl(storagePath);

    console.log('[AI Label] ✅ SUCCESS! Image available at:', publicUrlData.publicUrl);

    return new Response(
      JSON.stringify({
        success: true,
        imagePath: storagePath,
        imageUrl: publicUrlData.publicUrl,
        cached: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[AI Label] ❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error', stack: error.stack }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});


