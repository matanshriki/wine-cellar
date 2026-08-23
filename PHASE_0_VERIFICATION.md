# Sommi — Phase 0 Verification & Remediation Design

**Date:** 2026-08-23  
**Status:** Design only — **no implementation**.  
**Inputs:** [TECHNICAL_AUDIT.md](TECHNICAL_AUDIT.md), repository inspection  
**Companion SQL:** [supabase/verification/phase_0_read_only_verification.sql](supabase/verification/phase_0_read_only_verification.sql)

---

## 0. Scope and constraints

This document:

- Resolves **how to verify** live-database gaps for SEC-001, DATA-001/002, SEC-003, SEC-004, MIG-001/002.
- Produces an **implementation-ready design** for remediation.
- Does **not** implement fixes.
- Does **not** authorize production SQL execution beyond the read-only script (manual, by you).
- Does **not** change application code, migrations, config, dependencies, or data.

---

## 1. Main live-verification questions

Answer these from the SQL results before any remediation PR:

| # | Question | Section | Decision impact |
|---|----------|---------|-----------------|
| Q1 | Does `profiles` UPDATE for `authenticated` lack a WITH CHECK / column guard / privilege-lock trigger? | A3–A6 | Confirms SEC-001 live |
| Q2 | Which privileged columns exist on live `profiles`? | A1, A9 | Batch 1 column list |
| Q3 | How many `is_admin = true` rows, and do they match the known admin roster? | A10–A12 | Pre-lockdown audit |
| Q4 | Does `shared_cellars` exist? Is SELECT `USING (true)`? Can anon SELECT? | B1–B10 | SEC-003 severity / Batch 4 |
| Q5 | Does `bottles_with_wine_info` exist? Does it reference `opened_at`? Does `bottles.opened_at` exist? | C1–C5 | MIG-001 repair strategy |
| Q6 | Is `20251231_fix_security_definer_view` recorded in `schema_migrations`? | C6, E1–E2 | Fresh-clone vs live repair path |
| Q7 | Do `wishlist_items` and `profiles.wishlist_enabled` exist? | D1–D7 | MIG-002 / Batch 3 |
| Q8 | Were baby-tracker / manual filenames applied? | E1–E3 | Quarantine plan |
| Q9 | Is `pg_cron` installed with `reset-monthly-credits`? | F1–F3 | Ops reliability (related, not P0 security) |
| Q10 | Which SECURITY DEFINER functions lack `search_path`? | G1–G2 | SEC-005 in Batch 1/3 |
| Q11 | Does `consumption_history` already have `status` / `idempotency_key` / `undone_at`? | H1 | Inventory RPC schema delta |
| Q12 | Gateway JWT for Vivino functions | *Not in SQL* — Dashboard / CLI | SEC-004 live status |

**Repository-confirmed (no live SQL needed for design, but live still confirms):**

- Multi-bottle undo bug (DATA-001): `historyService.ts` always restores `+1`.
- Vivino functions lack in-function auth (SEC-004): `fetch-vivino-data`, `search-vivino-wine`.
- `config.toml` does **not** set `verify_jwt = false` for Vivino → **default gateway JWT verify is likely true**; anon JWT may still invoke. **Live status unverified.**

---

## 2. Manual order for running the SQL safely

1. Open **Supabase Dashboard → SQL Editor** on the target project (staging preferred first; production only when intentional).
2. Open [supabase/verification/phase_0_read_only_verification.sql](supabase/verification/phase_0_read_only_verification.sql).
3. Prefer **section-by-section** execution (A → H). The file uses only SELECT/catalog reads; optional objects are annotated with **SKIP IF missing**.
4. **Skip rules:**
   - Skip **A10–A11** if `is_admin` column missing (A9).
   - Skip **A12b** if A12 `admins_table_exists` is false.
   - Skip **B2–B10** (except B1) if B1 is false.
   - Skip **C2–C3** if C1 is false.
   - Skip **D3–D6** if D1 is false.
   - Skip **E1–E2, C6, D7** if `supabase_migrations.schema_migrations` errors (note “history table missing”).
   - Skip **F2** if F1 is false.
   - Skip **H2–H4** if `consumption_history` / `bottles` missing (E3).
5. Export each result grid (CSV or screenshots). Redact A11 emails if sharing externally.
6. **Do not** run the exploit procedure in §3.1 unless you explicitly approve a state-changing test.

---

## 3. Results you should return

Return (paste or attach):

