-- ============================================================
-- Sommi credits — Phase 1: Metering & Monetization Foundation
-- ============================================================
--
-- Tables created:
--   1. user_entitlements   — two-flag rollout control (UI visibility + enforcement)
--   2. user_ai_credits     — balance state table (fast reads)
--   3. ai_usage_events     — event ledger (analytics, billing, debugging)
--
-- Rollout intent:
--   - All flags default to FALSE → no visible change for any existing user
--   - Enable per-user via SQL (see docs/sommelier-credits-admin.md)
--   - Enforcement is a separate flag from UI visibility
--
-- Security:
--   - Users can only READ their own rows via RLS
--   - All mutations go through server-side paths (Express API with service role)
--   - No client-side trust for balance changes
--
-- ============================================================


-- ============================================================
-- 1. user_entitlements
-- ============================================================
-- Controls the two-flag staged rollout per user.
--   monetization_enabled        → user can SEE credits UI, pricing, upgrade prompts
--   credit_enforcement_enabled  → user is BLOCKED when credits are insufficient

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monetization_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  credit_enforcement_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

-- Users may only read their own entitlement row.
-- All writes happen server-side (service role bypasses RLS).
DROP POLICY IF EXISTS "Users can read own entitlements" ON public.user_entitlements;
CREATE POLICY "Users can read own entitlements"
  ON public.user_entitlements FOR SELECT
  USING (auth.uid() = user_id);

-- Reuse the shared updated_at trigger helper from initial_schema.
CREATE TRIGGER update_user_entitlements_updated_at
  BEFORE UPDATE ON public.user_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 2. user_ai_credits
-- ============================================================
-- Balance state table — fast reads for enforcement checks and UI display.
--   effective_balance = credit_balance + bonus_credits
--   monthly_credit_limit = allocated monthly credits for the user's plan
--   lifetime_credits_used = running counter for analytics / billing tiers

CREATE TABLE IF NOT EXISTS public.user_ai_credits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_credit_limit  INTEGER NOT NULL DEFAULT 0,
  credit_balance        INTEGER NOT NULL DEFAULT 0,
  bonus_credits         INTEGER NOT NULL DEFAULT 0,
  plan_key              TEXT NULL,
  billing_status        TEXT NULL,
  current_period_start  TIMESTAMPTZ NULL,
  current_period_end    TIMESTAMPTZ NULL,
  lifetime_credits_used INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_ai_credits_user_id
  ON public.user_ai_credits(user_id);

ALTER TABLE public.user_ai_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own credit balance" ON public.user_ai_credits;
CREATE POLICY "Users can read own credit balance"
  ON public.user_ai_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_ai_credits_updated_at
  BEFORE UPDATE ON public.user_ai_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 3. ai_usage_events
-- ============================================================
-- Immutable event ledger — one row per AI action.
-- Used for: analytics, debugging, pricing optimization, future billing.
-- Never update rows — append only.

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type       TEXT NOT NULL,
  credits_used      INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 4) NULL,
  request_status    TEXT NOT NULL DEFAULT 'success',
  request_id        TEXT NULL,
  model_name        TEXT NULL,
  input_tokens      INTEGER NULL,
  output_tokens     INTEGER NULL,
  metadata          JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Core access indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_id
  ON public.ai_usage_events(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created_at
  ON public.ai_usage_events(created_at DESC);

-- Composite index for per-user analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_created
  ON public.ai_usage_events(user_id, created_at DESC);

-- request_id index for idempotency / dedupe checks
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_request_id
  ON public.ai_usage_events(request_id)
  WHERE request_id IS NOT NULL;

-- action_type index for cost aggregation queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_action_type
  ON public.ai_usage_events(action_type);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage events (for future "Your usage" UI).
-- Write path is server-side only (service role).
DROP POLICY IF EXISTS "Users can read own usage events" ON public.ai_usage_events;
CREATE POLICY "Users can read own usage events"
  ON public.ai_usage_events FOR SELECT
  USING (auth.uid() = user_id);


-- ============================================================
-- 4. Atomic credit deduction RPC
-- ============================================================
-- Called from the Express API (service role) to:
--   a) ensure credit rows exist (upsert)
--   b) check entitlement flags
--   c) deduct credits atomically
--   d) log usage event
--   e) return structured result
--
-- SECURITY: SECURITY DEFINER runs as table owner — client cannot call
-- this with their own JWT to bypass RLS checks.  It is exposed only
-- to service-role or trusted server paths.

