/**
 * Supabase Edge Function: backfill-food-pairing
 *
 * Admin-only. Generates food_pairing for wines where it is still null.
 * Paginated + resumable — call repeatedly with increasing `offset`.
 *
 * Request body:
 * {
 *   batchSize?: number    — default 20, max 50 (per OpenAI rate-limit safety)
 *   offset?:   number    — default 0 (resume from here)
 *   force?:    boolean   — re-generate even if food_pairing already exists
 *   wine_id?:  string    — process only this single wine (ignores offset/batchSize)
 * }
 *
 * Response:
 * { processedCount, skippedCount, failedCount, fetchedCount, nextOffset, isComplete }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BACKFILL_CRON_SECRET = Deno.env.get('BACKFILL_CRON_SECRET')

const MAX_BATCH = 50
const DEFAULT_BATCH = 20
const MAX_CONCURRENT = 2   // conservative — avoids rate-limit bursts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Auth: accept either a cron secret header (for pg_cron) or a user JWT (for admin UI)
    const cronSecret = req.headers.get('x-cron-secret')
    const isCronCall = BACKFILL_CRON_SECRET && cronSecret === BACKFILL_CRON_SECRET

    if (!isCronCall) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
      if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

      // Admin gate
      const { data: adminRow } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!adminRow) return json({ error: 'Admin access required' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const batchSize = Math.min(body.batchSize ?? DEFAULT_BATCH, MAX_BATCH)
    const offset = body.offset ?? 0
    const force: boolean = body.force === true
    const singleWineId: string | null = body.wine_id ?? null
    const language: string = (typeof body.language === 'string' && body.language.length > 0)
      ? body.language
      : 'en'

    console.log(`[backfill-food-pairing] batchSize=${batchSize} offset=${offset} force=${force} wine_id=${singleWineId ?? 'all'} lang=${language}`)

    let query = supabase
      .from('wines')
      .select('id, wine_name, producer, vintage, country, region, appellation, color, grapes, notes, rating, regional_wine_style, user_id, food_pairing')

    if (singleWineId) {
      // Single-wine mode: ignore offset/batchSize/force checks, always regenerate
      query = query.eq('id', singleWineId)
    } else {
      query = query
        .order('created_at', { ascending: true })
        .range(offset, offset + batchSize - 1)
      if (!force) {
        query = query.is('food_pairing', null)
      }
    }

    const { data: wines, error: fetchErr } = await query
    if (fetchErr) {
      console.error('[backfill-food-pairing] Fetch error:', fetchErr)
      return json({ error: 'Failed to fetch wines' }, 500)
    }

    const fetched = wines?.length ?? 0
    let processedCount = 0
    let skippedCount = 0
    let failedCount = 0

    const forceRegenerate = force || singleWineId !== null

    for (let i = 0; i < (wines ?? []).length; i += MAX_CONCURRENT) {
      const chunk = (wines ?? []).slice(i, i + MAX_CONCURRENT)
      const results = await Promise.all(
        chunk.map((w: any) => processWine(w, supabase, forceRegenerate, language)),
      )
      for (const r of results) {
        if (r === 'success') processedCount++
        else if (r === 'skip') skippedCount++
        else failedCount++
      }
      // Small delay between chunks to respect rate limits
      if (i + MAX_CONCURRENT < (wines ?? []).length) {
        await new Promise((r) => setTimeout(r, 300))
      }
    }

    const isComplete = fetched < batchSize

    console.log(
      `[backfill-food-pairing] done processed=${processedCount} skipped=${skippedCount} failed=${failedCount} complete=${isComplete}`,
    )

    return json({ processedCount, skippedCount, failedCount, fetchedCount: fetched, nextOffset: offset + fetched, isComplete })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[backfill-food-pairing] Fatal:', err)
    return json({ error: message }, 500)
  }
})

async function processWine(
  wine: any,
  supabase: any,
  forceRegenerate: boolean,
  language: string,
): Promise<'success' | 'skip' | 'fail'> {
  try {
    if (!wine?.wine_name) return 'skip'

    // Language-aware skip: check if this specific language is already generated
    if (!forceRegenerate) {
      const fp = wine.food_pairing as Record<string, unknown> | null
      if (fp) {
        // New keyed format: { en: {...}, he: {...} }
        const hasKeyed = language in fp && (fp[language] as any)?.summary
        // Legacy flat format (English only)
        const hasLegacy = language === 'en' && fp.summary
        if (hasKeyed || hasLegacy) return 'skip'
      }
    }

    const pairing = await generateFoodPairing(wine, language)
    if (!pairing) return 'fail'

    // Merge language key into existing JSONB (preserve other languages)
    const existingFp = (wine.food_pairing ?? {}) as Record<string, unknown>
    const isLegacyFlat =
      !!(existingFp.summary) && !('en' in existingFp) && !('he' in existingFp)
    const keyedBase = isLegacyFlat ? { en: existingFp } : existingFp
    const mergedFp = { ...keyedBase, [language]: pairing }

    const { error } = await supabase
      .from('wines')
      .update({
        food_pairing: mergedFp,
        food_pairing_updated_at: new Date().toISOString(),
        food_pairing_confidence: pairing.confidence,
      })
      .eq('id', wine.id)

    if (error) {
      console.error('[backfill-food-pairing] DB update failed:', wine.id, error.message)
      return 'fail'
    }

    console.log(`[backfill-food-pairing] ✅ ${wine.wine_name} (${language})`)
    return 'success'
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[backfill-food-pairing] processWine error:', wine.id, msg)
    return 'fail'
  }
}

const LANGUAGE_NAMES: Record<string, string> = { he: 'Hebrew (עברית)', en: 'English' }

async function generateFoodPairing(wine: any, language = 'en'): Promise<Record<string, unknown> | null> {
  if (!OPENAI_API_KEY) return null

  const grapes = Array.isArray(wine.grapes)
    ? wine.grapes.join(', ')
    : typeof wine.grapes === 'string'
    ? wine.grapes
    : 'Unknown'

  const age = wine.vintage ? new Date().getFullYear() - wine.vintage : null

  const userPrompt = `Generate food pairing recommendations for this wine:

Wine: ${wine.wine_name}
Producer: ${wine.producer ?? 'Unknown'}
Vintage: ${wine.vintage ?? 'NV'}${age !== null ? ` (${age} years old)` : ''}
Country: ${wine.country ?? 'Unknown'}
Region: ${wine.region ?? 'Unknown'}
Appellation: ${wine.appellation ?? 'Unknown'}
Style: ${wine.color}
Grapes: ${grapes}
Regional Style: ${wine.regional_wine_style ?? 'Unknown'}
Vivino Rating: ${wine.rating ? `${wine.rating}/5` : 'Not rated'}
Notes: ${wine.notes?.trim() ? wine.notes : 'None'}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: (() => {
              const langName = LANGUAGE_NAMES[language] ?? 'English'
              const langInstruction = language === 'en'
                ? 'Respond in English.'
                : `Respond ENTIRELY in ${langName}. Every word — dish names, descriptions, explanations, and occasions — MUST be written in ${langName}. Do NOT use English.`
              return `You are an expert sommelier specializing in wine and food pairing.
Respond with valid JSON only using this structure:
{
  "summary": "2-sentence overview",
  "best_pairings": ["3-5 premium dishes"],
  "everyday_pairings": ["3-5 simple home dishes"],
  "avoid": ["2-4 food categories that clash"],
  "pairing_logic": "1-2 sentence explanation of pairing science",
  "occasion_fit": ["3-5 occasion examples"],
  "confidence": "low" | "med" | "high"
}
Be SPECIFIC to this wine. Use named dishes, not vague categories. ${langInstruction}`
            })(),
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' },
        max_tokens: 700,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    const raw = JSON.parse(content) as Record<string, unknown>
    return {
      summary: String(raw.summary ?? ''),
      best_pairings: Array.isArray(raw.best_pairings) ? raw.best_pairings.map(String) : [],
      everyday_pairings: Array.isArray(raw.everyday_pairings) ? raw.everyday_pairings.map(String) : [],
      avoid: Array.isArray(raw.avoid) ? raw.avoid.map(String) : [],
      pairing_logic: String(raw.pairing_logic ?? ''),
      occasion_fit: Array.isArray(raw.occasion_fit) ? raw.occasion_fit.map(String) : [],
      confidence: (['low', 'med', 'high'] as const).includes(raw.confidence as any)
        ? raw.confidence
        : 'med',
    }
  } catch {
    return null
  }
}