1. **A1, A2, A3, A4, A5, A7, A9** — profiles columns, grants, policies, triggers, `is_admin` definer/search_path.
2. **A10** count; **A11** only if comfortable (or redact emails → ids only).
3. **A12 / A12b** dual-admin status.
4. **B1 + B5 + B6 + B8 + B10** — shared_cellars existence, policies, grants, counts, anon risk heuristics.
5. **C1–C5** (+ C6 if available) — view / `opened_at` / migration match.
6. **D1–D2** (+ D5 if table exists).
7. **E1** full migration version list (or truncated with note) + **E2** suspect matches + **E3** object inventory.
8. **F1–F3** cron status.
9. **G1** full DEFINER inventory (or “missing search_path” subset).
10. **H1–H2** history schema + aggregates.

Optional: Dashboard note for Vivino function JWT setting (Q12).

---

## 3.1 Manual exploit-verification procedure (STATE-CHANGING — NOT in SQL file)

> **Do not run without explicit approval.** Uses a disposable non-admin account. Rolls back by clearing flags.

**Goal:** Prove whether PostgREST allows `authenticated` to set `profiles.is_admin = true`.

**Preconditions:** Disposable Google/test user that is **not** an intended admin. Note original profile flags.

**Steps (browser console or script with that user’s session):**

```js
// 1) Confirm not admin
const { data: before } = await supabase.from('profiles').select('is_admin, cellar_agent_enabled').single();
console.log('before', before);

// 2) Attempt privilege write
const { data: after, error } = await supabase
  .from('profiles')
  .update({ is_admin: true, cellar_agent_enabled: true })
  .eq('id', (await supabase.auth.getUser()).data.user.id)
  .select('is_admin, cellar_agent_enabled')
  .single();
console.log('after', after, error);

// 3) If is_admin became true — CRITICAL confirmed. Immediately revert:
await supabase.from('profiles').update({ is_admin: false }).eq('id', (await supabase.auth.getUser()).data.user.id);
// Revert other flags to `before` values as needed.
```

**Also test INSERT/upsert path:**

```js
await supabase.from('profiles').upsert({
  id: userId,
  display_name: 'probe',
  is_admin: true,
});
```

**Interpretation:**

| Result | Meaning |
|--------|---------|
| Update succeeds with `is_admin: true` | SEC-001 **live confirmed** |
| Update errors / column ignored / value stays false | Guard exists live (not in repo) — capture error text |
| Upsert creates privileged values | INSERT path also unsafe |

**Cleanup:** Ensure test account `is_admin = false` and flags restored. Delete test account if policy allows.

---

# Part 2 — Remediation design

## 4. SEC-001 — Privileged profile-column escalation

### 4.1 Privileged column inventory (repository)

| Column | Classification | Legitimate writers today |
|--------|----------------|--------------------------|
| `is_admin` | **Hard privileged** | SQL editor / service role; `sync_admin_to_profiles` trigger on `admins` |
| `ai_label_art_enabled` | Feature flag | Manual SQL / ops only (UI only reads) |
| `cellar_agent_enabled` | Feature flag | Manual SQL / ops (`20260302` default for new users) |
| `csv_import_enabled` | Feature flag | Manual SQL / ops |
| `plan_evening_enabled` | Feature flag | Manual SQL / ops |
| `can_multi_bottle_import` | Feature flag | Manual SQL / ops |
| `can_share_cellar` | Feature flag | Manual SQL / ops |
| `wishlist_enabled` | Feature flag | Manual SQL / ops (column may live outside canonical migrations) |

**Semi-privileged / spoofable (include in Batch 1 lockdown):**

| Column | Risk | Legitimate writers |
|--------|------|-------------------|
| `signup_source`, `signup_medium`, `signup_campaign` | Attribution fraud | Client once-null update in `SupabaseAuthContext.tsx` |
| `last_active_at` | Analytics spoof | Intended server/ops (migration comment); verify live writers |

**User-owned (must remain writable by authenticated owner):**

`display_name`, `first_name`, `last_name`, `email`, `avatar_url`, `preferred_language`, `preferred_currency`, `cookie_consent_*`, `analytics_enabled`, `theme_preference`, `taste_profile*` (via `tasteProfileService`), and other non-flag profile fields present live (confirm via A1).

### 4.2 Legitimate code paths that UPDATE `profiles`

