# Web Push reminders (decant + rate-later)

Server-scheduled reminders with absolute `fire_at`, Web Push delivery, and deep links.
**Closed-app delivery does not use service-worker `setTimeout`.**

> **Production / iPhone delivery: NOT PASSED.**

## Local test results (2026-09-28)

Database: local Postgres `sommi_web_push_test` (Homebrew PG 16).  
Harness: `supabase/verification/web_push_local_setup.sql` + migration + `web_push_local_tests.sql`.

| Check | Status | Evidence |
|-------|--------|----------|
| Migration apply | **tested and passed** | Applied cleanly; RLS on; GRANTs to `authenticated`/`service_role` |
| Create reminder | **tested and passed** | `NOTICE: PASS create` |
| Cancel before claim | **tested and passed** | `NOTICE: PASS cancel` |
| Claim → sending | **tested and passed** | `NOTICE: PASS claim` |
| No double-claim while sending | **tested and passed** | same |
| Retry (pending restore) + stuck 10m recovery | **tested and passed** | `NOTICE: PASS retry` (test disables `updated_at` trigger only to backdate; prod crash leaves claim-time stamp) |
| Concurrent batch_size=1 exclusive claims | **tested and passed** | `NOTICE: PASS concurrent` |
| Cancel while sending | **tested and passed** | `NOTICE: PASS cancel-during-sending` |
| RLS select/insert isolation | **tested and passed** | `PASS RLS-select`, `PASS RLS-insert-blocked` |
| Cold-start deep link **rate** (browser) | **tested and passed** | `http://localhost:5173/cellar?reminder=rate&historyId=…&wineName=Pinot%20Test&producer=Local%20Cellar` → Rate sheet “How was it?” / Local Cellar · Pinot Test (snapshot) |
| Cold-start deep link **decant** (browser) | **tested and passed** | `…?reminder=decant&…&wineName=Cabernet%20Test&producer=Napa%20Local` → “Decant ready” modal (snapshot) |

Re-run local suite:

```bash
psql -d postgres -c "DROP DATABASE IF EXISTS sommi_web_push_test; CREATE DATABASE sommi_web_push_test;"
psql -d sommi_web_push_test -f supabase/verification/web_push_local_setup.sql
psql -d sommi_web_push_test -f supabase/migrations/20260928_web_push_reminders.sql
psql -d sommi_web_push_test -f supabase/verification/web_push_local_tests.sql
```

## Production status (same session)

| Step | Status | Evidence |
|------|--------|----------|
| `wine_reminders` table exists | **not present** | REST `GET /rest/v1/wine_reminders` → **404** (bottles → 200) |
| Migration applied | **not done** | No `supabase login` / `SUPABASE_ACCESS_TOKEN`; pooler URL has no password |
| Edge secrets / function deploy | **not done** | CLI logged out |
| Vercel web deploy + `VITE_VAPID_PUBLIC_KEY` | **not done** | `vercel whoami` → logged out |
| Cron every minute | **not configured** | Example SQL only; cannot query `cron.job` |
| Deployed `/sw.js` | **tested and failed (old)** | Live file still has `SCHEDULE_NOTIFICATION` + `setTimeout` (etag `63eed8d827df6637abd0408a309e22b1`, last-modified 2026-09-28 09:42:16 GMT); **no** `push` listener |
| Short prod E2E reminder | **not tested** | Blocked on migration + function + secrets + cron + web |
| iPhone closed-app | **not tested** | Explicitly left for you |

VAPID keypair prepared locally (gitignored): `.local/vapid.env` — do not commit.  
Helper: `scripts/deploy-web-push.sh` (requires `supabase login` + `vercel login`).

## Exact deploy order (when credentials available)

1. `supabase login` (or set `SUPABASE_ACCESS_TOKEN`)
2. `supabase db push` — migration `20260928_web_push_reminders.sql`
3. `supabase secrets set` — `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, ensure `WEBHOOK_SECRET` exists
4. `supabase functions deploy send-due-reminders`
5. Vercel: set `VITE_VAPID_PUBLIC_KEY` → production web deploy
6. Run cron SQL in project (uncomment `supabase/cron/send_due_reminders.example.sql`) → verify `cron.job`
7. Confirm `/sw.js` contains `addEventListener('push'`
8. Short E2E: create due reminder + curl dispatcher
9. **Your iPhone** Home Screen PWA closed-app test

### Required secret names (no values)

`VITE_VAPID_PUBLIC_KEY` · `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` · `WEBHOOK_SECRET` · `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY`

## Architecture (unchanged)

| Piece | Role |
|-------|------|
| `wine_reminders` | Absolute `fire_at` |
| `push_subscriptions` | Per device |
| `send-due-reminders` | VAPID dispatcher |
| `claim_due_wine_reminders()` | `SKIP LOCKED` + 10m stuck recovery |
| Client countdown | Works without notification permission |
| SW `push` + deep links | Closed-app delivery + `/cellar?reminder=…` |
