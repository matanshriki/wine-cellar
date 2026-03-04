/**
 * backfill-wine-profiles
 *
 * Admin-only Edge Function that enriches wines.wine_profile with AI-generated
 * profiles for ALL users using OpenAI gpt-4o-mini.
 *
 * Designed to be called in a loop (via curl or a cron job) until hasMore = false.
 *
 * Auth: Pass the ADMIN_SECRET header (set the same value as a Supabase secret).
 *       Falls back to accepting any valid Supabase JWT from an admin user.
 *
 * POST body:
 * {
 *   mode?:       "missing_only"       // only wines with no wine_profile (default)
 *              | "upgrade_heuristic"  // also re-run wines that have source = "heuristic"
 *              | "force_all"          // reprocess every wine (expensive)
 *   batchSize?:  number               // wines per call, default 10, max 30
 *   offset?:     number               // starting row for pagination, default 0
 *   concurrency?: number              // parallel OpenAI calls, default 3, max 5
 * }
 *
 * Response:
 * {
 *   processed: number, skipped: number, failed: number,
 *   hasMore: boolean, nextOffset: number,
 *   results: [{ wine_id, wine_name, status, error? }]
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY         = Deno.env.get('OPENAI_API_KEY')!
const ADMIN_SECRET           = Deno.env.get('BACKFILL_ADMIN_SECRET') ?? ''   // optional extra guard

const MAX_BATCH   = 30
const DEFAULT_BATCH = 10
const MAX_CONCURRENCY = 5

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ─── Power formula (matches generate-wine-profile edge fn) ───────────────────
function computePower(p: { body: number; tannin: number; oak: number; acidity: number; sweetness: number }): number {
  const raw = p.body * 2 + p.tannin * 1.5 + p.oak * 1 + p.acidity * 0.8 + p.sweetness * 0.2
  return Math.round(Math.max(1, Math.min(10, raw / 2.0)))
}

// ─── OpenAI call for one wine ─────────────────────────────────────────────────
async function generateProfile(wine: any): Promise<any> {
  const grapesStr = Array.isArray(wine.grapes) ? wine.grapes.join(', ') : (wine.grapes ?? 'Unknown')

  const wineContext = [
    `Wine: ${wine.wine_name}${wine.vintage ? ` (${wine.vintage})` : ''}${wine.producer ? ` by ${wine.producer}` : ''}`,
    `Color: ${wine.color}`,
    wine.region  ? `Region: ${wine.region}`  : null,
    wine.country ? `Country: ${wine.country}` : null,
    grapesStr    ? `Grapes: ${grapesStr}`    : null,
    wine.regional_wine_style ? `Style: ${wine.regional_wine_style}` : null,
    wine.rating  ? `Vivino rating: ${wine.rating}/5` : null,
    wine.notes ? `Notes: ${wine.notes}` : null,
  ].filter(Boolean).join('\n')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: `You are a professional sommelier. Return ONLY a valid JSON object — no prose.

Provide a structured wine profile with:
- body (1-5): 1=very light, 5=very full
- tannin (1-5): 1=none, 5=very high
- acidity (1-5): 1=very low, 5=very high
- oak (1-5): 1=none/unoaked, 5=heavily oaked
- sweetness (0-5): 0=bone dry, 5=very sweet
- alcohol_est (number|null): estimated ABV %
- style_tags (array of 3-8 short kebab-case strings)
- confidence ("low"|"med"|"high")`,
        },
        {
          role: 'user',
          content: `Analyze this wine:\n\n${wineContext}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'wine_profile',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              body:         { type: 'integer', minimum: 1, maximum: 5 },
              tannin:       { type: 'integer', minimum: 1, maximum: 5 },
              acidity:      { type: 'integer', minimum: 1, maximum: 5 },
              oak:          { type: 'integer', minimum: 1, maximum: 5 },
              sweetness:    { type: 'integer', minimum: 0, maximum: 5 },
              alcohol_est:  { anyOf: [{ type: 'number' }, { type: 'null' }] },
              style_tags:   { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 8 },
              confidence:   { type: 'string', enum: ['low', 'med', 'high'] },
            },
            required: ['body','tannin','acidity','oak','sweetness','alcohol_est','style_tags','confidence'],
            additionalProperties: false,
          },
        },
      },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI ${response.status}: ${err.slice(0, 200)}`)
  }

  const data = await response.json()
  const aiProfile = JSON.parse(data.choices[0].message.content)
  return {
    ...aiProfile,
    power:      computePower(aiProfile),
    source:     'ai',
    updated_at: new Date().toISOString(),
  }
}

// ─── Process a single wine: generate + persist ────────────────────────────────
async function processWine(wine: any, supabase: any): Promise<{ wine_id: string; wine_name: string; status: string; error?: string }> {
  try {
    const profile = await generateProfile(wine)

    const { error } = await supabase
      .from('wines')
      .update({
        wine_profile:            profile,
        wine_profile_updated_at: new Date().toISOString(),
        wine_profile_source:     'ai',
        wine_profile_confidence:  profile.confidence,
      })
      .eq('id', wine.id)

    if (error) throw new Error(error.message)

    console.log(`[backfill-wine-profiles] ✅ ${wine.wine_name} (${wine.id})`)
    return { wine_id: wine.id, wine_name: wine.wine_name, status: 'success' }
  } catch (err: any) {
    console.error(`[backfill-wine-profiles] ❌ ${wine.wine_name}: ${err.message}`)
    return { wine_id: wine.id, wine_name: wine.wine_name, status: 'failed', error: err.message }
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // ── Auth: accept admin secret header OR a valid admin JWT ──────────────────
  const adminSecretHeader = req.headers.get('x-admin-secret') ?? ''
  const authHeader        = req.headers.get('Authorization') ?? ''

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let authed = false

  if (ADMIN_SECRET && adminSecretHeader === ADMIN_SECRET) {
    authed = true
  } else if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      authed = !!profile?.is_admin
    }
  }

  if (!authed) return json({ error: 'Unauthorized. Pass x-admin-secret header or an admin JWT.' }, 401)

  if (!OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY secret not configured' }, 500)

  // ── Parse request ──────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  const mode        = body.mode        ?? 'missing_only'   // missing_only | upgrade_heuristic | force_all
  const batchSize   = Math.min(body.batchSize  ?? DEFAULT_BATCH, MAX_BATCH)
  const offset      = body.offset      ?? 0
  const concurrency = Math.min(body.concurrency ?? 3, MAX_CONCURRENCY)

  console.log(`[backfill-wine-profiles] mode=${mode} batchSize=${batchSize} offset=${offset} concurrency=${concurrency}`)

  // ── Fetch eligible wines (across ALL users via service role) ────────────────
  let query = supabase
    .from('wines')
    .select('id, wine_name, producer, vintage, color, region, country, grapes, regional_wine_style, rating, notes, wine_profile_source')
    .order('created_at', { ascending: true })
    .range(offset, offset + batchSize - 1)

  if (mode === 'missing_only') {
    query = query.is('wine_profile', null)
  } else if (mode === 'upgrade_heuristic') {
    query = query.or('wine_profile.is.null,wine_profile_source.eq.heuristic')
  }
  // force_all: no extra filter

  const { data: wines, error: fetchErr } = await query

  if (fetchErr) return json({ error: `DB fetch failed: ${fetchErr.message}` }, 500)
  if (!wines || wines.length === 0) {
    return json({ processed: 0, skipped: 0, failed: 0, hasMore: false, nextOffset: offset, results: [] })
  }

  console.log(`[backfill-wine-profiles] Fetched ${wines.length} wines starting at offset ${offset}`)

  // ── Process in concurrent chunks ───────────────────────────────────────────
  const results: any[] = []

  for (let i = 0; i < wines.length; i += concurrency) {
    const chunk = wines.slice(i, i + concurrency)
    const chunkResults = await Promise.all(chunk.map((w: any) => processWine(w, supabase)))
    results.push(...chunkResults)

    // Small pause between chunks to stay within OpenAI rate limits
    if (i + concurrency < wines.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  const processed  = results.filter(r => r.status === 'success').length
  const failed     = results.filter(r => r.status === 'failed').length
  // hasMore: if the DB returned a full page, there may be more rows
  const hasMore    = wines.length >= batchSize
  const nextOffset = offset + wines.length

  console.log(`[backfill-wine-profiles] Done — processed=${processed} failed=${failed} hasMore=${hasMore} nextOffset=${nextOffset}`)

  return json({ processed, skipped: 0, failed, hasMore, nextOffset, results })
})
