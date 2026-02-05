/**
 * Wine Profile Service
 * 
 * Handles wine profile generation, caching, and heuristic fallbacks
 */

import { supabase } from '../lib/supabase';
import type { BottleWithWineInfo } from './bottleService';

export interface WineProfile {
  body: number; // 1-5
  tannin: number; // 1-5
  acidity: number; // 1-5
  oak: number; // 1-5
  sweetness: number; // 0-5
  alcohol_est: number | null;
  power: number; // 1-10
  style_tags: string[];
  confidence: 'low' | 'med' | 'high';
  source: 'ai' | 'vivino' | 'heuristic';
  updated_at: string;
}

export interface FoodProfile {
  protein: 'beef' | 'lamb' | 'chicken' | 'fish' | 'veggie' | 'none';
  fat: 'low' | 'med' | 'high';
  sauce: 'tomato' | 'bbq' | 'creamy' | 'none';
  spice: 'low' | 'med' | 'high';
  smoke: 'low' | 'med' | 'high';
}

/**
 * Get wine profile with graceful fallback
 */
export function getWineProfile(wine: any): WineProfile {
  // Check if stored profile exists and is recent (< 30 days)
  if (wine.wine_profile && wine.wine_profile_updated_at) {
    const updatedAt = new Date(wine.wine_profile_updated_at);
    const daysSince = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSince < 30) {
      return wine.wine_profile as WineProfile;
    }
  }
  
  // Fallback to heuristic profile
  return getHeuristicProfile(wine);
}

/**
 * Generate heuristic profile based on wine metadata
 */
