-- ─────────────────────────────────────────────────────────────────────────────
-- Paddle Billing — Phase 1 schema additions
-- Adds Paddle tracking columns to user_ai_credits and a paddle_events
-- idempotency / audit table.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend user_ai_credits with Paddle identifiers and plan tracking
ALTER TABLE public.user_ai_credits
  ADD COLUMN IF NOT EXISTS plan_key               TEXT        NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS billing_period_end      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paddle_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id  TEXT;

CREATE INDEX IF NOT EXISTS idx_user_ai_credits_paddle_customer
  ON public.user_ai_credits (paddle_customer_id)
  WHERE paddle_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_ai_credits_paddle_subscription
  ON public.user_ai_credits (paddle_subscription_id)
  WHERE paddle_subscription_id IS NOT NULL;

-- 2. paddle_events — idempotency store + audit log for every Paddle webhook
CREATE TABLE IF NOT EXISTS public.paddle_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     TEXT        NOT NULL UNIQUE,   -- Paddle's own event_id — prevents double-processing
  event_type   TEXT        NOT NULL,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  payload      JSONB       NOT NULL DEFAULT '{}'::JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.paddle_events ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write paddle_events (never exposed to the browser)
CREATE POLICY "Service role only" ON public.paddle_events
  USING (FALSE);   -- denies all authenticated / anon access; service_role bypasses RLS

COMMENT ON TABLE public.paddle_events IS
  'Paddle webhook audit log. Each row corresponds to one unique Paddle event.
   event_id is UNIQUE to guarantee idempotent processing.';

-- 3. Helper RPC: grant credits after a completed Paddle subscription renewal or
--    one-time top-up.  Called from the webhook handler via service_role.
CREATE OR REPLACE FUNCTION public.paddle_grant_credits(
  p_user_id              UUID,
  p_plan_key             TEXT,          -- 'free' | 'premium' | 'collector' | 'topup'
  p_credits_to_set       INTEGER,       -- for plan renewals: the plan's monthly_credits; for top-ups: 0
  p_bonus_credits_to_add INTEGER,       -- for top-ups: credits to add; for plans: 0
  p_billing_period_end   TIMESTAMPTZ,
  p_paddle_customer_id   TEXT,
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
    -- For a subscription renewal we SET the balance (fresh allowance)
    credit_balance         = CASE
                               WHEN p_credits_to_set > 0
                               THEN p_credits_to_set
                               ELSE public.user_ai_credits.credit_balance
                             END,
    -- For a top-up we ADD to existing bonus_credits
    bonus_credits          = CASE
                               WHEN p_bonus_credits_to_add > 0
                               THEN public.user_ai_credits.bonus_credits + p_bonus_credits_to_add
                               ELSE public.user_ai_credits.bonus_credits
                             END,
    -- Only update monthly_limit for subscription changes, not top-ups
    monthly_limit          = CASE
                               WHEN p_credits_to_set > 0
                               THEN p_credits_to_set
                               ELSE public.user_ai_credits.monthly_limit
                             END,
    plan_key               = CASE
                               WHEN p_plan_key != 'topup'
                               THEN p_plan_key
                               ELSE public.user_ai_credits.plan_key
                             END,
    billing_period_end     = COALESCE(p_billing_period_end, public.user_ai_credits.billing_period_end),
    paddle_customer_id     = COALESCE(p_paddle_customer_id, public.user_ai_credits.paddle_customer_id),
    paddle_subscription_id = COALESCE(p_paddle_subscription_id, public.user_ai_credits.paddle_subscription_id),
    updated_at             = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.paddle_grant_credits TO service_role;

-- 4. Helper RPC: cancel/downgrade subscription back to free
CREATE OR REPLACE FUNCTION public.paddle_cancel_subscription(
  p_user_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_ai_credits
  SET
    plan_key               = 'free',
    billing_period_end     = NULL,
    paddle_subscription_id = NULL,
    updated_at             = NOW()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.paddle_cancel_subscription TO service_role;
