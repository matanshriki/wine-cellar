# Sommi credits — Admin & Developer Runbook

Internal reference for manually controlling the monetization rollout.
Run these snippets in the Supabase SQL editor (service-role context).

---

## Table Reference

| Table | Purpose |
|---|---|
| `user_entitlements` | Two-flag rollout control per user |
| `user_ai_credits` | Balance state (fast reads) |
| `ai_usage_events` | Immutable event ledger |
| `ai_credit_usage_summary` | View — per-user/action aggregates |

## Flag Reference

| Column | Default | Effect |
|---|---|---|
| `monetization_enabled` | `false` | Shows credits UI, pricing modal, upgrade prompts |
| `credit_enforcement_enabled` | `false` | Blocks AI actions when balance is insufficient |

---

## Staged Rollout

```
Stage 1 (now):
  All users: monetization_enabled = false, credit_enforcement_enabled = false
  → Usage is logged silently. No UI changes. No blocking.

Stage 2 (per-user flag flip):
  Selected users: monetization_enabled = true, credit_enforcement_enabled = false
  → Those users see credits UI and pricing entry points. Still no blocking.

Stage 3 (enforcement):
  Selected users: monetization_enabled = true, credit_enforcement_enabled = true
  → Those users are blocked when credits reach 0.

Legacy / non-flagged users: unaffected at all stages.
```

---

## SQL Snippets

### 1. Enable monetization UI for a specific user

```sql
-- Replace '<user-uuid>' with the user's auth.users UUID

INSERT INTO public.user_entitlements (user_id, monetization_enabled, credit_enforcement_enabled)
VALUES ('<user-uuid>', true, false)
ON CONFLICT (user_id)
DO UPDATE SET
  monetization_enabled = true,
  updated_at = NOW();
```

### 2. Enable credit enforcement for a specific user

```sql
UPDATE public.user_entitlements
SET
  credit_enforcement_enabled = true,
  updated_at = NOW()
WHERE user_id = '<user-uuid>';
```

### 3. Disable enforcement (roll back a user to Stage 2)

```sql
UPDATE public.user_entitlements
SET
  credit_enforcement_enabled = false,
  updated_at = NOW()
WHERE user_id = '<user-uuid>';
```

### 4. Disable all monetization for a user (roll back to dark launch)

```sql
UPDATE public.user_entitlements
SET
  monetization_enabled = false,
  credit_enforcement_enabled = false,
  updated_at = NOW()
WHERE user_id = '<user-uuid>';
```

### 5. Create or update starting credits for a user

```sql
-- Give a user 100 credits on the free plan
INSERT INTO public.user_ai_credits (
  user_id,
  monthly_credit_limit,
  credit_balance,
  bonus_credits,
  plan_key,
  billing_status,
  current_period_start,
  current_period_end
) VALUES (
  '<user-uuid>',
  15,               -- monthly_credit_limit (free plan = 15)
  100,              -- credit_balance (override for testing)
  0,                -- bonus_credits
  'free',
  'active',
  date_trunc('month', NOW()),
  date_trunc('month', NOW()) + INTERVAL '1 month'
)
ON CONFLICT (user_id)
DO UPDATE SET
  monthly_credit_limit = EXCLUDED.monthly_credit_limit,
  credit_balance       = EXCLUDED.credit_balance,
  plan_key             = EXCLUDED.plan_key,
  billing_status       = EXCLUDED.billing_status,
  current_period_start = EXCLUDED.current_period_start,
  current_period_end   = EXCLUDED.current_period_end,
  updated_at           = NOW();
```

### 6. Grant bonus credits to a user

```sql
-- Grants 50 bonus credits on top of existing balance (does not reset main balance)
UPDATE public.user_ai_credits
SET
  bonus_credits = bonus_credits + 50,
  updated_at    = NOW()
WHERE user_id = '<user-uuid>';

-- Confirm:
SELECT user_id, credit_balance, bonus_credits,
       credit_balance + bonus_credits AS effective_balance
FROM public.user_ai_credits
WHERE user_id = '<user-uuid>';
```

### 7. Reset a user's balance to zero

```sql
UPDATE public.user_ai_credits
SET
  credit_balance = 0,
  bonus_credits  = 0,
  updated_at     = NOW()
WHERE user_id = '<user-uuid>';
```

### 8. Restore monthly credits (manual monthly reset for one user)

