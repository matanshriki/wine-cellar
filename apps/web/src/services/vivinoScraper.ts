/**
 * Vivino Data Fetcher (DEV ONLY - Localhost)
 * 
 * Fetches wine data (rating, image, details) from a Vivino wine page URL.
 * 
 * IMPORTANT LEGAL DISCLAIMER:
 * - Vivino does NOT provide a public API
 * - This uses undocumented/unofficial endpoints
 * - May violate Vivino's Terms of Service
 * - FOR DEVELOPMENT/TESTING ONLY
 * - DO NOT enable in production without legal review
 * 
 * RECOMMENDED PRODUCTION APPROACH:
 * - Apply for official Vivino API partnership
 * - Use official endpoints with proper authentication
 * - Respect rate limits and ToS
 * 
 * @see https://www.vivino.com/terms
 */

export interface VivinoWineData {
  wine_id: string;
  
  // Core info
  name?: string | null;
  winery?: string | null;
  vintage?: number | null;
  
  // Location
  region?: string | null;
  country?: string | null;
  
  // Grapes
  grape?: string | null; // Primary grape
  grapes?: string | null; // All grapes (comma-separated)
  
  // Rating
  rating?: number | null; // 0-5 scale (Vivino's native scale, matches database)
  rating_count?: number | null;
  
  // Style & characteristics
  wine_style?: string | null;
  alcohol?: string | null; // e.g., "14.5%"
  
  // Price
  price?: number | null;
  price_currency?: string | null;
  
  // Taste profile (Vivino's taste structure)
  acidity?: number | null;
  fizziness?: number | null;
  intensity?: number | null;
  sweetness?: number | null;
  
  // Food pairings
  food_pairings?: string | null; // Comma-separated
  
  // Media
  image_url?: string | null;
  
  // Metadata
  source?: 'api' | 'html'; // Track where data came from
  region_class?: string | null;
  winery_id?: number | null;
}

/**
 * Check if Vivino scraping is enabled (localhost only)
 */
function isVivinoScraperEnabled(): boolean {
  const hostname = window.location.hostname;
  const isLocalhost = 
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local');
  
  return isLocalhost;
}

/**
 * Extract wine ID from Vivino URL
 * 
 * Supported formats:
 * - https://www.vivino.com/wines/123456
 * - https://www.vivino.com/US/en/wines/123456
 * - https://www.vivino.com/wines/123456/some-wine-name
 * - https://www.vivino.com/en/wine-name/w/123456 (user-facing format)
 * - https://www.vivino.com/wine-name/w/123456 (short user-facing format)
 * 
 * @param url - Vivino wine page URL
 * @returns wine_id or null if invalid
 */
export function extractVivinoWineId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Try user-facing format first: /w/{id}
    let match = url.match(/\/w\/(\d+)/);
    if (match && match[1]) {
      console.log('[Vivino Scraper] Extracted ID from /w/ format:', match[1]);
      return match[1];
    }
    
    // Fallback to API format: /wines/{id}
    match = url.match(/\/wines\/(\d+)/);
    if (match && match[1]) {
      console.log('[Vivino Scraper] Extracted ID from /wines/ format:', match[1]);
      return match[1];
    }
    
    console.warn('[Vivino Scraper] No wine ID found in URL:', url);
    return null;
  } catch (error) {
    console.error('[Vivino Scraper] URL parse error:', error);
    return null;
  }
}

/**
 * Validate if a URL is a Vivino wine page
 * Accepts both API format (/wines/) and user-facing format (/w/)
 */
export function isVivinoWineUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    const isVivino = urlObj.hostname.includes('vivino.com');
    const hasWineId = url.includes('/wines/') || url.includes('/w/');
    
    console.log('[Vivino Scraper] URL validation:', {
      url,
      isVivino,
      hasWineId,
      result: isVivino && hasWineId,
    });
    
    return isVivino && hasWineId;
  } catch {
    console.error('[Vivino Scraper] Invalid URL format:', url);
    return false;
  }
}

/**
 * Fetch wine data from Vivino via Supabase Edge Function (DEV ONLY)
 * 
 * Uses a backend proxy to bypass CORS restrictions.
 * Only enabled on localhost for development/testing.
 * 
 * @param vivinoUrl - Full Vivino wine page URL
 * @returns Wine data or null if fetch fails
 */
export async function fetchVivinoWineData(vivinoUrl: string): Promise<VivinoWineData | null> {
  // Guard: Only work on localhost
  if (!isVivinoScraperEnabled()) {
    console.log('[Vivino Scraper] ⛔ Disabled - not in localhost environment');
    return null;
  }

  const wineId = extractVivinoWineId(vivinoUrl);
  if (!wineId) {
    console.error('[Vivino Scraper] ❌ Invalid Vivino URL:', vivinoUrl);
    return null;
  }

  console.log('[Vivino Scraper] 🔍 Fetching data for wine ID:', wineId);

  try {
    // Import Supabase client
    const { supabase } = await import('../lib/supabase');
    
    console.log('[Vivino Scraper] Calling Edge Function: fetch-vivino-data');

    // Call our Edge Function (acts as proxy to Vivino)
    const { data, error } = await supabase.functions.invoke('fetch-vivino-data', {
      body: { wine_id: wineId },
    });

    if (error) {
      console.error('[Vivino Scraper] ❌ Edge Function error:', error);
      return null;
    }

    if (!data.success) {
      console.error('[Vivino Scraper] ❌ Vivino fetch failed:', data.error);
      return null;
    }

    console.log('[Vivino Scraper] ✅ Parsed wine data:', data.data);
    return data.data as VivinoWineData;

  } catch (error: any) {
    console.error('[Vivino Scraper] ❌ Fetch error:', error);
    console.error('[Vivino Scraper] Error details:', error.message);
    return null;
  }
}

/**
 * TODO (for production):
 * 
 * CRITICAL: This scraper uses unofficial Vivino endpoints
 * 
 * Before production:
 * 
 * 1. LEGAL REVIEW:
 *    - Review Vivino Terms of Service
 *    - Contact Vivino for API partnership
 *    - Get explicit permission for data usage
 * 
 * 2. TECHNICAL:
 *    - Implement proper rate limiting (max 1 req/sec)
 *    - Add caching (don't refetch same wine repeatedly)
 *    - Handle CORS properly (may need backend proxy)
 *    - Add retry logic with exponential backoff
 *    - Monitor for API changes/breakage
 * 
 * 3. UX:
 *    - Show loading state during fetch
 *    - Clear error messages if fetch fails
 *    - Allow user to opt-out of auto-fetch
 *    - Show "data from Vivino" attribution
 * 
 * 4. PRIVACY:
 *    - Don't send user's personal data to Vivino
 *    - Log data usage for compliance
 *    - Provide opt-in preference
 * 
 * RECOMMENDED APPROACH:
 * Apply for Vivino's official API program instead of scraping.
 */

