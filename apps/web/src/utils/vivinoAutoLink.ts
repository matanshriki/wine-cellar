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
 * Strategy:
 * 1. Prefer: producer + wine_name + vintage
 * 2. Fallback: producer + wine_name
 * 3. Minimum: wine_name only
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
  
  // Extract producer (optional but preferred)
  const producer = data.producer?.trim() || '';
  
  // Extract vintage (optional)
  const vintage = data.vintage ? String(data.vintage).trim() : '';
  
  // Confidence check: prefer producer + wine_name combo
  const hasHighConfidence = producer && wineName;
  
  if (!hasHighConfidence) {
    console.log('[Vivino Auto-Link] Low confidence - producer missing, generating URL anyway');
  }
  
  // Build search query parts
  const queryParts: string[] = [];
  
  if (producer) {
    queryParts.push(producer);
  }
  
  queryParts.push(wineName);
  
  if (vintage && /^\d{4}$/.test(vintage)) {
    queryParts.push(vintage);
  }
  
  // Join with spaces and encode for URL
  const searchQuery = queryParts.join(' ').trim();
  const encodedQuery = encodeURIComponent(searchQuery);
  
  // Construct Vivino search URL
  const vivinoUrl = `https://www.vivino.com/search/wines?q=${encodedQuery}`;
  
  console.log('[Vivino Auto-Link] Generated URL:', vivinoUrl);
  console.log('[Vivino Auto-Link] Query parts:', queryParts);
  
  return vivinoUrl;
}

/**
 * TODO (for production):
 * 
 * Before enabling in production, consider:
 * 1. User privacy: Add opt-in preference
 * 2. Rate limiting: Throttle URL generation
 * 3. Analytics: Track success rate of auto-generated URLs
 * 4. Fallback: Handle Vivino search changes/deprecation
 * 5. Localization: Support Vivino regional domains (.com, .fr, .de, etc.)
 * 6. Legal: Review Vivino ToS for deep-linking
 */

