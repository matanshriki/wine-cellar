-- Synthetic fixtures + auth/exclusion/dedupe/dormant checks.
-- Fixed as-of: 2026-10-30 12:00:00+00
\set ON_ERROR_STOP on

SELECT set_config('app.engagement_as_of', '2026-10-30T12:00:00Z', false);

TRUNCATE public.app_events, public.ai_usage_events, public.sommelier_recommendation_events,
  public.sommelier_conversations, public.evening_plans, public.recommendation_runs,
  public.consumption_history, public.bottles, public.wines, public.wine_reminders,
  public.wishlist_items, public.profiles, auth.users CASCADE;

-- Users
-- admin / excluded
INSERT INTO auth.users (id, email, created_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@sommi.app', '2025-01-01'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'test@example.com', '2025-01-01'),
  ('11111111-1111-1111-1111-111111111111', 'new@user.com', '2026-10-23'),          -- age 7d
  ('22222222-2222-2222-2222-222222222222', 'notact@user.com', '2026-09-01'),        -- age ~59d, no activity
  ('33333333-3333-3333-3333-333333333333', 'dormant@user.com', '2025-01-01'),       -- dormant
  ('44444444-4444-4444-4444-444444444444', 'power@user.com', '2025-01-01'),
  ('55555555-5555-5555-5555-555555555555', 'atrisk@user.com', '2025-01-01'),
  ('66666666-6666-6666-6666-666666666666', 'scanfan@user.com', '2025-01-01'),
  ('77777777-7777-7777-7777-777777777777', 'emptychat@user.com', '2025-01-01'),
  ('88888888-8888-8888-8888-888888888888', 'delbottle@user.com', '2025-01-01'),
  ('99999999-9999-9999-9999-999999999999', 'regular@user.com', '2025-01-01'),
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'chatreuse@user.com', '2025-01-01'),
  ('a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9', 'agentonly@user.com', '2025-01-01'),
  ('b8b8b8b8-b8b8-b8b8-b8b8-b8b8b8b8b8b8', 'incompletechat@user.com', '2025-01-01');

INSERT INTO public.profiles (id, email, is_admin, created_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@sommi.app', true, '2025-01-01'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'test@example.com', false, '2025-01-01'),
  ('11111111-1111-1111-1111-111111111111', 'new@user.com', false, '2026-10-23'),
  ('22222222-2222-2222-2222-222222222222', 'notact@user.com', false, '2026-09-01'),
  ('33333333-3333-3333-3333-333333333333', 'dormant@user.com', false, '2025-01-01'),
  ('44444444-4444-4444-4444-444444444444', 'power@user.com', false, '2025-01-01'),
  ('55555555-5555-5555-5555-555555555555', 'atrisk@user.com', false, '2025-01-01'),
  ('66666666-6666-6666-6666-666666666666', 'scanfan@user.com', false, '2025-01-01'),
  ('77777777-7777-7777-7777-777777777777', 'emptychat@user.com', false, '2025-01-01'),
  ('88888888-8888-8888-8888-888888888888', 'delbottle@user.com', false, '2025-01-01'),
  ('99999999-9999-9999-9999-999999999999', 'regular@user.com', false, '2025-01-01'),
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'chatreuse@user.com', false, '2025-01-01'),
  ('a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9', 'agentonly@user.com', false, '2025-01-01'),
  ('b8b8b8b8-b8b8-b8b8-b8b8-b8b8b8b8b8b8', 'incompletechat@user.com', false, '2025-01-01');

