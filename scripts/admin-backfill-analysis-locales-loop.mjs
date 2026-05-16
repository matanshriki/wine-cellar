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
 *   SUPABASE_ACCESS_TOKEN — the **user session** JWT (GoTrue), NOT the anon key and NOT `sb_publishable_…`.
 *     In Local Storage, open `sb-…-auth-token` → JSON → field **`access_token`** (usually starts with `eyJ`).
 *     Decoded payload should show `"role":"authenticated"`. Keys with `"role":"anon"` are the wrong value.
 *
 * Env (optional if missing — loaded from apps/web/.env next to repo root):
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY  (this goes in the `apikey` header only)
 *
 * Optional env:
 *   TARGET_LANGUAGE   he | en   (default: he)
 *   BATCH             1–5 per Edge call (default: 5; server caps at 5)
 *   SLEEP_MS          pause between calls (default: 800)
 *   MAX_ROUNDS        safety stop (default: 2000)
 *   DRY_RUN           if "1" or "true", only preview first batch and exit
 *   ALLOW_INSECURE_TLS=1  If fetch fails with SELF_SIGNED_CERT_IN_CHAIN (corporate proxy), sets
 *     NODE_TLS_REJECT_UNAUTHORIZED=0 for this process only (no extra Node modules). Insecure.
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

/** Reject obvious wrong tokens (publishable key, anon JWT in Authorization, etc.). */
function assertUserAccessToken(accessToken, anonKey) {
  const t = accessToken.trim()
  if (t.startsWith('sb_publishable_') || t.startsWith('sb_secret_') || t.startsWith('sb_')) {
    console.error(
      '\nSUPABASE_ACCESS_TOKEN looks like a Supabase **sb_…** API key.\n' +
        'You need the **user session** JWT from Local Storage → sb-…-auth-token → JSON → **access_token** (eyJ…).\n',
    )
    process.exit(1)
  }
  if (anonKey && t === anonKey.trim()) {
    console.error(
      '\nSUPABASE_ACCESS_TOKEN must not be the same as the anon key.\n' +
        'Use **access_token** from the logged-in admin session (eyJ…, role "authenticated").\n',
    )
    process.exit(1)
  }
  const parts = t.split('.')
  if (parts.length !== 3) {
    console.error('\nSUPABASE_ACCESS_TOKEN should be a JWT with three dot-separated segments (eyJ…).\n')
    process.exit(1)
  }
  let payload = null
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  } catch {
    /* ignore */
  }
  if (payload?.role === 'anon') {
    console.error(
      '\nThis JWT has role "anon" — that is the **publishable/anon key**, not your login session.\n' +
        'Copy **access_token** from sb-…-auth-token while you are logged into the **web app** as an admin.\n',
    )
    process.exit(1)
  }
  if (payload?.role === 'service_role') {
    console.error(
      '\nDo not use the service_role key as Bearer; this script expects an **admin user** JWT for auth.getUser().\n',
    )
    process.exit(1)
  }
}

assertUserAccessToken(token, anon)

const allowInsecureTls = ['1', 'true', 'yes'].includes(
  String(process.env.ALLOW_INSECURE_TLS || '').toLowerCase(),
)

if (allowInsecureTls) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  console.warn(
    '\n⚠️  ALLOW_INSECURE_TLS=1 — NODE_TLS_REJECT_UNAUTHORIZED=0 for this process (TLS verification off).\n',
  )
}

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

  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    const code = err?.cause?.code ?? err?.code
    const msg = err?.message ?? String(err)
    if (code === 'SELF_SIGNED_CERT_IN_CHAIN' || msg.includes('SELF_SIGNED_CERT')) {
      throw new Error(
        `TLS error (${msg}). Try:\n` +
          `  ALLOW_INSECURE_TLS=1 SUPABASE_ACCESS_TOKEN='…' node scripts/admin-backfill-analysis-locales-loop.mjs\n` +
          '(Only on trusted networks; your proxy is intercepting HTTPS.)',
      )
    }
    throw err
  }

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
