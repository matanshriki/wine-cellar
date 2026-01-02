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
  name: string;
  winery: string;
  rating: number; // 0-5 scale (Vivino's native scale, matches database)
  rating_count: number;
  image_url: string | null;
  vintage?: number | null;
  region?: string | null;
  country?: string | null;
  grape?: string | null;
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
 * 
 * @param url - Vivino wine page URL
 * @returns wine_id or null if invalid
 */
export function extractVivinoWineId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Match /wines/{id} pattern
    const match = url.match(/\/wines\/(\d+)/);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  } catch (error) {
    console.error('[Vivino Scraper] URL parse error:', error);
    return null;
  }
}

/**
 * Validate if a URL is a Vivino wine page
 */
export function isVivinoWineUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('vivino.com') && url.includes('/wines/');
  } catch {
    return false;
  }
}

/**
 * Fetch wine data from Vivino (DEV ONLY)
 * 
 * LEGAL WARNING: This uses undocumented Vivino endpoints.
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
    // Vivino's undocumented API endpoint (may change/break at any time)
    // This is used by their website/app for fetching wine details
    const apiUrl = `https://www.vivino.com/api/wines/${wineId}`;
    
    console.log('[Vivino Scraper] API URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; WineCellarBrain/1.0; +dev)',
      },
    });

    if (!response.ok) {
      console.error('[Vivino Scraper] ❌ API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('[Vivino Scraper] 📦 Raw API response:', data);

    // Parse response (structure may vary)
    const wine = data.wine || data;
    
    const wineData: VivinoWineData = {
      wine_id: wineId,
      name: wine.name || '',
      winery: wine.winery?.name || '',
      // Keep Vivino's native 0-5 scale (matches database DECIMAL(2,1))
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

    console.log('[Vivino Scraper] ✅ Parsed wine data:', wineData);
    return wineData;

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

