/**
 * Client-side helpers for `bottles.analysis_data` (mirrors
 * `supabase/functions/_shared/bottleAnalysisData.ts`).
 */

export type AnalysisDataLangKey = 'en' | 'he'

export function normalizeAnalysisDataLang(lang: string | undefined | null): AnalysisDataLangKey {
  return lang && String(lang).toLowerCase().startsWith('he') ? 'he' : 'en'
}

export interface AnalysisDataLangSlice {
  summary: string
  reasons: string[]
  serving_guidance: Record<string, unknown>
  assumptions: string | null
}

export function buildAnalysisDataSlice(params: {
  analysis_summary: string
  analysis_reasons: string[]
  assumptions?: string | null
  serving_guidance: Record<string, unknown>
}): AnalysisDataLangSlice {
  return {
    summary: params.analysis_summary,
    reasons: params.analysis_reasons,
    serving_guidance: params.serving_guidance,
    assumptions: params.assumptions ?? null,
  }
}

export function mergeAnalysisDataJson(
  existing: Record<string, unknown> | null | undefined,
  langKey: AnalysisDataLangKey,
  slice: AnalysisDataLangSlice,
): Record<string, unknown> {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? { ...existing }
    : {}
  return { ...base, [langKey]: slice }
}

export function isValidLangSlice(raw: unknown): raw is AnalysisDataLangSlice {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const s = (raw as Record<string, unknown>).summary
  return typeof s === 'string' && s.trim().length > 0
}

/** First language key in `order` that has a valid slice, else null. */
export function firstValidAnalysisLangKey(
  analysisData: Record<string, unknown> | null | undefined,
  order: readonly AnalysisDataLangKey[],
): AnalysisDataLangKey | null {
  if (!analysisData || typeof analysisData !== 'object') return null
  for (const k of order) {
    if (isValidLangSlice(analysisData[k])) return k
  }
  const keys = Object.keys(analysisData)
  for (const k of keys) {
    if (k === 'en' || k === 'he') {
      if (isValidLangSlice(analysisData[k])) return k as AnalysisDataLangKey
    }
  }
  return null
}
