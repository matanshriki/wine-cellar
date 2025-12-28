/**
 * Recommendation Service
 * 
 * Generates wine recommendations from user's Supabase cellar.
 */

import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

type Bottle = Database['public']['Tables']['bottles']['Row'];
type Wine = Database['public']['Tables']['wines']['Row'];

export interface RecommendationInput {
  mealType?: string;
  occasion?: string;
  vibe?: string;
  constraints?: {
    avoidTooYoung?: boolean;
    preferReadyToDrink?: boolean;
    maxPrice?: number;
  };
}

export interface BottleWithWine extends Bottle {
  wine: Wine;
}

export interface Recommendation {
  bottleId: string;
  bottle: {
    id: string;
    name: string;
    producer?: string;
    vintage?: number;
    style: string;
    region?: string;
    quantity: number;
    rating?: number | null;
    vivinoUrl?: string | null;
    imageUrl?: string | null;
  };
  explanation: string;
  servingInstructions: string;
  score: number;
}

/**
 * Generate wine recommendations from user's cellar
 */
export async function getRecommendations(input: RecommendationInput): Promise<Recommendation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  console.log('[RecommendationService] Getting recommendations for:', input);

  // Get all user's bottles with wine info and quantity > 0
  const { data: bottles, error } = await supabase
    .from('bottles')
    .select(`
      *,
      wine:wines(*)
    `)
    .eq('user_id', user.id)
    .gt('quantity', 0)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[RecommendationService] Error fetching bottles:', error);
    throw new Error('Failed to fetch bottles');
  }

  if (!bottles || bottles.length === 0) {
    console.log('[RecommendationService] No bottles found');
    return [];
  }

  console.log('[RecommendationService] Found', bottles.length, 'bottles');

  // Cast to proper type
  const bottlesWithWine = bottles as unknown as BottleWithWine[];

  // Filter by constraints
  let filteredBottles = bottlesWithWine;

  // Filter by max price if provided
  if (input.constraints?.maxPrice && input.constraints.maxPrice > 0) {
    filteredBottles = filteredBottles.filter(b => 
      !b.purchase_price || b.purchase_price <= input.constraints!.maxPrice!
    );
  }

  // Filter by readiness if requested
  if (input.constraints?.preferReadyToDrink) {
    filteredBottles = filteredBottles.filter(b => {
      const status = b.readiness_status?.toLowerCase();
      return status === 'inwindow' || status === 'peak' || status === 'ready';
    });
  }

  // If no bottles match constraints, fall back to all bottles
  if (filteredBottles.length === 0) {
    filteredBottles = bottlesWithWine;
  }

  // Simple scoring algorithm based on meal type and wine style
  const scoredBottles = filteredBottles.map(bottle => {
    let score = 50; // Base score
    
    const wineColor = bottle.wine.color.toLowerCase();
    const mealType = input.mealType?.toLowerCase() || '';
    
    // Meal pairing heuristics
    if (mealType.includes('steak') || mealType.includes('beef')) {
      if (wineColor === 'red') score += 30;
    } else if (mealType.includes('fish') || mealType.includes('seafood')) {
      if (wineColor === 'white') score += 30;
      if (wineColor === 'sparkling') score += 20;
    } else if (mealType.includes('pasta')) {
      if (wineColor === 'red') score += 20;
      if (wineColor === 'white') score += 15;
    } else if (mealType.includes('chicken')) {
      if (wineColor === 'white') score += 20;
      if (wineColor === 'red') score += 10;
    } else if (mealType.includes('cheese')) {
      if (wineColor === 'red') score += 15;
      if (wineColor === 'white') score += 15;
      if (wineColor === 'sparkling') score += 25;
    } else if (mealType.includes('spicy') || mealType.includes('asian')) {
      if (wineColor === 'white') score += 25;
      if (wineColor === 'rose') score += 20;
    } else if (mealType.includes('pizza')) {
      if (wineColor === 'red') score += 25;
    }

    // Occasion bonuses
    const occasion = input.occasion?.toLowerCase() || '';
    if (occasion.includes('celebration') || occasion.includes('special')) {
      if (wineColor === 'sparkling') score += 20;
      if (bottle.purchase_price && bottle.purchase_price > 50) score += 10;
    }
    if (occasion.includes('date')) {
      if (wineColor === 'sparkling') score += 15;
      if (wineColor === 'red') score += 10;
    }

    // Vibe bonuses
    const vibe = input.vibe?.toLowerCase() || '';
    if (vibe.includes('special') || vibe.includes('surprise')) {
      if (bottle.purchase_price && bottle.purchase_price > 40) score += 10;
      if (bottle.readiness_status?.toLowerCase() === 'peak') score += 15;
    }
    if (vibe.includes('easy') || vibe.includes('casual')) {
      if (wineColor === 'white' || wineColor === 'rose') score += 10;
    }

    // Readiness bonus
    const readinessStatus = bottle.readiness_status?.toLowerCase();
    if (readinessStatus === 'peak') score += 20;
    if (readinessStatus === 'inwindow') score += 15;
    if (readinessStatus === 'ready') score += 10;

    // Random factor for variety
    score += Math.random() * 10;

    return { bottle, score };
  });

  // Sort by score and take top 3
  scoredBottles.sort((a, b) => b.score - a.score);
  const topBottles = scoredBottles.slice(0, 3);

  // Format recommendations
  const recommendations: Recommendation[] = topBottles.map((item, index) => {
    const { bottle, score } = item;
    const wine = bottle.wine;

    // Generate explanation
    let explanation = generateExplanation(bottle, wine, input, index + 1);

    // Generate serving instructions
    let servingInstructions = generateServingInstructions(bottle, wine);

    return {
      bottleId: bottle.id,
      bottle: {
        id: bottle.id,
        name: wine.wine_name,
        producer: wine.producer,
        vintage: wine.vintage || undefined,
        style: wine.color,
        region: wine.region || undefined,
        quantity: bottle.quantity,
        rating: wine.rating || null,
        vivinoUrl: wine.vivino_url || null,
        imageUrl: wine.image_url || null,
      },
      explanation,
      servingInstructions,
      score: Math.round(score),
    };
  });

  console.log('[RecommendationService] Generated', recommendations.length, 'recommendations');
  return recommendations;
}

