/**
 * AI Analysis Service
 * 
 * Handles ChatGPT-powered sommelier notes generation and caching.
 * 
 * Features:
 * - Calls Supabase Edge Function to generate AI analysis
 * - Caches results in database (30-day freshness)
 * - Provides fallback to deterministic analysis if AI fails
 */

import { supabase } from '../lib/supabase';
import type { BottleWithWineInfo } from './bottleService';

export interface AIAnalysis {
  analysis_summary: string;
  analysis_reasons: string[];
  readiness_label: 'READY' | 'HOLD' | 'PEAK_SOON';
  serving_temp_c: number;
  decant_minutes: number;
  drink_window_start?: number | null;
  drink_window_end?: number | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  assumptions?: string | null;
  analyzed_at: string;
}

const CACHE_FRESHNESS_DAYS = 30;

/**
 * Check if existing analysis is still fresh (< 30 days old)
 */
export function isAnalysisFresh(analyzedAt: string): boolean {
  const analyzed = new Date(analyzedAt);
  const now = new Date();
  const daysDiff = (now.getTime() - analyzed.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff < CACHE_FRESHNESS_DAYS;
}

/**
 * Get existing analysis for a bottle
 * Analysis data is stored directly in the bottles table
 */
export async function getBottleAnalysis(bottleId: string): Promise<AIAnalysis | null> {
  const { data, error } = await supabase
    .from('bottles')
    .select('*')
    .eq('id', bottleId)
    .single();

  if (error || !data) {
    return null;
  }

  // Check if all AI fields are present
  if (!data.analysis_summary || !data.readiness_label) {
    return null;
  }

  return {
    analysis_summary: data.analysis_summary,
    analysis_reasons: data.analysis_reasons || [],
    readiness_label: data.readiness_label as 'READY' | 'HOLD' | 'PEAK_SOON',
    serving_temp_c: data.serve_temp_c,
    decant_minutes: data.decant_minutes,
    drink_window_start: data.drink_window_start,
    drink_window_end: data.drink_window_end,
    confidence: data.confidence as 'LOW' | 'MEDIUM' | 'HIGH',
    assumptions: data.assumptions,
    analyzed_at: data.analyzed_at || data.updated_at,
  };
}

/**
 * Generate AI analysis using ChatGPT via Supabase Edge Function
 * Falls back to deterministic analysis if Edge Function fails
 */
export async function generateAIAnalysis(bottle: BottleWithWineInfo): Promise<AIAnalysis> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  // Try AI analysis first
  try {
    // Prepare wine data for Edge Function
    const wineData = {
      wine_name: bottle.wine.wine_name,
      producer: bottle.wine.producer,
      vintage: bottle.wine.vintage,
      region: bottle.wine.region,
      grapes: bottle.wine.grapes,
      color: bottle.wine.color,
      notes: bottle.notes,
    };

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('analyze-wine', {
      body: {
        bottle_id: bottle.id,
        wine_data: wineData,
      },
    });

    if (error) {
      console.warn('Edge function not available, using fallback analysis:', error);
      throw error; // Trigger fallback
    }

    if (!data.success || !data.analysis) {
      console.warn('Invalid Edge function response, using fallback');
      throw new Error('Invalid response');
    }

    const analysis = data.analysis as AIAnalysis;
    
    // Store in database
    await storeAnalysis(bottle.id, analysis);
    
    return {
      ...analysis,
      analyzed_at: new Date().toISOString(),
    };
    
  } catch (error) {
    console.warn('AI analysis failed, using deterministic fallback:', error);
    
    // Fallback to deterministic analysis
    const fallbackAnalysis = generateDeterministicAnalysis(bottle);
    
    // Store in database
    await storeAnalysis(bottle.id, fallbackAnalysis);
    
    return {
      ...fallbackAnalysis,
      analyzed_at: new Date().toISOString(),
    };
  }
}

/**
 * Deterministic fallback analysis (when AI is unavailable)
 */
