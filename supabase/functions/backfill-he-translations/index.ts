/**
 * backfill-he-translations
 *
 * Admin-only Edge Function that adds Hebrew translations to wines that don't
 * have them yet. Calls GPT-4o-mini with a translation-only prompt (much cheaper
 * than a full re-analysis) and saves the result to wines.translations.he.
 *
 * Auth: Pass the admin JWT in the Authorization header.
 *       Caller must be admin (is_admin = true in profiles).
 *
 * POST body (all optional):
 * {
 *   batchSize?: number   // wines per call, default 10, max 20
 *   offset?:   number   // starting row, default 0
 *   dryRun?:   boolean  // if true, count & preview without calling OpenAI
 * }
 *
 * Response:
 * {
 *   processed: number, failed: number, skipped: number,
 *   hasMore: boolean, nextOffset: number, totalMissing: number,
 *   results: [{ wine_id, wine_name, status, error? }]
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY       = Deno.env.get('OPENAI_API_KEY')!

const MAX_BATCH     = 20
const DEFAULT_BATCH = 10

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface WineRow {
  id: string
  wine_name: string
  producer: string | null
  region: string | null
  country: string | null
  appellation: string | null
  grapes: string | string[] | null
  color: string | null
  translations: Record<string, unknown> | null
}

interface HeTranslations {
  wine_name?: string
  producer?: string
  region?: string
  country?: string
  appellation?: string
  grapes?: string[]
}

async function translateWine(wine: WineRow): Promise<HeTranslations | null> {
  const grapesList = Array.isArray(wine.grapes)
    ? wine.grapes.join(', ')
    : wine.grapes ?? 'Unknown'

  const prompt = `You are a wine expert. Translate/transliterate the following wine details into Hebrew.
For geographic names (country, region, appellation), use the standard Hebrew name (e.g. France → צרפת, Bordeaux → בורדו).
For wine names and producer names, use the common Hebrew transliteration used in Israeli wine shops.
For grape varieties, use the standard Hebrew wine terminology.

Wine details:
- Name: ${wine.wine_name}
- Producer: ${wine.producer ?? 'Unknown'}
- Region: ${wine.region ?? 'Unknown'}
- Country: ${wine.country ?? 'Unknown'}
- Appellation: ${wine.appellation ?? 'Unknown'}
- Grapes: ${grapesList}

Return ONLY a JSON object with these fields (all strings, grapes as array):
{
  "wine_name": "Hebrew transliteration of wine name",
  "producer": "Hebrew transliteration of producer",
  "region": "Hebrew name of region",
  "country": "Hebrew name of country",
  "appellation": "Hebrew transliteration of appellation, or null if unknown",
  "grapes": ["Hebrew names of grape varieties"]
}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 300,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI error ${response.status}: ${err.slice(0, 200)}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty OpenAI response')

  return JSON.parse(content) as HeTranslations
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  // Verify admin
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return json({ error: 'Admin access required' }, 403)

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { batchSize?: number; offset?: number; dryRun?: boolean } = {}
  try { body = await req.json() } catch { /* use defaults */ }

  const batchSize = Math.min(MAX_BATCH, Math.max(1, body.batchSize ?? DEFAULT_BATCH))
  const offset    = Math.max(0, body.offset ?? 0)
  const dryRun    = body.dryRun === true

  // ── Find wines missing he translations ───────────────────────────────────
  // Two queries: wines with NULL translations, and wines with translations but no 'he' key
  const selectFields = 'id, wine_name, producer, region, country, appellation, grapes, color, translations'

  const [{ data: nullRows, error: e1 }, { data: partialRows, error: e2 }] = await Promise.all([
    // Wines with no translations column at all
    admin.from('wines').select(selectFields).is('translations', null).order('id'),
    // Wines with translations but missing the 'he' key
    admin.from('wines').select(selectFields).not('translations', 'is', null).order('id'),
  ])

  if (e1 || e2) return json({ error: e1?.message ?? e2?.message }, 500)

  const partialMissingHe = (partialRows ?? []).filter(
    (w: WineRow) => !w.translations?.he
  )

  const allMissing: WineRow[] = [...(nullRows ?? []), ...partialMissingHe]
  // Sort by id for deterministic pagination
  allMissing.sort((a, b) => a.id.localeCompare(b.id))

  const totalMissing = allMissing.length
  const batch = allMissing.slice(offset, offset + batchSize)
  const hasMore = offset + batchSize < totalMissing

  if (dryRun || batch.length === 0) {
    return json({
      processed: 0, failed: 0, skipped: 0,
      hasMore, nextOffset: offset + batchSize, totalMissing,
      results: batch.map(w => ({ wine_id: w.id, wine_name: w.wine_name, status: 'preview' })),
    })
  }

  // ── Process batch ─────────────────────────────────────────────────────────
  const results: Array<{ wine_id: string; wine_name: string; status: string; error?: string }> = []
  let processed = 0, failed = 0

  for (const wine of batch) {
    try {
      const heTranslations = await translateWine(wine)
      if (!heTranslations) throw new Error('Null translation result')

      const existing = (wine.translations as Record<string, unknown>) ?? {}
      const merged = { ...existing, he: heTranslations }

      const { error: updateErr } = await admin
        .from('wines')
        .update({ translations: merged })
        .eq('id', wine.id)

      if (updateErr) throw new Error(updateErr.message)

      processed++
      results.push({ wine_id: wine.id, wine_name: wine.wine_name, status: 'ok' })
      console.log(`[backfill-he-translations] ✓ ${wine.wine_name} (${wine.id})`)
    } catch (err: unknown) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ wine_id: wine.id, wine_name: wine.wine_name, status: 'failed', error: msg })
      console.error(`[backfill-he-translations] ✗ ${wine.wine_name}: ${msg}`)
    }
  }

  return json({
    processed, failed, skipped: 0,
    hasMore, nextOffset: offset + batchSize, totalMissing,
    results,
  })
})
