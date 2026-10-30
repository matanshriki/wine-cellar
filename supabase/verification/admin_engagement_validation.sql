-- ============================================================
-- Admin Engagement validation (LOCAL / STAGING ONLY)
-- Do NOT run against production user data.
--
-- Prerequisites:
--   1. Apply 20261030_admin_engagement_dashboard.sql on an isolated DB
--   2. Have at least one profiles.is_admin = true user JWT for RPC tests
--
-- Parity fixtures must match apps/web/src/lib/admin/engagementRules.parity.test.ts
-- Report timestamp reference: 2026-10-30 (UTC). Live RPCs use NOW().
-- ============================================================

-- A) Authorization smoke
-- As anon / non-admin authenticated: expect Unauthorized
-- SELECT public.admin_engagement_overview();
-- SELECT public.admin_engagement_users();
-- SELECT public.admin_engagement_user_detail('<uuid>');

-- B) touch_profile_last_active isolation
-- As user A: SELECT public.touch_profile_last_active();
-- Verify only profiles.last_active_at for auth.uid() changed; no other columns.
-- Attempting to pass another user id is impossible (function takes no user arg).

-- C) Exclusion consistency
-- SELECT (admin_engagement_overview()->'exclusions'->>'excluded_count')::int AS excluded;
-- SELECT (admin_engagement_overview()->'totals'->>'total_users')::int AS included;
-- Confirm included + excluded = COUNT(*) FROM profiles
-- AND feature_adoption / segment counts use the same excluded filter.
-- User table default p_include_excluded=false must omit excluded emails/admins.

-- D) Window boundary check (as-of fixed date)
-- Replace NOW() mentally with '2026-10-30'::date for manual audits:
--   current:  d >= '2026-10-02'   -- D-28
--   previous: d >= '2026-09-04' AND d < '2026-10-02'  -- [D-56, D-28)

-- E) Activation semantics samples
-- Empty chat must NOT activate:
--   INSERT sommelier_conversations (user_id, messages) VALUES (..., '[]'::jsonb);
-- Delivered rec activates; zero-count does not:
--   recommendation_runs.recommendation_count > 0
-- Failed AI must not create activity family 'ai':
--   ai_usage_events.request_status <> 'success'

-- F) Scan fan-out must not create power via actions
-- Same UTC day: bottle + ai_scan wine + successful AI → cellar + ai families only
-- Power requires active_days_28d >= 8 (not action volume).

-- G) Dormant risk
-- Activated user with last meaningful ≥ 60d ago and both windows 0
-- → segment dormant, risk prolonged_inactivity (NOT no_detected_decline)

-- H) Grants checklist
SELECT
  p.proname,
  r.rolname,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname IN (
    'admin_engagement_overview',
    'admin_engagement_users',
    'admin_engagement_user_detail',
    '_admin_engagement_user_metrics',
    'touch_profile_last_active'
  )
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY 1, 2;

-- Expect:
--   _admin_engagement_user_metrics: no EXECUTE for anon/authenticated
--   admin_engagement_*: EXECUTE for authenticated (admin check inside)
--   touch_profile_last_active: EXECUTE authenticated only; not anon
