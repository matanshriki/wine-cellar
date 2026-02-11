/**
 * Drink Window Service
 * 
 * Deterministic, explainable, and consistent drink window computation.
 * Fixes vintage inversion bugs where older wines show "HOLD" while younger show "READY".
 * 
 * Key Features:
 * - Monotonic vintage behavior (older vintages never less ready than younger)
 * - Explainable with clear reasons
 * - Confidence scoring
 * - Input validation and logging
 * - Versioning for cache invalidation
 */

import type { BottleWithWineInfo } from './bottleService';

export const DRINK_WINDOW_VERSION = 2; // Increment when logic changes

export type ReadinessStatus = 'READY' | 'HOLD' | 'PEAK_SOON';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DrinkWindowResult {
  readiness_label: ReadinessStatus;
  drink_window_start: number | null;
  drink_window_end: number | null;
  confidence: Confidence;
  reasons: string[];
  assumptions: string | null;
  version: number;
  computed_at: string;
  
  // Debug info
  _debug?: {
    vintage: number | null;
    age: number;
    color: string;
    currentYear: number;
    producer: string;
    wine_name: string;
  };
}

/**
 * Wine profile for aging potential estimation
 */
interface WineProfile {
  body?: number; // 1-5
  tannin?: number; // 1-5
  acidity?: number; // 1-5
  oak?: number; // 1-5
  power?: number; // 1-5
}

/**
 * Compute drink window with deterministic, explainable logic
 */
export function computeDrinkWindow(
  bottle: BottleWithWineInfo,
  options: {
    includeDebug?: boolean;
    language?: string;
  } = {}
): DrinkWindowResult {
  const { includeDebug = false, language = 'en' } = options;
  
  // Input validation
  const currentYear = new Date().getFullYear();
  const vintage = bottle.wine.vintage;
  const color = (bottle.wine.color || 'red').toLowerCase();
  const wine_name = bottle.wine.wine_name;
  const producer = bottle.wine.producer || '';
  
  // Validate vintage
  if (!vintage || vintage < 1900 || vintage > currentYear + 1) {
    console.warn('[DrinkWindow] Invalid vintage:', vintage, 'for', wine_name);
    return createFallbackResult(bottle, 'Invalid vintage', language, includeDebug);
  }
  
  // Calculate age (ensure integer)
  const age = Math.max(0, currentYear - vintage);
  
  console.log('[DrinkWindow] Computing:', {
    wine_name,
    producer,
    vintage,
    age,
    color,
    currentYear,
  });
  
  // Get wine profile if available
  const profile = extractWineProfile(bottle);
  
  // Compute based on wine type and age
  let result: DrinkWindowResult;
  
  if (color.includes('sparkling')) {
    result = computeSparklingWindow(age, wine_name, language);
  } else if (color.includes('white') || color.includes('rose')) {
    result = computeWhiteRoseWindow(age, color, wine_name, language);
  } else {
    // Red wine - use profile if available
    result = computeRedWindow(age, wine_name, producer, profile, language);
  }
  
  // Add context from region/grapes
  result = enrichWithContext(result, bottle, language);
  
  // Add debug info if requested
  if (includeDebug) {
    result._debug = {
      vintage,
      age,
      color,
      currentYear,
      producer,
      wine_name,
    };
  }
  
  console.log('[DrinkWindow] Result:', {
    wine_name,
    vintage,
    readiness: result.readiness_label,
    confidence: result.confidence,
    reasons: result.reasons,
  });
  
  return result;
}

/**
 * Compute drink window for sparkling wines
 */
