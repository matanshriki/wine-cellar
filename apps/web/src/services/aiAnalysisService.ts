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
 * 
 * @param bottle - The bottle to analyze
 * @param language - Optional language code for generating notes ('en' or 'he'). Defaults to 'en'.
 */
export async function generateAIAnalysis(
  bottle: BottleWithWineInfo,
  language: string = 'en'
): Promise<AIAnalysis> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  console.log('[AI Analysis] Generating analysis in language:', language);

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
      language: language, // Pass language preference
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
    
    // Fallback to deterministic analysis with language support
    const fallbackAnalysis = generateDeterministicAnalysis(bottle, language);
    
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
 * 
 * @param bottle - The bottle to analyze
 * @param language - Language code ('en' or 'he')
 */
function generateDeterministicAnalysis(bottle: BottleWithWineInfo, language: string = 'en'): AIAnalysis {
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
  
  // Translations helper
  const t = (en: string, he: string) => language === 'he' ? he : en;
  
  // Basic analysis based on type and age
  if (wineType === 'sparkling') {
    servingTemp = 6;
    decantMinutes = 0;
    if (age < 3) {
      readinessLabel = 'READY';
      summary = t(
        `This ${bottle.wine.wine_name} is fresh and ready to enjoy. Sparkling wines are best consumed young.`,
        `${bottle.wine.wine_name} רענן ומוכן ליהנות. יינות מבעבעים מומלץ לצרוך צעירים.`
      );
      reasons = [
        t('Sparkling wines are typically best enjoyed within 2-3 years', 'יינות מבעבעים מומלץ לשתות תוך 2-3 שנים'),
        t('Maintains vibrant bubbles and fresh fruit character', 'שומר על בועות חיות ואופי פירותי רענן')
      ];
    } else {
      readinessLabel = 'READY';
      summary = t(
        `This ${bottle.wine.wine_name} is mature. Drink soon to enjoy remaining freshness.`,
        `${bottle.wine.wine_name} בשל. מומלץ לשתות בקרוב כדי ליהנות מהרעננות הנותרת.`
      );
      reasons = [
        t('Older sparkling wine may lose some effervescence', 'יין מבעבע מבוגר עלול לאבד חלק מהתוססות'),
        t('Still enjoyable but past peak freshness', 'עדיין נעים אך עבר את שיא הרעננות')
      ];
    }
  } else if (wineType === 'white' || wineType === 'rose') {
    servingTemp = wineType === 'white' ? 10 : 12;
    decantMinutes = 0;
    if (age < 2) {
      readinessLabel = 'READY';
      summary = t(
        `This ${bottle.wine.wine_name} is in its prime drinking window with bright, fresh characteristics.`,
        `${bottle.wine.wine_name} בחלון השתייה המושלם שלו עם מאפיינים רעננים ובהירים.`
      );
      reasons = [
        t(`${age} year${age !== 1 ? 's' : ''} old - ideal for ${wineType} wines`, `בן ${age} שנ${age !== 1 ? 'ים' : 'ה'} - אידיאלי ליינות ${wineType === 'white' ? 'לבנים' : 'רוזה'}`),
        t('Maintains crisp acidity and fruit flavors', 'שומר על חומציות חדה וטעמי פירות')
      ];
    } else if (age < 5) {
      readinessLabel = 'READY';
      summary = t(
        `This ${bottle.wine.wine_name} is mature and ready to drink.`,
        `${bottle.wine.wine_name} בשל ומוכן לשתייה.`
      );
      reasons = [
        t('Developing complexity while maintaining freshness', 'מפתח מורכבות תוך שמירה על רעננות'),
        t('Drink within the next year for best quality', 'מומלץ לשתות תוך שנה לאיכות מיטבית')
      ];
    } else {
      readinessLabel = 'READY';
      summary = t(
        `This ${bottle.wine.wine_name} is quite mature. Drink soon.`,
        `${bottle.wine.wine_name} די בשל. מומלץ לשתות בקרוב.`
      );
      reasons = [
        t('May be losing freshness', 'עלול לאבד רעננות'),
        t('Best consumed promptly', 'מומלץ לצרוך במהירות')
      ];
      confidence = 'LOW';
    }
  } else { // red wine
    servingTemp = 16;
    if (age < 3) {
      readinessLabel = 'HOLD';
      decantMinutes = 60;
      summary = t(
        `This ${bottle.wine.wine_name} is still young. Consider holding for better development.`,
        `${bottle.wine.wine_name} עדיין צעיר. כדאי להמתין להתפתחות טובה יותר.`
      );
      reasons = [
        t(`Only ${age} year${age !== 1 ? 's' : ''} old`, `רק בן ${age} שנ${age !== 1 ? 'ים' : 'ה'}`),
        t('Red wines often benefit from aging', 'יינות אדומים נהנים מהתיישנות'),
        t('Tannins are still settling', 'הטאנינים עדיין מתיישבים')
      ];
      drinkStart = currentYear + 2;
      drinkEnd = currentYear + 10;
    } else if (age < 8) {
      readinessLabel = 'READY';
      decantMinutes = 45;
      summary = t(
        `This ${bottle.wine.wine_name} is entering its drinking window. Well-balanced and developing nicely.`,
        `${bottle.wine.wine_name} נכנס לחלון השתייה שלו. מאוזן היטב ומתפתח יפה.`
      );
      reasons = [
        t(`At ${age} years, showing good maturity`, `בן ${age} שנים, מראה בשלות טובה`),
        t('Tannins have softened', 'הטאנינים התרככו'),
        t('Fruit and structure in harmony', 'פרי ומבנה בהרמוניה')
      ];
      drinkStart = currentYear;
      drinkEnd = currentYear + 8;
    } else if (age < 15) {
      readinessLabel = 'READY';
      decantMinutes = 30;
      summary = t(
        `This ${bottle.wine.wine_name} is at peak maturity. Excellent time to enjoy.`,
        `${bottle.wine.wine_name} בשיא הבשלות. זמן מצוין ליהנות.`
      );
      reasons = [
        t(`${age} years of age - prime drinking window`, `בן ${age} שנים - חלון שתייה מושלם`),
        t('Developed complex tertiary aromas', 'פיתח ארומות שלישוניות מורכבות'),
        t('Well-integrated tannins', 'טאנינים משולבים היטב')
      ];
      drinkStart = currentYear;
      drinkEnd = currentYear + 5;
    } else {
      readinessLabel = 'READY';
      decantMinutes = 15;
      summary = t(
        `This ${bottle.wine.wine_name} is fully mature. Drink soon while it's still showing well.`,
        `${bottle.wine.wine_name} בשל לחלוטין. מומלץ לשתות בקרוב בעודו מראה טוב.`
      );
      reasons = [
        t(`At ${age} years, this wine is fully evolved`, `בן ${age} שנים, יין זה התפתח לחלוטין`),
        t('May be past peak depending on storage', 'עלול להיות עבר שיא תלוי באחסון'),
        t('Best consumed promptly', 'מומלץ לצרוך במהירות')
      ];
      confidence = 'LOW';
      drinkStart = currentYear;
      drinkEnd = currentYear + 2;
    }
  }
  
  // Add region/producer context if available
  if (bottle.wine.region) {
    reasons.push(t(`From ${bottle.wine.region}`, `מאזור ${bottle.wine.region}`));
  }
  if (bottle.wine.grapes && Array.isArray(bottle.wine.grapes) && bottle.wine.grapes.length > 0) {
    reasons.push(t(`${bottle.wine.grapes.join(', ')} blend`, `תערובת ${bottle.wine.grapes.join(', ')}`));
  }
  
  const assumptions = confidence === 'LOW' 
    ? t(
        'Analysis based on general wine aging principles. Actual condition depends on storage.',
        'ניתוח מבוסס על עקרונות כלליים של התיישנות יין. המצב בפועל תלוי באחסון.'
      )
    : null;
  
  return {
    analysis_summary: summary,
    analysis_reasons: reasons,
    readiness_label: readinessLabel,
    serving_temp_c: servingTemp,
    decant_minutes: decantMinutes,
    drink_window_start: drinkStart,
    drink_window_end: drinkEnd,
    confidence: confidence,
    assumptions,
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

/**
 * Bulk cellar analysis types
 */
export type BulkAnalysisMode = 'missing_only' | 'stale_only' | 'all';

export interface BulkAnalysisResult {
  success: boolean;
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  results: Array<{
    bottle_id: string;
    wine_name: string;
    status: 'success' | 'skipped' | 'failed';
    error?: string;
  }>;
}

/**
 * Analyze entire cellar in bulk (legacy - single batch)
 * Generates sommelier notes for multiple bottles based on mode
 * @deprecated Use analyzeCellarInBatches for large cellars
 */
export async function analyzeCellarBulk(
  mode: BulkAnalysisMode = 'missing_only',
  limit?: number
): Promise<BulkAnalysisResult> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  console.log('[Bulk Analysis] Starting cellar analysis...', { mode, limit });

  try {
    const { data, error } = await supabase.functions.invoke('analyze-cellar', {
      body: {
        mode,
        limit,
        pageSize: 50,
        offset: 0,
      },
    });

    if (error) {
      console.error('[Bulk Analysis] Edge function error:', error);
      throw new Error(error.message || 'Failed to analyze cellar');
    }

    if (!data || !data.success) {
      console.error('[Bulk Analysis] Invalid response:', data);
      throw new Error(data?.error || 'Invalid response from server');
    }

    console.log('[Bulk Analysis] ✅ Complete:', {
      processed: data.processedCount,
      skipped: data.skippedCount,
      failed: data.failedCount,
    });

    return data as BulkAnalysisResult;

  } catch (error: any) {
    console.error('[Bulk Analysis] Failed:', error);
    throw error;
  }
}

/**
 * Progress callback for batch analysis
 */
export type AnalysisProgressCallback = (progress: {
  processed: number;
  total: number | null; // null if total unknown
  currentBottle?: string;
  failed: number;
  skipped: number;
}) => void;

/**
 * Analyze cellar in paginated batches with progress updates and cancellation
 * 
 * This prevents crashes on large cellars by:
 * - Processing wines in small batches
 * - Yielding to browser between batches
 * - Supporting cancellation
 * - Providing real-time progress updates
 */
export async function analyzeCellarInBatches(
  mode: BulkAnalysisMode = 'missing_only',
  options: {
    pageSize?: number;
    maxBottles?: number;
    onProgress?: AnalysisProgressCallback;
    abortSignal?: AbortSignal;
  } = {}
): Promise<BulkAnalysisResult> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  const pageSize = options.pageSize || 50;
  const maxBottles = options.maxBottles || 1000; // Safety limit
  const onProgress = options.onProgress;
  const abortSignal = options.abortSignal;

  console.log('[Batch Analysis] 🚀 Starting batch analysis', { mode, pageSize, maxBottles });
  const startTime = Date.now();

  // Aggregated results
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const allResults: Array<{
    bottle_id: string;
    wine_name: string;
    status: 'success' | 'skipped' | 'failed';
    error?: string;
  }> = [];

  // First, get total count of eligible bottles for progress tracking
  let totalEligible: number | null = null;
  try {
    const countQuery = supabase
      .from('bottles')
      .select('id, analysis_summary, readiness_label, analyzed_at', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .gt('quantity', 0);

    // Apply mode filters for accurate count
    if (mode === 'missing_only') {
      countQuery.or('analysis_summary.is.null,readiness_label.is.null');
    }

    const { count, error: countError } = await countQuery;

    if (!countError && count !== null) {
      totalEligible = Math.min(count, maxBottles);
      console.log('[Batch Analysis] 📊 Total eligible bottles:', totalEligible);
    }
  } catch (error) {
    console.warn('[Batch Analysis] ⚠️ Could not get total count, proceeding without it');
  }

  // Process in batches
  let offset = 0;
  let hasMore = true;
  let batchNumber = 0;

  while (hasMore && totalProcessed < maxBottles) {
    // Check for cancellation
    if (abortSignal?.aborted) {
      console.log('[Batch Analysis] ❌ Cancelled by user');
      throw new Error('Analysis cancelled');
    }

    batchNumber++;
    console.log('[Batch Analysis] 📦 Processing batch', batchNumber, 'offset:', offset);
    const batchStart = Date.now();

    try {
      // Call edge function with pagination
      const { data, error } = await supabase.functions.invoke('analyze-cellar', {
        body: {
          mode,
          limit: Math.min(pageSize, maxBottles - totalProcessed), // Don't exceed max
          pageSize,
          offset,
        },
      });

      if (error) {
        console.error('[Batch Analysis] ❌ Batch error:', error);
        // Don't fail entire operation, just log and continue
        totalFailed += pageSize;
        break;
      }

      if (!data || !data.success) {
        console.error('[Batch Analysis] ❌ Invalid batch response:', data);
        break;
      }

      // Aggregate results
      totalProcessed += data.processedCount || 0;
      totalSkipped += data.skippedCount || 0;
      totalFailed += data.failedCount || 0;
      allResults.push(...(data.results || []));

      const batchTime = Date.now() - batchStart;
      console.log('[Batch Analysis] ✅ Batch complete:', {
        batch: batchNumber,
        processed: data.processedCount,
        skipped: data.skippedCount,
        failed: data.failedCount,
        timeMs: batchTime,
      });

      // Update progress
      if (onProgress) {
        onProgress({
          processed: totalProcessed,
          total: totalEligible,
          failed: totalFailed,
          skipped: totalSkipped,
        });
      }

      // Check if we should continue
      const bottlesInBatch = (data.results || []).length;
      hasMore = bottlesInBatch >= pageSize && totalProcessed < maxBottles;
      
      if (!hasMore) {
        console.log('[Batch Analysis] 🏁 No more bottles to process');
      }

      // Move to next page
      offset += pageSize;

      // Yield to browser to keep UI responsive
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

    } catch (error: any) {
      console.error('[Batch Analysis] ❌ Batch failed:', error);
      // Don't fail entire operation
      totalFailed += pageSize;
      break;
    }
  }

  const totalTime = Date.now() - startTime;
  console.log('[Batch Analysis] 🎉 Complete!', {
    batches: batchNumber,
    totalProcessed,
    totalSkipped,
    totalFailed,
    totalTimeMs: totalTime,
    avgBatchTimeMs: Math.round(totalTime / batchNumber),
  });

  return {
    success: true,
    processedCount: totalProcessed,
    skippedCount: totalSkipped,
    failedCount: totalFailed,
    results: allResults,
  };
}

