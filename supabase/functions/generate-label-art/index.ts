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
    // Get Authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('[AI Label] Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    console.log('[AI Label] Authorization header present');

    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError) {
      console.error('[AI Label] Auth error:', authError.message);
      return new Response(
        JSON.stringify({ error: `Authentication failed: ${authError.message}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    if (!user) {
      console.error('[AI Label] No user found in token');
      return new Response(
        JSON.stringify({ error: 'Not authenticated - invalid token' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    console.log('[AI Label] User authenticated:', user.id);

    // Parse request
    const body: GenerateRequest = await req.json();
    const { wineId, bottleId, prompt, promptHash, style } = body;

    if (!wineId || !prompt || !promptHash) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Check if wine belongs to user
    const { data: wine, error: wineError } = await supabaseClient
      .from('wines')
      .select('id, generated_image_prompt_hash, generated_image_path, user_id')
      .eq('id', wineId)
      .single();

    if (wineError || !wine) {
      return new Response(
        JSON.stringify({ error: 'Wine not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    if (wine.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // Check for idempotency: if prompt hash matches and image exists, return cached
    if (wine.generated_image_prompt_hash === promptHash && wine.generated_image_path) {
      console.log('Returning cached generated image');
      
      const { data: publicUrlData } = supabaseClient.storage
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
    console.log('Calling OpenAI to generate label art...');
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
      console.error('OpenAI error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate image' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const openaiData = await openaiResponse.json();
    const generatedImageUrl = openaiData.data[0].url;

    // Download the generated image
    const imageResponse = await fetch(generatedImageUrl);
    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();

    // Upload to Supabase Storage
    const filename = `${wineId}-${style}-${promptHash.slice(0, 8)}.png`;
    const storagePath = `${user.id}/${filename}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('generated-labels')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to store image' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Update wine record with generated image metadata
    const { error: updateError } = await supabaseClient
      .from('wines')
      .update({
        generated_image_path: storagePath,
        generated_image_prompt_hash: promptHash,
        generated_at: new Date().toISOString(),
      })
      .eq('id', wineId);

    if (updateError) {
      console.error('Database update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update wine record' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabaseClient.storage
      .from('generated-labels')
      .getPublicUrl(storagePath);

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
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});