| Path | Fields | Role |
|------|--------|------|
| `profileService.updateMyProfile` / ProfilePage | name, avatar, language, currency | authenticated |
| `profileService.upsertMyProfile` / getOrCreateProfile insert | identity fields | authenticated |
| `AvatarUpload.tsx` | `avatar_url` | authenticated |
| `CookieConsent.tsx` | consent fields | authenticated |
| `ThemeContext.tsx` | `theme_preference` | authenticated |
| `tasteProfileService.ts` | `taste_profile*` | authenticated |
| `SupabaseAuthContext.tsx` | signup attribution (null-only) | authenticated |
| Feature flags / admin UI | **read only** | — |
| Edge admin checks | **read** `is_admin` | — |
| `sync_admin_to_profiles` (DB) | `is_admin` | SECURITY DEFINER |
| Ops SQL / service_role | flags, admin | service_role |

**Credits / entitlements are already separate** (`user_entitlements`, `user_ai_credits` — SELECT-only for users). Do not conflate with profiles flags.

### 4.3 Approach comparison

| Approach | Pros | Cons | Fit for Sommi |
|----------|------|------|---------------|
| **1. Column-level UPDATE/INSERT grants** | Enforced by Postgres; PostgREST cannot touch revoked columns; no trigger logic | Must enumerate every safe column; new columns need grant updates; easy to miss INSERT grants | Strong, but brittle as schema evolves |
| **2. BEFORE UPDATE (+ INSERT) trigger** | Central allow/deny list; easy to add columns; works with broad table grants | Must correctly allow service_role / DEFINER admin sync; bugs can lock admins out | **Best emergency + durable primary** |
| **3. Move flags to entitlement table** | Aligns with credits pattern; clean long-term | Large app/migration change; doesn’t fix today | **Phase 2 follow-on** |
| **4. Safe profile-update RPC** | Explicit allowlist API | Clients can still PATCH table unless grants/RLS also locked; dual path risk | Good **complement** after table lockdown |

### 4.4 Recommended primary approach

**Primary (Batch 1): BEFORE UPDATE + BEFORE INSERT trigger** that:

1. For callers where `auth.role()` ∈ (`authenticated`, `anon`): force privileged columns to `OLD` (UPDATE) or defaults/`NULL` (INSERT).
2. Allows changes when:
   - `auth.role() = 'service_role'`, **or**
   - `current_setting('request.jwt.claim.role', true) = 'service_role'`, **or**
   - a session GUC `app.allow_profile_privilege_write = 'on'` set **only** inside trusted SECURITY DEFINER functions via `SET LOCAL` (used by `sync_admin_to_profiles` rewrite).

**Do not** rely solely on `current_user = 'service_role'`:

- PostgREST with user JWT runs as `authenticated` (DB role) with JWT claims.
- Service role key requests typically present as `service_role`.
- SECURITY DEFINER functions run as owner (`postgres` / `supabase_admin`) while JWT claims may still reflect the invoker — so admin sync must use `SET LOCAL app.allow_profile_privilege_write` **or** detect `current_user` is a superuser/owner **and** document that sync path.

**Complement (same batch or immediate follow-up):**

- Rewrite `sync_admin_to_profiles` to `SET LOCAL app.allow_profile_privilege_write = 'on'` before updating profiles.
- Optional: column grants as defense-in-depth after trigger proven.
- Optional later: `update_my_profile(...)` RPC for allowlisted fields; then tighten table UPDATE grants.

**Out of scope for Batch 1 but plan:** migrate feature flags into `user_entitlements` (or `user_feature_flags`) with SELECT-only RLS — Approach 3.

### 4.5 INSERT / upsert requirements

- Trigger on INSERT: strip/zero privileged columns for `authenticated`/`anon`.
- Defaults remain `false` for flags.
- `getOrCreateProfile` insert path already omits flags — keep that; DB must still enforce.

### 4.6 Signup attribution

Current client write of `signup_*` when null is legitimate but spoofable. Options:

- **A (Batch 1):** Leave writable once (no special lock) — low severity.
- **B (preferred soon):** Only allow update when OLD is null via trigger; never allow change once set.
- **C:** Move to server-only write on auth webhook.

Recommend **B** in Batch 1 trigger.

### 4.7 Rollback & tests

**Rollback:** `DROP TRIGGER …; DROP FUNCTION protect_profiles_privileges…;` (migration down or reverse migration).

**Tests:**

1. Authenticated PATCH `is_admin=true` → remains false / error.
2. Authenticated PATCH `display_name` → succeeds.
3. Service role UPDATE `is_admin` → succeeds.
4. Insert into `admins` → sync still sets `profiles.is_admin`.
5. Cookie consent / theme / taste_profile / avatar updates succeed.
6. Exploit procedure (§3.1) fails after deploy.

---

