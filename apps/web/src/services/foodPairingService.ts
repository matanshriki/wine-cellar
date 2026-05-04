/**
 * Food Pairing Service
 *
 * Reads cached food_pairing from wines table (already loaded with the bottle).
 * Triggers generation via Edge Function (fire-and-forget after bottle creation).
 * Provides a deterministic rule-based fallback when AI data is unavailable.
 */

import { supabase } from '../lib/supabase';
import type { BottleWithWineInfo } from './bottleService';

// Types

export interface FoodPairing {
  summary: string;
  best_pairings: string[];
  everyday_pairings: string[];
  avoid: string[];
  pairing_logic: string;
  occasion_fit: string[];
  confidence: 'low' | 'med' | 'high';
}

// Rule-based fallback

interface FallbackRule {
  match: string[];
  colors?: string[];
  best_pairings: string[];
  everyday_pairings: string[];
  avoid: string[];
  pairing_logic: string;
  occasion_fit: string[];
}

const FALLBACK_RULES: FallbackRule[] = [
  // Barolo / Barbaresco / Nebbiolo
  {
    match: ['nebbiolo', 'barolo', 'barbaresco'],
    colors: ['red'],
    best_pairings: [
      'Truffle risotto with aged Parmigiano',
      'Braised beef cheeks in wine reduction',
      'Venison stew with juniper and root vegetables',
      'Mushroom tagliatelle with black truffle',
    ],
    everyday_pairings: [
      'Slow-cooked beef ragu pasta',
      'Roasted lamb shoulder with rosemary',
      'Mushroom risotto',
      'Aged hard cheeses',
    ],
    avoid: ['Raw oysters and seafood', 'Very spicy dishes', 'Light cream-based sauces'],
    pairing_logic: `Nebbiolo's high tannin and acidity demand fatty, umami-rich food that softens the structure. The wine's earthy complexity mirrors truffles and mushrooms.`,
    occasion_fit: ['Dinner party', 'Romantic dinner', 'Italian feast', 'Special occasion', 'Cheese board'],
  },
  // Aglianico
  {
    match: ['aglianico', 'taurasi'],
    colors: ['red'],
    best_pairings: [
      'Braised lamb with olives and tomato',
      'Wild boar ragu over handmade pasta',
      'Smoked pork ribs with herb crust',
      'Pecorino or aged Caciocavallo cheese',
    ],
    everyday_pairings: [
      'Baked lamb chops with herbs',
      'Tomato meat sauce pasta',
      'Grilled sausages',
      'Lentil and smoked meat soup',
    ],
    avoid: ['Delicate fish dishes', 'Creamy risottos', 'Vinaigrette-dressed salads'],
    pairing_logic: `Aglianico's powerful tannins and acidity cut through rich, fatty meats. Smoky and earthy flavors complement its dark-fruit and volcanic-mineral character.`,
    occasion_fit: ['Sunday roast', 'BBQ', 'Family dinner', 'Rustic Italian dinner'],
  },
  // Sangiovese / Chianti / Brunello
  {
    match: ['sangiovese', 'chianti', 'brunello', 'morellino'],
    colors: ['red'],
    best_pairings: [
      'Bistecca alla Fiorentina (T-bone steak)',
      'Wild boar pappardelle',
      'Ribollita (Tuscan bread stew)',
      'Pecorino Toscano cheese board',
    ],
    everyday_pairings: [
      'Classic spaghetti bolognese',
      'Grilled chicken with sun-dried tomatoes',
      'Pizza Margherita',
      'Tomato-braised meatballs',
    ],
    avoid: ['Very rich cream sauces', 'Sushi and raw fish', 'Very sweet desserts'],
    pairing_logic: `Sangiovese's firm acidity mirrors tomato dishes naturally. Its moderate tannin cuts through olive oil and meat fats, while cherry fruit complements charred and herb-rubbed proteins.`,
    occasion_fit: ['Italian dinner', 'Pizza night', 'Family feast', 'Alfresco dining'],
  },
  // Tempranillo / Rioja
  {
    match: ['tempranillo', 'rioja', 'ribera del duero', 'toro', 'garnacha'],
    colors: ['red'],
    best_pairings: [
      'Roasted rack of lamb with garlic and thyme',
      'Iberico ham and charcuterie board',
      'Slow-roasted suckling pig (Cochinillo)',
      'Manchego and Idiazabal cheese platter',
    ],
    everyday_pairings: [
      'Lamb chops grilled with rosemary',
      'Chorizo and bean stew',
      'Roasted chicken with peppers and potatoes',
      'Hard Spanish cheeses',
    ],
    avoid: ['Very spicy Asian cuisine', 'Sushi', 'Bitter greens with vinegar dressing'],
    pairing_logic: `Tempranillo's earthy spice and dried-fruit notes match the smoky, savory character of grilled and roasted meats. Oak aging in Rioja layers vanilla that softens the tannin against fat.`,
    occasion_fit: ['Spanish tapas night', 'BBQ', 'Dinner party', 'Cheese board'],
  },
  // Cabernet Sauvignon
  {
    match: ['cabernet sauvignon', 'bordeaux', 'napa', 'cab sauv', 'cabernet franc'],
    colors: ['red'],
    best_pairings: [
      'Dry-aged New York strip steak',
      'Braised lamb shank with red wine sauce',
      'Double-cut pork chops with cherry reduction',
      'Aged cheddar or Gruyere cheese',
    ],
    everyday_pairings: [
      'Grilled hamburgers',
      'Beef stew with root vegetables',
      'Roasted lamb shoulder',
      'Cheddar grilled cheese sandwich',
    ],
    avoid: ['Delicate fish', 'Spicy Thai or Indian curries', 'Sweet fruit-forward desserts'],
    pairing_logic: `Cabernet's powerful tannins are softened by protein and fat in red meat. The wine's cassis and cedar notes complement char and herbal rubs, while acidity cuts through rich sauces.`,
    occasion_fit: ['Steakhouse night', 'Dinner party', 'BBQ', 'Special occasion', 'Romantic dinner'],
  },
  // Merlot / Pomerol
  {
    match: ['merlot', 'pomerol', 'saint-emilion', 'saint emilion'],
    colors: ['red'],
    best_pairings: [
      'Duck confit with cherry gastrique',
      'Beef tenderloin with mushroom sauce',
      'Roasted pork loin with plum glaze',
      'Truffle mac and cheese',
    ],
    everyday_pairings: [
      'Pasta with meat sauce',
      'Roast chicken with herbs',
      'Grilled salmon (with good body)',
      'Semi-hard cheeses',
    ],
    avoid: ['Very spicy food', 'Delicate white fish', 'Heavy cream-only sauces'],
    pairing_logic: `Merlot's plummy roundness and softer tannins pair with moderately rich proteins. Duck and pork mirror the wine's fruit character, while mushrooms echo its earthy undertones.`,
    occasion_fit: ['Date night', 'Weeknight dinner', 'Dinner party', 'Family roast'],
  },
  // Syrah / Shiraz
  {
    match: ['syrah', 'shiraz', 'hermitage', 'crozes', 'rhone'],
    colors: ['red'],
    best_pairings: [
      'Slow-cooked lamb shoulder with spices',
      'Smoked brisket with peppercorn bark',
      'Merguez sausage with couscous',
      'Strong aged cheeses',
    ],
    everyday_pairings: [
      'Grilled lamb kebabs',
      'BBQ ribs with smoky rub',
      'Hearty beef stew',
      'Spiced lamb burger',
    ],
    avoid: ['Delicate sole or halibut', 'Creamy carbonara', 'Light summer salads'],
    pairing_logic: `Syrah's peppery, meaty character mirrors smoked and grilled proteins. Its dark-fruit intensity can handle bold spices that would overwhelm lighter wines.`,
    occasion_fit: ['BBQ', 'Rustic dinner', 'Meat lovers feast', 'Autumn dinner'],
  },
  // Pinot Noir
  {
    match: ['pinot noir', 'burgundy', 'bourgogne', 'chambolle', 'gevrey', 'volnay', 'pommard'],
    colors: ['red'],
    best_pairings: [
      'Roasted duck breast with cherry jus',
      'Pan-seared salmon with beurre blanc',
      'Sauteed wild mushrooms on brioche toast',
      'Grilled quail with grape and walnut salad',
    ],
    everyday_pairings: [
      'Roasted chicken thighs with herbs',
      'Salmon fillet with lemon butter',
      'Mushroom pasta',
      'Brie or soft washed-rind cheese',
    ],
    avoid: ['Very tannic dishes (heavy red sauces)', 'Vinegary pickled foods', 'Strong blue cheeses'],
    pairing_logic: `Pinot Noir's light-medium body and silky tannin pair beautifully with umami-rich but not overpowering dishes. The acidity lifts fatty fish and poultry, while earthy complexity echoes mushrooms.`,
    occasion_fit: ['Romantic dinner', 'Dinner party', 'Cheese board', 'Thanksgiving', 'Date night'],
  },
  // Chardonnay
  {
    match: ['chardonnay', 'meursault', 'puligny', 'chassagne', 'white burgundy'],
    colors: ['white'],
    best_pairings: [
      'Lobster with drawn butter and tarragon',
      'Pan-roasted chicken in cream sauce with morels',
      'Scallops with cauliflower puree',
      'Aged Comte or Gruyere fondue',
    ],
    everyday_pairings: [
      'Roast chicken with butter and herbs',
      'Creamy pasta with smoked salmon',
      'Fish pie',
      'Brie or Camembert',
    ],
    avoid: ['Very spicy Asian food', 'Acidic tomato-based dishes', 'Vinegary ceviche'],
    pairing_logic: `Chardonnay's full body and creamy texture align with butter and cream-based dishes. Oak adds vanilla and toast notes that enhance roasted flavors, while the wine's natural acidity cuts richness.`,
    occasion_fit: ['Dinner party', 'Seafood night', 'Sunday lunch', 'Date night'],
  },
  // Sauvignon Blanc
  {
    match: ['sauvignon blanc', 'sancerre', 'pouilly-fume', 'marlborough sauvignon'],
    colors: ['white'],
    best_pairings: [
      'Ceviche with lime and cilantro',
      'Pan-fried sole with capers and lemon',
      'Goat cheese tart with fresh herbs',
      'Grilled asparagus with hollandaise',
    ],
    everyday_pairings: [
      'Salad Nicoise',
      'Grilled chicken with herb salsa verde',
      'Pasta primavera',
      'Fresh goat cheese on crackers',
    ],
    avoid: ['Steak and heavy red meats', 'Creamy butter-heavy dishes', 'Very rich cheeses'],
    pairing_logic: `Sauvignon Blanc's zippy acidity and herbaceous notes mirror green herbs and citrus perfectly. The wine's freshness cuts through tangy goat cheese while its minerality lifts delicate fish.`,
    occasion_fit: ['Summer lunch', 'Aperitivo', 'Light dinner', 'Picnic', 'Brunch'],
  },
  // Riesling
  {
    match: ['riesling', 'alsace', 'mosel'],
    colors: ['white'],
    best_pairings: [
      'Thai green curry',
      'Peking duck with hoisin',
      'Sushi and sashimi platter',
      'Smoked salmon with cream cheese on rye',
    ],
    everyday_pairings: [
      'Pork belly with apple sauce',
      'Vietnamese spring rolls',
      'Mild spiced chicken dishes',
      'Hard cheeses',
    ],
    avoid: ['Very tannic red meats', 'Heavy cream sauces', 'Rich lamb dishes'],
    pairing_logic: `Riesling's balance of acidity and residual sugar tames spicy cuisines that would overwhelm most wines. Its floral notes complement aromatic Asian spices and fruit-glazed meats.`,
    occasion_fit: ['Asian takeout', 'Dinner party', 'Sushi night', 'Aperitivo', 'Brunch'],
  },
  // Rose
  {
    match: ['rose', 'provence rose', 'tavel'],
    colors: ['rose'],
    best_pairings: [
      'Bouillabaisse with rouille',
      'Grilled whole sea bass with olive oil',
      'Nicoise-style mezze platter',
      'Burrata with heirloom tomatoes',
    ],
    everyday_pairings: [
      'Grilled salmon',
      'Caprese salad',
      'Light pasta with vegetables',
      'Mediterranean mezze',
    ],
    avoid: ['Heavy red meat stews', 'Very pungent cheeses', 'Rich cream dishes'],
    pairing_logic: `Rose bridges red and white wine pairings. Its crisp acidity and light red-fruit character match fresh, lightly prepared fish and vegetables while its subtle body handles richer salads.`,
    occasion_fit: ['Summer BBQ', 'Picnic', 'Lunch alfresco', 'Pool party', 'Brunch'],
  },
  // Champagne / Sparkling
  {
    match: ['champagne', 'sparkling', 'prosecco', 'cava', 'cremant', 'methode champenoise'],
    colors: ['sparkling'],
    best_pairings: [
      'Oysters with mignonette',
      'Blinis with caviar and creme fraiche',
      'Fried chicken and waffles',
      'Aged Parmigiano-Reggiano',
    ],
    everyday_pairings: [
      'Fish and chips',
      'Smoked salmon crackers',
      'Light appetizers and canapes',
      'Mild soft cheese',
    ],
    avoid: ['Very spicy food', 'Heavy red meat', 'Very sweet desserts (unless demi-sec)'],
    pairing_logic: `Champagne's persistent bubbles and high acidity cleanse the palate of oil and fat. The fine bubbles elevate delicate seafood, while yeasty notes bridge fried and crispy textures.`,
    occasion_fit: ['Celebration', 'Aperitivo', "New Year's Eve", 'Wedding', 'Brunch'],
  },
];