```sql
UPDATE public.user_ai_credits
SET
  credit_balance       = monthly_credit_limit,
  current_period_start = date_trunc('month', NOW()),
  current_period_end   = date_trunc('month', NOW()) + INTERVAL '1 month',
  updated_at           = NOW()
WHERE user_id = '<user-uuid>';
```

### 9. Inspect recent usage events for a user

```sql
-- Last 20 events
SELECT
  id,
  action_type,
  credits_used,
  request_status,
  model_name,
  input_tokens,
  output_tokens,
  estimated_cost_usd,
  metadata,
  created_at
FROM public.ai_usage_events
WHERE user_id = '<user-uuid>'
ORDER BY created_at DESC
LIMIT 20;
```

### 10. Inspect a user's full state (entitlement + credits)

```sql
SELECT
  e.user_id,
  e.monetization_enabled,
  e.credit_enforcement_enabled,
  c.monthly_credit_limit,
  c.credit_balance,
  c.bonus_credits,
  c.credit_balance + c.bonus_credits AS effective_balance,
  c.plan_key,
  c.billing_status,
  c.lifetime_credits_used,
  c.current_period_start,
  c.current_period_end
FROM public.user_entitlements e
LEFT JOIN public.user_ai_credits c USING (user_id)
WHERE e.user_id = '<user-uuid>';
```

---

## Analytics Queries

### Which users consume the most AI credits?

```sql
SELECT
  user_id,
  SUM(credits_used)      AS total_credits,
  COUNT(*)               AS total_events,
  SUM(estimated_cost_usd) AS total_cost_usd,
  MAX(created_at)        AS last_event_at
FROM public.ai_usage_events
WHERE request_status = 'success'
GROUP BY user_id
ORDER BY total_credits DESC
LIMIT 20;
```

### Which action types are most expensive?

```sql
SELECT
  action_type,
  COUNT(*)                AS event_count,
  SUM(credits_used)       AS total_credits,
  AVG(credits_used)       AS avg_credits,
  SUM(estimated_cost_usd) AS total_cost_usd,
  AVG(estimated_cost_usd) AS avg_cost_usd
FROM public.ai_usage_events
WHERE request_status = 'success'
GROUP BY action_type
ORDER BY total_cost_usd DESC NULLS LAST;
```

### Which users are near their credit limit?

```sql
SELECT
  c.user_id,
  c.monthly_credit_limit,
  c.credit_balance + c.bonus_credits AS effective_balance,
  c.plan_key,
  e.credit_enforcement_enabled
FROM public.user_ai_credits c
LEFT JOIN public.user_entitlements e USING (user_id)
WHERE c.monthly_credit_limit > 0
  AND (c.credit_balance + c.bonus_credits) < 5
ORDER BY effective_balance ASC;
```

### How often do insufficient-credit blocks occur?

```sql
SELECT
  date_trunc('day', created_at) AS day,
  COUNT(*)                       AS block_count
FROM public.ai_usage_events
WHERE request_status = 'blocked_insufficient_credits'
GROUP BY day
ORDER BY day DESC;
```

### Estimated AI cost by user and action (last 30 days)

```sql
SELECT
  user_id,
  action_type,
  COUNT(*)                 AS events,
  SUM(estimated_cost_usd)  AS cost_usd,
  SUM(input_tokens)        AS input_tokens,
  SUM(output_tokens)       AS output_tokens
FROM public.ai_usage_events
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND request_status = 'success'
GROUP BY user_id, action_type
ORDER BY cost_usd DESC NULLS LAST;
```

---

## Quick Rollout Checklist

### Give a test user access to the full Stage 2 experience

```sql
-- Step 1: Create entitlement row (monetization UI ON, enforcement OFF)
INSERT INTO public.user_entitlements (user_id, monetization_enabled, credit_enforcement_enabled)
VALUES ('<user-uuid>', true, false)
ON CONFLICT (user_id) DO UPDATE SET
  monetization_enabled = true,
  credit_enforcement_enabled = false,
  updated_at = NOW();

-- Step 2: Grant starting credits
INSERT INTO public.user_ai_credits (
  user_id, monthly_credit_limit, credit_balance, plan_key, billing_status,
  current_period_start, current_period_end
) VALUES (
  '<user-uuid>', 15, 15, 'free', 'active',
  date_trunc('month', NOW()),
  date_trunc('month', NOW()) + INTERVAL '1 month'
)
ON CONFLICT (user_id) DO UPDATE SET
  credit_balance = 15,
  monthly_credit_limit = 15,
  updated_at = NOW();

-- Step 3: Verify
SELECT e.*, c.credit_balance, c.bonus_credits
FROM user_entitlements e
LEFT JOIN user_ai_credits c USING (user_id)
WHERE e.user_id = '<user-uuid>';
```