function computeSparklingWindow(
  age: number,
  wine_name: string,
  language: string
): DrinkWindowResult {
  const t = (en: string, he: string) => language === 'he' ? he : en;
  
  if (age < 3) {
    return {
      readiness_label: 'READY',
      drink_window_start: null,
      drink_window_end: null,
      confidence: 'HIGH',
      reasons: [
        t('Fresh sparkling wine, best enjoyed young', 'יין מבעבע רענן, מומלץ לשתות צעיר'),
        t(`${age} ${age === 1 ? 'year' : 'years'} old - optimal for sparklings`, `בן ${age} שנ${age === 1 ? 'ה' : 'ים'} - אופטימלי למבעבעים`),
        t('Maintains vibrant bubbles and fresh fruit', 'שומר על בועות חיות ופרי רענן'),
      ],
      assumptions: null,
      version: DRINK_WINDOW_VERSION,
      computed_at: new Date().toISOString(),
    };
  } else if (age < 5) {
    return {
      readiness_label: 'READY',
      drink_window_start: null,
      drink_window_end: null,
      confidence: 'MEDIUM',
      reasons: [
        t('Mature sparkling, drink soon', 'מבעבע בשל, מומלץ לשתות בקרוב'),
        t(`${age} years old - approaching peak freshness window`, `בן ${age} שנים - מתקרב לחלון רעננות מרבי`),
        t('May be losing some effervescence', 'עלול לאבד חלק מהתוססות'),
      ],
      assumptions: t(
        'Assumes proper storage in cool, dark conditions',
        'מניח אחסון תקין במקום קריר וחשוך'
      ),
      version: DRINK_WINDOW_VERSION,
      computed_at: new Date().toISOString(),
    };
  } else {
    return {
      readiness_label: 'READY',
      drink_window_start: null,
      drink_window_end: null,
      confidence: 'LOW',
      reasons: [
        t('Older sparkling, drink promptly', 'מבעבע מבוגר, מומלץ לשתות במהירות'),
        t(`${age} years old - past typical freshness window`, `בן ${age} שנים - עבר חלון רעננות טיפוסי`),
        t('Quality depends heavily on storage', 'איכות תלויה מאוד באחסון'),
      ],
      assumptions: t(
        'Quality uncertain without tasting notes. May be past peak.',
        'איכות לא ודאית ללא הערות טעימה. ייתכן שעבר שיא.'
      ),
      version: DRINK_WINDOW_VERSION,
      computed_at: new Date().toISOString(),
    };
  }
}

/**
 * Compute drink window for white and rosé wines
 */
function computeWhiteRoseWindow(
  age: number,
  color: string,
  wine_name: string,
  language: string
): DrinkWindowResult {
  const t = (en: string, he: string) => language === 'he' ? he : en;
  const wineType = color.includes('rose') 
    ? t('rosé', 'רוזה')
    : t('white', 'לבן');
  
  if (age < 2) {
    return {
      readiness_label: 'READY',
      drink_window_start: null,
      drink_window_end: null,
      confidence: 'HIGH',
      reasons: [
        t(`Fresh ${wineType} wine at optimal age`, `יין ${wineType} רענן בגיל אופטימלי`),
        t(`${age} ${age === 1 ? 'year' : 'years'} old - prime freshness`, `בן ${age} שנ${age === 1 ? 'ה' : 'ים'} - רעננות מרבית`),
        t('Crisp acidity and bright fruit flavors', 'חומציות חדה וטעמי פירות בהירים'),
      ],
      assumptions: null,
      version: DRINK_WINDOW_VERSION,
      computed_at: new Date().toISOString(),
    };
  } else if (age < 5) {
    return {
      readiness_label: 'READY',
      drink_window_start: null,
      drink_window_end: null,
      confidence: 'MEDIUM',
      reasons: [
        t(`Mature ${wineType}, drink within a year`, `${wineType} בשל, מומלץ לשתות תוך שנה`),
        t(`${age} years old - developing complexity`, `בן ${age} שנים - מפתח מורכבות`),
        t('May be losing some freshness', 'עלול לאבד חלק מהרעננות'),
      ],
      assumptions: t(
        'Assumes typical table wine. Premium whites may age longer.',
        'מניח יין שולחן טיפוסי. לבנים פרימיום עשויים להתיישן יותר.'
      ),
      version: DRINK_WINDOW_VERSION,
      computed_at: new Date().toISOString(),
    };
  } else {
    return {
      readiness_label: 'READY',
      drink_window_start: null,
      drink_window_end: null,
      confidence: 'LOW',
      reasons: [
        t(`Older ${wineType}, drink promptly`, `${wineType} מבוגר, מומלץ לשתות במהירות`),
        t(`${age} years old - likely past peak`, `בן ${age} שנים - ככל הנראה עבר שיא`),
        t('Quality depends on storage and producer', 'איכות תלויה באחסון וביצרן'),
      ],
      assumptions: t(
        'May be oxidized or faded. Premium whites with oak may still be good.',
        'עלול להיות מחומצן או דהוי. לבנים פרימיום עם אלון עדיין עשויים להיות טובים.'
      ),
      version: DRINK_WINDOW_VERSION,
      computed_at: new Date().toISOString(),
    };
  }
}

