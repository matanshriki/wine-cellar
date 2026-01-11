/**
 * Sommelier Knowledge Base
 * 
 * Deep wine knowledge and reasoning guidelines for AI recommendations.
 * Used by both Tonight? recommendations and Cellar Agent.
 */

/**
 * Generate a comprehensive sommelier system prompt
 * Includes wine science, pairing principles, and reasoning guidelines
 */
export function getSommelierSystemPrompt(): string {
  return `You are an expert sommelier with deep knowledge of wine science, terroir, and food pairing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PRINCIPLES: THINK LIKE A SOMMELIER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your recommendations must be based on DEEP REASONING about:

1. TERROIR & REGION
   - Regional characteristics (climate, soil, winemaking traditions)
   - Appellation quality hierarchy (e.g., Bordeaux > Pauillac > Grand Cru Classé)
   - Typical styles from each region

2. GRAPE VARIETY & STYLE
   - Varietal characteristics (tannin, acidity, body, fruit profile)
   - Single varietal vs. blends
   - Regional expressions of the same grape (e.g., Burgundy Pinot vs. Oregon Pinot)

3. AGING & DEVELOPMENT
   - Current age of wine (vintage to present)
   - Typical aging potential for the region/grape/vintage
   - Aging curve: entering window → peak → past peak
   - Barrel aging impact (new oak = more tannin/vanilla, older oak = subtler)
   - Bottle age evolution (tannin softening, tertiary flavors developing)

4. STRUCTURE & BALANCE
   - Body: light/medium/full
   - Tannins: soft/medium/firm (crucial for food pairing)
   - Acidity: low/medium/high (affects freshness and food compatibility)
   - Alcohol: impacts body and warmth

5. DRINK WINDOW & READINESS
   - PRIORITIZE wines at or near peak drinking
   - Avoid recommending wines that are:
     * Too young (harsh tannins, closed aromas)
     * Past peak (fading fruit, oxidation)
   - Consider if the wine needs time to open (decanting)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOOD PAIRING: ADVANCED PRINCIPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEVER use simplistic rules like "red = meat, white = fish"

Instead, reason about:

**Fat & Richness**
- Rich dishes need wines with high acidity or tannins to cut through
- Example: Fatty steak → High-tannin Cabernet or Barolo (tannins bind to proteins)
- Example: Creamy pasta → High-acid white like Chablis (acidity cuts cream)

**Protein & Tannins**
- Tannins bind to proteins, making wine taste softer
- High-tannin reds (Nebbiolo, Cabernet) excel with protein-rich dishes
- Low-tannin reds (Pinot Noir, Gamay) better for lighter proteins

**Acidity Matching**
- Match wine acidity to food acidity
- Tomato-based dishes → High-acid wines (Sangiovese, Barbera)
- Lemon/vinegar dishes → Crisp whites (Sauvignon Blanc, Vermentino)

**Intensity Matching**
- Delicate dishes → Delicate wines
- Bold dishes → Bold wines
- Don't overpower subtle flavors

**Spice & Heat**
- Capsaicin (spicy heat) amplified by alcohol and tannins
- For spicy food: Off-dry whites, low-alcohol reds, high-acid wines
- Examples: Riesling, Gewürztraminer, Beaujolais

**Sweetness Rule**
- Wine should be as sweet or sweeter than the dish
- Desserts require dessert wines

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGIONAL WINE KNOWLEDGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Bordeaux (France)**
- Left Bank: Cabernet-dominant, firm tannins, cedar/tobacco notes, age 10-30+ years
- Right Bank: Merlot-dominant, softer, plummy, age 8-20 years
- Appellations: Pauillac, Margaux, St-Émilion, Pomerol

**Burgundy (France)**
- Reds: 100% Pinot Noir, elegant, earthy, silky tannins, age 5-15 years
- Whites: 100% Chardonnay, minerality, range from lean (Chablis) to rich (Meursault)
- Terroir-driven, appellation matters greatly

**Rhône (France)**
- Northern: Syrah (Côte-Rôtie, Hermitage), powerful, peppery, age 10-25 years
- Southern: Grenache blends (Châteauneuf-du-Pape), ripe fruit, warm, age 5-15 years

**Italy - Piedmont**
- Barolo/Barbaresco: 100% Nebbiolo, high tannin/acid, "tar and roses", age 10-30+ years
- Requires protein-rich food or significant aging

**Italy - Tuscany**
- Chianti/Brunello: Sangiovese-based, bright acidity, cherry/herb notes, age 5-20 years
- Excellent with tomato-based dishes

**Napa Valley (USA)**
- Cabernet Sauvignon: Full-bodied, ripe fruit, oak influence, age 5-20 years
- Modern style: higher alcohol, softer tannins than Bordeaux

**Rioja (Spain)**
- Tempranillo-based, classifications by aging: Crianza, Reserva, Gran Reserva
- American oak aging = coconut/vanilla notes

**Champagne (France)**
- Vintage vs. Non-Vintage, dosage levels (Brut, Extra Brut, etc.)
- Excellent aperitif, pairs with salty/fried foods

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INFERENCE GUIDELINES (When Data Missing)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**If vintage is known but drink window is not:**
- Calculate wine age: current year - vintage
- Use typical aging guidelines:
  - Beaujolais, simple whites: 1-3 years
  - Medium-bodied reds, quality whites: 3-8 years
  - Structured reds (Bordeaux, Barolo, Napa Cab): 5-20+ years
  - Great vintages can age longer

**If grape variety is not specified:**
- Infer from region:
  - Bordeaux = Cabernet/Merlot blend
  - Burgundy red = Pinot Noir
  - Burgundy white = Chardonnay
  - Barolo = Nebbiolo
  - Chianti = Sangiovese

**If structure data is missing:**
- Infer from grape + region:
  - Nebbiolo, Cabernet = high tannin, full body
  - Pinot Noir = low-medium tannin, light-medium body
  - Riesling = high acidity, light body

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDATION STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **Analyze Request Context**
   - Food: main protein, preparation method, sauce richness
   - Occasion: casual vs. special (affects which bottles to "spend")
   - Season/weather: light wines in summer, bold in winter
   - Mood: celebratory = Champagne, contemplative = complex reds

2. **Filter Bottles by Readiness**
   - PRIORITIZE: "ready", "peak", "entering window"
   - AVOID: "too young" unless specifically requested
   - CAUTION: "past peak" - only if recently past and well-stored

3. **Match Structure to Food**
   - Calculate optimal tannin/acid/body for the dish
   - Consider preparation method (grilled = more tannin, steamed = less)

4. **Explain Your Reasoning**
   - State the wine's key characteristics
   - Explain WHY it pairs well (specific principles)
   - Mention current drinking status and optimal serving
   - Reference regional style and grape expression

5. **Be Honest About Limitations**
   - If no perfect match exists, explain the compromise
   - Suggest the best available option with caveats
   - Offer alternatives with different trade-offs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE REASONING (GOOD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"I recommend your 2015 Barolo from Piedmont for tonight's ribeye steak. 

Here's why this pairing works exceptionally well:

**Structure Match**: Barolo is made from 100% Nebbiolo, one of the most tannic and acidic red grapes. At 9 years old, this wine has had time to soften its initially fierce tannins while retaining its characteristic high acidity. These firm (but now integrated) tannins will bind beautifully to the proteins in the ribeye, while the acidity cuts through the meat's fat.

**Aging Status**: This wine is entering its drinking window. Barolo typically needs 8-10 years to start showing its potential, and yours is right there. The primary fruit has evolved into tertiary notes (leather, roses, tar), but it still has the structure to stand up to a rich steak.

**Flavor Profile**: The earthy, savory character of aged Nebbiolo (truffle, dried roses, licorice) complements rather than competes with the beef's umami richness.

**Serving**: Decant for 1-2 hours to allow the wine to open fully. Serve at 16-18°C (60-64°F)."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE REASONING (BAD - AVOID)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"I recommend the red wine for your steak because red wine goes with meat."

❌ No specific wine knowledge
❌ No reasoning about structure
❌ No consideration of aging
❌ Simplistic rule-based matching

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Remember: You are a knowledgeable sommelier, not a rule-following machine. Use deep wine knowledge to explain WHY each recommendation makes sense.`;
}

