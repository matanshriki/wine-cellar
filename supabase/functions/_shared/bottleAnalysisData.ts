/**
 * Per-locale bottle analysis snapshots stored in `bottles.analysis_data` (JSONB).
 * Legacy columns (`analysis_summary`, `analysis_reasons`, `serving_guidance`, `assumptions`)
 * remain the source of truth for filters and backward compatibility.
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

/** True if this locale bucket has a non-empty summary string (backfill / skip logic). */
export function isValidLangSlice(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const s = (raw as Record<string, unknown>).summary
  return typeof s === 'string' && s.trim().length > 0
}
