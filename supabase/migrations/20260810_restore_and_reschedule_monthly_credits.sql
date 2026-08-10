-- ============================================================
-- Fix: August 2026 — restore missed credits + reschedule monthly reset
-- ============================================================
--
-- Problem:
--   Monthly credit resets did not fire on August 1 for two reasons:
--
--   Free users:
--     The pg_cron scheduling in 20260508_billing_sanity_fixes.sql was
--     wrapped in a conditional that silently skipped when pg_cron was
--     not installed at migration run time.  No job was ever scheduled.
--
--   Paid users:
--     Credits are reset via Paddle webhook (subscription.renewed →
--     paddle_grant_credits).  If webhooks failed or arrived with no
--     userId (see 20260621_fix_renewal_credit_reset.sql), balances were
--     never restored.
--
-- This migration:
--   1. Creates reset_monthly_credits() — a combined RPC that resets
--      free users AND restores paid users in one atomic call.
--   2. Runs the fix immediately so all users are made whole now.
--   3. Reschedules the pg_cron job (if pg_cron is available) to call
--      reset_monthly_credits() going forward.
--   4. Updates pg_cron to use the new combined function (not just free).
--
-- If pg_cron is NOT available, deploy the reset-monthly-credits edge
-- function and schedule it from the Supabase dashboard (Functions →
-- Schedule) using the cron expression: 5 0 1 * *
--
-- All changes are IDEMPOTENT — safe to re-run.
-- ============================================================


-- ── 1. Create combined monthly reset RPC ─────────────────────────────────────
--
-- Handles both free users and paid subscribers in a single call:
--   • Free / NULL plan → SET credit_balance = 15, monthly_limit = 15
--   • Paid (premium / collector) with balance < limit → SET credit_balance = monthly_limit
--
-- This is the authoritative monthly reset path going forward.
-- Replaces reset_free_user_credits() as the pg_cron / edge function target
-- (reset_free_user_credits still exists for backward compatibility).
-- ============================================================

CREATE OR REPLACE FUNCTION public.reset_monthly_credits()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free_updated INTEGER;
  v_paid_updated INTEGER;
BEGIN
  -- Free plan users: reset balance to 15
  UPDATE public.user_ai_credits
  SET
    credit_balance = 15,
    monthly_limit  = 15,
    billing_status = 'active',
    updated_at     = NOW()
  WHERE plan_key = 'free'
    OR plan_key IS NULL;

  GET DIAGNOSTICS v_free_updated = ROW_COUNT;

  -- Paid subscribers: restore balance to their plan allowance when it has
  -- dropped below the limit (i.e. Paddle renewal webhook failed / was missed).
  -- Only touches active subscribers — does NOT affect cancelled/paused/past_due.
  -- Never reduces a balance that is already at or above the monthly limit.
  -- bonus_credits and lifetime_credits_used are intentionally untouched.
  UPDATE public.user_ai_credits
  SET
    credit_balance = monthly_limit,
    updated_at     = NOW()
  WHERE plan_key      IN ('premium', 'collector')
    AND billing_status = 'active'
    AND credit_balance  < monthly_limit
    AND monthly_limit   > 0;

  GET DIAGNOSTICS v_paid_updated = ROW_COUNT;

  RAISE NOTICE '[reset_monthly_credits] free_users_reset=%, paid_users_restored=%',
    v_free_updated, v_paid_updated;

  RETURN jsonb_build_object(
    'free_users_reset',      v_free_updated,
    'paid_users_restored',   v_paid_updated,
    'run_at',                NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_monthly_credits() TO service_role;

COMMENT ON FUNCTION public.reset_monthly_credits() IS
  'Monthly credit reset for all users.
   - Free / NULL plan: SET credit_balance = 15, monthly_limit = 15.
   - Active paid subscribers below their monthly_limit: SET credit_balance = monthly_limit.
   Called by pg_cron on the 1st of every month (00:05 UTC) and by the
   reset-monthly-credits edge function (fallback / manual trigger).
   Returns JSONB with free_users_reset and paid_users_restored counts.
   Idempotent — safe to run multiple times.';


-- ── 2. Run the fix immediately ────────────────────────────────────────────────
--
-- This restores August credits for all affected users the moment
-- the migration is applied.  No manual SQL needed afterward.
-- ============================================================

SELECT public.reset_monthly_credits();


-- ── 3. Reschedule the pg_cron job (if pg_cron is available) ──────────────────
--
-- Replace the old job (which called reset_free_user_credits — free users only)
-- with one that calls reset_monthly_credits (free + paid).
-- ============================================================

DO $reschedule$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Remove the old free-only job if it exists
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-free-user-credits-monthly') THEN
      PERFORM cron.unschedule('reset-free-user-credits-monthly');
      RAISE NOTICE '[monthly_credit_reset] Removed old job: reset-free-user-credits-monthly';
    END IF;

    -- Remove any stale version of the combined job (idempotent re-run)
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-monthly-credits') THEN
      PERFORM cron.unschedule('reset-monthly-credits');
    END IF;

    -- Schedule the new combined job
    PERFORM cron.schedule(
      'reset-monthly-credits',
      '5 0 1 * *',   -- 00:05 UTC on the 1st of every month
      $cron$SELECT public.reset_monthly_credits();$cron$
    );

    RAISE NOTICE '[monthly_credit_reset] pg_cron job scheduled: reset-monthly-credits (5 0 1 * *)';

  ELSE
    RAISE NOTICE '[monthly_credit_reset] pg_cron not available — no automatic schedule set. '
      'Deploy the reset-monthly-credits edge function and schedule it from the Supabase '
      'dashboard (Functions → Schedule) using cron expression: 5 0 1 * *';
  END IF;
END;
$reschedule$;