## 5. Inventory RPCs — DATA-001 / DATA-002

### 5.1 Required invariants

1. `bottles.quantity` never negative.
2. Opening N decrements exactly N.
3. Undo restores exactly that event’s `opened_quantity`.
4. Concurrent opens cannot overspend (row lock).
5. Retries cannot double-decrement / double-restore (idempotency).
6. User A cannot touch user B’s bottles/history.
7. No split-brain between history and quantity.

### 5.2 Preferred auditable model

**Do not hard-delete history on undo.**

Add to `consumption_history` (new migration):

| Column | Type | Purpose |
|--------|------|---------|
| `status` | `text` CHECK IN (`active`,`undone`) DEFAULT `active` | Soft undo |
| `undone_at` | `timestamptz` NULL | Audit |
| `idempotency_key` | `uuid` NULL | Client retry key |
| Unique | `(user_id, idempotency_key)` WHERE key NOT NULL | Open idempotency |
| Partial index | `(bottle_id) WHERE status = 'active'` | Hot path |

Existing rows: `status = 'active'`, `opened_quantity` already present (`20260131`).

### 5.3 Function signatures

```text
open_bottles(
  p_bottle_id uuid,
  p_opened_quantity int,
  p_idempotency_key uuid DEFAULT NULL,
  p_occasion text DEFAULT NULL,
  p_meal_type text DEFAULT NULL,
  p_vibe text DEFAULT NULL,
  p_user_rating int DEFAULT NULL,
  p_tasting_notes text DEFAULT NULL,
  p_meal_notes text DEFAULT NULL
) RETURNS consumption_history

undo_consumption(
  p_history_id uuid,
  p_idempotency_key uuid DEFAULT NULL  -- optional: undo-of-undo prevention key
) RETURNS consumption_history
```

Both: `SECURITY DEFINER`, `SET search_path = public`, `REVOKE ALL FROM PUBLIC/anon/authenticated` then `GRANT EXECUTE TO authenticated` only (or keep authenticated and enforce `auth.uid()` inside — preferred pattern for Sommi client).

### 5.4 Algorithm (open)

1. `v_uid := auth.uid()`; if null → raise `not_authenticated`.
2. If `p_idempotency_key` present: SELECT existing row for `(user_id, key)`; if found return it (no further mutation).
3. `SELECT … FROM bottles WHERE id = p_bottle_id AND user_id = v_uid FOR UPDATE`.
4. If missing → `not_found`; if `quantity < p_opened_quantity` → `insufficient_quantity`.
5. INSERT history (`status=active`, `opened_quantity=p_opened_quantity`, …).
6. `UPDATE bottles SET quantity = quantity - p_opened_quantity`.
7. Return history row.

### 5.5 Algorithm (undo)

1. Auth as above.
2. `SELECT … FROM consumption_history WHERE id = p_history_id AND user_id = v_uid FOR UPDATE`.
3. If missing → `not_found`.
4. If `status = 'undone'` → return row (idempotent success).
5. Lock bottle `FOR UPDATE` (same user); if bottle deleted → raise `bottle_missing` (policy choice: still mark undone without restore, or fail — **recommend fail closed** so ops can repair).
6. `UPDATE bottles SET quantity = quantity + opened_quantity`.
7. `UPDATE history SET status='undone', undone_at=now()`.
8. Return history.

### 5.6 Authorization & DEFINER safety

- Always filter by `auth.uid()`.
- Never accept `user_id` from client args.
- `SET search_path = public`.
- Owner: `postgres` / migration role; grants: `authenticated` EXECUTE only.
- RLS still applies to client direct table access; prefer migrating UI to RPC-only for open/undo and optionally revoke DELETE on history from authenticated later.

### 5.7 Client changes

| File | Change |
|------|--------|
| `apps/web/src/services/historyService.ts` | Call RPCs; remove multi-step write |
| `OpenRitualSheet.tsx`, `CellarPage.tsx`, `EveningQueuePlayer.tsx`, `HistoryPage.tsx` | Pass idempotency UUID per attempt; treat undone status in UI |
| History list queries | Filter `status = 'active'` by default; optional “show undone” |

**Deploy order:** DB migration (columns + RPCs) → deploy web that calls RPCs → optionally revoke dangerous direct UPDATE patterns.

**Backward compatibility:** Old clients that still two-step write remain broken until web deploy; coordinate same release. Feature flag optional.

### 5.8 Backfill

- Set `status='active'` for all existing rows.
- No quantity backfill unless reconciliation (§5.10) finds drift — then **manual** ops, not automatic.

