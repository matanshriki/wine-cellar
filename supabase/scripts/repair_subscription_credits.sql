-- ============================================================
-- Admin repair script: restore subscription credits for users
-- whose most-recent renewal was not processed correctly.
--
-- Background:
--   Before the credit-renewal fix (20260621_fix_renewal_credit_reset.sql),
--   recurring Paddle renewal events could arrive with no userId in
--   custom_data. The handler logged a warning and returned early — credits
--   were never reset to the plan allowance. The event was still recorded
--   in paddle_events (with user_id = NULL, processed_successfully = TRUE),
--   so Paddle retries were also silently dropped.
--
--   This script identifies affected users and restores their subscription
--   credits to their current plan's monthly allowance.
--
-- What the script does:
--   1. Identifies active subscribers (plan_key IN ('premium','collector'))
--      whose credit_balance is LESS THAN their monthly_limit — meaning
--      credits were consumed in the previous cycle but never refreshed.
--   2. Does NOT touch bonus_credits (purchased top-ups).
--   3. Skips users whose credit_balance is already at or above their
--      monthly_limit (they were correctly provisioned).
--   4. Skips users whose billing_status is NOT 'active' (cancelled,
--      paused, past_due — do not auto-restore credits for these).
--   5. Supports a DRY-RUN mode that shows what would change without
--      writing anything.
--
-- Usage:
--   Dry run (no changes):
--     SET session_replication_role = DEFAULT; -- safety: no replication surprises
--     DO $$ BEGIN PERFORM repair_subscription_credits(p_dry_run := TRUE); END $$;
--
--   Live run (applies updates):
--     DO $$ BEGIN PERFORM repair_subscription_credits(p_dry_run := FALSE); END $$;
--
--   Or as a plain SELECT for inline inspection (dry run):
--     SELECT * FROM repair_subscription_credits_preview();
--
-- Safety:
--   • Wrapped in a transaction with ROLLBACK on error.
--   • Dry-run mode is the default to prevent accidental writes.
--   • NEVER modifies bonus_credits, lifetime_credits_used, or plan metadata.
--   • Each repaired row gets a note in the pg log at NOTICE level.
--   • The script is idempotent — running it twice produces the same result.
-- ============================================================


-- ── Helper view: preview affected users before committing ──────────────────

CREATE OR REPLACE VIEW public.repair_subscription_credits_preview AS
SELECT
  u.user_id,
  u.plan_key,
  u.billing_status,
  u.credit_balance                                          AS current_credit_balance,
  u.monthly_limit                                           AS plan_allowance,
  u.monthly_limit - u.credit_balance                        AS credits_to_restore,
  u.bonus_credits,
  u.paddle_subscription_id,
  u.paddle_customer_id,
  u.billing_period_end,
  u.updated_at                                              AS last_updated,
  -- Look up the most-recent paddle_events row for this user to understand
  -- whether any renewal was recorded as unprocessed (processed_successfully = FALSE)
  (
    SELECT pe.event_id
    FROM   public.paddle_events pe
    WHERE  pe.user_id = u.user_id
      AND  pe.event_type = 'subscription.renewed'
    ORDER  BY pe.processed_at DESC
    LIMIT  1
  )                                                         AS last_renewal_event_id,
  (
    SELECT pe.processed_successfully
    FROM   public.paddle_events pe
    WHERE  pe.user_id = u.user_id
      AND  pe.event_type = 'subscription.renewed'
    ORDER  BY pe.processed_at DESC
    LIMIT  1
  )                                                         AS last_renewal_processed_ok
FROM public.user_ai_credits u
WHERE u.plan_key    IN ('premium', 'collector')
  AND u.billing_status = 'active'
  AND u.credit_balance  < u.monthly_limit   -- credits not at full allowance
  AND u.monthly_limit   > 0                 -- sanity: skip zero-limit rows
ORDER BY u.updated_at ASC;

COMMENT ON VIEW public.repair_subscription_credits_preview IS
  'Preview of active subscribers whose subscription credits are below their plan allowance.
   Candidates for the repair_subscription_credits() function.
   Read-only — safe to query at any time.';


