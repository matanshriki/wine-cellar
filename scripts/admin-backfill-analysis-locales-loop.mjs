#!/usr/bin/env node
/**
 * Loop admin-backfill-analysis-locales until no more bottles need the target locale.
 *
 * Prerequisites:
 *   - Node 18+ (global fetch)
 *   - Your user must be in public.admins
 *   - Deploy admin-backfill-analysis-locales Edge function
 *
 * Env (required):
 *   SUPABASE_ACCESS_TOKEN A valid JWT for an admin user (same as logged-in app session)
 *
 * Env (optional if missing — loaded from apps/web/.env next to repo root):
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY
 *
 * Optional env:
 *   TARGET_LANGUAGE   he | en   (default: he)
 *   BATCH             1–5 per Edge call (default: 5; server caps at 5)
 *   SLEEP_MS          pause between calls (default: 800)
 *   MAX_ROUNDS        safety stop (default: 2000)
 *   DRY_RUN           if "1" or "true", only preview first batch and exit
 *
 * Get SUPABASE_ACCESS_TOKEN from the browser (while logged in as admin):
 *   DevTools → Application → Local Storage → key like sb-<ref>-auth-token → JSON → access_token
 *
 * Usage:
 *   export SUPABASE_ACCESS_TOKEN="eyJ..."
 *   node scripts/admin-backfill-analysis-locales-loop.mjs
 *
 * Or one line (zsh/bash), after copying token:
 *   SUPABASE_ACCESS_TOKEN='eyJ...' node scripts/admin-backfill-analysis-locales-loop.mjs
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Load KEY=value from .env into process.env (does not override existing). */
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

// apps/web/.env → VITE_SUPABASE_* for local runs
loadEnvFile(resolve(__dirname, '../apps/web/.env'))
if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL
}
if (!process.env.SUPABASE_ANON_KEY && process.env.VITE_SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
}

const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
const anon = process.env.SUPABASE_ANON_KEY
const token = process.env.SUPABASE_ACCESS_TOKEN
const target = (process.env.TARGET_LANGUAGE || 'he').toLowerCase().startsWith('he') ? 'he' : 'en'
const batch = Math.min(5, Math.max(1, Number(process.env.BATCH || 5) || 5))
const sleepMs = Math.max(0, Number(process.env.SLEEP_MS || 800) || 0)
const maxRounds = Math.max(1, Number(process.env.MAX_ROUNDS || 2000) || 2000)
const dryRun = ['1', 'true', 'yes'].includes(String(process.env.DRY_RUN || '').toLowerCase())

function needEnv(name, val) {
  if (!val) {
    console.error(`Missing env: ${name}`)
    process.exit(1)
  }
}

needEnv('SUPABASE_URL', url)
needEnv('SUPABASE_ANON_KEY', anon)
needEnv('SUPABASE_ACCESS_TOKEN', token)

const endpoint = `${url}/functions/v1/admin-backfill-analysis-locales`

async function sleep(ms) {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms))
}

async function oneRound(after) {
  const body = {
    target_language: target,
    limit: batch,
    dry_run: dryRun,
    ...(after ? { after } : {}),
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anon,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`HTTP ${res.status}: non-JSON body: ${text.slice(0, 400)}`)
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}: ${text.slice(0, 400)}`)
  }

  return data
}

let after = null
let totalProcessed = 0
let totalSkipped = 0
let totalFailed = 0
let rounds = 0

console.log(`Endpoint: ${endpoint}`)
console.log(`Target: analysis_data.${target}, batch=${batch}, dry_run=${dryRun}, sleep_ms=${sleepMs}`)

while (rounds < maxRounds) {
  rounds++
  const data = await oneRound(after)

  const p = data.processed_count ?? 0
  const s = data.skipped_count ?? 0
  const f = data.failed_count ?? 0
  const c = data.candidate_count ?? 0
  const more = !!data.has_more
  const next = data.next_after ?? null

  totalProcessed += p
  totalSkipped += s
  totalFailed += f

  console.log(
    `[${rounds}] candidates=${c} processed=${p} skipped=${s} failed=${f} ` +
      `has_more=${more} next_after=${next ?? 'null'}` +
      (data.limit_requested != null ? ` (limit_requested=${data.limit_requested} applied=${data.limit_applied})` : ''),
  )

  if (data.compute_note) console.log(`    note: ${data.compute_note}`)

  if (dryRun) {
    console.log('DRY_RUN set — stopping after first preview.')
    break
  }

  if (!more || c === 0) {
    console.log('Done (no more candidates or has_more=false).')
    break
  }

  if (!next) {
    console.warn('has_more is true but next_after is missing — stopping to avoid a tight loop.')
    break
  }

  after = next
  await sleep(sleepMs)
}

if (rounds >= maxRounds) {
  console.warn(`Stopped after MAX_ROUNDS=${maxRounds}. Re-run the script; cursor is last next_after in log.`)
}

console.log(
  `Totals: processed=${totalProcessed} skipped=${totalSkipped} failed=${totalFailed} (rounds=${rounds})`,
)