### 5.9 Rollback

- Keep old client path behind flag briefly, or:
- Drop RPCs; retain columns (harmless); revert web.

### 5.10 Read-only reconciliation queries (detect only)

Already partly in SQL §H. Additional (run manually after H):

```sql
-- Events vs bottles: not a perfect invariant without soft-delete,
-- but large multi-open usage:
SELECT COUNT(*) AS multi_open_events
FROM consumption_history
WHERE opened_quantity > 1;
```

True “should-have quantity” requires knowing original stock — **not reconstructible** without audit log. After soft-undo ships, monitor: `quantity` never decreases without an `active` history insert in same transaction (RPC only).

### 5.11 Integration tests

1. Open 3 → quantity −3; history `opened_quantity=3`.
2. Undo → quantity restored +3; status `undone`.
3. Second undo → no change.
4. Concurrent open totaling > quantity → one fails.
5. Idempotent open with same key → one history row.
6. User B cannot open user A bottle.
7. Partial failure impossible (single transaction).

---

## 6. Shared cellars — SEC-003

### 6.1 Approach comparison

| Approach | Pros | Cons |
|----------|------|------|
| **1. Direct anon table access** (today) | Simple | Enumeration, world-readable JSON, expiry client-only |
| **2. RPC-based access** | Can hide rows; rate-limit harder in SQL | Still need secret token; DEFINER risk |
| **3. Edge Function + opaque token** | Rate limit, hashing, logging, CORS control, minimal DTO | More moving parts |

**Recommend Approach 3** as primary. RPC optional internal helper called only by edge with service role.

### 6.2 Recommended design

**Schema (new canonical migration):**

| Column | Purpose |
|--------|---------|
| `id` uuid PK | Internal id (not the URL token) |
| `user_id` | Owner |
| `token_hash` | SHA-256 of 128+ bit token (store **hash only**) |
| `token_prefix` | First 8 hex chars for support lookup (optional) |
| `share_data` or normalized columns | Prefer **minimal snapshot columns**, not full cellar dump |
| `expires_at` | Server enforced |
| `revoked_at` | Owner revoke |
| `view_count` | Increment via edge only |
| `created_at` | — |

**RLS:**

- No anon policies on table.
- Owner SELECT/INSERT/UPDATE (revoke) only.
- All public reads via edge function using service role + hash lookup.

**Token:**

- Generate 16+ random bytes (128+ bits), URL-safe base64.
- URL: `/share/:token` (or `/share/c/:token`).
- DB stores `sha256(token)` only.

**Edge function `get-shared-cellar`:**

1. Validate token format; rate limit per IP + per token prefix.
2. Lookup by hash where `revoked_at IS NULL AND expires_at > now()`.
3. Return **minimal DTO** (display name, bottle list without purchase prices / notes / user UUID if avoidable).
4. Log view event without raw token (hash/prefix only).

**Create share:** authenticated edge or RPC generating token, returning raw token **once**.

### 6.3 Backward compatibility for 7-char links

| Strategy | Notes |
|----------|-------|
| **Dual-read window** | Keep old `shared_cellars.id` rows readable via edge: if token length=7, lookup by id **only through edge** with rate limit; remove table `USING (true)` immediately |
| **Invalidate** | Force regenerate — harsh UX |
| **Recommended** | Immediate policy lockdown (deny anon SELECT); edge supports legacy short ids for N days; UI regenerates long-token links; owner revoke UI |

### 6.4 Owner revoke UI

- Profile / Cellar: list my shares (id, created, expires, views, revoked).
- Revoke → `UPDATE revoked_at = now()`.
- No raw tokens displayed after creation (show “link created” copy-once).

### 6.5 Logging

- Structured: `share_prefix`, `result` (hit/miss/expired/revoked), `ip_hash`, latency.
- Never log raw token or full `share_data`.

---

## 7. Vivino — SEC-004

### 7.1 Gateway JWT (repository vs live)

| Source | Finding |
|--------|---------|
| `supabase/config.toml` | Vivino functions **not** listed under `verify_jwt = false` |
| Implication | **Likely** gateway requires a JWT (anon or user) |
| Live | **Unverified** — confirm in Dashboard → Edge Functions → each function → Enforce JWT |

CORS `*` is **not** an auth boundary; it only widens browser abuse when a callable key exists.

### 7.2 Design

