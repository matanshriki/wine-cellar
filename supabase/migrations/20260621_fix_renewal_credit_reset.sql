-- ============================================================
-- Fix: Monthly subscription credit renewal not resetting credits
-- ============================================================
--
-- Root cause:
--   When Paddle fires subscription.renewed for a recurring monthly
--   payment, the event's custom_data may not contain the userId.
--   In Paddle Billing v2, custom_data is attached to the checkout
--   transaction, not automatically copied to the subscription object.
--   Subsequent renewal events reference the subscription object's
--   custom_data (which is null), so the webhook handler exits early
--   without resetting credits.
--
--   Compounding issue: the event was still recorded in paddle_events
--   with user_id = NULL and processed_successfully = TRUE (implicit),
--   so Paddle retries were also silently dropped by the idempotency
--   check — making the failure permanent until a new billing cycle.
--
-- Fix overview (applied in billing.ts):
--   1. When userId is null from custom_data, look up the user by
--      paddle_subscription_id in user_ai_credits (stored at
--      subscription activation time).
--   2. Only mark an event as processed_successfully = TRUE when
--      credits were actually granted. Events with unresolvable userId
--      are stored as processed_successfully = FALSE so that a future
--      Paddle retry (or manual replay) can still succeed.
--
-- This migration:
--   1. Adds processed_successfully column to paddle_events.
--   2. Backfills: events with user_id IS NULL and a subscription
--      event type are marked processed_successfully = FALSE so they
--      are eligible for re-processing if replayed.
--   3. Rebuilds the idempotency unique index to cover the new column
--      if needed (event_id UNIQUE already exists; no change required).
--
-- All changes are IDEMPOTENT — safe to re-run.
-- ============================================================


-- ── 1. Add processed_successfully column ─────────────────────────────────────
ALTER TABLE public.paddle_events
  ADD COLUMN IF NOT EXISTS processed_successfully BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.paddle_events.processed_successfully IS
  'TRUE when the event was fully handled (credits granted / action taken).
   FALSE when the event was received but could not be processed — e.g.
   because the userId could not be resolved from custom_data or the DB.
   The idempotency check in the webhook handler only skips events where
   this flag is TRUE, allowing failed events to be re-processed on retry.';


-- ── 2. Backfill: mark subscription events with no resolved user as failed ─────
--
-- These are events that arrived before the DB-fallback fix was deployed.
-- The user's credits were NOT reset for these events. Setting
-- processed_successfully = FALSE means:
--   a) If Paddle still retries (within 72-hour window), the new handler
--      will resolve the userId via DB lookup and grant credits.
--   b) The repair script (supabase/scripts/repair_subscription_credits.sql)
--      can identify and fix users whose most-recent renewal was one of
--      these un-processed events.
--
-- Only subscription events are backfilled — transaction / admin events
-- with null user_id are expected to be one-offs and are left unchanged.
UPDATE public.paddle_events
SET    processed_successfully = FALSE
WHERE  user_id    IS NULL
  AND  event_type IN (
         'subscription.renewed',
         'subscription.activated',
         'subscription.created',
         'subscription.updated',
         'transaction.completed'
       )
  AND  processed_successfully = TRUE;   -- only touch rows not already fixed


-- ── 3. Index to speed up idempotency check (covers new column) ───────────────
--
-- The existing UNIQUE constraint on event_id already guarantees uniqueness.
-- Add a partial index on un-processed events so the idempotency SELECT is fast
-- (the common fast-path — already-processed events — keeps the existing index).
CREATE INDEX IF NOT EXISTS idx_paddle_events_unprocessed
  ON public.paddle_events (event_id)
  WHERE processed_successfully = FALSE;


-- ── 4. Grant (belt-and-suspenders) ───────────────────────────────────────────
-- paddle_events is service_role-only; no additional grants needed.
-- The existing RLS policy (USING FALSE) already blocks browser access.