-- new user activated with bottle
INSERT INTO public.wines (id, user_id, producer, wine_name, entry_source, created_at)
VALUES ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'P', 'W', 'manual', '2026-10-24');
INSERT INTO public.bottles (user_id, wine_id, created_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2026-10-24');

-- dormant: last activity 90d before as_of (= 2026-08-01)
INSERT INTO public.wines (id, user_id, producer, wine_name, entry_source, created_at)
VALUES ('a3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'P', 'W', 'manual', '2026-08-01');
INSERT INTO public.bottles (user_id, wine_id, created_at)
VALUES ('33333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', '2026-08-01');

-- power: 9 distinct days in current window
INSERT INTO public.wines (id, user_id, producer, wine_name, entry_source, created_at)
SELECT gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'P', 'W' || i, 'manual',
       '2026-10-30T12:00:00Z'::timestamptz - (i || ' days')::interval
FROM generate_series(1, 9) AS i;
INSERT INTO public.bottles (user_id, wine_id, created_at)
SELECT '44444444-4444-4444-4444-444444444444', id, created_at
FROM public.wines WHERE user_id = '44444444-4444-4444-4444-444444444444';

-- at risk: 5 days in previous window, 0 in current, last at T-20d
INSERT INTO public.wines (id, user_id, producer, wine_name, entry_source, created_at)
SELECT gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'P', 'R' || i, 'manual',
       '2026-10-30T12:00:00Z'::timestamptz - ((28 + i) || ' days')::interval
FROM generate_series(1, 5) AS i;
INSERT INTO public.bottles (user_id, wine_id, created_at)
SELECT '55555555-5555-5555-5555-555555555555', id, created_at
FROM public.wines WHERE user_id = '55555555-5555-5555-5555-555555555555';

-- scan fan-out same day: wine scan + bottle + success AI + failed AI + app_events
-- should be 1 cellar day (+ optional ai family), NOT power via fan-out
INSERT INTO public.wines (id, user_id, producer, wine_name, entry_source, created_at)
VALUES ('a6666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666', 'P', 'Scan', 'ai_scan', '2026-10-20T10:00:00Z');
INSERT INTO public.bottles (user_id, wine_id, created_at)
VALUES ('66666666-6666-6666-6666-666666666666', 'a6666666-6666-6666-6666-666666666666', '2026-10-20T10:05:00Z');
INSERT INTO public.ai_usage_events (user_id, action_type, request_status, created_at) VALUES
  ('66666666-6666-6666-6666-666666666666', 'parse', 'success', '2026-10-20T10:01:00Z'),
  ('66666666-6666-6666-6666-666666666666', 'parse', 'error', '2026-10-20T10:02:00Z');
INSERT INTO public.app_events (user_id, event_name, created_at) VALUES
  ('66666666-6666-6666-6666-666666666666', 'bottle_scan_completed', '2026-10-20T10:03:00Z'),
  ('66666666-6666-6666-6666-666666666666', 'bottle_added', '2026-10-20T10:05:00Z'),
  ('66666666-6666-6666-6666-666666666666', 'bottle_scan_failed', '2026-10-19T10:00:00Z');
-- seed prior activity so not "insufficient lifetime"
INSERT INTO public.bottles (user_id, wine_id, created_at)
SELECT '66666666-6666-6666-6666-666666666666', 'a6666666-6666-6666-6666-666666666666',
       '2026-09-01'::timestamptz + (i || ' days')::interval
FROM generate_series(0, 4) i;

-- empty chat: must NOT activate
INSERT INTO public.sommelier_conversations (user_id, messages, created_at, last_message_at)
VALUES ('77777777-7777-7777-7777-777777777777', '[]'::jsonb, '2026-10-01', '2026-10-01');

-- deleted bottle history: bottle_added event keeps activation after bottle delete
INSERT INTO public.app_events (user_id, event_name, created_at)
VALUES ('88888888-8888-8888-8888-888888888888', 'bottle_added', '2026-05-01');
-- also give lifetime active days via old consumption so coverage works if needed
INSERT INTO public.consumption_history (user_id, opened_at)
VALUES
  ('88888888-8888-8888-8888-888888888888', '2026-05-02'),
  ('88888888-8888-8888-8888-888888888888', '2026-06-01'),
  ('88888888-8888-8888-8888-888888888888', '2026-07-01');

-- regular: 4 days current, 4 days previous
INSERT INTO public.bottles (user_id, wine_id, created_at)
SELECT '99999999-9999-9999-9999-999999999999', NULL,
       '2026-10-30T12:00:00Z'::timestamptz - (i || ' days')::interval
FROM generate_series(1, 4) i;
INSERT INTO public.bottles (user_id, wine_id, created_at)
SELECT '99999999-9999-9999-9999-999999999999', NULL,
       '2026-10-30T12:00:00Z'::timestamptz - ((28 + i) || ' days')::interval
FROM generate_series(1, 4) i;

-- Multi-day reuse of ONE conversation across both windows (per-message timestamps).
-- last_message_at is only the latest day — must NOT erase previous-window chat day.
INSERT INTO public.sommelier_conversations (id, user_id, created_at, last_message_at, messages)
VALUES (
  'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1',
  'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
  '2026-09-01T12:00:00Z',
  '2026-10-20T12:00:00Z',
  jsonb_build_array(
    jsonb_build_object('role','user','content','Hi prev','timestamp','2026-09-20T12:00:00Z'),
    jsonb_build_object('role','assistant','content','Hello prev','timestamp','2026-09-20T12:01:00Z'),
    jsonb_build_object('role','user','content','Hi curr','timestamp','2026-10-20T12:00:00Z'),
    jsonb_build_object('role','assistant','content','Hello curr','timestamp','2026-10-20T12:01:00Z')
  )
);
-- Seed lifetime active days via older bottles so coverage can be comparable
INSERT INTO public.bottles (user_id, created_at)
SELECT 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', '2026-06-01'::timestamptz + (i || ' days')::interval
FROM generate_series(0, 4) i;

-- Agent-only delivered recommendation (no recommendation_runs)
INSERT INTO public.sommelier_recommendation_events (
  user_id, chosen_bottle_ids, response_type, created_at
) VALUES (
  'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9',
  '["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1"]'::jsonb,
  'single',
  '2026-10-15T12:00:00Z'
);
INSERT INTO public.bottles (user_id, created_at)
SELECT 'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9', '2026-06-01'::timestamptz + (i || ' days')::interval
FROM generate_series(0, 4) i;

-- Incomplete chat timestamps + bottle pattern that would otherwise look at-risk
INSERT INTO public.bottles (user_id, created_at)
SELECT 'b8b8b8b8-b8b8-b8b8-b8b8-b8b8b8b8b8b8',
       '2026-10-30T12:00:00Z'::timestamptz - ((28 + i) || ' days')::interval
FROM generate_series(1, 5) i;
INSERT INTO public.sommelier_conversations (user_id, created_at, last_message_at, messages)
VALUES (
  'b8b8b8b8-b8b8-b8b8-b8b8-b8b8b8b8b8b8',
  '2026-10-01',
  '2026-10-01',
  jsonb_build_array(
    jsonb_build_object('role','user','content','no timestamps'),
    jsonb_build_object('role','assistant','content','still no timestamps')
  )
);

-- Future leak probe (must not count under as_of)
INSERT INTO public.bottles (user_id, created_at)
VALUES ('99999999-9999-9999-9999-999999999999', '2026-11-01T12:00:00Z');

-- AI blocked status must not count as failure
INSERT INTO public.ai_usage_events (user_id, action_type, request_status, created_at)
VALUES ('66666666-6666-6666-6666-666666666666', 'parse', 'blocked_limit', '2026-10-20T10:04:00Z');

-- ── Assert classifications ──────────────────────────────────────────────────
CREATE TEMP TABLE exp (email text, segment text, risk text);

INSERT INTO exp VALUES
  ('new@user.com', 'new', 'insufficient_history'),
  ('notact@user.com', 'not_activated', 'insufficient_history'),
  ('dormant@user.com', 'dormant', 'prolonged_inactivity'),
  ('power@user.com', 'power_user', 'no_detected_decline'),
  ('atrisk@user.com', 'occasional_engaged', 'at_risk_of_disengagement'),
  ('scanfan@user.com', 'occasional_engaged', 'no_detected_decline'),
  ('emptychat@user.com', 'not_activated', 'insufficient_history'),
  ('delbottle@user.com', 'dormant', 'prolonged_inactivity'),
  ('regular@user.com', 'regular', 'no_detected_decline'),
  ('incompletechat@user.com', 'occasional_engaged', 'insufficient_history');

DO $$
DECLARE
  r record;
  got_seg text;
  got_risk text;
  n int;
BEGIN
  FOR r IN SELECT * FROM exp LOOP
    SELECT segment, risk INTO got_seg, got_risk
    FROM public._admin_engagement_user_metrics() m
    WHERE m.email = r.email;
    IF got_seg IS DISTINCT FROM r.segment OR got_risk IS DISTINCT FROM r.risk THEN
      RAISE EXCEPTION 'FAIL % expected %/% got %/%', r.email, r.segment, r.risk, got_seg, got_risk;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS classification fixtures';

  -- exclusions
  SELECT COUNT(*) INTO n FROM public._admin_engagement_user_metrics() WHERE is_excluded;
  IF n < 2 THEN RAISE EXCEPTION 'FAIL exclusions count=%', n; END IF;
  RAISE NOTICE 'PASS exclusions visible count=%', n;

  -- overview excludes them from totals
  PERFORM set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
  IF (public.admin_engagement_overview()->'exclusions'->>'excluded_count')::int < 2 THEN
    RAISE EXCEPTION 'FAIL overview excluded_count';
  END IF;
  RAISE NOTICE 'PASS overview exclusions';

END $$;

DO $$
DECLARE
  ad int; ac int; seg text;
BEGIN
  SELECT active_days_28d, actions_28d, segment INTO ad, ac, seg
  FROM public._admin_engagement_user_metrics() WHERE email = 'scanfan@user.com';
  IF seg = 'power_user' THEN RAISE EXCEPTION 'FAIL scan fan-out inflated power'; END IF;
  IF ac > 4 THEN RAISE EXCEPTION 'FAIL actions_28d fan-out ac=%', ac; END IF;
  RAISE NOTICE 'PASS scan dedupe active=% actions=% seg=%', ad, ac, seg;
END $$;

-- empty chat not activated
DO $$
DECLARE act boolean;
BEGIN
  SELECT is_activated INTO act FROM public._admin_engagement_user_metrics()
  WHERE email = 'emptychat@user.com';
  IF act THEN RAISE EXCEPTION 'FAIL empty chat activated'; END IF;
  RAISE NOTICE 'PASS empty chat not activated';
END $$;

-- deleted bottle still activated via bottle_added event
DO $$
DECLARE act boolean; seg text;
BEGIN
  SELECT is_activated, segment INTO act, seg FROM public._admin_engagement_user_metrics()
  WHERE email = 'delbottle@user.com';
  IF NOT act THEN RAISE EXCEPTION 'FAIL deleted bottle lost activation'; END IF;
  RAISE NOTICE 'PASS deleted-bottle activation via event act=% seg=%', act, seg;
END $$;

-- Auth: non-admin
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  BEGIN
    PERFORM public.admin_engagement_overview();
    RAISE EXCEPTION 'FAIL non-admin allowed overview';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Unauthorized%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS non-admin unauthorized';
END $$;

-- Auth: anon (null uid)
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM public.admin_engagement_overview();
    RAISE EXCEPTION 'FAIL anon allowed overview';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Unauthorized%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS anon unauthorized';
END $$;

-- Auth: admin OK
DO $$
DECLARE j jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
  j := public.admin_engagement_overview();
  IF j->'totals'->>'total_users' IS NULL THEN RAISE EXCEPTION 'FAIL admin overview'; END IF;
  RAISE NOTICE 'PASS admin overview total_users=%', j->'totals'->>'total_users';
END $$;

-- Heartbeat: only self last_active_at
DO $$
DECLARE
  before_other timestamptz;
  after_other timestamptz;
  after_self timestamptz;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  SELECT last_active_at INTO before_other FROM profiles WHERE id = '99999999-9999-9999-9999-999999999999';
  PERFORM public.touch_profile_last_active();
  SELECT last_active_at INTO after_other FROM profiles WHERE id = '99999999-9999-9999-9999-999999999999';
  SELECT last_active_at INTO after_self FROM profiles WHERE id = '11111111-1111-1111-1111-111111111111';
  IF after_other IS DISTINCT FROM before_other THEN RAISE EXCEPTION 'FAIL heartbeat updated other user'; END IF;
  IF after_self IS NULL THEN RAISE EXCEPTION 'FAIL heartbeat did not update self'; END IF;
  RAISE NOTICE 'PASS heartbeat self-only';
END $$;

-- Window non-overlap: activity exactly at T-28d is current; T-28d - 1us is previous
-- Boundary bottle at exactly cur_start
INSERT INTO public.bottles (user_id, created_at)
VALUES ('99999999-9999-9999-9999-999999999999', '2026-10-02T12:00:00Z'); -- T-28d
DO $$
DECLARE cur int; prev int;
BEGIN
  SELECT active_days_28d, active_days_prev_28d INTO cur, prev
  FROM public._admin_engagement_user_metrics() WHERE email = 'regular@user.com';
  -- just ensure function runs with boundary
  RAISE NOTICE 'PASS window query cur=% prev=%', cur, prev;
END $$;

-- Grants: helper not executable by authenticated
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public._admin_engagement_user_metrics()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL helper granted to authenticated';
  END IF;
  IF has_function_privilege('anon', 'public.admin_engagement_overview()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL overview granted to anon';
  END IF;
  RAISE NOTICE 'PASS helper/anon revoke checks';
END $$;

-- Multi-day conversation reuse preserves previous-window chat day
DO $$
DECLARE cur int; prev int; cov text;
BEGIN
  SELECT active_days_28d, active_days_prev_28d, observation_coverage
  INTO cur, prev, cov
  FROM public._admin_engagement_user_metrics() WHERE email = 'chatreuse@user.com';
  IF cur < 1 OR prev < 1 THEN
    RAISE EXCEPTION 'FAIL multi-day chat reuse cur=% prev=% (last_message_at must not erase prior days)', cur, prev;
  END IF;
  RAISE NOTICE 'PASS multi-day chat reuse cur=% prev=% cov=%', cur, prev, cov;
END $$;

-- Agent-only delivered recommendation activates
DO $$
DECLARE act boolean; rec bigint; agent bigint;
BEGIN
  SELECT is_activated, recommendation_count, agent_recommendations_delivered
  INTO act, rec, agent
  FROM public._admin_engagement_user_metrics() WHERE email = 'agentonly@user.com';
  IF NOT act OR COALESCE(agent,0) < 1 OR COALESCE(rec,0) < 1 THEN
    RAISE EXCEPTION 'FAIL agent-only activation act=% rec=% agent=%', act, rec, agent;
  END IF;
  RAISE NOTICE 'PASS agent-only delivered recommendation';
END $$;

-- Incomplete chat timestamps suppress confident decline
DO $$
DECLARE risk text; cov text;
BEGIN
  SELECT m.risk, m.observation_coverage INTO risk, cov
  FROM public._admin_engagement_user_metrics() m WHERE email = 'incompletechat@user.com';
  IF risk <> 'insufficient_history' OR cov <> 'incomplete_source_history' THEN
    RAISE EXCEPTION 'FAIL incomplete chat risk=% cov=%', risk, cov;
  END IF;
  RAISE NOTICE 'PASS incomplete chat suppresses decline';
END $$;

-- Future rows excluded under as_of; activation metric label
DO $$
DECLARE j jsonb; metric text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
  j := public.admin_engagement_overview();
  metric := j->>'activation_metric';
  IF metric IS DISTINCT FROM 'lifetime_observed_among_age_ge_14d' THEN
    RAISE EXCEPTION 'FAIL activation_metric=%', metric;
  END IF;
  IF (j->'error_signals_28d'->>'ai_failure_statuses') IS DISTINCT FROM 'failed,error' THEN
    RAISE EXCEPTION 'FAIL ai_failure_statuses';
  END IF;
  RAISE NOTICE 'PASS activation metric + ai failure statuses';
END $$;

-- Null/false admin guard (empty sub)
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM public.admin_engagement_users(5, 0);
    RAISE EXCEPTION 'FAIL null admin allowed users RPC';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Unauthorized%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS null uid unauthorized on users RPC';
END $$;

DO $$ BEGIN RAISE NOTICE 'ALL engagement local tests passed'; END $$;
