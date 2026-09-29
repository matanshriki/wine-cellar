-- Keep reminder type + duplicate prevention (run after 20260929_wine_reminders_keep.sql)

INSERT INTO auth.users (id) VALUES
  ('11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  uid uuid := '11111111-1111-1111-1111-111111111111';
  bid uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  n int;
BEGIN
  DELETE FROM wine_reminders WHERE client_timer_id LIKE 'keep_%' OR client_timer_id LIKE 'tmr_keep_%';

  -- keep type allowed
  INSERT INTO wine_reminders (
    user_id, client_timer_id, reminder_type, fire_at, status, bottle_id, wine_name, producer
  ) VALUES (
    uid, 'keep_' || bid::text, 'keep', now() + interval '2 days', 'pending', bid, 'Keep Test', 'Local'
  );
  RAISE NOTICE 'PASS keep-insert';

  -- duplicate pending keep for same bottle blocked by unique index
  BEGIN
    INSERT INTO wine_reminders (
      user_id, client_timer_id, reminder_type, fire_at, status, bottle_id, wine_name, producer
    ) VALUES (
      uid, 'tmr_keep_dup_other_id', 'keep', now() + interval '3 days', 'pending', bid, 'Dup', 'Local'
    );
    RAISE EXCEPTION 'FAIL keep-dup: expected unique violation';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'PASS keep-dup-blocked';
  END;

  -- upsert-style replace via same client_timer_id
  INSERT INTO wine_reminders (
    user_id, client_timer_id, reminder_type, fire_at, status, bottle_id, wine_name, producer
  ) VALUES (
    uid, 'keep_' || bid::text, 'keep', now() + interval '5 days', 'pending', bid, 'Keep Test', 'Local'
  )
  ON CONFLICT (user_id, client_timer_id) DO UPDATE
    SET fire_at = EXCLUDED.fire_at, status = 'pending', sent_at = NULL, last_error = NULL;

  SELECT count(*) INTO n FROM wine_reminders
  WHERE client_timer_id = 'keep_' || bid::text AND status = 'pending';
  IF n <> 1 THEN
    RAISE EXCEPTION 'FAIL keep-replace: expected 1 pending row, got %', n;
  END IF;
  RAISE NOTICE 'PASS keep-replace';

  -- cancel
  UPDATE wine_reminders SET status = 'canceled'
  WHERE client_timer_id = 'keep_' || bid::text AND status IN ('pending', 'sending');
  IF (SELECT status FROM wine_reminders WHERE client_timer_id = 'keep_' || bid::text) <> 'canceled' THEN
    RAISE EXCEPTION 'FAIL keep-cancel';
  END IF;
  RAISE NOTICE 'PASS keep-cancel';

  -- past fire_at canceled must not be claimed
  INSERT INTO wine_reminders (
    user_id, client_timer_id, reminder_type, fire_at, status, bottle_id
  ) VALUES (
    uid, 'tmr_keep_past_canceled', 'keep', now() - interval '30 days', 'canceled', gen_random_uuid()
  );
  SELECT count(*) INTO n FROM claim_due_wine_reminders(50) c
  WHERE c.client_timer_id = 'tmr_keep_past_canceled';
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL keep-no-claim-canceled-past';
  END IF;
  RAISE NOTICE 'PASS keep-no-claim-canceled-past';

  DELETE FROM wine_reminders WHERE client_timer_id LIKE 'keep_%' OR client_timer_id LIKE 'tmr_keep_%';
END $$;
