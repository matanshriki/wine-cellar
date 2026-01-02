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
          
          // Extract data from the page using multiple strategies
          let extractedData: any = {};
          
          // Strategy 1: Try JSON-LD structured data
          const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
          if (jsonLdMatch) {
            try {
              const structuredData = JSON.parse(jsonLdMatch[1]);
              console.log('[Fetch Vivino Data] Found structured data in HTML');
              
              // Extract from JSON-LD (Product schema)
              if (structuredData['@type'] === 'Product') {
                extractedData = {
                  name: structuredData.name || '',
                  winery: structuredData.brand?.name || '',
                  rating: structuredData.aggregateRating?.ratingValue 
                    ? parseFloat(structuredData.aggregateRating.ratingValue.toFixed(1)) 
                    : null,
                  rating_count: structuredData.aggregateRating?.ratingCount || null,
                  image_url: structuredData.image || null,
                };
              }
            } catch (e) {
              console.log('[Fetch Vivino Data] Failed to parse structured data:', e);
            }
          }
          
          // Strategy 2: Try to find __PRELOADED_STATE__ (React initial state)
          const preloadedStateMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({.+?});/s);
          if (preloadedStateMatch) {
            try {
              const preloadedState = JSON.parse(preloadedStateMatch[1]);
              console.log('[Fetch Vivino Data] Found preloaded state');
              
              // Try to extract wine data from preloaded state
              const wineData = preloadedState.winePageInformation?.wine;
              if (wineData) {
                extractedData = {
                  ...extractedData,
                  name: wineData.name || extractedData.name,
                  winery: wineData.winery?.name || extractedData.winery,
                  rating: wineData.statistics?.ratings_average 
                    ? parseFloat(wineData.statistics.ratings_average.toFixed(1))
                    : extractedData.rating,
                  rating_count: wineData.statistics?.ratings_count || extractedData.rating_count,
                  vintage: wineData.vintage?.year || null,
                  region: wineData.region?.name || null,
                  country: wineData.region?.country?.name || null,
                  grape: wineData.primary_varietal?.name || null,
                  image_url: wineData.image?.location || extractedData.image_url,
                };
              }
            } catch (e) {
              console.log('[Fetch Vivino Data] Failed to parse preloaded state:', e);
            }
          }
          
          // If we got some data, use it
          if (Object.keys(extractedData).length > 0) {
            console.log('[Fetch Vivino Data] Successfully extracted data from HTML');
            vivinoData = { fromHtml: true, ...extractedData };
            break;
          }
          
          // Fallback: couldn't extract structured data
          console.log('[Fetch Vivino Data] Could not extract structured data from HTML');
          vivinoData = { 
            fromHtml: true, 
            error: 'Could not parse wine data from page',
            html_snippet: html.substring(0, 1000) 
          };
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
      // Data extracted from HTML page
      console.log('[Fetch Vivino Data] Returning HTML-extracted data...');
      
      if (vivinoData.error) {
        // Failed to extract data
        cleanData = {
          wine_id: wine_id,
          source: 'html',
          success: false,
          error: vivinoData.error,
        };
      } else {
        // Successfully extracted data
        cleanData = {
          wine_id: wine_id,
          source: 'html',
          name: vivinoData.name || '',
          winery: vivinoData.winery || '',
          rating: vivinoData.rating || null,
          rating_count: vivinoData.rating_count || null,
          image_url: vivinoData.image_url || null,
          vintage: vivinoData.vintage || null,
          region: vivinoData.region || null,
          country: vivinoData.country || null,
          grape: vivinoData.grape || null,
        };
      }
    } else {
      // Data from API (if we ever get this working)
      console.log('[Fetch Vivino Data] Parsing API response...');
      const wine = vivinoData.wine || vivinoData;
      
      cleanData = {
        wine_id: wine_id,
        source: 'api',
        name: wine.name || '',
        winery: wine.winery?.name || '',
        rating: wine.statistics?.ratings_average 
          ? parseFloat(wine.statistics.ratings_average.toFixed(1))
          : null,
        rating_count: wine.statistics?.ratings_count || null,
        image_url: wine.image?.location || null,
        vintage: wine.vintage?.year || null,
        region: wine.region?.name || null,
        country: wine.region?.country?.name || null,
        grape: wine.primary_varietal?.name || wine.varietal?.name || null,
      };
    }
    
    console.log('[Fetch Vivino Data] Final clean data:', JSON.stringify(cleanData));

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