### Enable enforcement for the same user (Stage 3 test)

```sql
UPDATE public.user_entitlements
SET credit_enforcement_enabled = true, updated_at = NOW()
WHERE user_id = '<user-uuid>';

-- Set balance to 0 to test the block flow
UPDATE public.user_ai_credits
SET credit_balance = 0, bonus_credits = 0, updated_at = NOW()
WHERE user_id = '<user-uuid>';
```

---

## Credit-Aware AI Route Coverage (Phase 2)

### Covered routes (usage logged + enforcement-ready)

| Route / Function | Location | Action Type | Credit Cost | Notes |
|---|---|---|---|---|
| `POST /api/agent/recommend` | Express API | `sommelier_chat_message` | 1 | Pre-flight check + atomic deduction |
| `POST /api/agent/transcribe` | Express API | `voice_transcription` | **0** | Logged only — feeds into recommend |
| `analyze-wine` | Edge Function | `wine_bottle_analysis` | 1 | Pre-flight + post-log; `trigger_source` in metadata |
| `analyze-cellar` | Edge Function | `cellar_analysis` | 10 | Charged once per batch call, not per bottle |
| `parse-label-image` (single) | Edge Function | `label_scan` | 2 | Mode detected at request time |
| `parse-label-image` (multi/receipt) | Edge Function | `receipt_scan` | 8 | Action type confirmed from AI response |
| `generate-wine-profile` | Edge Function | `wine_profile_generation` | 1 | Pre-flight + post-log |
| `generate-label-art` | Edge Function | `label_art_generation` | 5 | Pre-flight skipped for cached responses |

### Not yet covered (out of scope this pass)

| Route / Function | Reason |
|---|---|
| `backfill-analysis` | Admin-only operation — should not use user credits |
| `backfill-he-translations` | Admin-only — no user association |
| `backfill-wine-profiles` | Admin/cron — no user association |
| `extract-wine-label` | Not active in current web app flow |
| `POST /api/analysis/bottles/:id` | Express legacy route — not called by web app |
| `POST /api/recommendations` | Express legacy route — not called by web app |

---

## Required Environment Variables

### Express API (`apps/api/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Anon key (user auth checks) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ **NEW** | Service role key for atomic credit deduction via RPC |
| `OPENAI_API_KEY` | ✅ | OpenAI API key |

Without `SUPABASE_SERVICE_ROLE_KEY`, credit deduction is silently skipped (fail-open). A warning is logged on startup.

### Supabase Edge Functions

Edge functions automatically have access to:

| Variable | Source | Purpose |
|---|---|---|
| `SUPABASE_URL` | Injected by Supabase | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected by Supabase | All edge functions already use this for DB ops |
| `OPENAI_API_KEY` | Supabase Secrets | OpenAI API key |

No additional secrets are needed for edge function credit logging — they reuse the existing admin client.

---

## Important Notes

- **Monthly reset** is not yet automated. Use the manual reset snippet above until a scheduled job or Stripe webhook handler is added.

- **Stripe** is not wired. The pricing modal shows placeholder UI. Wire Stripe Checkout sessions to the `handleSelectPlan` and `handleTopUp` functions in `PricingModal.tsx` when ready.

- **analyze-wine auto-trigger**: `bottleService.ts` fires `analyze-wine` automatically after bottle creation with no `trigger_source` field (defaults to `'user'` in the function). When Stage 3 enforcement turns on, auto-triggered analysis will also consume credits. To prevent this, pass `trigger_source: 'system'` from `bottleService.ts` and add a bypass check in the edge function for system-triggered calls. This is documented here as a Stage 3 pre-requisite.

- **Enforcement semantics for edge functions**: All five edge functions now use `checkCreditAccess()` before AI calls. During dark launch (enforcement = OFF for all users), the check always returns `allowed: true`. When enforcement is enabled, users with 0 credits will receive a `402` response before any OpenAI token is spent.

- **Failed AI calls**: All failure paths log with `request_status = 'failed'`. The `process_ai_credit_usage` RPC treats non-success statuses as 0 credits deducted, regardless of `p_credits_required`. Users are never charged for failed calls.