1. **Explicit auth:** `supabase.auth.getUser(jwt)` inside function; reject missing/invalid user (do not accept service role from clients).
2. **Rate limits:** per `user.id` (e.g. 30/hour search, 60/hour fetch) + per IP (edge memory or Redis/KV if available); return 429.
3. **Timeouts:** AbortController ~8–10s on Vivino fetches.
4. **Response size limits:** Cap HTML/JSON parse size before processing.
5. **Input validation:** Zod-like checks — wine_id numeric string; search fields length-capped; strip control chars.
6. **CORS:** Reflect allowlist (`sommi-ai.com`, localhost) — not `*`.
7. **Caching:** Cache successful Vivino payloads by wine_id with TTL (e.g. 24h) in DB or KV to cut scrape cost; never cache errors long.
8. **Credits (optional Stage 2):** Map to existing credit actions if monetization on; for Batch 5 start with rate limits only unless product requires metering.
9. **Vivino blocked/unavailable:** Return structured `upstream_unavailable`; client keeps manual entry; no crash loops.
10. **Monitoring:** Sentry + count 401/429/upstream failures.

**Admin batch enrich** already uses user JWT + `is_admin` — keep; ensure it doesn’t call unauthenticated public path.

---

## 8. Migration remediation — MIG-001 / MIG-002

### 8.1 Principles

- **Do not rewrite or rename historical applied migrations** in place.
- Separate **live repair**, **fresh rebuild**, and **history reconciliation**.

### 8.2 Live database repair

1. From Phase 0 SQL, determine whether view exists and whether it selects `opened_at`.
2. Apply a **new forward migration** that:
   - `CREATE OR REPLACE VIEW …` with correct columns (no `b.opened_at`), `security_invoker = true`.
3. If wishlist/shared_cellars missing → add **new** migrations creating them (IF NOT EXISTS) + correct RLS.
4. Quarantine is repo-only (move files); live already applied objects stay.

### 8.3 Fresh database rebuild

A fresh `supabase db reset` can still fail at `20251231` even if live is fine.

**Safest strategies by scenario:**

| Live observation | Fresh-clone strategy |
|------------------|----------------------|
| Migration **recorded** as applied + view **manually correct** | Add **new** repair migration for clones that skip 20251231 failure… **but** clones that execute 20251231 still fail. Therefore: also replace failure by documenting that **`20251231` must be patched in-repo with a comment-only change ONLY if never applied anywhere**, OR maintain a `supabase/migrations_repair/` used by CI. **Preferred:** edit `20251231` **only if E2 shows it was NEVER successfully applied to any environment you care about**; otherwise add pre-migration note and a **replacement file strategy** in CONTRIBUTING: squash is out of scope; use `supabase db reset` with a one-time local patch checklist. |
| Migration **recorded** but view **broken / missing** | Forward `CREATE OR REPLACE` repair; for fresh: **must fix 20251231 content** because replay fails — coordinate team: if all envs have it “applied”, changing file content doesn’t re-run; fresh clones need corrected file matching “intent”. Correcting the SQL of an applied migration is acceptable **only when** the checksum isn’t enforced or after `schema_migrations` repair — Supabase CLI may hash migrations. **Check CLI behavior:** if checksum validation exists, use `supabase migration repair` after intentional file fix. |
| Migration **skipped** / not in history + view missing | Fix file in place (safe) + ensure next reset applies clean definition. |
| Fresh clone fails at 20251231 | **Blocking for CI** — fix definition in that file and `migration repair` on remotes that already applied bad checksum, **or** delete version from history only with extreme care. |

**Explicit recommendation for `20251231_fix_security_definer_view.sql`:**

1. Run Phase 0 C + E.
2. If **not in schema_migrations** → edit the file in place to remove `b.opened_at` (safest for fresh rebuild).
3. If **in schema_migrations** and view OK → leave file as historical artifact; add **new** migration `YYYYMMDD_fix_bottles_with_wine_info_opened_at.sql` identical to desired view; document that fresh reset requires either migration repair tooling or a known local patch until a squash/baseline is done (Batch 3 decision).
4. If **in schema_migrations** and view broken → forward fix + plan baseline rebuild for long-term.

**Do not assume a later corrective migration alone makes a failing earlier migration succeed on empty DB.**

### 8.4 Reconciliation of `schema_migrations`

- Export E1 list.
- Diff against `supabase/migrations/*` filenames.
- For manual scripts that appear applied: leave history; move files out of auto-apply path in git.
- For baby-tracker `001–003`: if present live (`has_baby_*`), leave tables; stop new use; quarantine files from future resets by renaming outside folder **only after** baseline strategy agreed.

### 8.5 Manually applied migrations

