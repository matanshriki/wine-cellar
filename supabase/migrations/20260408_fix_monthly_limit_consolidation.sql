-- ============================================================
-- Fix: Consolidate monthly_credit_limit → monthly_limit
-- ============================================================
--
-- Root cause: The phase-1 migration created the column as
--   monthly_credit_limit, but paddle_billing.sql and
--   paddle_grant_credits() both reference monthly_limit.
-- This caused paddle_grant_credits() to fail silently on
-- every webhook, so no credits were ever set after a Paddle
-- subscription or top-up event.
--
-- This migration is IDEMPOTENT — safe to run even if the
-- FIX_MONTHLY_LIMIT_COLUMN.sql quick-fix was already applied.
--
-- Steps:
--   1. Add monthly_limit column (IF NOT EXISTS)
--   2. Backfill from monthly_credit_limit
--   3. Fix incorrect collector default (400 → 500) from
--      the quick-fix script
--   4. Drop the old monthly_credit_limit column
--   5. Add Paddle columns missing from generated types
--   6. Recreate paddle_grant_credits() referencing the
--      correct column name
--   7. Recreate paddle_events with correct schema
-- ============================================================


-- ── 1. Add canonical column ──────────────────────────────────────────────────
ALTER TABLE public.user_ai_credits
  ADD COLUMN IF NOT EXISTS monthly_limit INTEGER NOT NULL DEFAULT 0;


-- ── 2. Backfill from old column (handles both scenarios: fix applied or not) ─
UPDATE public.user_ai_credits
SET monthly_limit = monthly_credit_limit
WHERE monthly_limit = 0
  AND monthly_credit_limit > 0;


-- ── 3. Fix incorrect collector default from the quick-fix script ─────────────
--    FIX_MONTHLY_LIMIT_COLUMN.sql incorrectly used 400 for collector.
--    The plan policy defines collector = 500 credits.
UPDATE public.user_ai_credits
SET monthly_limit = 500
WHERE plan_key = 'collector'
  AND monthly_limit = 400;


-- ── 4. Drop the old column ───────────────────────────────────────────────────
ALTER TABLE public.user_ai_credits
  DROP COLUMN IF EXISTS monthly_credit_limit;


-- ── 5. Add Paddle tracking columns missing from generated types ──────────────
--    billing_period_end, paddle_customer_id, paddle_subscription_id were
--    added by 20260406_paddle_billing.sql but never reflected in supabase.ts.
ALTER TABLE public.user_ai_credits
  ADD COLUMN IF NOT EXISTS billing_period_end      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paddle_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id  TEXT;

CREATE INDEX IF NOT EXISTS idx_user_ai_credits_paddle_customer
  ON public.user_ai_credits (paddle_customer_id)
  WHERE paddle_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_ai_credits_paddle_subscription
  ON public.user_ai_credits (paddle_subscription_id)
  WHERE paddle_subscription_id IS NOT NULL;


-- ── 6. Recreate paddle_grant_credits() with correct column ───────────────────
CREATE OR REPLACE FUNCTION public.paddle_grant_credits(
  p_user_id                UUID,
  p_plan_key               TEXT,
  p_credits_to_set         INTEGER,
  p_bonus_credits_to_add   INTEGER,
  p_billing_period_end     TIMESTAMPTZ,
  p_paddle_customer_id     TEXT,
  p_paddle_subscription_id TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_ai_credits (
    user_id,
    credit_balance,
    bonus_credits,
    monthly_limit,
    plan_key,
    billing_period_end,
    paddle_customer_id,
    paddle_subscription_id,
    updated_at
  )
  VALUES (
    p_user_id,
    p_credits_to_set,
    p_bonus_credits_to_add,
    p_credits_to_set,
    p_plan_key,
    p_billing_period_end,
    p_paddle_customer_id,
    p_paddle_subscription_id,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    -- Subscription renewal: SET the balance to the plan's monthly allowance
    credit_balance         = CASE
                               WHEN p_credits_to_set > 0
                               THEN p_credits_to_set
                               ELSE public.user_ai_credits.credit_balance
                             END,
    -- Top-up: ADD to existing bonus_credits
    bonus_credits          = CASE
                               WHEN p_bonus_credits_to_add > 0
                               THEN public.user_ai_credits.bonus_credits + p_bonus_credits_to_add
                               ELSE public.user_ai_credits.bonus_credits
                             END,
    -- Track the plan's monthly allowance (not updated for top-ups)
    monthly_limit          = CASE
                               WHEN p_credits_to_set > 0
                               THEN p_credits_to_set
                               ELSE public.user_ai_credits.monthly_limit
                             END,
    -- Never overwrite plan_key when processing a top-up
    plan_key               = CASE
                               WHEN p_plan_key != 'topup'
                               THEN p_plan_key
                               ELSE public.user_ai_credits.plan_key
                             END,
    billing_period_end     = COALESCE(p_billing_period_end,     public.user_ai_credits.billing_period_end),
    paddle_customer_id     = COALESCE(p_paddle_customer_id,     public.user_ai_credits.paddle_customer_id),
    paddle_subscription_id = COALESCE(p_paddle_subscription_id, public.user_ai_credits.paddle_subscription_id),
    updated_at             = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.paddle_grant_credits TO service_role;


-- ── 7. Ensure paddle_events table exists with correct schema ─────────────────
--    20260406_paddle_billing.sql may have created a broken version.
--    Recreate idempotently: only drop if the event_id UNIQUE constraint is missing
--    (which was the bug in the original table).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'paddle_events'
      AND constraint_type = 'UNIQUE'
  ) THEN
    DROP TABLE IF EXISTS public.paddle_events CASCADE;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.paddle_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     TEXT        NOT NULL UNIQUE,
  event_type   TEXT        NOT NULL,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  payload      JSONB       NOT NULL DEFAULT '{}'::JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.paddle_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.paddle_events;
CREATE POLICY "Service role only" ON public.paddle_events
  USING (FALSE);
