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
import i18n from '../i18n/config';
import {
  isInsufficientCreditsError,
  throwIfInsufficientCreditsFromFunctionsInvokeError,
  throwIfInsufficientCreditsInDataPayload,
} from '../lib/insufficientCredits';
import type { BottleWithWineInfo } from './bottleService';
import * as drinkWindowService from './drinkWindowService';
import {
  buildAnalysisDataSlice,
  firstValidAnalysisLangKey,
  isValidLangSlice,
  mergeAnalysisDataJson,
  normalizeAnalysisDataLang,
  type AnalysisDataLangKey,
  type AnalysisDataLangSlice,
} from '../utils/bottleAnalysisData';

export type { AnalysisDataLangKey } from '../utils/bottleAnalysisData';
export { normalizeAnalysisDataLang };

/** Structured serving guidance stored on bottles.serving_guidance */
export interface ServingGuidance {
  temp_min: number;
  temp_max: number;
  decanting: 'recommended' | 'optional' | 'none';
  decant_min: number;
  decant_max: number;
  open_before_minutes: number;
  glassware: string;
  short_instruction: string;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  source_summary: string;
}

/** Barrel aging metadata stored on wines.barrel_aging_metadata */
export interface BarrelAgingMetadata {
  is_estimated: boolean;
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

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
  /** Structured per-wine serving guidance (new) */
  serving_guidance?: ServingGuidance | null;
  /** From wines row — populated after AI analysis (bulk or single) */
  barrel_aging_note?: string | null;
  barrel_aging_months_est?: number | null;
  barrel_aging_metadata?: BarrelAgingMetadata | null;
}

const CACHE_FRESHNESS_DAYS = 30;

/**
 * Parse barrel fields from analyze-wine JSON (handles missing keys / string months).
 */
function parseBarrelFromAnalysisPayload(a: Record<string, unknown>): {
  barrel_aging_note: string | null;
  barrel_aging_months_est: number | null;
  barrel_aging_metadata: BarrelAgingMetadata | null;
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

  // Parse barrel metadata
  let barrel_aging_metadata: BarrelAgingMetadata | null = null;
  const meta = a.barrel_aging_metadata;
  if (meta && typeof meta === 'object') {
    const m2 = meta as Record<string, unknown>;
    const validConf = ['high', 'medium', 'low'];
    barrel_aging_metadata = {
      is_estimated: typeof m2.is_estimated === 'boolean' ? m2.is_estimated : true,
      confidence: typeof m2.confidence === 'string' && validConf.includes(m2.confidence)
        ? (m2.confidence as 'high' | 'medium' | 'low')
        : 'medium',
      source: typeof m2.source === 'string' && m2.source.trim() ? m2.source.trim() : 'AI general knowledge',
    };
  }

  return { barrel_aging_note, barrel_aging_months_est, barrel_aging_metadata };
}

/**
 * Parse and validate serving guidance from the AI analysis payload.
 * Returns null if the payload is missing or malformed.
 */
export function parseServingGuidanceFromPayload(a: Record<string, unknown>): ServingGuidance | null {
  const s = a.serving;
  if (!s || typeof s !== 'object') return null;
  const sg = s as Record<string, unknown>;

  const tempMin = typeof sg.temp_min === 'number' && Number.isFinite(sg.temp_min) ? sg.temp_min : null;
  const tempMax = typeof sg.temp_max === 'number' && Number.isFinite(sg.temp_max) ? sg.temp_max : null;
  if (tempMin === null || tempMax === null) return null;

  const validDecanting = ['recommended', 'optional', 'none'];
  const decanting = typeof sg.decanting === 'string' && validDecanting.includes(sg.decanting)
    ? (sg.decanting as 'recommended' | 'optional' | 'none')
    : 'optional';

  const decantMin = typeof sg.decant_min === 'number' ? Math.max(0, sg.decant_min) : 0;
  const decantMax = typeof sg.decant_max === 'number' ? Math.max(0, sg.decant_max) : decantMin;
  const openBefore = typeof sg.open_before_minutes === 'number' ? Math.max(0, sg.open_before_minutes) : decantMax;

  const validConf = ['high', 'medium', 'low'];
  const confidence = typeof sg.confidence === 'string' && validConf.includes(sg.confidence)
    ? (sg.confidence as 'high' | 'medium' | 'low')
    : 'medium';

  return {
    temp_min: tempMin,
    temp_max: tempMax,
    decanting,
    decant_min: decantMin,
    decant_max: decantMax,
    open_before_minutes: openBefore,
    glassware: typeof sg.glassware === 'string' && sg.glassware.trim() ? sg.glassware.trim() : 'standard wine glass',
    short_instruction: typeof sg.short_instruction === 'string' ? sg.short_instruction.trim().slice(0, 500) : '',
    explanation: typeof sg.explanation === 'string' ? sg.explanation.trim().slice(0, 1000) : '',
    confidence,
    source_summary: typeof sg.source_summary === 'string' && sg.source_summary.trim()
      ? sg.source_summary.trim().slice(0, 500)
      : 'AI sommelier analysis',
  };
}

