-- ============================================================
-- Fix credit enforcement defaults — 2026-07-24
-- ============================================================
--
-- Problem:
--   The signup trigger (provision_free_credits_on_signup) creates a
--   user_ai_credits row with 15 free credits but NEVER creates a
--   user_entitlements row.  When the process_ai_credit_usage RPC finds
--   no entitlement row it falls back to credit_enforcement_enabled = FALSE,
--   which means credit_balance is NEVER decremented — usage events are
--   logged with credits_used = 0 and only lifetime_credits_used ticks up.
--
-- Fix:
--   1. Update provision_free_credits_on_signup() to also insert a
--      user_entitlements row (both flags TRUE) for every new user.
--   2. Backfill existing users who have a user_ai_credits row but no
--      user_entitlements row.
--   3. Enable enforcement for any existing user_entitlements rows that
--      were manually created with credit_enforcement_enabled = FALSE.
--
-- All changes are IDEMPOTENT — safe to re-run.
-- ============================================================


-- ── 1. Update signup trigger ─────────────────────────────────────────────────
--
-- Replaces the version from 20260508_billing_sanity_fixes.sql.
-- The only addition is the INSERT INTO user_entitlements block at the end.
-- The ON CONFLICT DO NOTHING keeps it idempotent for both tables.
-- ============================================================

CREATE OR REPLACE FUNCTION public.provision_free_credits_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Provision 15 free credits (unchanged from previous version)
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
  ON CONFLICT (user_id) DO NOTHING;

  -- NEW: create entitlement row with enforcement enabled so credits actually
  -- decrement from the very first action.  ON CONFLICT DO NOTHING means an
  -- admin-created row is never overwritten.
  INSERT INTO public.user_entitlements (
    user_id,
    monetization_enabled,
    credit_enforcement_enabled
  )
  VALUES (
    NEW.id,
    TRUE,
    TRUE
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.provision_free_credits_on_signup() IS
  'Trigger function: creates user_ai_credits (15 free credits) AND user_entitlements
   (monetization + enforcement both TRUE) when a new user signs up.
   Both inserts are idempotent (ON CONFLICT DO NOTHING).';


-- ── 2. Backfill existing users missing an entitlement row ────────────────────
--
-- Any user who signed up before this migration has a user_ai_credits row
-- but no user_entitlements row.  Insert one with both flags = TRUE so their
-- credits start decrementing immediately after this migration is applied.
-- ============================================================

INSERT INTO public.user_entitlements (
  user_id,
  monetization_enabled,
  credit_enforcement_enabled
)
SELECT
  uac.user_id,
  TRUE,
  TRUE
FROM public.user_ai_credits uac
WHERE uac.user_id NOT IN (
  SELECT user_id FROM public.user_entitlements
)
ON CONFLICT (user_id) DO NOTHING;


-- ── 3. Enable enforcement for existing rows that still have it disabled ───────
--
-- Covers users whose entitlement row was created manually (e.g. via the
-- admin runbook) with credit_enforcement_enabled = FALSE as a staged rollout.
-- After this migration enforcement is ON for all users.
-- ============================================================

UPDATE public.user_entitlements
SET
  credit_enforcement_enabled = TRUE,
  monetization_enabled       = TRUE,
  updated_at                 = NOW()
WHERE credit_enforcement_enabled = FALSE;