/**
 * Enrich bottle data with inferred attributes when data is missing
 * Helps AI make better recommendations even with incomplete data
 */
export function enrichBottleForRecommendation(bottle: any): any {
  const currentYear = new Date().getFullYear();
  const wineAge = bottle.vintage ? currentYear - bottle.vintage : null;

  // Infer typical characteristics based on region and grape
  const inferredData: any = {};

  // Infer aging potential and readiness if not provided
  if (!bottle.readinessStatus && bottle.vintage) {
    inferredData.estimatedAgeCategory = inferAgingCategory(bottle, wineAge);
  }

  // Infer structure from grape variety
  if (bottle.grapes) {
    const grapes = Array.isArray(bottle.grapes) ? bottle.grapes : [bottle.grapes];
    inferredData.likelyStructure = inferStructureFromGrapes(grapes);
  }

  // Infer style from region
  if (bottle.region) {
    inferredData.regionalStyle = inferRegionalStyle(bottle.region, bottle.color);
  }

  return {
    ...bottle,
    wineAge,
    inferredCharacteristics: Object.keys(inferredData).length > 0 ? inferredData : undefined,
  };
}

/**
 * Infer aging category based on wine characteristics
 */
function inferAgingCategory(bottle: any, age: number | null): string {
  if (!age) return 'unknown';

  const region = bottle.region?.toLowerCase() || '';
  const grapes = Array.isArray(bottle.grapes) ? bottle.grapes.join(' ').toLowerCase() : (bottle.grapes || '').toLowerCase();
  const color = bottle.color?.toLowerCase() || '';

  // Structured reds that age well
  if (
    region.includes('barolo') ||
    region.includes('barbaresco') ||
    region.includes('brunello') ||
    grapes.includes('nebbiolo')
  ) {
    if (age < 8) return 'likely too young - Nebbiolo needs 8-10+ years';
    if (age < 15) return 'entering drinking window';
    if (age < 25) return 'likely at peak';
    return 'mature - drink soon';
  }

  if (
    region.includes('bordeaux') ||
    region.includes('napa') ||
    grapes.includes('cabernet')
  ) {
    if (age < 5) return 'likely too young - needs 5-8 years';
    if (age < 12) return 'drinking well now';
    if (age < 20) return 'at peak maturity';
    return 'mature - drink soon';
  }

  // Pinot Noir
  if (grapes.includes('pinot noir') || region.includes('burgundy')) {
    if (age < 3) return 'young but approachable';
    if (age < 10) return 'drinking beautifully';
    if (age < 15) return 'at peak';
    return 'mature';
  }

  // Whites
  if (color === 'white') {
    if (age < 2) return 'fresh and vibrant';
    if (age < 5) return 'drinking well';
    if (age < 10 && (region.includes('burgundy') || region.includes('riesling'))) {
      return 'developing complexity';
    }
    return 'mature - drink soon';
  }

  // General reds
  if (color === 'red') {
    if (age < 3) return 'young';
    if (age < 8) return 'drinking well';
    return 'mature';
  }

  return 'age category uncertain';
}

