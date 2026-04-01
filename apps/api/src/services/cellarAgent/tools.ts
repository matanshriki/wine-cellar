/**
 * Internal "tools" — pure deterministic helpers.
 *
 * These mirror future agent tool boundaries: intent, constraints, clarification,
 * and reasoning context without network I/O. Phase 2 can promote them to real tools.
 */

import type {
  CellarBottleInput,
  CellarIntent,
  ExtractedConstraints,
  ReasoningContext,
} from './types.js';

const MULTI_PATTERNS =
  /\b(top|best|pick|give|show|need|want)\s+(\d{1,2})\b|\b(\d{1,2})\s+(bottles|wines|recommendations|picks|options)\b|\b(several|few|multiple|many)\s+(bottles|wines|recommendations|options|picks)\b/i;

const BROWSE_PATTERNS =
  /\b(what\s+do\s+i\s+have|what'?s\s+in\s+my\s+cellar|show\s+my\s+cellar|browse|inventory|collection)\b/i;

const FOOD_HINT =
  /\b(with|for|pair|pairing|dinner|lunch|steak|fish|salmon|chicken|pasta|cheese|dessert|sushi|bbq|grill|roast|curry|spicy|cream|tomato)\b/i;

function normalizeMessage(s: string): string {
  return s.trim().toLowerCase();
}

export function detectIntent(message: string, historyLen: number): CellarIntent {
  const m = normalizeMessage(message);
  if (BROWSE_PATTERNS.test(m)) return 'browse_cellar';
  if (MULTI_PATTERNS.test(m)) return 'multi_recommendation';
  if (FOOD_HINT.test(m)) return 'pairing';
  if (m.split(/\s+/).length <= 2 && historyLen === 0) return 'general';
  return 'single_recommendation';
}

function parseRequestedCount(message: string): number | null {
  const m = normalizeMessage(message);
  const topN = m.match(/\b(top|best|pick|give|show|need|want)\s+(\d{1,2})\b/);
  if (topN) return Math.min(12, Math.max(1, parseInt(topN[2], 10)));
  const nBottles = m.match(/\b(\d{1,2})\s+(bottles|wines|recommendations|picks|options)\b/);
  if (nBottles) return Math.min(12, Math.max(1, parseInt(nBottles[1], 10)));
  if (/\b(several|few|multiple|many)\b/.test(m)) return 3;
  return null;
}

function extractColorHints(message: string): string[] {
  const m = normalizeMessage(message);
  const colors: string[] = [];
  // English
  if (/\bred(s)?\b/.test(m) || /\brouge\b/.test(m)) colors.push('red');
  if (/\bwhite\b/.test(m) || /\bblanc\b/.test(m)) colors.push('white');
  if (/\bros[eé]\b/.test(m)) colors.push('rose');
  if (/\bsparkling\b/.test(m)) colors.push('sparkling');
  // Hebrew — use original message (not lowercased); handle final-letter forms (ם ן ך ף ץ).
  // אדום (singular, final-mem ם) | אדומים (plural, regular mem מ + final-mem ם)
  if (/אדו[מם]/.test(message)) colors.push('red');
  // לבן (singular, final-nun ן) | לבנה | לבנים
  if (/לב[נן]/.test(message)) colors.push('white');
  if (/רוזה/.test(message)) colors.push('rose');
  if (/תוסס|מבעבע/.test(message)) colors.push('sparkling');
  return [...new Set(colors)];
}

function extractRegionGrapeHints(message: string): { regions: string[]; grapes: string[] } {
  const m = normalizeMessage(message);
  const regions: string[] = [];
  const grapes: string[] = [];

  const regionLex = [
    'bordeaux',
    'burgundy',
    'champagne',
    'rioja',
    'barolo',
    'barbaresco',
    'chianti',
    'tuscany',
    'napa',
    'rhone',
    'rhône',
    'mosel',
    'burgundy',
    'loire',
    'alsace',
  ];
  for (const r of regionLex) {
    if (m.includes(r)) regions.push(r.replace('ô', 'o'));
  }

  const grapeLex = [
    'pinot noir',
    'cabernet',
    'merlot',
    'syrah',
    'shiraz',
    'sangiovese',
    'nebbiolo',
    'tempranillo',
    'chardonnay',
    'sauvignon',
    'riesling',
    'gamay',
    'grenache',
  ];
  for (const g of grapeLex) {
    if (m.includes(g)) grapes.push(g);
  }

  return { regions: [...new Set(regions)], grapes: [...new Set(grapes)] };
}

function extractFoodOccasion(message: string): { food: string[]; occasion: string[] } {
  const m = normalizeMessage(message);
  const food: string[] = [];
  const foodLex = [
    'steak', 'beef', 'lamb', 'fish', 'salmon', 'chicken', 'pasta',
    'cheese', 'sushi', 'bbq', 'grill', 'curry', 'dessert', 'tomato',
  ];
  for (const w of foodLex) {
    if (m.includes(w)) food.push(w);
  }
  // Hebrew food terms (map to English equivalents already in foodLex)
  if (/בשר|סטייק/.test(message)) food.push('steak');
  if (/טלה|כבש/.test(message)) food.push('lamb');
  if (/דג|סלמון/.test(message)) food.push('fish');
  if (/עוף|תרנגול/.test(message)) food.push('chicken');
  if (/פסטה/.test(message)) food.push('pasta');
  if (/גבינ/.test(message)) food.push('cheese');
  if (/עוגה|קינוח/.test(message)) food.push('dessert');
  if (/פיצה/.test(message)) food.push('pizza');

  const occasion: string[] = [];
  if (/\b(birthday|anniversary|celebration|party|holiday)\b/.test(m)) occasion.push('celebration');
  if (/\b(summer|hot|warm)\b/.test(m)) occasion.push('summer');
  if (/\b(winter|cold)\b/.test(m)) occasion.push('winter');
  // Hebrew occasions
  if (/חגיגה|יום הולדת|יום נישואין|אירוע|מסיבה/.test(message)) occasion.push('celebration');
  if (/חג|פסח|ראש השנה|סוכות|חנוכה|שבת/.test(message)) occasion.push('celebration');
  if (/קיץ|חם/.test(message)) occasion.push('summer');
  if (/חורף|קר/.test(message)) occasion.push('winter');

  return { food: [...new Set(food)], occasion: [...new Set(occasion)] };
}

/**
 * Detect if the user message references a specific producer or winery,
 * including Hebrew patterns (יקב = winery). Used to expand shortlist cap.
 */
export function detectsSpecificProducerMention(message: string): boolean {
  // Hebrew winery marker
  if (/יקב/.test(message)) return true;
  // English producer-specific patterns: "from [Proper Noun]", "[Name] winery", etc.
  if (/\b(winery|winer|château|domaine|estate|vineyard)\b/i.test(message)) return true;
  // Pattern: "the [Producer] wine / bottle"
  if (/\b(the\s+\w+\s+(wine|bottle|label|red|white))\b/i.test(message)) return true;
  return false;
}

/**
 * Detects if the user explicitly wants to include reserved (Keep) bottles in suggestions.
 * Matches: "include reserved", "include keep wines", "even reserved", "כולל שמורים", etc.
 */
export function detectsIncludeReservedRequest(message: string): boolean {
  // English patterns
  if (/\b(include|show|add|consider|with)\b.{0,20}\b(reserved|keep|kept|set aside)\b/i.test(message)) return true;
  if (/\beven\s+(the\s+)?(reserved|kept|keep)\b/i.test(message)) return true;
  if (/\breserved\s+(wines?|bottles?|ones?)\b/i.test(message)) return true;
  // Hebrew patterns (שמורים / שמורות = reserved; כולל = including)
  if (/כולל\s*שמור/.test(message)) return true;
  if (/גם\s*שמור/.test(message)) return true;
  if (/הצג\s*שמור/.test(message)) return true;
  if (/לשמור/.test(message) && /כולל|הצג|גם/.test(message)) return true;
  return false;
}

export function extractConstraints(message: string): ExtractedConstraints {
  const m = normalizeMessage(message);
  const { regions, grapes } = extractRegionGrapeHints(message);
  const { food, occasion } = extractFoodOccasion(message);
  const count = parseRequestedCount(message);

  return {
    requestedCount: count,
    colors: extractColorHints(message),
    regionHints: regions,
    grapeHints: grapes,
    foodKeywords: food,
    occasionKeywords: occasion,
    wantsSparkling: /\b(sparkling|champagne|bubbles?|cr[eé]mant)\b/i.test(m),
    wantsChampagne: /\bchampagne\b/i.test(m),
  };
}

/**
 * Whether we should nudge the model toward a clarifying question first.
 * Conservative: only when input is extremely underspecified.
 */
export function needsClarification(
  intent: CellarIntent,
  constraints: ExtractedConstraints,
  bottles: CellarBottleInput[],
  message: string,
  historyLen: number
): boolean {
  const t = message.trim();
  if (t.length > 0 && t.length < 3 && historyLen === 0) return true;
  if (bottles.length === 0) return true;

  // User asked for a color that does not exist in cellar (deterministic check)
  if (constraints.colors.length > 0) {
    const set = new Set(
      bottles.map((b) => (b.color || '').toLowerCase()).filter(Boolean)
    );
    const anyMatch = constraints.colors.some((c) => set.has(c));
    if (!anyMatch) return true;
  }

  return false;
}

export function buildReasoningContext(
  intent: CellarIntent,
  constraints: ExtractedConstraints,
  shortlistRegions: string[],
  clarificationNeeded: boolean,
  relaxedColorFilter: boolean
): ReasoningContext {
  const parts: string[] = [];
  parts.push(`Intent: ${intent}`);
  if (constraints.requestedCount) {
    parts.push(`Requested count: ${constraints.requestedCount}`);
  }
  if (constraints.colors.length) {
    parts.push(`Color preference: ${constraints.colors.join(', ')}`);
  }
  if (constraints.regionHints.length) {
    parts.push(`Region hints: ${constraints.regionHints.join(', ')}`);
  }
  if (constraints.grapeHints.length) {
    parts.push(`Grape hints: ${constraints.grapeHints.join(', ')}`);
  }
  if (constraints.foodKeywords.length) {
    parts.push(`Food context: ${constraints.foodKeywords.join(', ')}`);
  }
  if (shortlistRegions.length) {
    parts.push(`Shortlist regions (sample): ${shortlistRegions.slice(0, 6).join(', ')}`);
  }
  if (relaxedColorFilter) {
    parts.push(
      'Note: No bottle matched the requested color exactly; candidates include other colors — explain honestly.'
    );
  }

  let clarificationHint: string | undefined;
  if (clarificationNeeded) {
    clarificationHint =
      'The user may need a brief clarifying question before locking a bottle, unless the cellar makes the answer obvious.';
  }

  return {
    intent,
    constraints,
    shortlistSummary: parts.join(' | '),
    clarificationHint,
  };
}
