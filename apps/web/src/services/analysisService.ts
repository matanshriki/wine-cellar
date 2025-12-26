/**
 * Wine Analysis Service
 * 
 * Generates per-wine analysis based on wine characteristics.
 * This is a deterministic heuristic-based system (not AI) that provides
 * personalized insights for each bottle.
 * 
 * Factors considered:
 * - Wine type (red/white/rosé/sparkling)
 * - Vintage (age calculation)
 * - Region (if available)
 * - Grapes (if available)
 */

import type { BottleWithWineInfo } from './bottleService';

export interface WineAnalysisResult {
  readiness_status: 'TooYoung' | 'Approaching' | 'InWindow' | 'Peak' | 'PastPeak' | 'Unknown';
  readiness_score: number; // 0-100
  serve_temp_c: number;
  decant_minutes: number;
  analysis_notes: string;
  reasons: string[]; // Bullet points explaining the analysis
}

/**
 * Calculate wine age from vintage
 */
function calculateAge(vintage: number | null): number {
  if (!vintage) return 0;
  const currentYear = new Date().getFullYear();
  return currentYear - vintage;
}

/**
 * Determine optimal serving temperature based on wine type
 */
function getServingTemp(wineType: string): number {
  switch (wineType.toLowerCase()) {
    case 'sparkling':
      return 6; // 6-8°C for sparkling
    case 'white':
      return 10; // 10-12°C for white
    case 'rose':
      return 12; // 12-14°C for rosé
    case 'red':
      return 16; // 16-18°C for red
    default:
      return 14; // Default middle ground
  }
}

/**
 * Determine if wine needs decanting and for how long
 */
function getDecantTime(wineType: string, age: number): number {
  if (wineType.toLowerCase() !== 'red') {
    return 0; // Only red wines typically need decanting
  }
  
  if (age < 3) {
    return 60; // Young reds benefit from longer aeration
  } else if (age < 8) {
    return 30; // Medium-aged reds need moderate decanting
  } else if (age < 15) {
    return 15; // Older reds need gentle decanting
  } else {
    return 5; // Very old wines are fragile
  }
}

/**
 * Analyze wine readiness based on type and age
 */
