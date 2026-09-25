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
  /\b(what\s+do\s+i\s+have|what\s+(?:\w+\s+){1,4}do\s+i\s+have|how\s+many\s+(?:\w+\s+){0,4}(do\s+i\s+have|wines?|bottles?)|what'?s\s+in\s+my\s+(cellar|fridge|collection)|show\s+(me\s+)?(all\s+)?(my\s+)?|list\s+(all\s+)?(my\s+)?|browse|inventory|collection|which\s+(?:\w+\s+){0,3}do\s+i\s+have)\b/i;

const BROWSE_PATTERNS_HE =
  /(מה\s+יש\s+לי|איזה\s+.+\s+יש\s+לי|כמה\s+.+\s+יש\s+לי|הצג\s+(את\s+)?(כל\s+)?|תראה\s+(לי\s+)?(את\s+)?(כל\s+)?|רשימת|כל\s+ה(כשרים|אדומים|לבנים)|מה\s+במקרר|מה\s+יש\s+במקרר)/;

const SHOW_ALL_FOLLOWUP =
  /\b(show\s+(me\s+)?(all\s+of\s+them|the\s+rest|them\s+all|more)|list\s+them\s+all|the\s+full\s+list|see\s+(them\s+)?all|next\s+page|show\s+the\s+rest)\b/i;

const SHOW_ALL_FOLLOWUP_HE =
  /(הצג\s+(את\s+)?(כולם|השאר|ההמשך)|תראה\s+(לי\s+)?(את\s+)?(כולם|השאר)|את\s+כולם|את\s+כל\s+אלה|המשך\s+הרשימה|עמוד\s+הבא|אלה\s+כל\s+ה|האם\s+אלה\s+כל)/;

const FOOD_HINT =
  /\b(pair(ing|ed)?|with\s+(the\s+)?(steak|fish|salmon|chicken|pasta|cheese|sushi|bbq|lamb|beef|pork|duck)|dinner\s+with|for\s+(the\s+)?(steak|fish|salmon|chicken|pasta|cheese|sushi|bbq|lamb|beef|pork|duck)|steak|fish|salmon|chicken|pasta|cheese|dessert|sushi|bbq|grill|roast|curry|spicy|cream|tomato|lamb|beef|seafood)\b/i;

function normalizeMessage(s: string): string {
  return s.trim().toLowerCase();
}

export function detectIntent(message: string, historyLen: number): CellarIntent {
  const m = normalizeMessage(message);
  if (BROWSE_PATTERNS.test(m) || BROWSE_PATTERNS_HE.test(message)) return 'browse_cellar';
  if (MULTI_PATTERNS.test(m)) return 'multi_recommendation';
  if (FOOD_HINT.test(m)) return 'pairing';
  if (m.split(/\s+/).length <= 2 && historyLen === 0) return 'general';
  return 'single_recommendation';
}

/** User wants the full matching list / next page (retain prior filters). */
export function detectsInventoryFollowUp(message: string): boolean {
  return SHOW_ALL_FOLLOWUP.test(message) || SHOW_ALL_FOLLOWUP_HE.test(message);
}

export function detectsWantsKosher(message: string): boolean {
  if (/\bkosher\b/i.test(message)) return true;
  if (/כשר/.test(message)) return true;
  return false;
}

/**
 * Bottle-level storage filters (bottles.storage_location).
 *
 * Important product rule: bare “fridge” / “wine fridge” / מקרר / “cellar” / מרתף
 * mean the user’s wine collection itself (many people store wine only in a wine
 * fridge). Those are NOT hard filters on storage_location — otherwise kosher/etc.
 * inventory asks return 0 when location is unset.
 *
 * Only distinct places (e.g. kitchen fridge, garage) become location hints.
 */
export function extractStorageLocationHints(message: string): string[] {
  const hints: string[] = [];
  const m = normalizeMessage(message);

  // Explicit non-collection places
  if (/\bkitchen\s+(fridge|refrigerator)\b/.test(m)) hints.push('kitchen');
  if (/\b(garage|basement\s+shelf|rack\s+\d+)\b/.test(m)) {
    if (/\bgarage\b/.test(m)) hints.push('garage');
    if (/\bbasement\s+shelf\b/.test(m)) hints.push('basement shelf');
    if (/\brack\s+\d+\b/.test(m)) {
      const rack = m.match(/\brack\s+(\d+)\b/);
      if (rack) hints.push(`rack ${rack[1]}`);
    }
  }
  if (/מקרר\s+המטבח|במטבח/.test(message) && /מקרר|fridge/i.test(message)) {
    hints.push('kitchen');
  }

  // Bare fridge / wine fridge / מקרר / cellar / מרתף → no storage hint (cellar synonym)
  return [...new Set(hints)];
}

/**
 * Inventory mode: list/count from full cellar (deterministic).
 * Recommend mode: hard-filter then rank picks.
 */
export function resolveQueryMode(
  message: string,
  intent: CellarIntent,
  constraints: ExtractedConstraints,
  opts?: {
    inventoryFollowUp?: boolean;
    hasPriorHardFilters?: boolean;
  }
): 'inventory' | 'recommend' {
  if (opts?.inventoryFollowUp && opts.hasPriorHardFilters) return 'inventory';
  if (intent === 'browse_cellar') return 'inventory';
  if (detectsInventoryFollowUp(message)) return 'inventory';

  // Explicit list/show-all/count with hard attribute → inventory
  const listy =
    /\b(list|show\s+(me\s+)?all|how\s+many|what\s+(?:\w+\s+){1,4}do\s+i\s+have|which\s+(?:\w+\s+){0,3}do\s+i\s+have)\b/i.test(
      message
    ) ||
    /(מה\s+יש\s+לי|איזה\s+.+\s+יש\s+לי|כמה\s+.+\s+יש\s+לי|הצג\s+את\s+כל|כל\s+הכשרים)/.test(
      message
    );

  const hasHard =
    constraints.wantsKosher ||
    constraints.storageLocationHints.length > 0 ||
    constraints.colors.length > 0;

  if (listy && hasHard) return 'inventory';
  if (constraints.storageLocationHints.length > 0 && listy) return 'inventory';
  if (
    constraints.storageLocationHints.length > 0 &&
    (/\bwhat'?s\s+in\b/i.test(message) || /מה\s+(יש\s+)?במקרר/.test(message))
  ) {
    return 'inventory';
  }

  return 'recommend';
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
  // Avoid bare "קר" — it matches inside מקרר (fridge)
  if (/חורף|יום\s+קר|מזג\s+אוויר\s+קר/.test(message)) occasion.push('winter');

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

/**
 * Detect cheapest vs most-expensive intent so shortlisting can prefer priced bottles.
 * Checks "most expensive" / "least expensive" before bare "expensive"/"cheap".
 */
export function detectPriceSortIntent(
  message: string
): 'cheapest' | 'most_expensive' | null {
  const m = message.toLowerCase();
  if (
    /\b(most\s+expensive|priciest|highest\s+priced?|most\s+costly)\b/i.test(m) ||
    /היקר(?:ה)?\s*ביותר|הכי\s*יקר|יקר\s*ביותר/.test(message)
  ) {
    return 'most_expensive';
  }
  if (
    /\b(cheap(?:er|est)?|least\s+expensive|most\s+affordable|budget|inexpensive|lowest\s+priced?)\b/i.test(
      m
    ) ||
    /הזול(?:ה)?\s*ביותר|הכי\s*זול|זול\s*ביותר|זול(?:ה|ים)?/.test(message)
  ) {
    return 'cheapest';
  }
  // Bare "expensive" / Hebrew "יקר" without "most/cheapest" → treat as most expensive
  if (/\b(expensive|pricey|costly)\b/i.test(m) || /יקר(?:ה|ים)?/.test(message)) {
    return 'most_expensive';
  }
  if (/\b(price|cost|how\s+much)\b/i.test(m) || /מחיר|כסף/.test(message)) {
    // Generic price question — surface priced bottles; default to cheapest listing
    return 'cheapest';
  }
  return null;
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
    priceSort: detectPriceSortIntent(message),
    wantsKosher: detectsWantsKosher(message),
    storageLocationHints: extractStorageLocationHints(message),
  };
}

/** Merge prior hard filters when follow-up is “show all / show the rest”. */
export function mergeConstraintsWithPrior(
  current: ExtractedConstraints,
  prior: Partial<{
    colors: string[];
    wantsKosher: boolean;
    storageLocationHints: string[];
  }> | null | undefined
): ExtractedConstraints {
  if (!prior) return current;
  return {
    ...current,
    colors: current.colors.length ? current.colors : prior.colors ?? [],
    wantsKosher: current.wantsKosher || prior.wantsKosher === true,
    storageLocationHints: current.storageLocationHints.length
      ? current.storageLocationHints
      : prior.storageLocationHints ?? [],
  };
}

/** Matches food keywords in any message — used to detect if history already has food context */
const FOOD_CONTEXT_RE =
  /\b(steak|beef|lamb|fish|salmon|chicken|pasta|cheese|sushi|bbq|grill|curry|dessert|tomato|pizza|seafood|pork|veal|duck|risotto|burger|salad)\b|בשר|סטייק|טלה|כבש|דג|סלמון|עוף|פסטה|גבינ|עוגה|קינוח|פיצה|סושי|המבורגר|סלט/i;

/** Matches price/value follow-up requests — these should NOT demand food clarification */
const PRICE_FOLLOWUP_RE =
  /\b(cheap(er|est)?|budget|affordable|value|inexpensive|least expensive|most affordable|price|expensive|priciest|cost)\b|זול(ה?|ים|יותר|ביותר)|יקר(ה?|יותר|ביותר)|מחיר|כסף/i;

/**
 * Whether we should nudge the model toward a clarifying question first.
 *
 * Triggers when key pairing/occasion context is missing — a real sommelier
 * always asks what you're eating before picking a bottle.
 *
 * `recentHistory` (when provided) is used to check if prior turns already
 * supply food/occasion context, so the agent doesn't re-ask.
 */
export function needsClarification(
  intent: CellarIntent,
  constraints: ExtractedConstraints,
  bottles: CellarBottleInput[],
  message: string,
  historyLen: number,
  recentHistory?: Array<{ role?: string; content?: string }>
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

  // Price/value requests never need food clarification — user wants cheapest/most affordable
  if (PRICE_FOLLOWUP_RE.test(message)) return false;

  // Check if prior user messages already supply food or occasion context
  const historyHasFoodContext = recentHistory
    ? recentHistory.some(
        (m) =>
          m.role === 'user' &&
          m.content &&
          FOOD_CONTEXT_RE.test(m.content)
      )
    : false;

  // On first turn: meal occasion mentioned (lunch, dinner, tonight) but no specific food — ask what they're eating
  // Mid-conversation: only ask if this specific message mentions a meal occasion without food context
  const ml = message.toLowerCase();
  const mentionsMealOccasion =
    /\b(lunch|dinner|supper|brunch|meal|tonight)\b/i.test(ml) ||
    /ארוח[הת]|צהריים|ערב/.test(message);
  if (
    mentionsMealOccasion &&
    constraints.foodKeywords.length === 0 &&
    !historyHasFoodContext
  ) {
    return true;
  }

  // Very generic first-turn request with no context at all — ask for occasion/mood/food
  // Mid-conversation: trust the LLM to use conversation history for context
  const hasNoConstraints =
    constraints.foodKeywords.length === 0 &&
    constraints.regionHints.length === 0 &&
    constraints.grapeHints.length === 0 &&
    constraints.colors.length === 0;

  if (
    historyLen === 0 &&
    intent === 'single_recommendation' &&
    hasNoConstraints
  ) {
    return true;
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
  if (constraints.priceSort === 'cheapest') {
    parts.push(
      'Price ask: cheapest — use purchasePrice on bottles that have it; do not invent prices for unpriced bottles'
    );
  } else if (constraints.priceSort === 'most_expensive') {
    parts.push(
      'Price ask: most expensive — use purchasePrice on bottles that have it; do not invent prices for unpriced bottles'
    );
  }
  if (constraints.wantsKosher) {
    parts.push('Hard filter: kosher only (isKosher === true); null/unknown is not kosher');
  }
  if (constraints.storageLocationHints.length) {
    parts.push(`Hard filter: storage ${constraints.storageLocationHints.join(', ')}`);
  }
  if (shortlistRegions.length) {
    parts.push(`Selection regions (sample): ${shortlistRegions.slice(0, 6).join(', ')}`);
  }
  if (relaxedColorFilter) {
    parts.push(
      'Note: No bottle matched the requested color exactly; candidates include other colors — explain honestly.'
    );
  }

  let clarificationHint: string | undefined;
  if (clarificationNeeded) {
    clarificationHint =
      'IMPORTANT: The user has NOT provided enough context for a confident recommendation. ' +
      'You MUST ask a short, friendly clarifying question FIRST (e.g., what are you eating? ' +
      'what is the occasion? how many guests?). Use the "followUpQuestion" field and OMIT ' +
      '"recommendation" / "bottles". Do NOT guess — a great sommelier asks before pouring.';
  }

  return {
    intent,
    constraints,
    shortlistSummary: parts.join(' | '),
    clarificationHint,
  };
}