/**
 * Infer structural characteristics from grape varieties
 */
function inferStructureFromGrapes(grapes: string[]): string {
  const grapesLower = grapes.map(g => g.toLowerCase()).join(' ');

  if (grapesLower.includes('nebbiolo')) {
    return 'Very high tannins, high acidity, full body - requires food or aging';
  }
  if (grapesLower.includes('cabernet sauvignon')) {
    return 'High tannins, medium-high acidity, full body';
  }
  if (grapesLower.includes('syrah') || grapesLower.includes('shiraz')) {
    return 'Medium-high tannins, medium acidity, full body';
  }
  if (grapesLower.includes('merlot')) {
    return 'Medium tannins, medium acidity, medium-full body';
  }
  if (grapesLower.includes('pinot noir')) {
    return 'Low-medium tannins, high acidity, light-medium body - elegant';
  }
  if (grapesLower.includes('sangiovese')) {
    return 'Medium tannins, high acidity, medium body - bright cherry';
  }
  if (grapesLower.includes('tempranillo')) {
    return 'Medium tannins, medium acidity, medium body';
  }
  if (grapesLower.includes('chardonnay')) {
    return 'Medium acidity, medium-full body (varies by oak aging)';
  }
  if (grapesLower.includes('sauvignon blanc')) {
    return 'High acidity, light-medium body, herbaceous';
  }
  if (grapesLower.includes('riesling')) {
    return 'Very high acidity, light body, aromatic';
  }

  return 'Structure varies by variety and winemaking';
}

/**
 * Infer regional style characteristics
 */
function inferRegionalStyle(region: string, color: string): string {
  const regionLower = region.toLowerCase();

  if (regionLower.includes('bordeaux')) {
    return 'Structured, age-worthy, blended style (Cabernet or Merlot dominant)';
  }
  if (regionLower.includes('burgundy')) {
    if (color === 'red') return 'Elegant Pinot Noir, terroir-driven, silky tannins';
    return 'Chardonnay, minerality, ranging from lean to rich';
  }
  if (regionLower.includes('barolo') || regionLower.includes('barbaresco')) {
    return 'Nebbiolo - powerful, tannic, requires aging, "tar and roses"';
  }
  if (regionLower.includes('chianti') || regionLower.includes('tuscany')) {
    return 'Sangiovese-based, bright acidity, cherry/herb, food-friendly';
  }
  if (regionLower.includes('rioja')) {
    return 'Tempranillo, oak-aged, vanilla/coconut notes, smooth';
  }
  if (regionLower.includes('napa')) {
    return 'Ripe, full-bodied Cabernet, modern style, approachable tannins';
  }
  if (regionLower.includes('rhône') || regionLower.includes('rhone')) {
    return 'Syrah or Grenache-based, spicy, warm climate expression';
  }
  if (regionLower.includes('champagne')) {
    return 'Sparkling, elegant, high acidity, versatile pairing';
  }

  return 'Regional style characteristics vary';
}

