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

    // Try multiple Vivino API endpoints
    const endpoints = [
      `https://www.vivino.com/api/wines/${wine_id}`,
      `https://www.vivino.com/api/wines/${wine_id}?currency_code=USD&language=en`,
      `https://www.vivino.com/wines/${wine_id}`,
    ];

    let vivinoResponse: Response | null = null;
    let successUrl = '';

    for (const endpoint of endpoints) {
      console.log('[Fetch Vivino Data] Trying endpoint:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (response.ok) {
        vivinoResponse = response;
        successUrl = endpoint;
        console.log('[Fetch Vivino Data] ✅ Success with:', endpoint);
        break;
      } else {
        console.log('[Fetch Vivino Data] ❌ Failed with:', endpoint, response.status);
      }
    }

    if (!vivinoResponse) {
      console.error('[Fetch Vivino Data] All endpoints failed');
      throw new Error(`All Vivino API endpoints returned errors for wine ID: ${wine_id}`);
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