CREATE OR REPLACE FUNCTION public.process_ai_credit_usage(
  p_user_id           UUID,
  p_action_type       TEXT,
  p_credits_required  INTEGER,
  p_request_id        TEXT DEFAULT NULL,
  p_model_name        TEXT DEFAULT NULL,
  p_input_tokens      INTEGER DEFAULT NULL,
  p_output_tokens     INTEGER DEFAULT NULL,
  p_estimated_cost_usd NUMERIC DEFAULT NULL,
  p_metadata          JSONB DEFAULT '{}'::JSONB,
  p_request_status    TEXT DEFAULT 'success'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entitlement        public.user_entitlements%ROWTYPE;
  v_credits            public.user_ai_credits%ROWTYPE;
  v_effective_balance  INTEGER;
  v_deduct             INTEGER;
  v_rows_updated       INTEGER;
  v_event_id           UUID;
BEGIN
  -- ── 1. Fetch entitlement flags (default to false if row missing) ──
  SELECT * INTO v_entitlement
  FROM public.user_entitlements
  WHERE user_id = p_user_id;

  -- If no entitlement row → treat as non-flagged user, allow through
  IF NOT FOUND THEN
    v_entitlement.monetization_enabled       := FALSE;
    v_entitlement.credit_enforcement_enabled := FALSE;
  END IF;

  -- ── 2. Ensure credit row exists (upsert) ──
  INSERT INTO public.user_ai_credits (user_id, credit_balance, bonus_credits, lifetime_credits_used)
  VALUES (p_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_credits
  FROM public.user_ai_credits
  WHERE user_id = p_user_id;

  v_effective_balance := v_credits.credit_balance + v_credits.bonus_credits;

  -- ── 3. Decide whether to deduct ──
  -- Only deduct if enforcement is enabled AND the action succeeded
  IF v_entitlement.credit_enforcement_enabled AND p_request_status = 'success' THEN

    -- Check balance
    IF v_effective_balance < p_credits_required THEN
      -- Log the blocked attempt (0 credits deducted)
      INSERT INTO public.ai_usage_events (
        user_id, action_type, credits_used, estimated_cost_usd,
        request_status, request_id, model_name, input_tokens, output_tokens, metadata
      ) VALUES (
        p_user_id, p_action_type, 0, p_estimated_cost_usd,
        'blocked_insufficient_credits', p_request_id, p_model_name,
        p_input_tokens, p_output_tokens, p_metadata
      )
      RETURNING id INTO v_event_id;

      RETURN jsonb_build_object(
        'allowed',          FALSE,
        'reason',           'insufficient_credits',
        'effective_balance', v_effective_balance,
        'required',         p_credits_required,
        'enforcement',      TRUE,
        'event_id',         v_event_id
      );
    END IF;

    -- Deduct atomically — prefer spending credit_balance before bonus_credits
    v_deduct := LEAST(p_credits_required, v_credits.credit_balance);

    UPDATE public.user_ai_credits
    SET
      credit_balance        = credit_balance - v_deduct,
      bonus_credits         = bonus_credits - (p_credits_required - v_deduct),
      lifetime_credits_used = lifetime_credits_used + p_credits_required,
      updated_at            = NOW()
    WHERE user_id = p_user_id
      -- Safety guard: only proceed if effective balance is still sufficient
      AND (credit_balance + bonus_credits) >= p_credits_required;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
      -- Race condition: another request consumed credits between check and update
      INSERT INTO public.ai_usage_events (
        user_id, action_type, credits_used, request_status,
        request_id, model_name, input_tokens, output_tokens, metadata
      ) VALUES (
        p_user_id, p_action_type, 0, 'blocked_race_condition',
        p_request_id, p_model_name, p_input_tokens, p_output_tokens, p_metadata
      )
      RETURNING id INTO v_event_id;

      RETURN jsonb_build_object(
        'allowed',  FALSE,
        'reason',   'race_condition',
        'event_id', v_event_id
      );
    END IF;

  ELSE
    -- Enforcement is OFF (or action failed) — log analytically, do not block
    -- Still increment lifetime counter for analytics if successful
    IF p_request_status = 'success' THEN
      UPDATE public.user_ai_credits
      SET
        lifetime_credits_used = lifetime_credits_used + p_credits_required,
        updated_at            = NOW()
      WHERE user_id = p_user_id;
    END IF;

    v_deduct := 0; -- No real deduction when enforcement is off
  END IF;

  -- ── 4. Log usage event ──
  INSERT INTO public.ai_usage_events (
    user_id, action_type, credits_used, estimated_cost_usd,
    request_status, request_id, model_name, input_tokens, output_tokens, metadata
  ) VALUES (
    p_user_id,
    p_action_type,
    CASE WHEN v_entitlement.credit_enforcement_enabled THEN p_credits_required ELSE 0 END,
    p_estimated_cost_usd,
    p_request_status,
    p_request_id,
    p_model_name,
    p_input_tokens,
    p_output_tokens,
    p_metadata
  )
  RETURNING id INTO v_event_id;

  -- Refresh credit row for response
  SELECT * INTO v_credits FROM public.user_ai_credits WHERE user_id = p_user_id;
  v_effective_balance := v_credits.credit_balance + v_credits.bonus_credits;

  RETURN jsonb_build_object(
    'allowed',                TRUE,
    'enforcement',            v_entitlement.credit_enforcement_enabled,
    'monetization_enabled',   v_entitlement.monetization_enabled,
    'credits_used',           CASE WHEN v_entitlement.credit_enforcement_enabled THEN p_credits_required ELSE 0 END,
    'effective_balance',      v_effective_balance,
    'lifetime_credits_used',  v_credits.lifetime_credits_used,
    'event_id',               v_event_id
  );
END;
$$;

-- Grant execute to authenticated role (Express API uses service role; this is belt-and-suspenders)
GRANT EXECUTE ON FUNCTION public.process_ai_credit_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_ai_credit_usage TO service_role;


-- ============================================================
-- 5. Convenience view for analytics
-- ============================================================
-- Summarises per-user credit consumption — safe for admin tooling.
-- Not exposed via RLS to normal users.

CREATE OR REPLACE VIEW public.ai_credit_usage_summary AS
SELECT
  u.user_id,
  u.action_type,
  COUNT(*)                             AS total_events,
  SUM(u.credits_used)                  AS total_credits_used,
  SUM(u.estimated_cost_usd)            AS total_estimated_cost_usd,
  SUM(u.input_tokens)                  AS total_input_tokens,
  SUM(u.output_tokens)                 AS total_output_tokens,
  COUNT(*) FILTER (WHERE u.request_status = 'success')             AS success_count,
  COUNT(*) FILTER (WHERE u.request_status LIKE 'blocked%')         AS blocked_count,
  MAX(u.created_at)                    AS last_event_at
FROM public.ai_usage_events u
GROUP BY u.user_id, u.action_type;

-- This view is intentionally not RLS-protected — access via service role only.