function analyzeReadiness(
  wineType: string,
  age: number,
  region?: string
): {
  status: WineAnalysisResult['readiness_status'];
  score: number;
  reasons: string[];
} {
  const type = wineType.toLowerCase();
  const reasons: string[] = [];

  // Sparkling wines - best enjoyed young
  if (type === 'sparkling') {
    if (age < 2) {
      reasons.push('Sparkling wines are best enjoyed fresh and young');
      return { status: 'Peak', score: 95, reasons };
    } else if (age < 5) {
      reasons.push('Still excellent, though past peak freshness');
      return { status: 'InWindow', score: 85, reasons };
    } else {
      reasons.push('May have lost some of its sparkle and freshness');
      return { status: 'PastPeak', score: 65, reasons };
    }
  }

  // White wines - generally earlier drinking windows
  if (type === 'white') {
    if (age < 1) {
      reasons.push('Young and vibrant, perfect for immediate enjoyment');
      return { status: 'Peak', score: 92, reasons };
    } else if (age < 3) {
      reasons.push('In prime drinking window with good freshness');
      return { status: 'InWindow', score: 88, reasons };
    } else if (age < 6) {
      // Special regions like Burgundy, Alsace can age longer
      const ageWorthy = region && (
        region.toLowerCase().includes('burgundy') ||
        region.toLowerCase().includes('chablis') ||
        region.toLowerCase().includes('alsace') ||
        region.toLowerCase().includes('riesling')
      );
      
      if (ageWorthy) {
        reasons.push('Premium white from an age-worthy region, developing complexity');
        return { status: 'InWindow', score: 85, reasons };
      } else {
        reasons.push('May be losing freshness, drink soon');
        return { status: 'Approaching', score: 75, reasons };
      }
    } else {
      reasons.push('Likely past its peak unless from an exceptional vintage');
      return { status: 'PastPeak', score: 60, reasons };
    }
  }

  // Rosé - best enjoyed young and fresh
  if (type === 'rose') {
    if (age < 1) {
      reasons.push('Fresh and fruity, perfect for summer enjoyment');
      return { status: 'Peak', score: 95, reasons };
    } else if (age < 2) {
      reasons.push('Still good, but losing some freshness');
      return { status: 'InWindow', score: 80, reasons };
    } else {
      reasons.push('Past its prime, may lack vibrant fruit character');
      return { status: 'PastPeak', score: 65, reasons };
    }
  }

  // Red wines - more complex aging curves
  if (type === 'red') {
    // Check for premium aging regions
    const premiumRegion = region && (
      region.toLowerCase().includes('bordeaux') ||
      region.toLowerCase().includes('burgundy') ||
      region.toLowerCase().includes('barolo') ||
      region.toLowerCase().includes('brunello') ||
      region.toLowerCase().includes('rioja') ||
      region.toLowerCase().includes('napa')
    );

    if (age < 2) {
      reasons.push('Very young, primary fruit flavors still dominant');
      if (premiumRegion) {
        reasons.push('From a premium region - will benefit from cellaring');
        return { status: 'TooYoung', score: 70, reasons };
      } else {
        reasons.push('Approachable young, but can benefit from some aging');
        return { status: 'Approaching', score: 75, reasons };
      }
    } else if (age < 5) {
      reasons.push('Youthful with good structure, entering drinking window');
      return { status: 'InWindow', score: 85, reasons };
    } else if (age < 10) {
      reasons.push('In prime drinking window, showing excellent balance');
      if (premiumRegion) {
        reasons.push('Developing secondary complexity from aging');
      }
      return { status: 'Peak', score: 92, reasons };
    } else if (age < 15) {
      if (premiumRegion) {
        reasons.push('Mature wine with developed tertiary aromas');
        return { status: 'Peak', score: 90, reasons };
      } else {
        reasons.push('Fully mature, drink soon to enjoy remaining fruit');
        return { status: 'InWindow', score: 80, reasons };
      }
    } else if (age < 20) {
      if (premiumRegion) {
        reasons.push('Well-aged wine, likely at or past peak');
        return { status: 'InWindow', score: 78, reasons };
      } else {
        reasons.push('Quite old, may be fading - drink now if still good');
        return { status: 'PastPeak', score: 65, reasons };
      }
    } else {
      reasons.push('Very old wine - quality depends heavily on storage conditions');
      return { status: 'PastPeak', score: 60, reasons };
    }
  }

  // Default fallback
  reasons.push('Analysis based on general wine aging principles');
  return { status: 'Unknown', score: 70, reasons };
}

/**
 * Generate comprehensive wine analysis
 * 
 * This function creates a personalized analysis for each wine based on:
 * - Wine type (color)
 * - Vintage (age)
 * - Region
 * - Grapes
 * 
 * Returns structured analysis with readiness status, serving suggestions,
 * and explanatory reasons.
 */
export function analyzeWine(bottle: BottleWithWineInfo): WineAnalysisResult {
  const wine = bottle.wine;
  const age = calculateAge(wine.vintage);
  const wineType = wine.color || 'red';
  
  // Get readiness analysis
  const { status, score, reasons } = analyzeReadiness(
    wineType,
    age,
    wine.region || undefined
  );

  // Get serving recommendations
  const serveTemp = getServingTemp(wineType);
  const decantMinutes = getDecantTime(wineType, age);

  // Build analysis notes
  let notes = '';
  
  if (status === 'Peak') {
    notes = `This wine is at its peak. `;
  } else if (status === 'InWindow') {
    notes = `This wine is in its drinking window. `;
  } else if (status === 'Approaching') {
    notes = `This wine is approaching its ideal drinking window. `;
  } else if (status === 'TooYoung') {
    notes = `This wine is still young and will improve with age. `;
  } else if (status === 'PastPeak') {
    notes = `This wine may be past its peak. `;
  }

  // Add serving suggestions
  if (decantMinutes > 0) {
    notes += `Decant for ${decantMinutes} minutes before serving. `;
  }
  notes += `Serve at ${serveTemp}°C for optimal enjoyment.`;

  // Add region/grape context if available
  if (wine.region) {
    reasons.push(`From ${wine.region}`);
  }
  if (wine.grapes && Array.isArray(wine.grapes) && wine.grapes.length > 0) {
    reasons.push(`${wine.grapes.join(', ')} blend`);
  }

  return {
    readiness_status: status,
    readiness_score: score,
    serve_temp_c: serveTemp,
    decant_minutes: decantMinutes,
    analysis_notes: notes,
    reasons,
  };
}

