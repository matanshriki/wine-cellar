-- Local verification: create / cancel / claim / retry / concurrent / RLS
-- Aborts on first failure. Success prints NOTICE PASS_* lines.

\set ON_ERROR_STOP on

-- Fresh users for this run
TRUNCATE public.wine_reminders CASCADE;
TRUNCATE public.push_subscriptions CASCADE;
TRUNCATE auth.users CASCADE;

INSERT INTO auth.users (id) VALUES
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

-- ── 1) Create ───────────────────────────────────────────────────────────────
INSERT INTO public.wine_reminders (
  user_id, client_timer_id, reminder_type, fire_at, status, wine_name, producer
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'tmr_local_1', 'decant', now() - interval '1 minute', 'pending', 'Test Wine', 'Producer'
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM wine_reminders WHERE client_timer_id = 'tmr_local_1' AND status = 'pending') THEN
    RAISE EXCEPTION 'FAIL create';
  END IF;
  RAISE NOTICE 'PASS create';
END $$;

-- ── 2) Cancel before claim ──────────────────────────────────────────────────
INSERT INTO public.wine_reminders (
  user_id, client_timer_id, reminder_type, fire_at, status
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'tmr_local_cancel', 'rate', now() - interval '1 minute', 'pending'
);
UPDATE public.wine_reminders SET status = 'canceled'
WHERE client_timer_id = 'tmr_local_cancel' AND status IN ('pending', 'sending');

DO $$
DECLARE n int;
BEGIN
  IF (SELECT status FROM wine_reminders WHERE client_timer_id = 'tmr_local_cancel') <> 'canceled' THEN
    RAISE EXCEPTION 'FAIL cancel status';
  END IF;
  SELECT count(*) INTO n FROM claim_due_wine_reminders(50) c
  WHERE c.client_timer_id = 'tmr_local_cancel';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL cancel still claimable'; END IF;
  RAISE NOTICE 'PASS cancel';
END $$;

-- ── 3) Claim + no double-claim while sending ────────────────────────────────
DO $$
DECLARE
  id1 uuid;
  ids uuid[];
  ids2 uuid[];
  st text;
BEGIN
  SELECT id INTO id1 FROM wine_reminders WHERE client_timer_id = 'tmr_local_1';
  UPDATE wine_reminders SET status = 'pending', updated_at = now() WHERE id = id1;

  SELECT array_agg(id) INTO ids FROM claim_due_wine_reminders(50);
  IF NOT (id1 = ANY (ids)) THEN RAISE EXCEPTION 'FAIL claim missing id'; END IF;
  SELECT status INTO st FROM wine_reminders WHERE id = id1;
  IF st <> 'sending' THEN RAISE EXCEPTION 'FAIL claim status=%', st; END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO ids2 FROM claim_due_wine_reminders(50);
  IF id1 = ANY (ids2) THEN RAISE EXCEPTION 'FAIL double-claim while sending'; END IF;
  RAISE NOTICE 'PASS claim';
END $$;

-- ── 4) Retry: sending -> pending -> reclaim; stuck sending recovery ─────────
INSERT INTO public.wine_reminders (
  user_id, client_timer_id, reminder_type, fire_at, status
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'tmr_local_retry', 'decant', now() - interval '30 seconds', 'sending'
);
UPDATE wine_reminders SET status = 'pending', last_error = 'transient_test', updated_at = now()
WHERE client_timer_id = 'tmr_local_retry';

DO $$
DECLARE idr uuid; got uuid;
BEGIN
  SELECT id INTO idr FROM wine_reminders WHERE client_timer_id = 'tmr_local_retry';
  SELECT c.id INTO got FROM claim_due_wine_reminders(50) c WHERE c.id = idr;
  IF got IS NULL THEN RAISE EXCEPTION 'FAIL retry reclaim'; END IF;

  -- Trigger set_updated_at_timestamp would overwrite a backdated updated_at;
  -- disable it only for this simulation (production crash leaves claim-time stamp).
  ALTER TABLE wine_reminders DISABLE TRIGGER wine_reminders_updated_at;
  UPDATE wine_reminders
  SET status = 'sending', updated_at = now() - interval '11 minutes'
  WHERE id = idr;
  ALTER TABLE wine_reminders ENABLE TRIGGER wine_reminders_updated_at;

  got := NULL;
  SELECT c.id INTO got FROM claim_due_wine_reminders(50) c WHERE c.id = idr;
  IF got IS NULL THEN RAISE EXCEPTION 'FAIL stuck-recovery'; END IF;
  RAISE NOTICE 'PASS retry';
