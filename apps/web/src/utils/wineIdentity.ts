/**
 * Wine Identity & Duplicate Detection
 * 
 * Utilities for identifying and matching wines to detect duplicates
 * before adding to cellar.
 * 
 * Identity Key Strategy:
 * - Primary: producer + name + vintage
 * - Fallback: producer + name (if vintage missing)
 * - Normalization: trim, lowercase, remove punctuation, handle abbreviations
 */

/**
 * Normalize a string for comparison
 * - Trim whitespace
 * - Lowercase
 * - Remove punctuation
 * - Handle common abbreviations
 */
function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  
  return str
    .trim()
    .toLowerCase()
    // Remove punctuation except spaces and hyphens
    .replace(/[^\w\s-]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Handle common wine abbreviations
    .replace(/\bchateau\b/g, 'ch')
    .replace(/\bdomaine\b/g, 'dom')
    .replace(/\bcuvee\b/g, 'cuv')
    .replace(/\breserve\b/g, 'res')
    .replace(/\bgrand cru\b/g, 'gc')
    .replace(/\bpremier cru\b/g, 'pc')
    // Remove articles
    .replace(/\b(the|la|le|les|el|il)\b/g, '')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a unique identity key for a wine
 * Used for duplicate detection
 */
export function generateWineIdentityKey(wine: {
  producer?: string | null;
  name?: string | null;
  vintage?: number | null;
}): string {
  const producer = normalizeString(wine.producer);
  const name = normalizeString(wine.name);
  const vintage = wine.vintage?.toString() || 'nv'; // 'nv' = no vintage
  
  // Generate key: producer|name|vintage
  const key = `${producer}|${name}|${vintage}`;
  
  console.log('[wineIdentity] Generated key:', key, 'from:', wine);
  
  return key;
}

/**
 * Check if two wines are duplicates based on identity key
 */
export function areWinesDuplicate(
  wine1: { producer?: string | null; name?: string | null; vintage?: number | null },
  wine2: { producer?: string | null; name?: string | null; vintage?: number | null }
): boolean {
  const key1 = generateWineIdentityKey(wine1);
  const key2 = generateWineIdentityKey(wine2);
  
  const isDuplicate = key1 === key2 && key1 !== '||nv'; // Ensure not both empty
  
  console.log('[wineIdentity] Comparing:', key1, 'vs', key2, '→', isDuplicate ? 'DUPLICATE' : 'UNIQUE');
  
  return isDuplicate;
}

/**
 * Find a duplicate wine in a list of existing wines
 * Returns the first matching wine or null
 */
export function findDuplicateWine<T extends { producer?: string | null; name?: string | null; vintage?: number | null }>(
  candidateWine: { producer?: string | null; name?: string | null; vintage?: number | null },
  existingWines: T[]
): T | null {
  console.log('[wineIdentity] Searching for duplicates of:', candidateWine);
  console.log('[wineIdentity] In', existingWines.length, 'existing wines');
  
  const candidateKey = generateWineIdentityKey(candidateWine);
  
  // Don't match if candidate is empty
  if (candidateKey === '||nv') {
    console.log('[wineIdentity] Candidate is empty, no duplicate');
    return null;
  }
  
  for (const existing of existingWines) {
    const existingKey = generateWineIdentityKey(existing);
    
    if (candidateKey === existingKey) {
      console.log('[wineIdentity] ✅ Found duplicate!', existing);
      return existing;
    }
  }
  
  console.log('[wineIdentity] No duplicate found');
  return null;
}

/**
 * Calculate similarity score between two wines (0-1)
 * Useful for fuzzy matching when exact duplicate not found
 */
export function calculateWineSimilarity(
  wine1: { producer?: string | null; name?: string | null; vintage?: number | null },
  wine2: { producer?: string | null; name?: string | null; vintage?: number | null }
): number {
  const producer1 = normalizeString(wine1.producer);
  const producer2 = normalizeString(wine2.producer);
  const name1 = normalizeString(wine1.name);
  const name2 = normalizeString(wine2.name);
  
  let score = 0;
  let maxScore = 0;
  
  // Producer match (40% weight)
  maxScore += 0.4;
  if (producer1 && producer2) {
    if (producer1 === producer2) {
      score += 0.4;
    } else if (producer1.includes(producer2) || producer2.includes(producer1)) {
      score += 0.2; // Partial match
    }
  }
  
  // Name match (40% weight)
  maxScore += 0.4;
  if (name1 && name2) {
    if (name1 === name2) {
      score += 0.4;
    } else if (name1.includes(name2) || name2.includes(name1)) {
      score += 0.2; // Partial match
    }
  }
  
  // Vintage match (20% weight)
  maxScore += 0.2;
  if (wine1.vintage && wine2.vintage) {
    if (wine1.vintage === wine2.vintage) {
      score += 0.2;
    }
  }
  
  return maxScore > 0 ? score / maxScore : 0;
}
