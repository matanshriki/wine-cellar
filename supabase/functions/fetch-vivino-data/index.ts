/**
 * Supabase Edge Function: Fetch Vivino Wine Data
 * 
 * Acts as a proxy to fetch wine data from Vivino's pages.
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

    // Try short URL format first
    let url = `https://www.vivino.com/w/${wine_id}`;
    console.log('[Fetch Vivino Data] Fetching:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.vivino.com/',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow', // Follow redirects
    });

    if (!response.ok) {
      throw new Error(`Vivino returned ${response.status}`);
    }

    // Log the final URL after redirects
    const finalUrl = response.url;
    if (finalUrl !== url) {
      console.log('[Fetch Vivino Data] 🔄 Redirected to:', finalUrl);
    }

    const html = await response.text();
    console.log('[Fetch Vivino Data] ✅ Got HTML, length:', html.length);

    // Extract data from HTML
    const extractedData: any = {};

    // Strategy 1: JSON-LD (for rating + basic info)
    const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs);
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1]);
        if (data['@type'] === 'Product' || data['@type'] === 'http://schema.org/Product') {
          if (data.aggregateRating?.ratingValue) {
            extractedData.rating = Math.round(parseFloat(data.aggregateRating.ratingValue) * 10) / 10;
          }
          if (data.aggregateRating?.ratingCount) {
            extractedData.rating_count = parseInt(String(data.aggregateRating.ratingCount).replace(/,/g, ''));
          }
          extractedData.name = data.name || extractedData.name;
          extractedData.winery = data.brand?.name || extractedData.winery;
          extractedData.image_url = data.image || extractedData.image_url;
          console.log('[Fetch Vivino Data] ✅ Extracted from JSON-LD');
        }
      } catch (e) {
        // Skip
      }
    }

    // Strategy 2: Search for large JSON objects in scripts (Vivino's data structure)
    console.log('[Fetch Vivino Data] Searching for wine data in script tags...');
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
    
    for (const scriptMatch of scriptMatches) {
      const script = scriptMatch[1];
      
      // Skip small scripts (< 2000 chars)
      if (script.length < 2000) continue;
      
      // Look for JSON objects that contain wine-related data
      // Pattern: Look for objects with "region" AND ("grapes" OR "grape")
      if (script.includes('"region"') && (script.includes('"grapes"') || script.includes('"grape"'))) {
        console.log('[Fetch Vivino Data] 🔍 Found potential wine data script, length:', script.length);
        
        // Try to extract JSON objects
        let depth = 0;
        let startIdx = -1;
        let jsonObjects = [];
        
        for (let i = 0; i < script.length; i++) {
          if (script[i] === '{') {
            if (depth === 0) startIdx = i;
            depth++;
          } else if (script[i] === '}') {
            depth--;
            if (depth === 0 && startIdx !== -1) {
              const jsonStr = script.substring(startIdx, i + 1);
              // Only keep large JSON objects (> 500 chars) that look like wine data
              if (jsonStr.length > 500 && jsonStr.includes('"region"')) {
                jsonObjects.push(jsonStr);
              }
              startIdx = -1;
            }
          }
        }
        
        console.log('[Fetch Vivino Data] 🔍 Found', jsonObjects.length, 'potential JSON objects');
        
        // Try parsing each object
        for (const jsonStr of jsonObjects) {
          try {
            const obj = JSON.parse(jsonStr);
            
            // Log the first few keys to debug
            const objKeys = Object.keys(obj);
            console.log('[Fetch Vivino Data] 🔍 JSON object keys:', objKeys.slice(0, 15).join(', '));
            
            // Check both top-level and nested wine data
            let wineData = null;
            
            // Case 1: Wine data is directly in this object
            if ((obj.region || obj.grapes || obj.style) && obj.name) {
              wineData = obj;
              console.log('[Fetch Vivino Data] ✅ Found wine data at top level!');
            }
            // Case 2: Wine data is nested in a "wine" property
            else if (obj.wine && typeof obj.wine === 'object') {
              const wine = obj.wine;
              if ((wine.region || wine.grapes || wine.style) && wine.name) {
                wineData = wine;
                console.log('[Fetch Vivino Data] ✅ Found wine data in nested "wine" object!');
              }
            }
            // Case 3: This might be a "vintage" object that contains wine data
            else if (obj.vintage && typeof obj.vintage === 'object' && obj.vintage.wine) {
              const wine = obj.vintage.wine;
              if ((wine.region || wine.grapes || wine.style) && wine.name) {
                wineData = wine;
                console.log('[Fetch Vivino Data] ✅ Found wine data in vintage.wine!');
              }
            }
            
            if (wineData) {
              console.log('[Fetch Vivino Data] 🔍 Wine data keys:', Object.keys(wineData).join(', '));
              
              // Extract all available data
              extractedData.name = wineData.name || extractedData.name;
              extractedData.winery = wineData.winery?.name || extractedData.winery;
              extractedData.vintage = wineData.vintage?.year || wineData.year || null;
              extractedData.region = wineData.region?.name || wineData.region || null;
              extractedData.country = wineData.region?.country?.name || wineData.country?.name || null;
              extractedData.grape = wineData.style?.varietal_name || wineData.primary_varietal?.name || wineData.grape || null;
              
              // Handle grapes array (can be objects or strings)
              if (wineData.grapes && Array.isArray(wineData.grapes)) {
                extractedData.grapes = wineData.grapes.map((g: any) => 
                  typeof g === 'string' ? g : (g.name || g.varietal_name || '')
                ).filter(Boolean).join(', ') || null;
              } else if (wineData.style?.grapes) {
                extractedData.grapes = wineData.style.grapes.map((g: any) => g.name || g).filter(Boolean).join(', ') || null;
              }
              
              extractedData.alcohol = wineData.alcohol ? `${wineData.alcohol}%` : null;
              extractedData.wine_style = wineData.style?.name || wineData.wine_style?.name || null;
              extractedData.image_url = wineData.image?.location || wineData.image || extractedData.image_url;
              
              console.log('[Fetch Vivino Data] ✅ Extracted:', Object.keys(extractedData).filter(k => extractedData[k]).join(', '));
              break;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
        
        // If we found data, stop searching
        if (extractedData.region || extractedData.grapes) break;
      }
    }

    // Return data
    const cleanData = {
      wine_id,
      source: 'html',
      name: extractedData.name || '',
      winery: extractedData.winery || '',
      vintage: extractedData.vintage || null,
      region: extractedData.region || null,
      country: extractedData.country || null,
      grape: extractedData.grape || null,
      grapes: extractedData.grapes || null,
      rating: extractedData.rating || null,
      rating_count: extractedData.rating_count || null,
      alcohol: extractedData.alcohol || null,
      wine_style: extractedData.wine_style || null,
      image_url: extractedData.image_url || null,
    };

    console.log('[Fetch Vivino Data] ✅ Returning data');

    return new Response(
      JSON.stringify({ success: true, data: cleanData }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('[Fetch Vivino Data] ❌ Error:', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to fetch wine data from Vivino',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