export function getHeuristicProfile(wine: any): WineProfile {
  const color = wine.color || 'red';
  const region = (wine.region || '').toLowerCase();
  const grapes = Array.isArray(wine.grapes) ? wine.grapes : [];
  const grapesStr = grapes.join(' ').toLowerCase();
  const style = (wine.regional_wine_style || '').toLowerCase();
  
  // Default values
  let body = 3;
  let tannin = 3;
  let acidity = 3;
  let oak = 2;
  let sweetness = 0;
  let alcohol_est = 13.0;
  const style_tags: string[] = [];
  
  // Color-based defaults
  if (color === 'white') {
    body = 2;
    tannin = 1;
    acidity = 4;
    oak = 1;
    alcohol_est = 12.5;
    style_tags.push('white-wine');
  } else if (color === 'rose') {
    body = 2;
    tannin = 2;
    acidity = 4;
    oak = 1;
    sweetness = 0;
    alcohol_est = 12.0;
    style_tags.push('rose');
  } else if (color === 'sparkling') {
    body = 2;
    tannin = 1;
    acidity = 5;
    oak = 1;
    sweetness = 1;
    alcohol_est = 12.0;
    style_tags.push('sparkling', 'refreshing');
  } else {
    // Red wine defaults
    style_tags.push('red-wine');
  }
  
  // Region-based adjustments
  if (region.includes('bordeaux') || region.includes('napa')) {
    body = Math.min(5, body + 1);
    tannin = Math.min(5, tannin + 1);
    oak = Math.min(5, oak + 1);
    style_tags.push('structured', 'age-worthy');
  } else if (region.includes('burgundy') || region.includes('willamette')) {
    body = Math.max(1, body - 1);
    acidity = Math.min(5, acidity + 1);
    oak = Math.min(5, oak + 1);
    style_tags.push('elegant', 'terroir-driven');
  } else if (region.includes('rioja') || region.includes('barolo')) {
    tannin = Math.min(5, tannin + 1);
    oak = Math.min(5, oak + 1);
    style_tags.push('traditional', 'complex');
  } else if (region.includes('rhone') || region.includes('barossa')) {
    body = Math.min(5, body + 1);
    tannin = Math.min(5, tannin);
    oak = Math.max(1, oak - 1);
    style_tags.push('bold', 'fruit-forward');
  }
  
  // Grape-based adjustments
  if (grapesStr.includes('cabernet') || grapesStr.includes('syrah') || grapesStr.includes('shiraz')) {
    body = Math.min(5, body + 1);
    tannin = Math.min(5, tannin + 1);
    alcohol_est = 14.0;
    style_tags.push('full-bodied', 'powerful');
  } else if (grapesStr.includes('pinot noir')) {
    body = Math.max(1, body - 1);
    tannin = Math.max(1, tannin - 1);
    acidity = Math.min(5, acidity + 1);
    style_tags.push('elegant', 'silky');
  } else if (grapesStr.includes('merlot')) {
    body = 3;
    tannin = 3;
    oak = 3;
    style_tags.push('smooth', 'approachable');
  } else if (grapesStr.includes('chardonnay')) {
    body = 3;
    oak = 3;
    style_tags.push('versatile');
  } else if (grapesStr.includes('sauvignon blanc') || grapesStr.includes('riesling')) {
    body = 2;
    acidity = 5;
    oak = 1;
    style_tags.push('crisp', 'refreshing');
  }
  
  // Style-based adjustments
  if (style.includes('reserve') || style.includes('gran reserva')) {
    oak = Math.min(5, oak + 1);
    body = Math.min(5, body + 1);
    style_tags.push('premium', 'age-worthy');
  }
  
  // Compute power
  const base = body * 2 + tannin * 1.5 + oak * 1 + acidity * 0.8 + sweetness * 0.2;
  const power = Math.round(Math.max(1, Math.min(10, base / 2.0)));
  
  // Ensure at least 3 tags
  if (style_tags.length < 3) {
    if (body >= 4) style_tags.push('full-bodied');
    if (tannin >= 4) style_tags.push('structured');
    if (acidity >= 4) style_tags.push('fresh');
  }
  
  return {
    body,
    tannin,
    acidity,
    oak,
    sweetness,
    alcohol_est,
    power,
    style_tags: style_tags.slice(0, 8),
    confidence: 'low',
    source: 'heuristic',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Generate wine profile using Edge Function
 */
export async function generateWineProfile(wine: {
  id?: string;
  wine_name: string;
  producer?: string;
  region?: string;
  country?: string;
  grapes?: string[];
  color: string;
  regional_wine_style?: string;
  vintage?: number;
  vivino_wine_id?: string;
  notes?: string;
}): Promise<WineProfile> {
  console.log('[WineProfileService] Generating profile for:', wine.wine_name);
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-wine-profile`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        wine_id: wine.id,
        name: wine.wine_name,
        producer: wine.producer,
        region: wine.region,
        country: wine.country,
        grapes: wine.grapes,
        color: wine.color,
        regional_wine_style: wine.regional_wine_style,
        vintage: wine.vintage,
        vivino_fields: wine.vivino_wine_id ? {
          rating: (wine as any).vivino_rating,
          notes: wine.notes,
        } : undefined,
      }),
    }
  );
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to generate profile');
  }
  
  console.log('[WineProfileService] ✅ Profile generated');
  return result.profile;
}

/**
 * Calculate food pairing score
 */
export function calculateFoodPairingScore(
  wineProfile: WineProfile,
  foodProfile: FoodProfile
): number {
  let score = 0;
  
  // High fat + red meat
  if (['beef', 'lamb'].includes(foodProfile.protein) && foodProfile.fat === 'high') {
    if (wineProfile.body >= 4) score += 15;
    if (wineProfile.tannin >= 3) score += 15;
    if (wineProfile.acidity >= 3) score += 10;
    if (wineProfile.body < 3) score -= 10;
  }
  
  // Tomato sauce
  if (foodProfile.sauce === 'tomato') {
    if (wineProfile.acidity >= 4) score += 20;
    if (wineProfile.body >= 2 && wineProfile.body <= 4) score += 10;
    if (wineProfile.oak < 3) score += 5;
    if (wineProfile.acidity < 3) score -= 15;
  }
  
  // Spicy food
  if (foodProfile.spice === 'high') {
    if (wineProfile.sweetness > 0) score += 15;
    if (wineProfile.body >= 2 && wineProfile.body <= 3) score += 10;
    if (wineProfile.tannin >= 4 && (wineProfile.alcohol_est || 13) > 13.5) score -= 20;
  }
  
  // Smoky/BBQ
  if (foodProfile.smoke === 'high' || foodProfile.sauce === 'bbq') {
    if (wineProfile.oak >= 3) score += 15;
    if (wineProfile.body >= 4) score += 10;
    if (wineProfile.oak < 2) score -= 10;
  }
  
  // Fish/seafood
  if (foodProfile.protein === 'fish') {
    if (wineProfile.body <= 2) score += 15;
    if (wineProfile.acidity >= 4) score += 15;
    if (wineProfile.oak < 3) score += 10;
    if (wineProfile.tannin > 2) score -= 20;
  }
  
  // Chicken/lighter proteins
  if (foodProfile.protein === 'chicken' || foodProfile.protein === 'veggie') {
    if (wineProfile.body >= 2 && wineProfile.body <= 4) score += 10;
    if (wineProfile.acidity >= 3) score += 10;
  }
  
  // Creamy sauce
  if (foodProfile.sauce === 'creamy') {
    if (wineProfile.body >= 3) score += 10;
    if (wineProfile.acidity >= 3) score += 10;
    if (wineProfile.oak >= 2) score += 5;
  }
  
  return score;
}

/**
 * Generate pairing explanation
 */
export function getPairingExplanation(
  wine: BottleWithWineInfo,
  wineProfile: WineProfile,
  foodProfile: FoodProfile,
  position: 'first' | 'middle' | 'last'
): string {
  const protein = foodProfile.protein;
  const sauce = foodProfile.sauce;
  const spice = foodProfile.spice;
  const smoke = foodProfile.smoke;
  
  // Position-based explanations
  if (position === 'first') {
    if (wineProfile.acidity >= 4) return 'Fresh opener - awakens the palate';
    if (wineProfile.body <= 2) return 'Light start - sets the stage';
    return 'Perfect warm-up wine';
  }
  
  if (position === 'last') {
    if (wineProfile.power >= 8) return 'Grand finale - bold and memorable';
    if (wineProfile.sweetness > 0) return 'Sweet ending note';
    return 'Perfect closing wine';
  }
  
  // Food-specific explanations
  if (protein === 'beef' || protein === 'lamb') {
    if (wineProfile.tannin >= 4 && wineProfile.body >= 4) {
      return 'Powerful match - tannins cut through rich meat';
    }
    if (wineProfile.body >= 4) {
      return 'Bold pairing - stands up to hearty flavors';
    }
  }
  
  if (sauce === 'tomato') {
    if (wineProfile.acidity >= 4) {
      return 'Bright acidity complements tomato perfectly';
    }
  }
  
  if (spice === 'high') {
    if (wineProfile.sweetness > 0) {
      return 'Touch of sweetness tames the heat';
    }
    if (wineProfile.tannin <= 3) {
      return 'Gentle structure won't amplify spice';
    }
  }
  
  if (smoke === 'high' || sauce === 'bbq') {
    if (wineProfile.oak >= 3) {
      return 'Oak echoes smoky flavors beautifully';
    }
    if (wineProfile.body >= 4) {
      return 'Rich body matches bold smokiness';
    }
  }
  
  if (protein === 'fish') {
    if (wineProfile.acidity >= 4) {
      return 'Crisp and refreshing with seafood';
    }
  }
  
  // Fallback based on wine characteristics
  if (wineProfile.power >= 7) return 'Main event wine - powerful and structured';
  if (wineProfile.acidity >= 4) return 'Refreshing lift between courses';
  if (wineProfile.oak >= 4) return 'Complex and layered';
  
  return 'Excellent choice for this moment';
}
