/**
 * AI Analysis Service
 * 
 * Handles ChatGPT-powered sommelier notes generation and caching.
 * 
 * Features:
 * - Calls Supabase Edge Function to generate AI analysis
 * - Caches results in database (30-day freshness)
 * - Provides fallback to deterministic analysis if AI fails
 * - Uses drinkWindowService for consistent, explainable drink window logic
 */

import { supabase } from '../lib/supabase';
import {
  isInsufficientCreditsError,
  throwIfInsufficientCreditsFromFunctionsInvokeError,
  throwIfInsufficientCreditsInDataPayload,
} from '../lib/insufficientCredits';
import type { BottleWithWineInfo } from './bottleService';
import * as drinkWindowService from './drinkWindowService';

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
  /** From wines row — populated after AI analysis (bulk or single) */
  barrel_aging_note?: string | null;
  barrel_aging_months_est?: number | null;
}

const CACHE_FRESHNESS_DAYS = 30;

/**
 * Parse barrel fields from analyze-wine JSON (handles missing keys / string months).
 */
function parseBarrelFromAnalysisPayload(a: Record<string, unknown>): {
  barrel_aging_note: string | null;
  barrel_aging_months_est: number | null;
} {
  const note = a.barrel_aging_note;
  let barrel_aging_note: string | null = null;
  if (typeof note === 'string' && note.trim()) barrel_aging_note = note.trim().slice(0, 2000);

  let barrel_aging_months_est: number | null = null;
  const m = a.barrel_aging_months_est;
  if (typeof m === 'number' && Number.isFinite(m)) barrel_aging_months_est = Math.round(m);
  else if (typeof m === 'string' && m.trim()) {
    const p = parseInt(m.trim(), 10);
    if (!Number.isNaN(p)) barrel_aging_months_est = p;
  } else if (m === null || m === undefined) barrel_aging_months_est = null;

  if (barrel_aging_months_est !== null && (barrel_aging_months_est < 0 || barrel_aging_months_est > 240)) {
    barrel_aging_months_est = null;
  }
  return { barrel_aging_note, barrel_aging_months_est };
}

/**
 * After analyze, overlay barrel fields from the API onto the fetched bottle so the UI
 * updates immediately even if the wines row or PostgREST cache lags behind.
 */
