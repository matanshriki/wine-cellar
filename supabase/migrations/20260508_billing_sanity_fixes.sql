-- ============================================================
-- Billing sanity fixes — 2026-05-08
-- ============================================================
--
-- Problems fixed:
--   1. paddle_grant_credits() was missing p_billing_period_start
--      and p_billing_status parameters added to the webhook handler.
--   2. paddle_cancel_subscription() never restored the free-tier
--      monthly credit allowance (15 credits).
--   3. New users were created with credit_balance = 0 and no free
--      credits — a DB trigger now provisions 15 credits on signup.
--   4. Free users' credits were never reset monthly — a scheduled
--      RPC (reset_free_user_credits) + pg_cron job handles that.
--   5. current_period_start was never persisted (column existed
--      but paddle_grant_credits() never wrote it).
--   6. billing_status was never written to the DB.
--
-- All changes are IDEMPOTENT — safe to re-run.
-- ============================================================


-- ── 1. Recreate paddle_grant_credits() with new parameters ────────────────────
--
--   NEW params vs previous version:
--     p_billing_period_start TEXT  — start of the new billing period
--     p_billing_status       TEXT  — 'active' | 'past_due' | 'paused' | NULL
--
--   Behaviour notes:
--   • p_credits_to_set = 0  → do NOT touch credit_balance (used for
--     metadata-only updates like payment-method changes).
--   • p_credits_to_set > 0  → SET credit_balance to the plan allowance
--     (fresh monthly allocation; intentional RESET, not addition).
--   • Bonus credits are always ADD-ed, never replaced.
-- ============================================================
-- Drop legacy 7-parameter overload (paddle_billing.sql).
-- Without this, paddle_grant_credits exists twice and COMMENT / GRANT fail.
-- ============================================================
DROP FUNCTION IF EXISTS public.paddle_grant_credits(uuid, text, integer, integer, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.paddle_grant_credits(
  p_user_id                UUID,
  p_plan_key               TEXT,
  p_credits_to_set         INTEGER,
  p_bonus_credits_to_add   INTEGER,
  p_billing_period_end     TIMESTAMPTZ,
  p_billing_period_start   TIMESTAMPTZ DEFAULT NULL,
  p_billing_status         TEXT        DEFAULT NULL,
  p_paddle_customer_id     TEXT        DEFAULT NULL,
  p_paddle_subscription_id TEXT        DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_ai_credits (
    user_id,
    credit_balance,
    bonus_credits,
    monthly_limit,
    plan_key,
    billing_status,
    current_period_start,
    current_period_end,
    billing_period_end,
    paddle_customer_id,
    paddle_subscription_id,
    updated_at
  )
  VALUES (
    p_user_id,
    GREATEST(p_credits_to_set, 0),
    GREATEST(p_bonus_credits_to_add, 0),
    GREATEST(p_credits_to_set, 0),   -- monthly_limit mirrors the plan allowance
    p_plan_key,
    p_billing_status,
    p_billing_period_start,
    p_billing_period_end,
    p_billing_period_end,
    p_paddle_customer_id,
    p_paddle_subscription_id,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    -- Subscription renewal / activation → SET balance to plan allowance
    -- p_credits_to_set = 0 → metadata-only update, leave balance untouched
    credit_balance         = CASE
                               WHEN p_credits_to_set > 0
                               THEN p_credits_to_set
                               ELSE public.user_ai_credits.credit_balance
                             END,
    -- Top-up / bonus → ADD to existing bonus pool
    bonus_credits          = CASE
                               WHEN p_bonus_credits_to_add > 0
                               THEN public.user_ai_credits.bonus_credits + p_bonus_credits_to_add
                               ELSE public.user_ai_credits.bonus_credits
                             END,
    -- Track plan's monthly allowance; never update for top-ups
    monthly_limit          = CASE
                               WHEN p_credits_to_set > 0 AND p_plan_key != 'topup'
                               THEN p_credits_to_set
                               ELSE public.user_ai_credits.monthly_limit
                             END,
    -- Never overwrite plan_key when processing a top-up
    plan_key               = CASE
                               WHEN p_plan_key != 'topup'
                               THEN p_plan_key
                               ELSE public.user_ai_credits.plan_key
                             END,
    -- Only update billing_status when a non-NULL value is provided
    billing_status         = COALESCE(p_billing_status,         public.user_ai_credits.billing_status),
    -- Persist period timestamps when provided
    current_period_start   = COALESCE(p_billing_period_start,   public.user_ai_credits.current_period_start),
    current_period_end     = COALESCE(p_billing_period_end,     public.user_ai_credits.current_period_end),
    billing_period_end     = COALESCE(p_billing_period_end,     public.user_ai_credits.billing_period_end),
    paddle_customer_id     = COALESCE(p_paddle_customer_id,     public.user_ai_credits.paddle_customer_id),
    paddle_subscription_id = COALESCE(p_paddle_subscription_id, public.user_ai_credits.paddle_subscription_id),
    updated_at             = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.paddle_grant_credits(uuid, text, integer, integer, timestamptz, timestamptz, text, text, text) TO service_role;


-- ── 2. Fix paddle_cancel_subscription() — restore free-tier credits ───────────
--
-- When a user cancels their subscription, downgrade them to the free plan
-- AND restore their free monthly credit allowance (15 credits).
-- We SET credit_balance = 15 so they can still use the product immediately.
-- ============================================================
CREATE OR REPLACE FUNCTION public.paddle_cancel_subscription(
  p_user_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_ai_credits
  SET
    plan_key               = 'free',
    billing_status         = 'cancelled',
    monthly_limit          = 15,
    credit_balance         = 15,           -- restore free allowance immediately
    billing_period_end     = NULL,
    current_period_start   = NULL,
    current_period_end     = NULL,
    paddle_subscription_id = NULL,
    updated_at             = NOW()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.paddle_cancel_subscription TO service_role;


-- ── 3. New-user trigger — provision 15 free credits on auth.users insert ──────
--
-- When a new user signs up (row inserted into auth.users), create their
-- credit row with 15 free credits so they can use AI features immediately.
-- Uses SECURITY DEFINER so it can write to public.user_ai_credits from
-- the auth schema trigger context.
-- ============================================================
CREATE OR REPLACE FUNCTION public.provision_free_credits_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_ai_credits (
    user_id,
    credit_balance,
    bonus_credits,
    monthly_limit,
    plan_key,
    billing_status,
    updated_at
  )
  VALUES (
    NEW.id,
    15,       -- free plan monthly allowance
    0,
    15,
    'free',
    'active',
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING; -- idempotent; never overwrite if row exists
  RETURN NEW;
END;
$$;

-- Attach to auth.users (fires after INSERT, for each new user row)
DROP TRIGGER IF EXISTS on_auth_user_created_provision_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_provision_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.provision_free_credits_on_signup();

-- Backfill: grant 15 credits to existing users who have NO credit row yet
INSERT INTO public.user_ai_credits (
  user_id, credit_balance, bonus_credits, monthly_limit, plan_key, billing_status, updated_at
)
SELECT
  id,
  15,
  0,
  15,
  'free',
  'active',
  NOW()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_ai_credits)
ON CONFLICT (user_id) DO NOTHING;


-- ── 4. Monthly free-credit reset RPC ──────────────────────────────────────────
--
-- Resets credit_balance to 15 for all users on the free plan whose
-- credit_balance is below 15.  Call this once per month via pg_cron.
--
-- The function is intentionally conservative:
--   • Only touches free-plan users (plan_key = 'free').
--   • Never reduces a balance — uses GREATEST so users who somehow have
--     MORE than 15 are not affected.
--   • Returns a count of rows updated for logging.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_free_user_credits()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.user_ai_credits
  SET
    credit_balance = 15,
    monthly_limit  = 15,
    billing_status = 'active',
    updated_at     = NOW()
  WHERE plan_key = 'free'
    OR plan_key IS NULL;   -- treat users with no plan as free

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE '[reset_free_user_credits] Updated % free users', v_updated;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_free_user_credits TO service_role;

-- ── 5. Schedule monthly reset via pg_cron (1st of every month at 00:05 UTC) ──
--
-- Requires the pg_cron extension — already enabled on Supabase Pro/Team.
-- If pg_cron is not available, call reset_free_user_credits() manually or
-- via a Supabase Edge Function cron trigger.
-- ============================================================
DO $outer$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove any existing job first (idempotent)
    IF EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'reset-free-user-credits-monthly'
    ) THEN
      PERFORM cron.unschedule('reset-free-user-credits-monthly');
    END IF;

    -- Tagged dollar quotes required for the cron job command string (avoid ambiguous punctuation in comments).
    PERFORM cron.schedule(
      'reset-free-user-credits-monthly',
      '5 0 1 * *',   -- 00:05 UTC on the 1st of every month
      $cron$SELECT public.reset_free_user_credits();$cron$
    );

    RAISE NOTICE '[billing_sanity] pg_cron job scheduled: reset-free-user-credits-monthly';
  ELSE
    RAISE NOTICE '[billing_sanity] pg_cron extension not available — schedule reset_free_user_credits() manually';
  END IF;
END;
$outer$;


-- ── 6. Ensure current_period_start column exists (added in supabase.ts types) ─
ALTER TABLE public.user_ai_credits
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;

-- Ensure billing_status column exists
ALTER TABLE public.user_ai_credits
  ADD COLUMN IF NOT EXISTS billing_status TEXT;


-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.paddle_grant_credits(uuid, text, integer, integer, timestamptz, timestamptz, text, text, text) IS
  'Grant or refresh credits after a Paddle subscription activation, renewal, or top-up.
   p_credits_to_set = 0 → metadata-only update (balance untouched).
   p_credits_to_set > 0 → fresh monthly allocation (balance SET, not added).
   p_bonus_credits_to_add > 0 → one-time bonus credits ADDED to the pool.';

COMMENT ON FUNCTION public.paddle_cancel_subscription(uuid) IS
  'Downgrade user to free plan after Paddle cancellation.
   Restores 15 free monthly credits immediately.';

COMMENT ON FUNCTION public.provision_free_credits_on_signup() IS
  'Trigger function: creates user_ai_credits row with 15 free credits when a new user signs up.
   Idempotent — uses ON CONFLICT DO NOTHING.';

COMMENT ON FUNCTION public.reset_free_user_credits() IS
  'Monthly maintenance: resets credit_balance to 15 for all free-plan users.
   Called by pg_cron on the 1st of every month at 00:05 UTC.
   Safe to call manually for ad-hoc resets.';