/** Pick the best fallback rule for a wine based on grape / style / color. */
export function getFoodPairingFallback(wine: {
  wine_name?: string;
  color?: string;
  grapes?: unknown;
  regional_wine_style?: string | null;
  region?: string | null;
  appellation?: string | null;
}): FoodPairing {
  const haystack = [
    wine.wine_name,
    wine.regional_wine_style,
    wine.region,
    wine.appellation,
    Array.isArray(wine.grapes)
      ? (wine.grapes as string[]).join(' ')
      : typeof wine.grapes === 'string'
      ? wine.grapes
      : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const color = (wine.color || 'red').toLowerCase() as 'red' | 'white' | 'rose' | 'sparkling';

  for (const rule of FALLBACK_RULES) {
    const colorOk = !rule.colors || rule.colors.includes(color);
    const matchOk = rule.match.some((token) => haystack.includes(token.toLowerCase()));
    if (colorOk && matchOk) {
      return {
        summary: `${rule.best_pairings[0]} and ${rule.everyday_pairings[0].toLowerCase()} are natural companions for this wine.`,
        best_pairings: rule.best_pairings,
        everyday_pairings: rule.everyday_pairings,
        avoid: rule.avoid,
        pairing_logic: rule.pairing_logic,
        occasion_fit: rule.occasion_fit,
        confidence: 'low',
      };
    }
  }

  // Generic color-based fallback
  const genericByColor: Record<string, FoodPairing> = {
    red: {
      summary: 'This red wine pairs well with hearty proteins and aged cheeses.',
      best_pairings: ['Grilled steak', 'Braised beef short rib', 'Roasted lamb', 'Aged hard cheese'],
      everyday_pairings: ['Pasta bolognese', 'Grilled chicken', 'Beef burger', 'Cheddar sandwich'],
      avoid: ['Delicate white fish', 'Very spicy food', 'Acidic ceviche'],
      pairing_logic: 'Red wines match fatty proteins and umami-rich dishes through tannin-protein interaction.',
      occasion_fit: ['Dinner party', 'BBQ', 'Family roast', 'Weekend dinner'],
      confidence: 'low',
    },
    white: {
      summary: 'This white wine shines alongside seafood, poultry, and fresh cheeses.',
      best_pairings: ['Roast chicken', 'Grilled halibut', 'Lobster with butter', 'Soft fresh cheese'],
      everyday_pairings: ['Pasta primavera', 'Grilled salmon', 'Chicken salad', 'Goat cheese toast'],
      avoid: ['Heavy red meat stews', 'Very spicy curries', 'Tannic red meat'],
      pairing_logic: "White wine's acidity cuts through fatty fish and poultry, refreshing the palate.",
      occasion_fit: ['Summer lunch', 'Dinner party', 'Seafood night', 'Brunch'],
      confidence: 'low',
    },
    rose: {
      summary: 'This rose is versatile, pairing with light meats, fish, and Mediterranean flavors.',
      best_pairings: ['Grilled fish', 'Chicken salad', 'Mediterranean mezze', 'Burrata'],
      everyday_pairings: ['Grilled salmon', 'Light pasta', 'Caprese salad', 'Mild cheese'],
      avoid: ['Very heavy stews', 'Pungent blue cheese', 'Cream-heavy dishes'],
      pairing_logic: 'Rose bridges red and white pairings with its refreshing acidity and light fruit.',
      occasion_fit: ['Summer lunch', 'Alfresco dining', 'Picnic', 'Aperitivo'],
      confidence: 'low',
    },
    sparkling: {
      summary: 'This sparkling wine is a natural aperitivo and pairs brilliantly with fried foods and seafood.',
      best_pairings: ['Oysters', 'Fried calamari', 'Caviar with blinis', 'Light canapes'],
      everyday_pairings: ['Fish and chips', 'Smoked salmon', 'Mild cheese platter', 'Fresh spring rolls'],
      avoid: ['Heavy meat dishes', 'Very sweet desserts', 'Spicy curries'],
      pairing_logic: 'Bubbles and acidity cleanse the palate between bites and elevate delicate flavors.',
      occasion_fit: ['Celebration', 'Aperitivo', 'Brunch', 'Wedding', "New Year's Eve"],
      confidence: 'low',
    },
  };

  return genericByColor[color] ?? genericByColor.red;
}

// Read / generate

/**
 * Read food_pairing from the wine object already loaded in the bottle.
 * Returns null if not yet generated (caller should show fallback).
 */
export function readCachedFoodPairing(wine: Record<string, unknown>): FoodPairing | null {
  const raw = (wine as any).food_pairing;
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<FoodPairing>;
  if (!p.summary || !Array.isArray(p.best_pairings) || p.best_pairings.length === 0) return null;
  return p as FoodPairing;
}

/**
 * Fire-and-forget: trigger generation from the Edge Function.
 * Call this after createBottle; never await it in the critical path.
 */
export function triggerFoodPairingGeneration(bottle: BottleWithWineInfo): void {
  const wine = bottle.wine as any;
  if (wine.food_pairing || bottle.id.startsWith('demo-')) return;

  supabase.functions
    .invoke('generate-food-pairing', {
      body: {
        wine_id: bottle.wine_id,
        wine_data: {
          wine_name: wine.wine_name,
          producer: wine.producer,
          vintage: wine.vintage ?? null,
          country: wine.country ?? null,
          region: wine.region ?? null,
          appellation: wine.appellation ?? null,
          color: wine.color,
          grapes: wine.grapes ?? null,
          rating: wine.rating ?? null,
          notes: bottle.notes ?? wine.notes ?? null,
          regional_wine_style: wine.regional_wine_style ?? null,
        },
        trigger_source: 'user_scan',
      },
    })
    .catch((err) => {
      console.warn('[foodPairingService] Background generation failed:', err);
    });
}
