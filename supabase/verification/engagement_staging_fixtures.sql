-- ============================================================
-- STAGING-ONLY synthetic fixtures for Engagement validation
-- ============================================================
-- DO NOT run on production.
-- DO NOT mix into the release migration.
--
-- Purpose: create disposable profiles + durable activity rows so the
-- Engagement UI/RPCs show populated / empty / partial / risk cases.
--
-- Prerequisites:
--   1. Migration 20261030_admin_engagement_dashboard.sql applied
--   2. You already have (or will create in Auth UI) real Auth users whose
--      UUIDs you paste below. Prefer Auth-created users so browser login works.
--      If you only need RPC shape checks as postgres, profiles-only is OK,
--      but browser auth tests still need Auth users.
--
-- Instructions:
--   1. Replace the UUID placeholders below with unused staging UUIDs.
--   2. Run the SEED section once.
--   3. Run browser / JWT checks.
--   4. Run the CLEANUP section (bottom) when finished.
--
-- Do not paste emails of real customers, JWTs, or passwords into chat.
-- ============================================================

-- ---------- CONFIG (edit these) ----------
-- Use fixed synthetic UUIDs you control on staging Auth.
-- Example pattern (replace entirely):
--   eng_admin   = your existing staging admin (do NOT create a second admin here)
--   eng_user_a  = non-admin for authorization negative tests
--   eng_new …   = synthetic engagement cohort users

-- BEGIN SEED (comment out if re-running after partial failure; prefer CLEANUP first)

/*
-- Example: after creating Auth users in Dashboard, upsert matching profiles.
-- Replace every '00000000-0000-4000-8000-00000000000X' before running.

INSERT INTO public.profiles (id, email, display_name, created_at, is_admin, last_active_at)
VALUES
  -- Non-admin auth probe (authorization negative). Keep is_admin false.
  ('00000000-0000-4000-8000-0000000000a1', 'eng+nonadmin@sommi.test', 'Eng NonAdmin', NOW() - INTERVAL '100 days', false, NULL),
  -- New (<14d)
  ('00000000-0000-4000-8000-0000000000b1', 'eng+new@sommi.test', 'Eng New', NOW() - INTERVAL '5 days', false, NULL),
  -- Not activated (≥14d, no durable value)
  ('00000000-0000-4000-8000-0000000000b2', 'eng+notactivated@sommi.test', 'Eng NotAct', NOW() - INTERVAL '30 days', false, NULL),
  -- Regular / durable_comparable candidate
  ('00000000-0000-4000-8000-0000000000b3', 'eng+regular@sommi.test', 'Eng Regular', NOW() - INTERVAL '120 days', false, NOW() - INTERVAL '1 day'),
  -- At-risk (prior window active, current quiet)
  ('00000000-0000-4000-8000-0000000000b4', 'eng+atrisk@sommi.test', 'Eng AtRisk', NOW() - INTERVAL '120 days', false, NOW() - INTERVAL '20 days'),
  -- Dormant / prolonged_inactivity
  ('00000000-0000-4000-8000-0000000000b5', 'eng+dormant@sommi.test', 'Eng Dormant', NOW() - INTERVAL '200 days', false, NULL),
  -- Empty chat (must NOT activate)
  ('00000000-0000-4000-8000-0000000000b6', 'eng+emptychat@sommi.test', 'Eng EmptyChat', NOW() - INTERVAL '40 days', false, NULL)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  created_at = EXCLUDED.created_at,
  is_admin = EXCLUDED.is_admin;

-- Regular: activity in both half-open windows relative to NOW()
INSERT INTO public.bottles (id, user_id, created_at)
SELECT gen_random_uuid(), '00000000-0000-4000-8000-0000000000b3', NOW() - (d || ' days')::interval
FROM generate_series(2, 10, 2) AS d
ON CONFLICT DO NOTHING;

-- At-risk: ≥3 active days in previous window [T-56,T-28), ≤1 in current, ≥14d since last
INSERT INTO public.bottles (id, user_id, created_at)
SELECT gen_random_uuid(), '00000000-0000-4000-8000-0000000000b4', NOW() - (d || ' days')::interval
FROM unnest(ARRAY[35, 40, 45, 50]) AS d;

-- Dormant: last activity ≥60d ago
INSERT INTO public.bottles (id, user_id, created_at)
VALUES (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b5', NOW() - INTERVAL '90 days');

-- Empty chat shell (no user+assistant) — must not activate
INSERT INTO public.sommelier_conversations (id, user_id, created_at, last_message_at, messages)
VALUES (
  gen_random_uuid(),
  '00000000-0000-4000-8000-0000000000b6',
  NOW() - INTERVAL '20 days',
  NOW() - INTERVAL '20 days',
  '[]'::jsonb
);

-- Zero-result recommendation — must not activate / must not count as delivered
INSERT INTO public.recommendation_runs (id, user_id, created_at, recommendation_count)
VALUES (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b6', NOW() - INTERVAL '15 days', 0);

-- Note: emails use @sommi.test and will be EXCLUDED from overview by default.
-- Toggle "Include excluded" in the UI, or temporarily use a non-excluded domain
-- on a throwaway staging account if you need them in overview totals.
*/

-- END SEED


-- ---------- CLEANUP (run after validation) ----------
-- Replace the same UUIDs you used in SEED.
-- Order: dependent rows first, then profiles. Do not delete unrelated users.

/*
DO $$
DECLARE
  ids uuid[] := ARRAY[
    '00000000-0000-4000-8000-0000000000a1'::uuid,
    '00000000-0000-4000-8000-0000000000b1'::uuid,
    '00000000-0000-4000-8000-0000000000b2'::uuid,
    '00000000-0000-4000-8000-0000000000b3'::uuid,
    '00000000-0000-4000-8000-0000000000b4'::uuid,
    '00000000-0000-4000-8000-0000000000b5'::uuid,
    '00000000-0000-4000-8000-0000000000b6'::uuid
  ];
BEGIN
  DELETE FROM public.bottles WHERE user_id = ANY (ids);
  DELETE FROM public.wines WHERE user_id = ANY (ids);
  DELETE FROM public.consumption_history WHERE user_id = ANY (ids);
  DELETE FROM public.recommendation_runs WHERE user_id = ANY (ids);
  DELETE FROM public.evening_plans WHERE user_id = ANY (ids);
  DELETE FROM public.sommelier_conversations WHERE user_id = ANY (ids);
  DELETE FROM public.sommelier_recommendation_events WHERE user_id = ANY (ids);
  DELETE FROM public.ai_usage_events WHERE user_id = ANY (ids);
  DELETE FROM public.app_events WHERE user_id = ANY (ids);
  IF to_regclass('public.wine_reminders') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.wine_reminders WHERE user_id = ANY ($1)' USING ids;
  END IF;
  IF to_regclass('public.wishlist_items') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.wishlist_items WHERE user_id = ANY ($1)' USING ids;
  END IF;
  DELETE FROM public.profiles WHERE id = ANY (ids);
END $$;

-- Also delete the Auth users in the Supabase Dashboard (Authentication → Users)
-- for the same UUIDs. SQL DELETE on auth.users is project-specific; prefer UI.
*/