/**
 * Compute drink window for red wines (most complex)
 */
function computeRedWindow(
  age: number,
  wine_name: string,
  producer: string,
  profile: WineProfile | null,
  language: string
): DrinkWindowResult {
  const t = (en: string, he: string) => language === 'he' ? he : en;
  const currentYear = new Date().getFullYear();
  
  // Estimate aging potential from profile
  const agingPotential = profile 
    ? estimateAgingPotential(profile)
    : 'medium'; // default assumption
  
  // Adjust thresholds based on aging potential
  let youngThreshold: number;
  let primeStart: number;
  let primeEnd: number;
  let matureThreshold: number;
  
  if (agingPotential === 'high') {
    // e.g., Bordeaux, Barolo, premium Cabernet
    youngThreshold = 5;
    primeStart = 5;
    primeEnd = 20;
    matureThreshold = 25;
  } else if (agingPotential === 'medium') {
    // e.g., Chianti, Rioja, mid-tier Pinot
    youngThreshold = 3;
    primeStart = 3;
    primeEnd = 12;
    matureThreshold = 18;
  } else {
    // e.g., Beaujolais, light reds, entry-level
    youngThreshold = 2;
    primeStart = 2;
    primeEnd = 8;
    matureThreshold = 12;
  }
  
  // Apply logic with clear thresholds
  if (age < youngThreshold) {
    return {
      readiness_label: 'HOLD',
      drink_window_start: currentYear + (youngThreshold - age),
      drink_window_end: currentYear + (primeEnd - age),
      confidence: profile ? 'MEDIUM' : 'LOW',
      reasons: [
        t(`Only ${age} ${age === 1 ? 'year' : 'years'} old - still young`, `רק בן ${age} שנ${age === 1 ? 'ה' : 'ים'} - עדיין צעיר`),
        t('Red wines benefit from aging', 'יינות אדומים נהנים מהתיישנות'),
        t('Tannins are still settling', 'הטאנינים עדיין מתיישבים'),
        t(`Estimated ${agingPotential} aging potential`, `פוטנציאל התיישנות ${agingPotential === 'high' ? 'גבוה' : agingPotential === 'medium' ? 'בינוני' : 'נמוך'}`),
      ],
      assumptions: profile
        ? t('Based on wine structure analysis', 'מבוסס על ניתוח מבנה היין')
        : t('Based on typical red wine aging patterns', 'מבוסס על דפוסי התיישנות טיפוסיים ליין אדום'),
      version: DRINK_WINDOW_VERSION,
      computed_at: new Date().toISOString(),
    };
  } else if (age < primeStart + 2) {
    return {
      readiness_label: 'READY',
      drink_window_start: currentYear,
      drink_window_end: currentYear + (primeEnd - age),
      confidence: 'HIGH',
      reasons: [
        t(`${age} years old - entering drinking window`, `בן ${age} שנים - נכנס לחלון שתייה`),
        t('Tannins have softened', 'הטאנינים התרככו'),
        t('Fruit and structure in balance', 'פרי ומבנה באיזון'),
        t(`Peak window: next ${primeEnd - age} years`, `חלון שיא: ${primeEnd - age} השנים הבאות`),
      ],
      assumptions: null,
      version: DRINK_WINDOW_VERSION,
      computed_at: new Date().toISOString(),
    };
  } else if (age < primeEnd) {
    return {
      readiness_label: 'READY',
      drink_window_start: currentYear,
      drink_window_end: currentYear + (primeEnd - age),
      confidence: 'HIGH',
      reasons: [
        t(`${age} years old - at peak maturity`, `בן ${age} שנים - בשיא הבשלות`),
        t('Complex tertiary aromas developed', 'ארומות שלישוניות מורכבות התפתחו'),
        t('Well-integrated tannins', 'טאנינים משולבים היטב'),
        t('Optimal drinking window', 'חלון שתייה אופטימלי'),
      ],
      assumptions: null,
      version: DRINK_WINDOW_VERSION,
      computed_at: new Date().toISOString(),
    };
  } else if (age < matureThreshold) {
    return {
      readiness_label: 'READY',
      drink_window_start: currentYear,
      drink_window_end: currentYear + 3,
      confidence: 'MEDIUM',
      reasons: [
        t(`${age} years old - fully mature`, `בן ${age} שנים - בשל לחלוטין`),
        t('Drink within the next few years', 'מומלץ לשתות במהלך השנים הקרובות'),
        t('Quality depends on storage', 'איכות תלויה באחסון'),
      ],
      assumptions: t(
        'Assumes proper cellar storage. May be past peak without ideal conditions.',
        'מניח אחסון במרתף תקין. עלול להיות עבר שיא ללא תנאים אידיאליים.'
      ),
      version: DRINK_WINDOW_VERSION,
      computed_at: new Date().toISOString(),
    };
  } else {
    return {
      readiness_label: 'READY',
      drink_window_start: currentYear,
      drink_window_end: currentYear + 2,
      confidence: 'LOW',
      reasons: [
        t(`${age} years old - very mature`, `בן ${age} שנים - בשל מאוד`),
        t('Likely past peak, drink promptly', 'ככל הנראה עבר שיא, מומלץ לשתות במהירות'),
        t('May be fading or oxidized', 'עלול להיות דהוי או מחומצן'),
      ],
      assumptions: t(
        'Uncertain quality without recent tasting notes. Storage history critical.',
        'איכות לא ודאית ללא הערות טעימה עדכניות. היסטוריית אחסון קריטית.'
      ),
      version: DRINK_WINDOW_VERSION,
      computed_at: new Date().toISOString(),
    };
  }
}