function generateExplanation(bottle: BottleWithWine, wine: Wine, input: RecommendationInput, rank: number): string {
  const mealType = input.mealType || 'your meal';
  const occasion = input.occasion || 'this occasion';
  const wineColor = wine.color.toLowerCase();
  
  let explanation = '';

  if (rank === 1) {
    explanation = `This ${wineColor} wine from ${wine.region || wine.producer} is an excellent choice for ${mealType}. `;
  } else {
    explanation = `A great ${wineColor} option from ${wine.region || wine.producer} that pairs well with ${mealType}. `;
  }

  // Add readiness info
  if (bottle.readiness_status) {
    const status = bottle.readiness_status.toLowerCase();
    if (status === 'peak') {
      explanation += 'It\'s at peak drinking condition right now! ';
    } else if (status === 'inwindow' || status === 'ready') {
      explanation += 'It\'s ready to drink and will show beautifully. ';
    }
  }

  // Add occasion-specific note
  if (occasion.includes('celebration') || occasion.includes('special')) {
    explanation += 'Perfect for a special occasion. ';
  } else if (occasion.includes('date')) {
    explanation += 'Great for a romantic evening. ';
  } else if (occasion.includes('friends') || occasion.includes('hosting')) {
    explanation += 'Your guests will love this. ';
  }

  return explanation.trim();
}

function generateServingInstructions(bottle: BottleWithWine, wine: Wine): string {
  const wineColor = wine.color.toLowerCase();
  
  let temp = '16°C';
  let decanting = 'No decanting needed';
  
  if (wineColor === 'red') {
    temp = bottle.serve_temp_c ? `${bottle.serve_temp_c}°C` : '16-18°C';
    
    if (bottle.decant_minutes && bottle.decant_minutes > 0) {
      decanting = `Decant for ${bottle.decant_minutes} minutes`;
    } else if (wine.vintage && wine.vintage < new Date().getFullYear() - 5) {
      decanting = 'Decant for 30 minutes for best results';
    } else {
      decanting = 'No decanting needed, but 15 minutes can help';
    }
  } else if (wineColor === 'white' || wineColor === 'rose') {
    temp = bottle.serve_temp_c ? `${bottle.serve_temp_c}°C` : '8-12°C';
    decanting = 'No decanting needed';
  } else if (wineColor === 'sparkling') {
    temp = '6-8°C';
    decanting = 'Serve immediately, do not decant';
  }

  return `Serve at ${temp}. ${decanting}.`;
}

