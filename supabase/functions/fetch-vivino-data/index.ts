/**
 * Supabase Edge Function: Fetch Vivino Wine Data
 * 
 * Acts as a proxy to fetch wine data from Vivino's API.
 * Bypasses CORS restrictions by making server-to-server requests.
 * 
 * Endpoint: POST /functions/v1/fetch-vivino-data
 * Body: { wine_id: "123456" }
 * Response: { success: true, data: {...} }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { wine_id } = await req.json();

    if (!wine_id) {
      throw new Error('wine_id is required');
    }

    console.log('[Fetch Vivino Data] Fetching wine ID:', wine_id);

    // Fetch from Vivino's API (server-to-server, no CORS)
    const vivinoResponse = await fetch(`https://www.vivino.com/api/wines/${wine_id}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; WineCellarBrain/1.0)',
      },
    });

    if (!vivinoResponse.ok) {
      console.error('[Fetch Vivino Data] Vivino API error:', vivinoResponse.status);
      throw new Error(`Vivino API returned ${vivinoResponse.status}`);
    }

    const vivinoData = await vivinoResponse.json();
    console.log('[Fetch Vivino Data] Success, wine name:', vivinoData.wine?.name);

    // Parse and return clean data
    const wine = vivinoData.wine || vivinoData;
    
    const cleanData = {
      wine_id: wine_id,
      name: wine.name || '',
      winery: wine.winery?.name || '',
      rating: wine.statistics?.ratings_average 
        ? parseFloat(wine.statistics.ratings_average.toFixed(1))
        : 0,
      rating_count: wine.statistics?.ratings_count || 0,
      image_url: wine.image?.location || null,
      vintage: wine.vintage?.year || null,
      region: wine.region?.name || null,
      country: wine.region?.country?.name || null,
      grape: wine.primary_varietal?.name || wine.varietal?.name || null,
    };

    return new Response(
      JSON.stringify({ success: true, data: cleanData }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('[Fetch Vivino Data] Error:', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to fetch wine data from Vivino',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 with error in body for better client handling
      }
    );
  }
});

