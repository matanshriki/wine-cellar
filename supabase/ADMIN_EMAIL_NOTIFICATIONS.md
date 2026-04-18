# Admin email notifications (Resend + Edge Functions)

Production-oriented admin alerts for your Supabase-backed Sommi project: **signups** and **purchases** fire immediately from Database Webhooks; **bottle scans** are summarized once per day from a scheduled (or manual) Edge Function.

Customer-facing email is out of scope — only `ADMIN_EMAIL` receives messages.

## What was implemented

| Piece | Purpose |
|--------|---------|
| Edge Function `admin-notifications` | Validates `Authorization: Bearer WEBHOOK_SECRET`, accepts Supabase Database Webhook payloads, handles **INSERT** only, sends Resend email for `profiles` and filtered `paddle_events` rows. |
| Edge Function `daily-bottle-scan-summary` | Same auth pattern, calls RPC `admin_bottle_scan_summary_stats`, emails a **rolling last-24-hours** digest; **skips sending when scan count is 0**. |
| `_shared/adminEmail/*` | Resend HTTP client, HTML shell, Paddle amount parsing (aligned with `apps/api` Meta helper), subject/body builders. |
| Migration `20260418_admin_bottle_scan_summary_rpc.sql` | `SECURITY DEFINER` RPC used by the daily job so scan logic stays in one SQL place (join `bottles` + `wines`, scan heuristics). |

## Tables used

| Notification | Table | Why |
|----------------|--------|-----|
| Signup | **`public.profiles`** | App-level row created by `handle_new_user` on auth signup (see `20251226_initial_schema.sql`). Avoids coupling to `auth.users` in webhooks. |
| Purchase | **`public.paddle_events`** | Canonical audit trail for Paddle: every billing webhook is inserted here from `apps/api` `POST /api/billing/webhook`. Rich JSON in `payload`. |
| Daily scans | **`public.bottles`** + **`public.wines`** (via RPC) | No dedicated “scan session” table. A bottle counts as scan-driven if the linked wine has `entry_source = 'ai_scan'` **or** any of `bottles`/`wines` image path columns is set (`label_image_path` / `image_path`), matching how `entry_source` is inferred in migrations. |

**Purchase noise control:** Immediate email is sent only for `paddle_events.event_type` in:

- `transaction.completed`
- `subscription.activated`
- `subscription.created`

Other Paddle rows (e.g. `subscription.updated`, `customer.*`) are ignored by design so you are not spammed on metadata-only webhooks.

## Required secrets (Supabase project → Edge Functions → Secrets)

Set these for **both** functions (same names in Dashboard or `supabase secrets set`):