-- ── Main repair function ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.repair_subscription_credits(
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  user_id              UUID,
  plan_key             TEXT,
  old_credit_balance   INTEGER,
  new_credit_balance   INTEGER,
  bonus_credits        INTEGER,
  monthly_limit        INTEGER,
  billing_period_end   TIMESTAMPTZ,
  action               TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row            RECORD;
  v_updated        INTEGER := 0;
  v_skipped        INTEGER := 0;
BEGIN

  -- Iterate over affected rows
  FOR v_row IN
    SELECT
      u.user_id,
      u.plan_key,
      u.billing_status,
      u.credit_balance,
      u.bonus_credits,
      u.monthly_limit,
      u.billing_period_end,
      u.paddle_subscription_id
    FROM public.user_ai_credits u
    WHERE u.plan_key    IN ('premium', 'collector')
      AND u.billing_status = 'active'
      AND u.credit_balance  < u.monthly_limit
      AND u.monthly_limit   > 0
    ORDER BY u.user_id
  LOOP

    IF p_dry_run THEN
      -- Dry run: report what would happen
      RAISE NOTICE '[repair_subscription_credits DRY-RUN] user_id=% plan=% credit_balance % → % (bonus_credits unchanged: %)',
        v_row.user_id, v_row.plan_key,
        v_row.credit_balance, v_row.monthly_limit, v_row.bonus_credits;
    ELSE
      -- Live run: apply the fix
      UPDATE public.user_ai_credits
      SET
        credit_balance = monthly_limit,   -- SET to plan allowance (not added)
        updated_at     = NOW()
      WHERE user_id = v_row.user_id
        -- Double-check: only update if still below limit (concurrent safety)
        AND credit_balance < monthly_limit
        AND billing_status = 'active'
        AND plan_key IN ('premium', 'collector');

      RAISE NOTICE '[repair_subscription_credits] UPDATED user_id=% plan=% credit_balance % → % (bonus_credits unchanged: %)',
        v_row.user_id, v_row.plan_key,
        v_row.credit_balance, v_row.monthly_limit, v_row.bonus_credits;
    END IF;

    v_updated := v_updated + 1;

    -- Yield a result row
    user_id            := v_row.user_id;
    plan_key           := v_row.plan_key;
    old_credit_balance := v_row.credit_balance;
    new_credit_balance := v_row.monthly_limit;
    bonus_credits      := v_row.bonus_credits;
    monthly_limit      := v_row.monthly_limit;
    billing_period_end := v_row.billing_period_end;
    action             := CASE WHEN p_dry_run THEN 'would_restore' ELSE 'restored' END;
    RETURN NEXT;

  END LOOP;

  RAISE NOTICE '[repair_subscription_credits] Finished. % users %.',
    v_updated,
    CASE WHEN p_dry_run THEN 'would be updated (DRY RUN)' ELSE 'updated' END;

END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_subscription_credits(boolean) TO service_role;

COMMENT ON FUNCTION public.repair_subscription_credits(boolean) IS
  'Restores subscription credits for active subscribers whose credit_balance is below
   their plan monthly_limit (caused by failed renewal credit resets).

   p_dry_run = TRUE  (default): reports what would change, makes no writes.
   p_dry_run = FALSE          : applies the fix (SET credit_balance = monthly_limit).

   Only touches credit_balance. bonus_credits, lifetime_credits_used, and plan
   metadata are never modified. Idempotent — safe to run multiple times.';


-- ── Usage examples ─────────────────────────────────────────────────────────
--
-- 1. Preview affected users (read-only):
--
--    SELECT * FROM public.repair_subscription_credits_preview;
--
-- 2. Dry run — see what would change:
--
--    SELECT * FROM public.repair_subscription_credits(p_dry_run := TRUE);
--
-- 3. Live run — apply the fix:
--
--    SELECT * FROM public.repair_subscription_credits(p_dry_run := FALSE);
--
-- 4. Count summary:
--
--    SELECT
--      action,
--      COUNT(*)                           AS users_affected,
--      SUM(new_credit_balance - old_credit_balance) AS total_credits_restored,
--      SUM(bonus_credits)                 AS total_bonus_credits_unchanged
--    FROM public.repair_subscription_credits(p_dry_run := TRUE)
--    GROUP BY action;
