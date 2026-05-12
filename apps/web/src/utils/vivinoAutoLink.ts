/**
 * Vivino Auto-Link Utility
 * 
 * Auto-generates Vivino search URLs from AI-extracted wine data.
 * Enabled in production for all users.
 * 
 * @see https://www.vivino.com/search/wines
 */

export interface WineDataForVivino {
  producer?: string | null;
  wine_name?: string | null;
  vintage?: number | string | null;
  region?: string | null;
  grape?: string | null;
}

/**
 * Check if we're running in local development environment
 * 
 * @returns true (always enabled in production now)
 * @deprecated This function now always returns true. Kept for backwards compatibility.
 */
export function isLocalDevEnvironment(): boolean {
  // Feature is now enabled in production for all users
  return true;
}

/**
 * Generate a Vivino search URL from extracted wine data
 * 
 * IMPORTANT LIMITATION:
 * This generates a SEARCH URL, not a direct wine page URL.
 * We cannot get the exact wine page URL (/wines/123456) without:
 * - Calling Vivino's API (not public/documented)
 * - Web scraping (against Vivino ToS)
 * - User manually copying the URL after visiting Vivino
 * 
 * Strategy:
 * 1. Plain text query (Vivino does NOT support quoted/boolean operators)
 * 2. Order: Producer → Wine Name → Vintage → Region (if distinct from wine name)
 * 3. Region is omitted when it duplicates the wine name (e.g., "Barolo" wine in "Barolo" region)
 * 
 * @param data - Extracted wine data from AI
 * @returns Vivino search URL or null if insufficient data
 */
export function generateVivinoSearchUrl(data: WineDataForVivino): string | null {
  // Minimum requirement: wine name
  const wineName = data.wine_name?.trim();
  if (!wineName) {
    console.log('[Vivino Auto-Link] Skipped - no wine name');
    return null;
  }
  
  // Extract all available fields
  const producer = data.producer?.trim() || '';
  const vintage = data.vintage ? String(data.vintage).trim() : '';
  const region = data.region?.trim() || '';
  const grape = data.grape?.trim() || '';
  
  // Confidence check: require producer for better precision
  const hasHighConfidence = producer && wineName && vintage;
  
  if (!producer) {
    console.warn('[Vivino Auto-Link] ⚠️ Low confidence - missing producer. Search may return multiple wines.');
  }
  
  // Build search query — Vivino does NOT support quoted/boolean operators
  // Using plain text gives better results than quoted terms
  const queryParts: string[] = [];
  
  // Producer first (most specific)
  if (producer) {
    queryParts.push(producer);
  }
  
  // Wine name
  queryParts.push(wineName);
  
  // Vintage (numeric year, helps narrow results)
  if (vintage && /^\d{4}$/.test(vintage)) {
    queryParts.push(vintage);
  }
  
  // Note: region is intentionally omitted — broad regional terms like "Piedmont" or
  // "Burgundy" tend to over-filter Vivino's search and return unrelated wines.
  // Producer + wine name + vintage is precise enough for most searches.
  
  const searchQuery = queryParts.join(' ').trim();
  const encodedQuery = encodeURIComponent(searchQuery);
  
  // Construct Vivino search URL
  const vivinoUrl = `https://www.vivino.com/search/wines?q=${encodedQuery}`;
  
  console.log('[Vivino Auto-Link] 🍷 Generated SEARCH URL (not direct wine page)');
  console.log('[Vivino Auto-Link] Confidence:', hasHighConfidence ? '✅ HIGH' : '⚠️ MEDIUM');
  console.log('[Vivino Auto-Link] URL:', vivinoUrl);
  console.log('[Vivino Auto-Link] Query parts:', queryParts);
  console.log('[Vivino Auto-Link] 💡 TIP: Click "Search on Vivino", find the exact wine, then copy/paste the wine page URL here.');
  
  return vivinoUrl;
}

/**
 * PRODUCTION NOTES:
 * 
 * This feature is now ENABLED in production.
 * 
 * LIMITATION: This generates SEARCH URLs, not direct wine pages.
 * The backend Edge Function (fetch-vivino-data) handles fetching actual wine data.
 * 
 * Current workflow:
 * 1. User adds bottle → AI extracts wine info
 * 2. System generates Vivino search URL
 * 3. User can click "Fetch Data" to get full details (rating, region, grapes)
 * 4. Backend scrapes Vivino (via Edge Function to bypass CORS)
 * 
 * Future improvements:
 * - Official Vivino API partnership for stable integration
 * - Rate limiting on Edge Function to prevent abuse
 * - Caching of fetched wine data to reduce API calls
 * - Analytics to track fetch success rates
 */