/**
 * Extract wine profile from bottle data
 */
function extractWineProfile(bottle: BottleWithWineInfo): WineProfile | null {
  const wine = bottle.wine as any;
  
  // Check if we have wine_profile data
  if (wine.wine_profile) {
    return {
      body: wine.wine_profile.body,
      tannin: wine.wine_profile.tannin,
      acidity: wine.wine_profile.acidity,
      oak: wine.wine_profile.oak,
      power: wine.wine_profile.power,
    };
  }
  
  return null;
}

/**
 * Estimate aging potential from wine profile
 */
function estimateAgingPotential(profile: WineProfile): 'low' | 'medium' | 'high' {
  // Score based on structure indicators
  let score = 0;
  
  if (profile.tannin) score += profile.tannin;
  if (profile.body) score += profile.body;
  if (profile.oak) score += profile.oak * 0.5;
  if (profile.power) score += profile.power * 0.5;
  if (profile.acidity) score += profile.acidity * 0.3;
  
  // Normalize to 0-15 range
  const maxScore = 5 + 5 + 2.5 + 2.5 + 1.5; // 16.5
  const normalized = (score / maxScore) * 15;
  
  if (normalized >= 10) return 'high';
  if (normalized >= 6) return 'medium';
  return 'low';
}

/**
 * Enrich result with regional/grape context
 */
function enrichWithContext(
  result: DrinkWindowResult,
  bottle: BottleWithWineInfo,
  language: string
): DrinkWindowResult {
  const t = (en: string, he: string) => language === 'he' ? he : en;
  
  // Add region context
  if (bottle.wine.region) {
    result.reasons.push(t(`From ${bottle.wine.region}`, `מאזור ${bottle.wine.region}`));
  }
  
  // Add grape context
  if (bottle.wine.grapes && Array.isArray(bottle.wine.grapes) && bottle.wine.grapes.length > 0) {
    const grapesList = bottle.wine.grapes.join(', ');
    result.reasons.push(t(`Grapes: ${grapesList}`, `ענבים: ${grapesList}`));
  }
  
  return result;
}

/**
 * Create fallback result for invalid inputs
 */
