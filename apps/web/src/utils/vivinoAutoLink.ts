/**
 * Vivino Auto-Link Utility (DEV ONLY)
 * 
 * Auto-generates Vivino search URLs from AI-extracted wine data.
 * 
 * IMPORTANT: This feature is ONLY enabled on localhost for development/testing.
 * Do NOT enable in production without thorough testing and user consent.
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
 * @returns true if localhost, false otherwise
 */
export function isLocalDevEnvironment(): boolean {
  // Check multiple conditions for localhost
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
 * Generate a Vivino search URL from extracted wine data
 * 
 * IMPORTANT LIMITATION:
 * This generates a SEARCH URL, not a direct wine page URL.
 * We cannot get the exact wine page URL (/wines/123456) without:
 * - Calling Vivino's API (not public/documented)
 * - Web scraping (against Vivino ToS)
 * - User manually copying the URL after visiting Vivino
 * 
 * Strategy for MAXIMUM PRECISION:
 * 1. Use exact match syntax with quotes: "Producer" "Wine Name" vintage
 * 2. Add region/grape if available for disambiguation
 * 3. Order matters: Producer → Wine Name → Vintage → Region
 * 
 * @param data - Extracted wine data from AI
 * @returns Vivino search URL or null if insufficient data
 */
export function generateVivinoSearchUrl(data: WineDataForVivino): string | null {
  // Vivino auto-link (dev only) - Check if feature should be enabled
  if (!isLocalDevEnvironment()) {
    console.log('[Vivino Auto-Link] Skipped - not in localhost environment');
    return null;
  }
  
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
  
  // Build search query with QUOTED TERMS for exact matching
  const queryParts: string[] = [];
  
  // Producer (quoted for exact match)
  if (producer) {
    queryParts.push(`"${producer}"`);
  }
  
  // Wine name (quoted for exact match)
  queryParts.push(`"${wineName}"`);
  
  // Vintage (unquoted, numeric)
  if (vintage && /^\d{4}$/.test(vintage)) {
    queryParts.push(vintage);
  }
  
  // Region (quoted, helps disambiguation)
  if (region && region.length > 2) {
    queryParts.push(`"${region}"`);
  }
  
  // Grape variety (quoted, additional filter)
  if (grape && grape.length > 2) {
    // Only include if it's a single grape (not a blend description)
    const grapeWords = grape.split(/[,\s]+/);
    if (grapeWords.length <= 2) {
      queryParts.push(`"${grape}"`);
    }
  }
  
  // Join with spaces (Vivino's search engine handles quoted terms)
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
 * TODO (for production):
 * 
 * LIMITATION: This generates SEARCH URLs, not direct wine pages.
 * To get exact wine page URLs (/wines/123456), we would need:
 * 
 * Option A: Official Vivino API Integration (RECOMMENDED)
 * - Apply for Vivino API partnership
 * - Use official wine lookup endpoint
 * - Get wine_id directly from Vivino
 * - Pro: Legal, stable, accurate
 * - Con: Requires business partnership
 * 
 * Option B: Hybrid Approach (CURRENT)
 * - Generate precise search URL
 * - User clicks → finds wine → copies actual URL
 * - Add helper text explaining workflow
 * - Pro: Simple, no API needed
 * - Con: Extra user step
 * 
 * Option C: Vivino Database Integration
 * - Build local database of wine_id mappings
 * - Map (producer + wine + vintage) → vivino_id
 * - Requires large dataset and maintenance
 * - Pro: Fast, no API calls
 * - Con: Outdated data, huge effort
 * 
 * Before enabling in production:
 * 1. User privacy: Add opt-in preference
 * 2. Rate limiting: Throttle URL generation
 * 3. Analytics: Track success rate of search URLs
 * 4. Fallback: Handle Vivino search changes/deprecation
 * 5. Localization: Support Vivino regional domains (.com, .fr, .de, etc.)
 * 6. Legal: Review Vivino ToS for deep-linking and search automation
 * 7. UX: Add clear helper text explaining this is a search URL
 * 8. Workflow: Provide "Copy wine page URL" helper after Vivino search
 */

