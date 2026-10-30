# Engagement release — manual handoff (corrected package)

You perform all Supabase operations. Do not paste JWTs, passwords, keys, or private user records into chat.

A passing local/preflight check is **not** production-ready until you finish real-session and browser checks below.

---

## Finding → fix

| Finding | Fix |
|---------|-----|
| Preflight verdict ignored column/RLS/signature failures | Single authoritative check set; any `required=false` blocks `PREFLIGHT_OK` |
| Migration not explicitly transactional | Top-level `BEGIN;` / `COMMIT;` in raw `.sql` |
| Chat cadence used `last_message_at` only | Per-message `timestamp` + non-empty user/assistant content same UTC day; incomplete timestamps → `incomplete_source_history` (suppresses decline risk) |
| Agent recs inconsistent | `chosen_bottle_ids` non-empty counts for activity, activation, counts, filters, timeline; overlap with runs documented (may over-count) |
| `durable_comparable` over-claimed | Renamed semantics to `observed_retained_comparable`; age≥56 is eligibility only |
| Activation rate implied 14d conversion | Labeled `lifetime_observed_among_age_ge_14d` + UI note |
| Scan failure start from `MIN(app_events)` | Instrumentation start = `unknown` |
| AI failures = any non-success | Only `failed` and `error` |
| Weak auth / PUBLIC grants | Fail-closed `IS NOT TRUE`; revoke PUBLIC+anon on data RPCs; helper inaccessible |
| Temp table not schema-qualified | `pg_temp._eng_activity` + `search_path = public, pg_temp` |
| Broad admin SELECT policies | Removed — dashboard uses RPCs only |
| Rollback dropped uncertain shared indexes | Only `idx_eng_*` + engagement functions; backup export for OR REPLACE |
| Post-check weak / wrong users smoke | Explicit pass/fail; fixed `admin_engagement_users(5,0)->>'total'`; SIMULATION labeled |

---

## Files to review / run (order)

1. `supabase/verification/engagement_preflight.sql`
2. `supabase/verification/engagement_pre_change_backup.sql` (save output if collisions / re-apply)
3. `supabase/migrations/20261030_admin_engagement_dashboard.sql`
4. `supabase/verification/engagement_post_migration_checks.sql`
5. Optional staging fixtures: `engagement_staging_fixtures.sql` (cleanup only if you seeded)
6. Browser + real-session auth (below)
7. Abort: `engagement_rollback.sql` (+ restore from backup if needed)

App/docs/tests (local): `AdminEngagement*`, `useAdminEngagement`, `engagementRules*`, `docs/admin-dashboard.md`.

---

## Manual checklist

### A. Preflight (SQL Editor)
- Expect `verdict = PREFLIGHT_OK` and **zero** `required_failures`.
- Review collision warnings; if functions already exist, run backup and save definitions.

### B. Backup (if re-apply / collisions)
- Run `engagement_pre_change_backup.sql`; store result offline.

### C. Apply migration
- Paste/run **only** `20261030_admin_engagement_dashboard.sql` (has `BEGIN`/`COMMIT`).
- Do not re-run the entire historical migrations folder blindly.

### D. Post-checks (SQL Editor — not auth proof)
- Expect `POSTCHECK_OK`.
- Confirm anon cannot EXECUTE data RPCs; authenticated can; helper neither.

### E. Real-session authorization (required)
Use PostgREST/app with real user sessions (not SQL Editor / service_role):

| Actor | Direct RPC | Expected |
|-------|------------|----------|
| Admin JWT | `admin_engagement_overview`, `users`, `user_detail` | Success |
| Non-admin JWT | same | `Unauthorized` (route denial alone insufficient) |
| Signed-out / anon key | same | Deny / Unauthorized |
| Any auth user | `touch_profile_last_active` | Only caller `last_active_at` |

### F. UI / regression (admin browser)
Populated/empty/partial/loading/error; filters/sort/pagination/drawer; mobile; HE/RTL; existing admin tabs still work.

### G. Optional fixtures
Seed/cleanup only via staging fixtures file; cleanup limited to those synthetic IDs you seeded.

### H. Types / build (your machine)
Optional `supabase gen types` after migrate. Local: `apps/web` vitest engagement suites + `npm run build`.

---

## Local validation already executed (this package)

| Layer | Result |
|-------|--------|
| Unit / parity / fixture / mock-state tests | Run in agent reply |
| Vite build | Run in agent reply |
| Isolated local Postgres migrate + fixtures + postcheck + rollback | Run in agent reply if `:54329` available |
| Remote Supabase Auth/PostgREST/browser | **Not performed** (you own these) |

Mocked UI contracts ≠ live Supabase.

---

## Remaining limitations / blockers

- Not production-ready until you complete A–F on your environment.
- Live agent recommendations come from `sommelier_recommendation_events` (non-empty `chosen_bottle_ids`). `recommendation_runs` has no active `apps/` writers found — counted only if historical rows exist; overlap may over-count (no shared id).
- Chat messages without parseable timestamps do not create cadence days.
- Scan-failure instrumentation start unknown (`bottle_scan_failed` via `trackEvent`; table exists since `20260505`).
- AI failure statuses counted: `failed`/`error` only (`blocked_*` excluded).
- Some Agent AI paths may still under-log to `ai_usage_events`.

---

## Non-sensitive results to return

Preflight verdict + failing object names; migrate success/error text; postcheck verdict; auth matrix pass/fail per actor (no tokens); UI checklist fails; RPC error strings like `Unauthorized`.

---

## Next action for you

1. Run `engagement_preflight.sql` on your **staging** project SQL Editor.  
2. If OK (and after backup if needed), apply `20261030_admin_engagement_dashboard.sql`.  
3. Run post-checks, then real-session RPC denial tests and browser Engagement validation.