export function mergeBottleWineWithAnalysisBarrel(
  bottle: BottleWithWineInfo,
  analysis: AIAnalysis,
): BottleWithWineInfo {
  return {
    ...bottle,
    wine: {
      ...bottle.wine,
      barrel_aging_note: analysis.barrel_aging_note ?? null,
      barrel_aging_months_est: analysis.barrel_aging_months_est ?? null,
    },
  };
}

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
    .select(`
      *,
      wine:wines(barrel_aging_note, barrel_aging_months_est)
    `)
    .eq('id', bottleId)
    .single();

  if (error || !data) {
    return null;
  }

  // Check if all AI fields are present
  if (!data.analysis_summary || !data.readiness_label) {
    return null;
  }

  const wine = (data as { wine?: { barrel_aging_note?: string | null; barrel_aging_months_est?: number | null } }).wine;

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
    barrel_aging_note: wine?.barrel_aging_note ?? null,
    barrel_aging_months_est: wine?.barrel_aging_months_est ?? null,
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

  // Try AI analysis first
  try {
    const wineData = {
      wine_name: bottle.wine.wine_name,
      producer: bottle.wine.producer,
      vintage: bottle.wine.vintage,
      region: bottle.wine.region,
      country: (bottle.wine as any).country,
      appellation: (bottle.wine as any).appellation,
      grapes: bottle.wine.grapes,
      color: bottle.wine.color,
      notes: bottle.notes,
      language: language,
    };

    const { data, error } = await supabase.functions.invoke('analyze-wine', {
      body: {
        bottle_id: bottle.id,
        wine_id: bottle.wine_id,
        wine_data: wineData,
      },
    });

    if (error) {
      throwIfInsufficientCreditsFromFunctionsInvokeError(error);
      console.warn('Edge function not available, using fallback analysis:', error);
      throw error; // Trigger fallback
    }

    throwIfInsufficientCreditsInDataPayload(data as { success?: boolean; error?: string; message?: string });

    if (!data.success || !data.analysis) {
      console.warn('Invalid Edge function response, using fallback');
      throw new Error('Invalid response');
    }

    const raw = data.analysis as Record<string, unknown>;
    const barrel = parseBarrelFromAnalysisPayload(raw);
    const analysis: AIAnalysis = {
      ...(data.analysis as AIAnalysis),
      ...barrel,
    };

    // Store in database
    await storeAnalysis(bottle.id, analysis);

    // Mirror barrel fields on wines from the client too (covers edge update failures / RLS / cache lag).
    if (bottle.wine_id) {
      const { error: wineErr } = await supabase
        .from('wines')
        .update({
          barrel_aging_note: analysis.barrel_aging_note ?? null,
          barrel_aging_months_est: analysis.barrel_aging_months_est ?? null,
        })
        .eq('id', bottle.wine_id);
      if (wineErr) {
        console.warn('[AI Analysis] Client wines barrel update failed:', wineErr.message);
      }
    }

    return {
      ...analysis,
      analyzed_at: new Date().toISOString(),
    };
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      throw error;
    }
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
  const drinkWindow = drinkWindowService.computeDrinkWindow(bottle, {
    language,
    includeDebug: true,
  });
  
  // Determine serving temperature based on wine type
  const wineType = (bottle.wine.color || 'red').toLowerCase();
  let servingTemp = 16;
  let decantMinutes = 30;
  
  if (wineType.includes('sparkling')) {
    servingTemp = 6;
    decantMinutes = 0;
  } else if (wineType.includes('white')) {
    servingTemp = 10;
    decantMinutes = 0;
  } else if (wineType.includes('rose')) {
    servingTemp = 12;
    decantMinutes = 0;
  } else if (drinkWindow.readiness_label === 'HOLD') {
    decantMinutes = 60;
  } else if (drinkWindow.readiness_label === 'READY') {
    const age = drinkWindow._debug?.age || 0;
    if (age < 5) {
      decantMinutes = 45;
    } else if (age < 10) {
      decantMinutes = 30;
    } else {
      decantMinutes = 15;
    }
  }
  
  // Generate summary from reasons
  const t = (en: string, he: string) => language === 'he' ? he : en;
  const statusText = drinkWindow.readiness_label === 'READY' 
    ? t('ready to enjoy', 'מוכן ליהנות')
    : drinkWindow.readiness_label === 'HOLD'
    ? t('still young, consider aging', 'עדיין צעיר, כדאי להתיישן')
    : t('approaching peak', 'מתקרב לשיא');
  
  const summary = t(
    `This ${bottle.wine.wine_name} is ${statusText}. ${drinkWindow.reasons[0]}`,
    `${bottle.wine.wine_name} ${statusText}. ${drinkWindow.reasons[0]}`
  );
  
  return {
    analysis_summary: summary,
    analysis_reasons: drinkWindow.reasons,
    readiness_label: drinkWindow.readiness_label,
    serving_temp_c: servingTemp,
    decant_minutes: decantMinutes,
    drink_window_start: drinkWindow.drink_window_start,
    drink_window_end: drinkWindow.drink_window_end,
    confidence: drinkWindow.confidence,
    assumptions: drinkWindow.assumptions,
    analyzed_at: new Date().toISOString(),
    barrel_aging_note: null,
    barrel_aging_months_est: null,
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
  // Use getUser() to validate + auto-refresh the session before invoking the edge function
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Not authenticated');
  }

  try {
    const { data, error } = await supabase.functions.invoke('analyze-cellar', {
      body: {
        mode,
        limit,
        pageSize: 50,
        offset: 0,
        language: 'en',
      },
    });

    if (error) {
      throwIfInsufficientCreditsFromFunctionsInvokeError(error);
      console.error('[Bulk Analysis] Edge function error:', error);
      throw new Error(error.message || 'Failed to analyze cellar');
    }

    throwIfInsufficientCreditsInDataPayload(data as { success?: boolean; error?: string; message?: string });

    if (!data || !data.success) {
      console.error('[Bulk Analysis] Invalid response:', data);
      throw new Error(data?.error || 'Invalid response from server');
    }

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
 * Validate drink window consistency across vintages
 * 
 * Checks for logical inconsistencies like older vintages marked HOLD
 * while younger vintages are marked READY.
 */
export async function validateDrinkWindowConsistency(
  userId?: string
): Promise<{
  valid: boolean;
  issues: Array<{
    wine: string;
    producer: string;
    olderVintage: number;
    youngerVintage: number;
    issue: string;
  }>;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session && !userId) {
    throw new Error('Not authenticated');
  }
  
  // Fetch all analyzed bottles for the user
  const { data: bottles, error } = await supabase
    .from('bottles')
    .select(`
      id,
      wine_id,
      quantity,
      readiness_label,
      analyzed_at,
      wine:wines(
        wine_name,
        producer,
        vintage,
        color
      )
    `)
    .eq('user_id', userId || session!.user.id)
    .gt('quantity', 0)
    .not('readiness_label', 'is', null);
  
  if (error || !bottles) {
    console.error('[Validate Consistency] Error fetching bottles:', error);
    return { valid: true, issues: [] };
  }
  
  // Use drink window service validation
  const result = drinkWindowService.validateVintageConsistency(bottles as any);
  
  // Format issues for UI
  const formattedIssues = result.issues.map(issue => {
    // Find the bottles
    const older = bottles.find(b => (b.wine as any).vintage === issue.olderVintage);
    const younger = bottles.find(b => (b.wine as any).vintage === issue.youngerVintage);
    
    return {
      wine: (older?.wine as any)?.wine_name || 'Unknown',
      producer: (older?.wine as any)?.producer || 'Unknown',
      olderVintage: issue.olderVintage,
      youngerVintage: issue.youngerVintage,
      issue: issue.issue,
    };
  });
  
  if (!result.valid) {
    console.warn('[Validate Consistency] Found', formattedIssues.length, 'consistency issues');
  }
  
  return {
    valid: result.valid,
    issues: formattedIssues,
  };
}

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
    /** Match single-bottle analyze language ('en' | 'he') */
    language?: string;
  } = {}
): Promise<BulkAnalysisResult> {
  // Use getUser() to validate + auto-refresh the session before invoking the edge function
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  if (authError || !authUser) {
    throw new Error('Not authenticated');
  }
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) {
    throw new Error('Not authenticated');
  }

  const pageSize = options.pageSize || 50;
  const maxBottles = options.maxBottles || 1000; // Safety limit
  const onProgress = options.onProgress;
  const abortSignal = options.abortSignal;
  const language = options.language?.startsWith('he') ? 'he' : 'en';

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

    // Apply mode filters for accurate count (best-effort; stale_only is approximate since
    // we can't filter by age in a single Supabase query without a custom RPC)
    if (mode === 'missing_only') {
      countQuery.or('analysis_summary.is.null,readiness_label.is.null');
    } else if (mode === 'stale_only') {
      // Approximate: count only bottles that have been analyzed (a subset will be stale)
      countQuery.not('analyzed_at', 'is', null);
    }
    // 'all' mode: count everything — no extra filter needed

    const { count, error: countError } = await countQuery;

    if (!countError && count !== null) {
      totalEligible = Math.min(count, maxBottles);
    }
  } catch {
    // Proceed without total count — progress bar will show indeterminate
  }

  // Process in batches
  let offset = 0;
  let hasMore = true;
  let batchNumber = 0;

  while (hasMore && totalProcessed < maxBottles) {
    if (abortSignal?.aborted) throw new Error('Analysis cancelled');

    batchNumber++;
    const batchStart = Date.now();

    try {
      // Call edge function with pagination
      const { data, error } = await supabase.functions.invoke('analyze-cellar', {
        body: {
          mode,
          limit: Math.min(pageSize, maxBottles - totalProcessed), // Don't exceed max
          pageSize,
          offset,
          language,
        },
      });

      if (error) {
        throwIfInsufficientCreditsFromFunctionsInvokeError(error);
        console.error('[Batch Analysis] ❌ Batch error:', error);
        // Don't fail entire operation, just log and continue
        totalFailed += pageSize;
        break;
      }

      throwIfInsufficientCreditsInDataPayload(
        data as { success?: boolean; error?: string; message?: string },
      );

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
      void batchTime; // used only in dev logs

      // Update progress
      if (onProgress) {
        onProgress({
          processed: totalProcessed,
          total: totalEligible,
          failed: totalFailed,
          skipped: totalSkipped,
        });
      }

      // Check if we should continue.
      // We use `fetchedCount` (rows returned from DB) instead of results.length,
      // because results only contains eligible bottles (max 20 due to edge fn limit).
      // If the DB returned fewer rows than a full page, we've reached the end.
      const fetchedCount = data.fetchedCount ?? (data.results || []).length;
      hasMore = fetchedCount >= pageSize && totalProcessed < maxBottles;

      // Move to next page
      offset += pageSize;

      // Yield to browser to keep UI responsive
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

    } catch (error: any) {
      if (isInsufficientCreditsError(error)) throw error;
      console.error('[Batch Analysis] ❌ Batch failed:', error);
      // Don't fail entire operation
      totalFailed += pageSize;
      break;
    }
  }

  void (Date.now() - startTime); // elapsed available for diagnostics if needed

  return {
    success: true,
    processedCount: totalProcessed,
    skippedCount: totalSkipped,
    failedCount: totalFailed,
    results: allResults,
  };
}