| Name | Example | Notes |
|------|---------|--------|
| `RESEND_API_KEY` | `re_...` | [Resend API keys](https://resend.com/docs/dashboard/api-keys/introduction) |
| `RESEND_FROM_EMAIL` | `Sommi Admin <onboarding@resend.dev>` | Must be a verified sender/domain in Resend. |
| `ADMIN_EMAIL` | `you@yourdomain.com` | Recipient only. |
| `WEBHOOK_SECRET` | Long random string | Shared secret for `Authorization: Bearer …` on **both** webhooks and manual/cron calls to the daily summary. |
| `SUPABASE_URL` | Auto in hosted | Usually injected; set explicitly if needed. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role | Required for `daily-bottle-scan-summary` to call `auth.admin` is optional there — actually daily doesn't use auth.admin, only RPC. Still needs service role for RPC. `admin-notifications` uses it to resolve signup **provider** and purchase **user email**. |

## Deploy Edge Functions

From the repo root (with [Supabase CLI](https://supabase.com/docs/guides/cli) logged in):

```bash
cd /path/to/wine
supabase functions deploy admin-notifications --no-verify-jwt
supabase functions deploy daily-bottle-scan-summary --no-verify-jwt
```

`--no-verify-jwt` matches `verify_jwt = false` in `config.toml` so Database Webhooks and schedulers are not blocked by Supabase JWT checks.

Set secrets (non-interactive):

```bash
supabase secrets set RESEND_API_KEY=re_xxxxx RESEND_FROM_EMAIL="Sommi <noreply@yourdomain.com>" ADMIN_EMAIL=you@yourdomain.com WEBHOOK_SECRET="$(openssl rand -hex 32)"
```

Hosted function URLs:

- `https://<PROJECT_REF>.supabase.co/functions/v1/admin-notifications`
- `https://<PROJECT_REF>.supabase.co/functions/v1/daily-bottle-scan-summary`

## Database Webhooks (Dashboard)

There is no webhook IaC in this repo — configure in **Supabase Dashboard → Database → Webhooks**.

### 1) New signup → `admin-notifications`

- **Name:** e.g. `admin-signup`
- **Table:** `profiles`
- **Events:** Insert
- **HTTP Request**
  - **URL:** `https://<PROJECT_REF>.supabase.co/functions/v1/admin-notifications`
  - **HTTP Headers:** `Authorization` = `Bearer <WEBHOOK_SECRET>` (same value as the `WEBHOOK_SECRET` secret; do not commit it)
  - **HTTP Method:** POST

### 2) New Paddle event → `admin-notifications`

- **Name:** e.g. `admin-purchase`
- **Table:** `paddle_events`
- **Events:** Insert
- **URL / Authorization:** same as above

Supabase sends a JSON body like:

```json
{
  "type": "INSERT",
  "schema": "public",
  "table": "profiles",
  "record": { "id": "…", "display_name": "…", "email": "…", "created_at": "…" },
  "old_record": null
}
```

## Schedule the daily summary

The function accepts **`Authorization: Bearer <WEBHOOK_SECRET>`** (same value as Database Webhooks) **or** **`Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`** so you can follow Supabase’s pg_cron examples that send the service role, while manual operators can use the shorter webhook secret.

**Option A — pg_cron + pg_net (Supabase-recommended):** See [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions). Store your project URL and either `WEBHOOK_SECRET` or the service role in **Vault**, then `net.http_post` with the matching `Authorization` header. Starter SQL: `supabase/cron/daily_bottle_scan_summary.example.sql`.

**Option B — Manual / external cron:** `POST` or `GET` the function URL with `Authorization: Bearer <WEBHOOK_SECRET>`.

**Option C — Third-party cron (GitHub Actions, etc.):** Same as B; keep `WEBHOOK_SECRET` in CI secrets, not the service role, when possible.

## Apply the database migration

Run against production (CLI or SQL Editor):

```bash
supabase db push
```

Or paste `supabase/migrations/20260418_admin_bottle_scan_summary_rpc.sql` into the SQL Editor.

## Local testing

Start stack:

```bash
supabase start
supabase functions serve admin-notifications daily-bottle-scan-summary --no-verify-jwt --env-file ./supabase/.env.local
```

Create `./supabase/.env.local` (gitignored) with the secrets above plus `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` from `supabase status`.

### Example: signup webhook payload

```bash
curl -sS -X POST 'http://127.0.0.1:54321/functions/v1/admin-notifications' \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "schema": "public",
    "table": "profiles",
    "record": {
      "id": "11111111-1111-1111-1111-111111111111",
      "display_name": "Test User",
      "email": "test@example.com",
      "first_name": "Test",
      "last_name": "User",
      "created_at": "2026-04-18T12:00:00.000Z"
    },
    "old_record": null
  }'
```

### Example: purchase (`paddle_events`)

```bash
curl -sS -X POST 'http://127.0.0.1:54321/functions/v1/admin-notifications' \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "table": "paddle_events",
    "record": {
      "event_id": "evt_test_123",
      "event_type": "transaction.completed",
      "user_id": "11111111-1111-1111-1111-111111111111",
      "processed_at": "2026-04-18T12:00:00.000Z",
      "payload": {
        "event_type": "transaction.completed",
        "data": {
          "id": "txn_abc",
          "currency_code": "USD",
          "totals": { "total": 2900 },
          "items": [{ "price": { "id": "pri_xxx", "name": "Collector monthly" } }]
        }
      }
    }
  }'
```

(Amounts in Paddle are often in minor units; adjust `totals.total` to match your real payloads.)

### Example: daily summary

```bash
curl -sS -X POST 'http://127.0.0.1:54321/functions/v1/daily-bottle-scan-summary' \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET"
```

GET is also allowed with the same header.

## Manual Dashboard checklist

1. Deploy both functions and set secrets.
2. Run migration `20260418_admin_bottle_scan_summary_rpc.sql`.
3. Create two Database Webhooks (`profiles` INSERT, `paddle_events` INSERT) pointing at `admin-notifications` with `Bearer WEBHOOK_SECRET`.
4. Add a schedule (or external cron) for `daily-bottle-scan-summary` with the same bearer token.
5. Verify sender domain in Resend.