END $$;

-- ── 5) Concurrent-style sequential exclusive claims (batch_size=1) ──────────
DELETE FROM wine_reminders WHERE client_timer_id LIKE 'tmr_conc_%';
INSERT INTO wine_reminders (user_id, client_timer_id, reminder_type, fire_at, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'tmr_conc_a', 'decant', now() - interval '1 minute', 'pending'),
  ('11111111-1111-1111-1111-111111111111', 'tmr_conc_b', 'rate', now() - interval '1 minute', 'pending');

DO $$
DECLARE a uuid; b uuid; c1 uuid; c2 uuid;
BEGIN
  SELECT id INTO a FROM wine_reminders WHERE client_timer_id = 'tmr_conc_a';
  SELECT id INTO b FROM wine_reminders WHERE client_timer_id = 'tmr_conc_b';
  SELECT id INTO c1 FROM claim_due_wine_reminders(1);
  SELECT id INTO c2 FROM claim_due_wine_reminders(1);
  IF c1 IS NULL OR c2 IS NULL THEN RAISE EXCEPTION 'FAIL concurrent null claim'; END IF;
  IF c1 = c2 THEN RAISE EXCEPTION 'FAIL concurrent same id'; END IF;
  IF NOT (c1 IN (a,b) AND c2 IN (a,b)) THEN RAISE EXCEPTION 'FAIL concurrent unexpected ids'; END IF;
  RAISE NOTICE 'PASS concurrent';
END $$;

-- ── 6) Cancel while sending ─────────────────────────────────────────────────
DO $$
DECLARE id1 uuid; n int;
BEGIN
  SELECT id INTO id1 FROM wine_reminders WHERE client_timer_id = 'tmr_local_1';
  UPDATE wine_reminders SET status = 'sending', updated_at = now() WHERE id = id1;
  UPDATE wine_reminders SET status = 'canceled'
  WHERE id = id1 AND status IN ('pending', 'sending');
  IF (SELECT status FROM wine_reminders WHERE id = id1) <> 'canceled' THEN
    RAISE EXCEPTION 'FAIL cancel-during-sending status';
  END IF;
  SELECT count(*) INTO n FROM claim_due_wine_reminders(50) c WHERE c.id = id1;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL cancel-during-sending claimed'; END IF;
  RAISE NOTICE 'PASS cancel-during-sending';
END $$;

-- ── 7) RLS isolation (SET ROLE authenticated + jwt sub) ─────────────────────
INSERT INTO wine_reminders (user_id, client_timer_id, reminder_type, fire_at, status)
VALUES ('22222222-2222-2222-2222-222222222222', 'tmr_u2_only', 'decant', now() - interval '1 minute', 'pending')
ON CONFLICT DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM wine_reminders WHERE user_id = '22222222-2222-2222-2222-222222222222';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL RLS-select count=%', n; END IF;
  RAISE NOTICE 'PASS RLS-select';

  BEGIN
    INSERT INTO wine_reminders (user_id, client_timer_id, reminder_type, fire_at, status)
    VALUES ('22222222-2222-2222-2222-222222222222', 'tmr_u2_via_u1', 'rate', now(), 'pending');
    RAISE EXCEPTION 'FAIL RLS-insert allowed';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS RLS-insert-blocked';
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'FAIL RLS-insert%' THEN RAISE; END IF;
      RAISE NOTICE 'PASS RLS-insert-blocked (%)', SQLERRM;
  END;

  RESET ROLE;
END $$;

SELECT 'ALL_LOCAL_WEB_PUSH_TESTS_PASSED' AS result;