function generateDeterministicAnalysis(bottle: BottleWithWineInfo): AIAnalysis {
  const currentYear = new Date().getFullYear();
  const age = bottle.wine.vintage ? currentYear - bottle.wine.vintage : 0;
  const wineType = bottle.wine.color || 'red';
  
  let readinessLabel: 'READY' | 'HOLD' | 'PEAK_SOON' = 'READY';
  let servingTemp = 16;
  let decantMinutes = 30;
  let summary = '';
  let reasons: string[] = [];
  let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  let drinkStart: number | null = null;
  let drinkEnd: number | null = null;
  
  // Basic analysis based on type and age
  if (wineType === 'sparkling') {
    servingTemp = 6;
    decantMinutes = 0;
    if (age < 3) {
      readinessLabel = 'READY';
      summary = `This ${bottle.wine.wine_name} is fresh and ready to enjoy. Sparkling wines are best consumed young.`;
      reasons = ['Sparkling wines are typically best enjoyed within 2-3 years', 'Maintains vibrant bubbles and fresh fruit character'];
    } else {
      readinessLabel = 'READY';
      summary = `This ${bottle.wine.wine_name} is mature. Drink soon to enjoy remaining freshness.`;
      reasons = ['Older sparkling wine may lose some effervescence', 'Still enjoyable but past peak freshness'];
    }
  } else if (wineType === 'white' || wineType === 'rose') {
    servingTemp = wineType === 'white' ? 10 : 12;
    decantMinutes = 0;
    if (age < 2) {
      readinessLabel = 'READY';
      summary = `This ${bottle.wine.wine_name} is in its prime drinking window with bright, fresh characteristics.`;
      reasons = [`${age} year${age !== 1 ? 's' : ''} old - ideal for ${wineType} wines`, 'Maintains crisp acidity and fruit flavors'];
    } else if (age < 5) {
      readinessLabel = 'READY';
      summary = `This ${bottle.wine.wine_name} is mature and ready to drink.`;
      reasons = ['Developing complexity while maintaining freshness', 'Drink within the next year for best quality'];
    } else {
      readinessLabel = 'READY';
      summary = `This ${bottle.wine.wine_name} is quite mature. Drink soon.`;
      reasons = ['May be losing freshness', 'Best consumed promptly'];
      confidence = 'LOW';
    }
  } else { // red wine
    servingTemp = 16;
    if (age < 3) {
      readinessLabel = 'HOLD';
      decantMinutes = 60;
      summary = `This ${bottle.wine.wine_name} is still young. Consider holding for better development.`;
      reasons = [`Only ${age} year${age !== 1 ? 's' : ''} old`, 'Red wines often benefit from aging', 'Tannins are still settling'];
      drinkStart = currentYear + 2;
      drinkEnd = currentYear + 10;
    } else if (age < 8) {
      readinessLabel = 'READY';
      decantMinutes = 45;
      summary = `This ${bottle.wine.wine_name} is entering its drinking window. Well-balanced and developing nicely.`;
      reasons = [`At ${age} years, showing good maturity`, 'Tannins have softened', 'Fruit and structure in harmony'];
      drinkStart = currentYear;
      drinkEnd = currentYear + 8;
    } else if (age < 15) {
      readinessLabel = 'READY';
      decantMinutes = 30;
      summary = `This ${bottle.wine.wine_name} is at peak maturity. Excellent time to enjoy.`;
      reasons = [`${age} years of age - prime drinking window`, 'Developed complex tertiary aromas', 'Well-integrated tannins'];
      drinkStart = currentYear;
      drinkEnd = currentYear + 5;
    } else {
      readinessLabel = 'READY';
      decantMinutes = 15;
      summary = `This ${bottle.wine.wine_name} is fully mature. Drink soon while it's still showing well.`;
      reasons = [`At ${age} years, this wine is fully evolved`, 'May be past peak depending on storage', 'Best consumed promptly'];
      confidence = 'LOW';
      drinkStart = currentYear;
      drinkEnd = currentYear + 2;
    }
  }
  
  // Add region/producer context if available
  if (bottle.wine.region) {
    reasons.push(`From ${bottle.wine.region}`);
  }
  if (bottle.wine.grapes && Array.isArray(bottle.wine.grapes) && bottle.wine.grapes.length > 0) {
    reasons.push(`${bottle.wine.grapes.join(', ')} blend`);
  }
  
  return {
    analysis_summary: summary,
    analysis_reasons: reasons,
    readiness_label: readinessLabel,
    serving_temp_c: servingTemp,
    decant_minutes: decantMinutes,
    drink_window_start: drinkStart,
    drink_window_end: drinkEnd,
    confidence: confidence,
    assumptions: confidence === 'LOW' ? 'Analysis based on general wine aging principles. Actual condition depends on storage.' : null,
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * Store analysis in database
 */
async function storeAnalysis(bottleId: string, analysis: AIAnalysis): Promise<void> {
  const analysisData = {
    readiness_status: mapReadinessLabelToStatus(analysis.readiness_label),
    readiness_score: mapReadinessToScore(analysis.readiness_label),
    readiness_label: analysis.readiness_label,
    serve_temp_c: analysis.serving_temp_c,
    decant_minutes: analysis.decant_minutes,
    analysis_notes: analysis.analysis_summary,
    analysis_summary: analysis.analysis_summary,
    analysis_reasons: analysis.analysis_reasons,
    drink_window_start: analysis.drink_window_start,
    drink_window_end: analysis.drink_window_end,
    confidence: analysis.confidence,
    assumptions: analysis.assumptions,
    analyzed_at: new Date().toISOString(),
  };

  // Update the bottle with analysis data
  // @ts-ignore - Supabase type inference issue with update
  const { error: updateError } = await supabase
    .from('bottles')
    .update(analysisData)
    .eq('id', bottleId);

  if (updateError) {
    console.error('Failed to store analysis:', updateError);
    // Don't throw - we still have the analysis, just couldn't cache it
  }
}

/**
 * Get or generate analysis (with caching)
 */
export async function getOrGenerateAnalysis(bottle: BottleWithWineInfo): Promise<AIAnalysis> {
  // Check if we have existing analysis
  const existing = await getBottleAnalysis(bottle.id);

  // If fresh, return it
  if (existing && isAnalysisFresh(existing.analyzed_at)) {
    return existing;
  }

  // Otherwise, generate new analysis
  return generateAIAnalysis(bottle);
}

/**
 * Map readiness label to database status enum
 */
function mapReadinessLabelToStatus(label: string): string {
  switch (label) {
    case 'READY':
      return 'InWindow';
    case 'PEAK_SOON':
      return 'Approaching';
    case 'HOLD':
      return 'TooYoung';
    default:
      return 'Unknown';
  }
}

/**
 * Map readiness label to score (0-100)
 */
function mapReadinessToScore(label: string): number {
  switch (label) {
    case 'READY':
      return 90;
    case 'PEAK_SOON':
      return 75;
    case 'HOLD':
      return 60;
    default:
      return 50;
  }
}