- Treat live schema as source of truth for “what exists”.
- Encode missing pieces as **idempotent IF NOT EXISTS** forward migrations.
- Never re-run destructive manual SQL.

### 8.6 Wishlist / shared_cellars into canonical path

1. New timestamped migrations copied from `apps/api/supabase/migrations/20240110_*` and root `CREATE_SHARED_CELLARS_TABLE.sql`, rewritten:
   - wishlist: keep owner RLS.
   - shared_cellars: **do not** copy `USING (true)`; create locked-down schema matching §6.
2. Ensure `wishlist_enabled` column migration runs **before** any `ALTER COLUMN … DEFAULT` that references it.
3. Order: after `profiles` exists; before or instead of fragile `20260302` dependency — use `ADD COLUMN IF NOT EXISTS` in the new migration.

### 8.7 Quarantine operational SQL

Move to e.g. `supabase/ops/` or `supabase/manual/` (not auto-applied):

- `RUN_*`, `backfill_*`, `diagnose_*`, `fix_expired_*`

Update docs: “never place one-off SQL in `migrations/`”.

### 8.8 Baby-tracker schema

- Confirm via E3 `has_baby_*`.
- **Do not delete prematurely** — may have live rows or break history.
- Quarantine `001–003` from new environments via baseline/squash project later.
- Root `src/` remains non-production (vercel → `apps/web`).

---

## 9. Dependency findings (npm audit — classify only)

From audit run 2026-08-23 (`npm audit --omit=dev`) and lockfile versions. **Do not run `npm audit fix`.**

| Package | Direct/transitive | Runtime surface | Severity | Fix available | Upgrade risk | `--force`? |
|---------|-------------------|-----------------|----------|---------------|--------------|------------|
| `tar` via `@mapbox/node-pre-gyp` | Transitive (bcrypt native build) | **Build/install time**, not request path | Critical | Yes (audit) | Medium — native rebuild | Maybe for deep bumps |
| `@grpc/grpc-js` | Transitive (GA4) | API admin GA path | High | Yes | Low–Med | Unlikely |
| `@opentelemetry/core` (+ http instr.) | Transitive via `@sentry/node` | API telemetry | Moderate | Yes (Sentry bump) | Low | Unlikely |
| `@remix-run/router` / `react-router` / `react-router-dom` | **Direct** web | Browser routing; open-redirect GHSA | High | Yes (router ≥ fixed) | Low–Med (v6→v6) | Unlikely |
| `body-parser` / `qs` / `express` | Direct API express stack | HTTP parsing DoS | Moderate | Yes (express patch) | Low | Unlikely |
| `brace-expansion` / `minimatch` | Transitive (tooling/glob) | Mostly install/tooling; some runtime glob | High | Yes | Low | Unlikely |
| `form-data` | Transitive | Outbound multipart (GA/google libs) | High | Yes | Low | Unlikely |
| `path-to-regexp` | Transitive (express) | Route matching ReDoS | High | Yes via express | Low | Unlikely |
| `protobufjs` | Transitive (GA) | Admin analytics | High | Yes | Low | Unlikely |
| `ws` | Transitive | Likely realtime/tooling | High | Yes | Low | Unlikely |

**Batch 6 approach:** bump direct deps (`react-router-dom`, `express`, `@sentry/node`) deliberately; re-audit; avoid `--force` unless isolated and tested.

---

# Part 3 — Implementation batches

## Batch 1 — Emergency privilege lockdown (SEC-001 + DEFINER search_path for `is_admin`)

| Item | Detail |
|------|--------|
| **Scope** | Profiles privilege trigger; signup_* immutability; fix `is_admin`/`sync_admin_to_profiles` search_path + GUC; document admin grant SOP |
| **Files** | New migration only; optionally tiny comment in `profileService` (no reliance) |
| **DB objects** | Trigger/function on `profiles`; replace `is_admin`, `sync_admin_to_profiles` |
| **Tests** | SQL/RLS tests §4.7; manual exploit must fail |
| **Deploy** | Migration first; no frontend required |
| **Rollback** | Drop trigger/function; restore prior function defs |
| **Depends on live** | A3–A7, A9–A11 — confirm no existing guard; confirm admin roster |
| **FE+DB together?** | **No** |

## Batch 2 — Transactional inventory integrity (DATA-001/002)

