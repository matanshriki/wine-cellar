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

    // Try multiple Vivino endpoints (API + HTML page)
    const endpoints = [
      { url: `https://www.vivino.com/api/wines/${wine_id}`, type: 'api' },
      { url: `https://www.vivino.com/api/wines/${wine_id}?currency_code=USD&language=en`, type: 'api' },
      { url: `https://www.vivino.com/wines/${wine_id}`, type: 'page' },
      { url: `https://www.vivino.com/w/${wine_id}`, type: 'page' },
    ];

    let vivinoData: any = null;
    let successUrl = '';
    let responseType = '';

    for (const endpoint of endpoints) {
      console.log('[Fetch Vivino Data] Trying:', endpoint.url, `(${endpoint.type})`);
      
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.vivino.com/',
      };

      // For API endpoints, request JSON
      if (endpoint.type === 'api') {
        headers['Accept'] = 'application/json';
      } else {
        headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
      }
      
      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        successUrl = endpoint.url;
        responseType = endpoint.type;
        console.log('[Fetch Vivino Data] ✅ Success with:', endpoint.url);
        
        if (endpoint.type === 'api') {
          // Parse as JSON
          vivinoData = await response.json();
          console.log('[Fetch Vivino Data] Parsed JSON data');
          break;
        } else {
          // Parse HTML page
          const html = await response.text();
          console.log('[Fetch Vivino Data] Got HTML page, length:', html.length);
          
          // Try to extract JSON-LD data from HTML
          const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
          if (jsonLdMatch) {
            try {
              const structuredData = JSON.parse(jsonLdMatch[1]);
              console.log('[Fetch Vivino Data] Found structured data in HTML');
              vivinoData = { fromHtml: true, structuredData, html: html.substring(0, 1000) };
              break;
            } catch (e) {
              console.log('[Fetch Vivino Data] Failed to parse structured data');
            }
          }
          
          // If no structured data, store HTML for manual parsing
          console.log('[Fetch Vivino Data] No structured data found, storing HTML snippet');
          vivinoData = { fromHtml: true, html: html.substring(0, 2000) };
          break;
        }
      } else {
        const errorText = await response.text();
        console.log('[Fetch Vivino Data] ❌ Failed:', endpoint.url, response.status);
        console.log('[Fetch Vivino Data] Error snippet:', errorText.substring(0, 200));
      }
    }

    if (!vivinoData) {
      console.error('[Fetch Vivino Data] All endpoints failed');
      throw new Error(`All Vivino endpoints returned errors for wine ID: ${wine_id}`);
    }

    console.log('[Fetch Vivino Data] Success! Response type:', responseType);
    console.log('[Fetch Vivino Data] Data preview:', JSON.stringify(vivinoData).substring(0, 300));

    // Parse and return clean data
    let cleanData: any;

    if (vivinoData.fromHtml) {
      // Data from HTML page
      console.log('[Fetch Vivino Data] Parsing HTML response...');
      
      // For now, return raw HTML so we can see what we got
      cleanData = {
        wine_id: wine_id,
        source: 'html',
        success: true,
        message: 'Fetched HTML page successfully. API endpoints may be unavailable.',
        html_preview: vivinoData.html,
        structured_data: vivinoData.structuredData || null,
      };
    } else {
      // Data from API
      console.log('[Fetch Vivino Data] Parsing API response...');
      const wine = vivinoData.wine || vivinoData;
      
      cleanData = {
        wine_id: wine_id,
        source: 'api',
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
    }

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