function looksLikeHebrewScript(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

/** Resolved prose + serving for the Wine Page from `analysis_data` with safe fallbacks. */
export interface LocalizedAnalysisView {
  analysis_summary: string;
  analysis_reasons: string[];
  serving_guidance: ServingGuidance | null;
  assumptions: string | null;
  /** Language bucket the displayed prose came from (best-effort for legacy-only). */
  contentLanguage: AnalysisDataLangKey;
  /** User may run analyze-wine to fill `analysis_data[requested]` without silent credit charges on language switch. */
  showsMissingLanguageCta: boolean;
}

/**
 * Centralized resolver for localized AI analysis text.
 * Order: requested locale → en → he → any valid slice in analysis_data → legacy flat columns.
 */
export function getLocalizedAnalysis(
  bottle: Record<string, unknown>,
  requestedUiLang: string,
): LocalizedAnalysisView | null {
  const readiness = bottle.readiness_label;
  if (!readiness || typeof readiness !== 'string') return null;

  const requested = normalizeAnalysisDataLang(requestedUiLang);
  const ad = bottle.analysis_data as Record<string, unknown> | null | undefined;

  let summary: string;
  let reasons: string[];
  let serving: ServingGuidance | null;
  let assumptions: string | null;
  let contentLanguage: AnalysisDataLangKey;

  const fromSlice = (slice: AnalysisDataLangSlice, lang: AnalysisDataLangKey) => {
    summary = slice.summary;
    reasons = slice.reasons;
    const sgRaw = slice.serving_guidance;
    const parsed = sgRaw && typeof sgRaw === 'object'
      ? parseServingGuidanceFromPayload({ serving: sgRaw as Record<string, unknown> })
      : null;
    const bottleServing = bottle.serving_guidance as ServingGuidance | null | undefined;
    serving = parsed ?? bottleServing ?? null;
    if (slice.assumptions === null || slice.assumptions === undefined) {
      assumptions = null;
    } else {
      assumptions = typeof slice.assumptions === 'string' ? slice.assumptions : String(slice.assumptions);
    }
    contentLanguage = lang;
  };

  if (ad && isValidLangSlice(ad[requested])) {
    fromSlice(ad[requested], requested);
  } else if (ad && isValidLangSlice(ad.en)) {
    fromSlice(ad.en, 'en');
  } else if (ad && isValidLangSlice(ad.he)) {
    fromSlice(ad.he, 'he');
  } else {
    const anyKey = firstValidAnalysisLangKey(ad, ['en', 'he']);
    if (anyKey && ad && isValidLangSlice(ad[anyKey])) {
      fromSlice(ad[anyKey], anyKey);
    } else if (typeof bottle.analysis_summary === 'string' && bottle.analysis_summary.trim()) {
      summary = bottle.analysis_summary;
      reasons = Array.isArray(bottle.analysis_reasons)
        ? (bottle.analysis_reasons as unknown[]).map(String)
        : [];
      serving = (bottle.serving_guidance as ServingGuidance | null) ?? null;
      assumptions = typeof bottle.assumptions === 'string' ? bottle.assumptions : null;
      contentLanguage = looksLikeHebrewScript(summary) ? 'he' : 'en';
    } else {
      return null;
    }
  }

  const hasRequestedSlice = !!(ad && isValidLangSlice(ad[requested]));
  let showsMissingLanguageCta = false;
  if (!hasRequestedSlice && summary.trim()) {
    if (requested === 'he') {
      showsMissingLanguageCta = true;
    } else {
      showsMissingLanguageCta = isValidLangSlice(ad?.he) || looksLikeHebrewScript(summary);
    }
  } else if (
    requested === 'en' &&
    hasRequestedSlice &&
    summary.trim() &&
    looksLikeHebrewScript(summary)
  ) {
    // Hebrew prose mis-keyed as `analysis_data.en` (e.g. legacy backfill) still satisfies
    // `hasRequestedSlice` — offer English regeneration so EN UI is not stuck without a CTA.
    showsMissingLanguageCta = true;
  }

  return {
    analysis_summary: summary,
    analysis_reasons: reasons,
    serving_guidance: serving,
    assumptions,
    contentLanguage,
    showsMissingLanguageCta,
  };
}
/**
 * Build a client-side fallback serving guidance object based on wine color and vintage.
 * Mirrors the edge function buildFallbackServingGuidance logic.
 */
function buildClientFallbackServing(
  color: string | null | undefined,
  vintage: number | null | undefined,
  readinessLabel?: string,
): ServingGuidance {
  const c = (color ?? 'red').toLowerCase();
  const currentYear = new Date().getFullYear();
  const age = vintage != null ? currentYear - vintage : null;

  if (c === 'sparkling') {
    return { temp_min: 6, temp_max: 9, decanting: 'none', decant_min: 0, decant_max: 0, open_before_minutes: 0, glassware: 'Champagne flute', short_instruction: 'Serve well chilled immediately.', explanation: 'Sparkling wines are served cold to preserve bubbles.', confidence: 'high', source_summary: 'Standard sparkling wine protocol.' };
  }
  if (c === 'white') {
    return { temp_min: 8, temp_max: 12, decanting: 'none', decant_min: 0, decant_max: 0, open_before_minutes: 0, glassware: 'White wine glass', short_instruction: 'Serve chilled.', explanation: 'White wines are served cold to highlight acidity and freshness.', confidence: 'medium', source_summary: 'Standard white wine protocol.' };
  }
  if (c === 'rose' || c === 'rosé') {
    return { temp_min: 8, temp_max: 12, decanting: 'none', decant_min: 0, decant_max: 0, open_before_minutes: 0, glassware: 'White or rosé wine glass', short_instruction: 'Serve well chilled.', explanation: 'Rosé is best enjoyed cold to preserve its delicate fruit character.', confidence: 'high', source_summary: 'Standard rosé protocol.' };
  }

  // Red wine
  if (age !== null && age > 25) {
    return { temp_min: 16, temp_max: 17, decanting: 'optional', decant_min: 10, decant_max: 20, open_before_minutes: 30, glassware: 'Large red wine glass', short_instruction: 'Stand upright, open gently, brief decant only if needed.', explanation: 'Very old wines are fragile — excessive oxygen can cause them to fade quickly.', confidence: 'medium', source_summary: 'Fallback for very old reds.' };
  }
  if (age !== null && age > 15) {
    return { temp_min: 16, temp_max: 17, decanting: 'optional', decant_min: 15, decant_max: 30, open_before_minutes: 30, glassware: 'Large red wine glass', short_instruction: 'Open 30 minutes before serving. Decant briefly if sediment present.', explanation: 'Mature reds benefit from careful handling rather than aggressive airing.', confidence: 'medium', source_summary: 'Fallback for mature reds.' };
  }
  if (age !== null && age > 8) {
    return { temp_min: 16, temp_max: 18, decanting: 'recommended', decant_min: 30, decant_max: 60, open_before_minutes: 60, glassware: 'Large red wine glass', short_instruction: 'Open 1 hour before serving and decant 30–60 minutes.', explanation: 'This red is approaching maturity and benefits from moderate aeration.', confidence: 'medium', source_summary: 'Fallback for medium-age reds.' };
  }
  if (readinessLabel === 'HOLD') {
    return { temp_min: 16, temp_max: 18, decanting: 'recommended', decant_min: 60, decant_max: 120, open_before_minutes: 90, glassware: 'Large Bordeaux glass', short_instruction: 'Open 90 minutes before serving and decant at least 1 hour.', explanation: 'Young tannic red needs extended airing to soften its tannins.', confidence: 'medium', source_summary: 'Fallback for young tannic reds.' };
  }
  return { temp_min: 16, temp_max: 18, decanting: 'recommended', decant_min: 30, decant_max: 60, open_before_minutes: 45, glassware: 'Large red wine glass', short_instruction: 'Open 45 minutes before serving.', explanation: 'Red wines benefit from some aeration before serving.', confidence: 'low', source_summary: 'Generic fallback — AI serving guidance was unavailable; based on wine color only.' };
}

/**
 * After analyze, overlay barrel + serving fields from the API onto the fetched bottle so the UI
 * updates immediately even if the DB or PostgREST cache lags behind.
 */
export function mergeBottleWineWithAnalysisBarrel(
  bottle: BottleWithWineInfo,
  analysis: AIAnalysis,
): BottleWithWineInfo {
  return {
    ...bottle,
    serving_guidance: analysis.serving_guidance ?? (bottle as any).serving_guidance ?? null,
    wine: {
      ...bottle.wine,
      barrel_aging_note: analysis.barrel_aging_note ?? null,
      barrel_aging_months_est: analysis.barrel_aging_months_est ?? null,
      barrel_aging_metadata: analysis.barrel_aging_metadata ?? null,
    },
  } as BottleWithWineInfo;
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
      wine:wines(barrel_aging_note, barrel_aging_months_est, barrel_aging_metadata)
    `)
    .eq('id', bottleId)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as unknown as Record<string, unknown> & {
    wine?: {
      barrel_aging_note?: string | null;
      barrel_aging_months_est?: number | null;
      barrel_aging_metadata?: BarrelAgingMetadata | null;
    };
  };

  if (!row.analysis_summary || !row.readiness_label) {
    return null;
  }

  const wine = row.wine;

  return {
    analysis_summary: row.analysis_summary as string,
    analysis_reasons: (row.analysis_reasons as string[]) || [],
    readiness_label: row.readiness_label as 'READY' | 'HOLD' | 'PEAK_SOON',
    serving_temp_c: row.serve_temp_c as number,
    decant_minutes: row.decant_minutes as number,
    serving_guidance: row.serving_guidance as ServingGuidance | null,
    drink_window_start: row.drink_window_start as number | null,
    drink_window_end: row.drink_window_end as number | null,
    confidence: row.confidence as 'LOW' | 'MEDIUM' | 'HIGH',
    assumptions: row.assumptions as string | null,
    analyzed_at: (row.analyzed_at as string) || (row.updated_at as string),
    barrel_aging_note: wine?.barrel_aging_note ?? null,
    barrel_aging_months_est: wine?.barrel_aging_months_est ?? null,
    barrel_aging_metadata: wine?.barrel_aging_metadata ?? null,
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

  const langNorm = normalizeAnalysisDataLang(language);

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
      language: langNorm,
    };

    const { data, error } = await supabase.functions.invoke('analyze-wine', {
      body: {
        bottle_id: bottle.id,
        wine_id: bottle.wine_id,
        wine_data: wineData,
      },
    });

    if (error) {
      await throwIfInsufficientCreditsFromFunctionsInvokeError(error);
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
    const parsedServing = parseServingGuidanceFromPayload(raw);

    // If the AI serving object was missing/malformed on the client side, prefer existing
    // good guidance over a generic client-side fallback.
    let servingGuidance: ServingGuidance;
    if (parsedServing) {
      servingGuidance = parsedServing;
    } else {
      const existingServing = (bottle as any).serving_guidance as ServingGuidance | null;
      const existingConf = existingServing?.confidence;
      if (existingConf === 'high' || existingConf === 'medium') {
        console.log('[AI Analysis] Client serving parse failed — preserved existing', existingConf,
          '-confidence guidance for bottle:', bottle.id);
        servingGuidance = existingServing!;
      } else {
        servingGuidance = buildClientFallbackServing(
          bottle.wine.color,
          bottle.wine.vintage,
          (data.analysis as AIAnalysis).readiness_label,
        );
      }
    }

    const analysis: AIAnalysis = {
      ...(data.analysis as AIAnalysis),
      ...barrel,
      serving_guidance: servingGuidance,
    };

    // Store in database
    await storeAnalysis(bottle.id, analysis, langNorm);

    // Mirror barrel fields on wines from the client too (covers edge update failures / RLS / cache lag).
    if (bottle.wine_id) {
      const { error: wineErr } = await supabase
        .from('wines')
        .update({
          barrel_aging_note: analysis.barrel_aging_note ?? null,
          barrel_aging_months_est: analysis.barrel_aging_months_est ?? null,
        } as never)
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

    // If the bottle already has good serving guidance from a prior successful analysis,
    // preserve it rather than overwriting with the generic deterministic fallback.
    // NOTE: bottle.serving_guidance is available here because generateAIAnalysis receives
    // the full BottleWithWineInfo object. If callers pass a partial object without
    // serving_guidance, this guard silently no-ops (existingServing is null/undefined).
    const existingServing = (bottle as any).serving_guidance as ServingGuidance | null;
    const existingConf = existingServing?.confidence;
    if (existingConf === 'high' || existingConf === 'medium') {
      console.log('[AI Analysis] Edge call failed — preserved existing', existingConf,
        '-confidence serving guidance for bottle:', bottle.id);
      fallbackAnalysis.serving_guidance = existingServing!;
      fallbackAnalysis.serving_temp_c = existingServing!.temp_min;
      fallbackAnalysis.decant_minutes = existingServing!.decant_min;
    }

    // Store in database
    await storeAnalysis(bottle.id, fallbackAnalysis, langNorm);

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

  const servingGuidance = buildClientFallbackServing(
    bottle.wine.color,
    bottle.wine.vintage,
    drinkWindow.readiness_label,
  );

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
    serving_temp_c: servingGuidance.temp_min,
    decant_minutes: servingGuidance.decant_min,
    serving_guidance: servingGuidance,
    drink_window_start: drinkWindow.drink_window_start,
    drink_window_end: drinkWindow.drink_window_end,
    confidence: drinkWindow.confidence,
    assumptions: drinkWindow.assumptions,
    analyzed_at: new Date().toISOString(),
    barrel_aging_note: null,
    barrel_aging_months_est: null,
    barrel_aging_metadata: null,
  };
}

/**
 * Store analysis in database (legacy columns + merged `analysis_data` locale slice).
 */
async function storeAnalysis(
  bottleId: string,
  analysis: AIAnalysis,
  language: string,
): Promise<void> {
  const langKey = normalizeAnalysisDataLang(language);

  const { data: existingRow } = await supabase
    .from('bottles')
    .select('analysis_data')
    .eq('id', bottleId)
    .single();

  const existingPayload = existingRow as { analysis_data?: unknown } | null | undefined;
  const rawAd = existingPayload?.analysis_data;
  const existing =
    rawAd && typeof rawAd === 'object' && !Array.isArray(rawAd)
      ? (rawAd as Record<string, unknown>)
      : null;
  const servingRecord = (analysis.serving_guidance ?? null) as unknown as Record<string, unknown>;
  const slice = buildAnalysisDataSlice({
    analysis_summary: analysis.analysis_summary,
    analysis_reasons: analysis.analysis_reasons,
    assumptions: analysis.assumptions ?? null,
    serving_guidance: servingRecord && typeof servingRecord === 'object' ? servingRecord : {},
  });
  const mergedAnalysisData = mergeAnalysisDataJson(existing, langKey, slice);

  const analysisData: Record<string, unknown> = {
    readiness_status: mapReadinessLabelToStatus(analysis.readiness_label),
    readiness_score: mapReadinessToScore(analysis.readiness_label),
    readiness_label: analysis.readiness_label,
    serve_temp_c: analysis.serving_guidance?.temp_min ?? analysis.serving_temp_c,
    decant_minutes: analysis.serving_guidance?.decant_min ?? analysis.decant_minutes,
    serving_guidance: analysis.serving_guidance ?? null,
    analysis_notes: analysis.analysis_summary,
    analysis_summary: analysis.analysis_summary,
    analysis_reasons: analysis.analysis_reasons,
    drink_window_start: analysis.drink_window_start,
    drink_window_end: analysis.drink_window_end,
    confidence: analysis.confidence,
    assumptions: analysis.assumptions,
    analyzed_at: new Date().toISOString(),
    analysis_data: mergedAnalysisData,
  };

  // Update the bottle with analysis data (bottles table has more columns than Database typings)
  const { error: updateError } = await supabase
    .from('bottles')
    .update(analysisData as never)
    .eq('id', bottleId);

  if (updateError) {
    console.error('Failed to store analysis:', updateError);
    // Don't throw - we still have the analysis, just couldn't cache it
  }
}

/**
 * Parse a raw analyze-wine edge response and persist the full analysis result
 * to the bottles table. Used by background callers (e.g., bottleService.createBottle)
 * that invoke the edge function directly and need to save readiness_status,
 * drink_window_start/end, and analysis_notes — fields the edge function does not
 * write itself (it only updates serving scalars + barrel fields).
 *
 * This is exported so bottleService.ts can call it without a circular runtime import.
 * (aiAnalysisService imports only `type BottleWithWineInfo` from bottleService, which
 * is elided at runtime.)
 */
export async function storeBottleAnalysisFromEdgeResponse(
  bottleId: string,
  rawAnalysis: Record<string, unknown>,
  language: string = 'he',
): Promise<void> {
  const barrel = parseBarrelFromAnalysisPayload(rawAnalysis);
  // The edge function always populates `serving` (AI or fallback), so prefer that.
  const servingGuidance = parseServingGuidanceFromPayload(rawAnalysis);

  const validReadiness = ['READY', 'HOLD', 'PEAK_SOON'];
  const readiness_label = (
    typeof rawAnalysis.readiness_label === 'string' &&
    validReadiness.includes(rawAnalysis.readiness_label)
      ? rawAnalysis.readiness_label
      : 'HOLD'
  ) as 'READY' | 'HOLD' | 'PEAK_SOON';

  const validConf = ['LOW', 'MEDIUM', 'HIGH'];
  const confidence = (
    typeof rawAnalysis.confidence === 'string' && validConf.includes(rawAnalysis.confidence)
      ? rawAnalysis.confidence
      : 'LOW'
  ) as 'LOW' | 'MEDIUM' | 'HIGH';

  const analysis: AIAnalysis = {
    analysis_summary: typeof rawAnalysis.analysis_summary === 'string' ? rawAnalysis.analysis_summary : '',
    analysis_reasons: Array.isArray(rawAnalysis.analysis_reasons)
      ? (rawAnalysis.analysis_reasons as string[])
      : [],
    readiness_label,
    serving_temp_c: servingGuidance?.temp_min ??
      (typeof rawAnalysis.serving_temp_c === 'number' ? rawAnalysis.serving_temp_c : 0),
    decant_minutes: servingGuidance?.decant_min ??
      (typeof rawAnalysis.decant_minutes === 'number' ? rawAnalysis.decant_minutes : 0),
    drink_window_start: typeof rawAnalysis.drink_window_start === 'number'
      ? rawAnalysis.drink_window_start : null,
    drink_window_end: typeof rawAnalysis.drink_window_end === 'number'
      ? rawAnalysis.drink_window_end : null,
    confidence,
    assumptions: typeof rawAnalysis.assumptions === 'string' ? rawAnalysis.assumptions : null,
    analyzed_at: new Date().toISOString(),
    serving_guidance: servingGuidance,
    ...barrel,
  };

  await storeAnalysis(bottleId, analysis, language);
}


export async function getOrGenerateAnalysis(bottle: BottleWithWineInfo): Promise<AIAnalysis> {
  // Check if we have existing analysis
  const existing = await getBottleAnalysis(bottle.id);

  // If fresh, return it
  if (existing && isAnalysisFresh(existing.analyzed_at)) {
    return existing;
  }

  // Otherwise, generate new analysis
  return generateAIAnalysis(bottle, i18n.language ?? 'en');
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
        language: normalizeAnalysisDataLang(i18n.language ?? 'en'),
      },
    });

    if (error) {
      await throwIfInsufficientCreditsFromFunctionsInvokeError(error);
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
    const list = bottles as unknown as Array<Record<string, unknown>>;
    // Find the bottles
    const older = list.find(b => (b.wine as { vintage?: number })?.vintage === issue.olderVintage);
    const younger = list.find(b => (b.wine as { vintage?: number })?.vintage === issue.youngerVintage);

    return {
      wine: (older?.wine as { wine_name?: string })?.wine_name || 'Unknown',
      producer: (older?.wine as { producer?: string })?.producer || 'Unknown',
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
  const language = normalizeAnalysisDataLang(options.language ?? i18n.language ?? 'en');

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
        await throwIfInsufficientCreditsFromFunctionsInvokeError(error);
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

