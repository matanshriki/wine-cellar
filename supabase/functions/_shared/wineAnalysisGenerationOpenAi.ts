/**
 * Shared OpenAI call for bottle sommelier analysis (single-bottle prompts).
 * Used by analyze-wine (user-facing, credits) and admin-only backfills (no credits).
 */

import {
  buildFallbackServingGuidance,
  buildWineAnalysisSystemPrompt,
  buildWineAnalysisUserPrompt,
  normalizeBarrelFields,
  normalizeServingGuidance,
  type BarrelAgingMetadata,
  type ServingGuidance,
  type WineAnalysisInput,
  type WineAnalysisMode,
} from './wineAiAnalysis.ts'

export interface WineDataForAnalysis {
  wine_name: string
  producer?: string
  vintage?: number
  region?: string
  country?: string
  appellation?: string
  grapes?: string[]
  color: string
  notes?: string
}

export interface AnalysisGenerationResult {
  analysis_summary: string
  analysis_reasons: string[]
  readiness_label: 'READY' | 'HOLD' | 'PEAK_SOON'
  serving_temp_c: number
  decant_minutes: number
  drink_window_start?: number
  drink_window_end?: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  assumptions?: string
  barrel_aging_note?: string | null
  barrel_aging_months_est?: number | null
  barrel_aging_confidence?: string | null
  barrel_aging_source?: string | null
  barrel_aging_metadata?: BarrelAgingMetadata | null
  serving?: ServingGuidance | null
  he_translations?: {
    wine_name?: string
    producer?: string
    region?: string
    country?: string
    appellation?: string
    grapes?: string[]
  }
}

export interface WineEnrichmentForAnalysis {
  regional_wine_style?: string | null
  wine_profile?: Record<string, unknown> | null
  rating?: number | null
  vivino_wine_id?: string | null
}

export async function generateWineAnalysisWithOpenAi(params: {
  openaiApiKey: string
  wineData: WineDataForAnalysis
  wineEnrichment: WineEnrichmentForAnalysis
  language: string
  /** Bottle's current serving_guidance — used when AI returns invalid serving */
  existingServingForFallback: Record<string, unknown> | null | undefined
  mode: WineAnalysisMode
}): Promise<{
  analysis: AnalysisGenerationResult
  usage: { prompt_tokens: number | null; completion_tokens: number | null }
}> {
  const { openaiApiKey, wineData, wineEnrichment, language, existingServingForFallback, mode } = params
  const currentYear = new Date().getFullYear()

  const systemPrompt = buildWineAnalysisSystemPrompt(mode, language)
  const userPrompt = buildWineAnalysisUserPrompt(
    {
      wine_name: wineData.wine_name,
      producer: wineData.producer,
      vintage: wineData.vintage,
      region: wineData.region,
      country: wineData.country,
      appellation: wineData.appellation,
      grapes: wineData.grapes,
      color: wineData.color,
      notes: wineData.notes,
      regional_wine_style: wineEnrichment.regional_wine_style ?? undefined,
      wine_profile: wineEnrichment.wine_profile as WineAnalysisInput['wine_profile'] ?? undefined,
      rating: wineEnrichment.rating ?? undefined,
      vivino_wine_id: wineEnrichment.vivino_wine_id ?? undefined,
    },
    currentYear,
    language,
    mode,
  )

  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  })

  if (!openaiResponse.ok) {
    const errorData = await openaiResponse.text()
    console.error('[wineAnalysisGenerationOpenAi] OpenAI API error:', errorData)
    throw new Error(`OpenAI API error: ${openaiResponse.status}`)
  }

  const openaiData = await openaiResponse.json()
  const content = openaiData.choices[0]?.message?.content

  if (!content) {
    throw new Error('No response from OpenAI')
  }

  const rawAnalysis = JSON.parse(content) as Record<string, unknown>
  const analysis = normalizeBarrelFields(rawAnalysis) as AnalysisGenerationResult

  if (!analysis.analysis_summary || !analysis.analysis_reasons || !analysis.readiness_label) {
    throw new Error('Invalid response structure from ChatGPT')
  }

  const normalizedServing = normalizeServingGuidance(analysis.serving)
  if (normalizedServing) {
    analysis.serving = normalizedServing
  } else {
    const existingServing = existingServingForFallback as Record<string, unknown> | null
    const existingConf = existingServing?.confidence
    const existingIsGood = existingConf === 'high' || existingConf === 'medium'

    if (existingIsGood) {
      console.log('[wineAnalysisGenerationOpenAi] AI serving invalid — preserved existing', existingConf,
        '-confidence guidance for wine:', wineData.wine_name)
      analysis.serving = existingServing as ServingGuidance
    } else {
      console.warn('[wineAnalysisGenerationOpenAi] AI serving invalid — using fallback for:', wineData.wine_name)
      analysis.serving = buildFallbackServingGuidance(
        wineData.color,
        wineData.vintage,
        currentYear,
        analysis.readiness_label,
      )
    }
  }

  return {
    analysis,
    usage: {
      prompt_tokens: openaiData.usage?.prompt_tokens ?? null,
      completion_tokens: openaiData.usage?.completion_tokens ?? null,
    },
  }
}