| Item | Detail |
|------|--------|
| **Scope** | Soft-undo columns; `open_bottles` / `undo_consumption` RPCs; wire `historyService` + callers |
| **Files** | New migration; `historyService.ts`; OpenRitual/Cellar/History/EveningQueuePlayer; i18n if needed |
| **DB objects** | Columns, indexes, RPCs, grants |
| **Tests** | §5.11 integration |
| **Deploy** | DB then FE same release window |
| **Rollback** | FE revert; keep columns; drop RPCs optional |
| **Depends on live** | H1 (columns), H2 (usage) |
| **FE+DB together?** | **Yes** (compatibility window short) |

## Batch 3 — Migration reconstruction & schema alignment (MIG-001/002)

| Item | Detail |
|------|--------|
| **Scope** | View repair strategy per §8.3; wishlist + shared_cellars canonical migrations (locked RLS); quarantine ops SQL; document baby-tracker |
| **Files** | `supabase/migrations/*` (new); move ops scripts; possibly edit `20251231` per decision tree; docs |
| **DB objects** | View; tables/policies IF NOT EXISTS |
| **Tests** | Isolated `supabase db reset` in CI/container |
| **Deploy** | Migrations; verify staging reset |
| **Rollback** | Reverse migrations carefully |
| **Depends on live** | C*, D*, E* |
| **FE+DB together?** | No for view; shared_cellars lockdown may need FE share path (coordinate with Batch 4) |

## Batch 4 — Sharing security (SEC-003)

| Item | Detail |
|------|--------|
| **Scope** | Token-hash schema; revoke RLS anon; edge get/create; FE share modal + revoke UI; legacy short-id dual-read |
| **Files** | Migrations; new edge functions; `shareService.ts`; `ShareCellarModal`; `SharedCellarPage`; `UserMenu` |
| **DB objects** | Table alter/replace policies; RPCs optional |
| **Tests** | Anon cannot SELECT table; rate limit; expired/revoked |
| **Deploy** | DB lockdown **first** (may break old direct client reads) → edge → FE |
| **Rollback** | Risky once anon denied — keep edge compatible |
| **Depends on live** | B* |
| **FE+DB together?** | **Tightly coupled** after lockdown |

## Batch 5 — Vivino abuse controls (SEC-004)

| Item | Detail |
|------|--------|
| **Scope** | Auth, rate limit, CORS allowlist, timeouts, validation, caching; optional credits later |
| **Files** | `fetch-vivino-data`, `search-vivino-wine`, `_shared` helpers; callers unchanged if invoke still works |
| **DB objects** | Optional cache table |
| **Tests** | Unauth 401; over-limit 429; valid user 200 |
| **Deploy** | Edge only |
| **Rollback** | Redeploy previous function version |
| **Depends on live** | Q12 JWT enforcement |
| **FE+DB together?** | No |

## Batch 6 — Types, lint, dependencies, CI

| Item | Detail |
|------|--------|
| **Scope** | Regenerate `supabase.ts`; fix eslint plugin; CI workflow; careful dependency bumps |
| **Files** | `apps/web/src/types/supabase.ts`; `.eslintrc*`; `.github/workflows/*`; package.json lock |
| **DB objects** | None |
| **Tests** | typecheck/lint/vitest in CI |
| **Deploy** | No prod data |
| **Rollback** | Revert PR |
| **Depends on live** | None critical |
| **FE+DB together?** | No |

## Batch 7 — Remaining data-accuracy & retention

| Item | Detail |
|------|--------|
| **Scope** | Stats use `opened_quantity` / active status; share color counts; delete warnings; CASCADE vs SET NULL decision; credit fail-closed when enforcement on |
| **Files** | `historyService.getConsumptionStats`; `shareService`; i18n delete copy; `creditService.ts`; optional FK migration |
| **DB objects** | Possible FK change on `consumption_history.bottle_id` |
| **Tests** | Stats unit tests; delete UX |
| **Deploy** | FE; FK change careful |
| **Rollback** | Per-change |
| **Depends on live** | Batch 2 complete preferred |
| **FE+DB together?** | Only if FK changes |

---

## 10. Suggested verification → remediation gate

```text
Phase 0 SQL results
    → Confirm SEC-001 live (or already guarded)
    → Confirm shared_cellars / view / wishlist / migrations
    → Explicit approval for §3.1 exploit test (optional)
    → Implement Batch 1
    → Implement Batch 2
    → …
```

---

## 11. Confirmation

- **No application code, migrations (active), configuration, dependencies, generated types, or production data were modified** in Phase 0.
- **Created only:**
  - `PHASE_0_VERIFICATION.md` (this file)
  - `supabase/verification/phase_0_read_only_verification.sql`
  - directory `supabase/verification/` (for the SQL file)

---

*End of Phase 0 design.*