function createFallbackResult(
  bottle: BottleWithWineInfo,
  reason: string,
  language: string,
  includeDebug: boolean
): DrinkWindowResult {
  const t = (en: string, he: string) => language === 'he' ? he : en;
  
  const result: DrinkWindowResult = {
    readiness_label: 'READY',
    drink_window_start: null,
    drink_window_end: null,
    confidence: 'LOW',
    reasons: [
      t(`Unable to analyze: ${reason}`, `לא ניתן לנתח: ${reason}`),
      t('Defaulting to "Ready" status', 'ברירת מחדל למצב "מוכן"'),
      t('Manual verification recommended', 'מומלץ אימות ידני'),
    ],
    assumptions: t(
      'Analysis failed due to missing or invalid data',
      'הניתוח נכשל עקב נתונים חסרים או לא תקינים'
    ),
    version: DRINK_WINDOW_VERSION,
    computed_at: new Date().toISOString(),
  };
  
  if (includeDebug) {
    result._debug = {
      vintage: bottle.wine.vintage,
      age: 0,
      color: bottle.wine.color || 'unknown',
      currentYear: new Date().getFullYear(),
      producer: bottle.wine.producer || '',
      wine_name: bottle.wine.wine_name,
    };
  }
  
  return result;
}

/**
 * Validate vintage consistency across same wine
 * 
 * CRITICAL: Older vintages should never be less ready than younger vintages
 * of the same wine (unless there's an explicit reason like different cuvée).
 */
export function validateVintageConsistency(
  bottles: BottleWithWineInfo[],
  options: {
    autoFix?: boolean;
    language?: string;
  } = {}
): {
  valid: boolean;
  issues: Array<{
    olderVintage: number;
    youngerVintage: number;
    issue: string;
    suggestion: string;
  }>;
  fixed?: BottleWithWineInfo[];
} {
  const { autoFix = false, language = 'en' } = options;
  const t = (en: string, he: string) => language === 'he' ? he : en;
  
  // Group by wine identity (producer + wine_name)
  const wineGroups = new Map<string, BottleWithWineInfo[]>();
  
  for (const bottle of bottles) {
    const identity = `${bottle.wine.producer || 'unknown'}::${bottle.wine.wine_name}`.toLowerCase();
    if (!wineGroups.has(identity)) {
      wineGroups.set(identity, []);
    }
    wineGroups.get(identity)!.push(bottle);
  }
  
  const issues: Array<{
    olderVintage: number;
    youngerVintage: number;
    issue: string;
    suggestion: string;
  }> = [];
  
  // Check each wine group for vintage inversions
  for (const [identity, groupBottles] of wineGroups.entries()) {
    // Filter bottles with vintages
    const withVintages = groupBottles.filter(b => b.wine.vintage);
    
    if (withVintages.length < 2) continue;
    
    // Sort by vintage (oldest first)
    withVintages.sort((a, b) => a.wine.vintage! - b.wine.vintage!);
    
    // Check for inversions
    for (let i = 0; i < withVintages.length - 1; i++) {
      const older = withVintages[i];
      const younger = withVintages[i + 1];
      
      const olderAnalysis = older as any;
      const youngerAnalysis = younger as any;
      
      // Check if older is HOLD and younger is READY/PEAK_SOON
      if (
        olderAnalysis.readiness_label === 'HOLD' &&
        (youngerAnalysis.readiness_label === 'READY' || youngerAnalysis.readiness_label === 'PEAK_SOON')
      ) {
        issues.push({
          olderVintage: older.wine.vintage!,
          youngerVintage: younger.wine.vintage!,
          issue: t(
            `${older.wine.vintage} is marked HOLD but ${younger.wine.vintage} is marked ${youngerAnalysis.readiness_label}`,
            `${older.wine.vintage} מסומן HOLD אבל ${younger.wine.vintage} מסומן ${youngerAnalysis.readiness_label}`
          ),
          suggestion: t(
            'Older vintage should be at least as ready as younger vintage',
            'בציר מבוגר יותר צריך להיות לפחות מוכן כמו בציר צעיר יותר'
          ),
        });
        
        console.warn('[DrinkWindow] Vintage inversion detected:', {
          wine: older.wine.wine_name,
          producer: older.wine.producer,
          older: older.wine.vintage,
          olderStatus: olderAnalysis.readiness_label,
          younger: younger.wine.vintage,
          youngerStatus: youngerAnalysis.readiness_label,
        });
      }
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
    fixed: autoFix ? [] : undefined, // TODO: implement auto-fix
  };
}
