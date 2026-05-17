#!/usr/bin/env node
/**
 * Loop `backfill-kosher-status` until it stops making progress or hits the daily Perplexity cap.
 *
 * What “all wines” means here
 * ----------------------------
 * The Edge function only enqueues wines that match its **priority passes** (Israel first, rule/med,
 * AI+null+trigger, then never-enriched **with** a Perplexity trigger). Generic non‑Israeli wines with
 * **no Kosher signal** are skipped on purpose (cost control). To stamp those rows you need
 * `detect-kosher-status` on bottle add/scan or a future “OpenAI-only” backfill — not this script.
 *
 * Daily cap
 * ---------
 * Respects `KOSHER_PERPLEXITY_DAILY_LIMIT` in Supabase Edge secrets (raise temporarily if needed).
 *
 * Prerequisites
 * -------------
 * - Node 18+ (global fetch)
 * - Deployed `backfill-kosher-status` Edge function
 * - Supabase secret `BACKFILL_ADMIN_SECRET` set (same value you pass here)
 *
 * Env (required)
 * --------------
 *   BACKFILL_ADMIN_SECRET — must match Supabase → Project Settings → Edge Functions → Secrets
 *
 * Env (loaded from files if unset — does not override existing shell env)
 * ------------------------------------------------------------------------
 *   apps/web/.env, apps/api/.env, repo-root .env — for:
 *     VITE_SUPABASE_URL / SUPABASE_URL
 *     VITE_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY
 *     BACKFILL_ADMIN_SECRET (optional if you only keep it in gitignored .env)
 *
 * Optional env
 * ------------
 *   BATCH           1–10 wines per Edge call (default: 10; server max 10)
 *   SLEEP_MS        pause between calls (default: 400)
 *   MAX_ROUNDS      safety stop (default: 500)
 *   ZERO_STOP       stop after N consecutive batches with 0 processed (default: 3)
 *   DRY_RUN         if "1" or "true", one batch with dry_run:true then exit
 *   ALLOW_INSECURE_TLS=1  Same as other admin scripts (corporate proxy)
 *   FETCH_TIMEOUT_MS      Per-request timeout (default: 480000)
 *
 * Usage
 * -----
 *   export BACKFILL_ADMIN_SECRET='your-secret'
 *   node scripts/kosher-backfill-loop.mjs
 *
 * Or add BACKFILL_ADMIN_SECRET to repo-root `.env` (gitignored) and:
 *   node scripts/kosher-backfill-loop.mjs
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val
    }
  }
}

loadEnvFile(resolve(__dirname, '../apps/web/.env'))
loadEnvFile(resolve(__dirname, '../apps/api/.env'))
loadEnvFile(resolve(__dirname, '../.env'))

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const backfillSecret = (process.env.BACKFILL_ADMIN_SECRET || '').trim()

const batch = Math.min(10, Math.max(1, Number(process.env.BATCH || 10) || 10))
const sleepMs = Math.max(0, Number(process.env.SLEEP_MS || 400) || 0)
const maxRounds = Math.max(1, Number(process.env.MAX_ROUNDS || 500) || 500)
const zeroStop = Math.max(1, Number(process.env.ZERO_STOP || 3) || 3)
const dryRun = ['1', 'true', 'yes'].includes(String(process.env.DRY_RUN || '').toLowerCase())
const fetchTimeoutMs = Math.max(10_000, Number(process.env.FETCH_TIMEOUT_MS || 480_000) || 480_000)

const allowInsecureTls = ['1', 'true', 'yes'].includes(
  String(process.env.ALLOW_INSECURE_TLS || '').toLowerCase(),
)
if (allowInsecureTls) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  console.warn(
    '\n⚠️  ALLOW_INSECURE_TLS=1 — TLS verification disabled for this process.\n',
  )
}

function needEnv(name, val) {
  if (!val) {
    console.error(`Missing env: ${name}`)
    process.exit(1)
  }
}

needEnv('SUPABASE_URL (or VITE_SUPABASE_URL)', url)
needEnv('SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)', anon)
needEnv('BACKFILL_ADMIN_SECRET', backfillSecret)

const endpoint = `${url}/functions/v1/backfill-kosher-status`

async function sleep(ms) {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms))
}

function fetchAbortAfter(ms) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    finish: () => clearTimeout(id),
  }
}

async function post(body) {
  const { signal, finish } = fetchAbortAfter(fetchTimeoutMs)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${anon}`,
        apikey: anon,
        'x-kosher-backfill-secret': backfillSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`Non-JSON response HTTP ${res.status}: ${text.slice(0, 400)}`)
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`)
    }
    return json
  } finally {
    finish()
  }
}

console.log(`Endpoint: ${endpoint}`)
console.log(`Batch: ${batch}, max rounds: ${maxRounds}, zero-stop: ${zeroStop}, dry_run: ${dryRun}\n`)

if (dryRun) {
  const d = await post({ dry_run: true, limit: batch })
  console.log(JSON.stringify(d, null, 2))
  process.exit(0)
}

let totalProcessed = 0
let zeros = 0

for (let i = 0; i < maxRounds; i++) {
  const d = await post({ limit: batch, dry_run: false })
  if (!d.success) {
    console.error('Backfill error:', d)
    process.exit(1)
  }
  const proc = Number(d.processed_count || 0)
  const sk = Number(d.skipped_count || 0)
  const hit = d.daily_limit_hit === true
  const du = d.daily_usage || {}
  totalProcessed += proc
  console.log(
    `round ${i + 1}: processed=${proc} skipped=${sk} daily_hit=${hit} used=${du.used}/${du.limit}`,
  )
  if (hit) {
    console.log('\nStopped: daily Perplexity limit reached. Raise KOSHER_PERPLEXITY_DAILY_LIMIT or run again tomorrow.')
    break
  }
  if (proc === 0) {
    zeros += 1
    if (zeros >= zeroStop) {
      console.log(
        `\nStopped: ${zeroStop} consecutive rounds with 0 processed (no more eligible candidates for this backfill, or all skipped).`,
      )
      break
    }
  } else {
    zeros = 0
  }
  await sleep(sleepMs)
}

console.log(`\nDone. Total wines processed this run: ${totalProcessed}`)
