-- ============================================================
-- Engagement rollback (explicit transaction)
-- Removes ONLY feature-scoped objects from
--   20261030_admin_engagement_dashboard.sql (corrected package).
--
-- Does NOT restore prior CREATE OR REPLACE function bodies.
-- If functions existed before apply, restore from the saved output of
--   engagement_pre_change_backup.sql
--
-- Does NOT drop shared tables/columns (profiles.last_active_at remains).
-- Does NOT drop non-eng indexes (e.g. idx_ai_usage_events_user_created).
-- Avoids CASCADE.
--
-- Frontend/database order if aborting a release:
--   1) Stop shipping UI that calls engagement RPCs (or accept soft errors)
--   2) Run this rollback on the DB
--   3) Optionally restore saved function definitions from backup
-- Remaining data: last_active_at values written by heartbeat; product rows untouched.
-- ============================================================

BEGIN;

-- 1) Client RPCs
DROP FUNCTION IF EXISTS public.admin_engagement_user_detail(UUID);
DROP FUNCTION IF EXISTS public.admin_engagement_users(
  INT, INT, TEXT, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, BOOLEAN
);
DROP FUNCTION IF EXISTS public.admin_engagement_overview();

-- 2) Internal helper
DROP FUNCTION IF EXISTS public._admin_engagement_user_metrics();

-- 3) Config / exclusion
DROP FUNCTION IF EXISTS public.admin_engagement_config();
DROP FUNCTION IF EXISTS public.admin_engagement_is_excluded(TEXT, BOOLEAN);

-- 4) Heartbeat introduced by this feature (did not exist in prior Sommi migrations)
DROP FUNCTION IF EXISTS public.touch_profile_last_active();

-- 5) Feature-scoped indexes only (idx_eng_*). Never drop pre-existing non-eng names.
DROP INDEX IF EXISTS public.idx_eng_bottles_user_created;
DROP INDEX IF EXISTS public.idx_eng_wines_user_entry_created;
DROP INDEX IF EXISTS public.idx_eng_ai_usage_user_status_created;
DROP INDEX IF EXISTS public.idx_eng_app_events_user_name_created;
DROP INDEX IF EXISTS public.idx_eng_recommendation_runs_user_created;
DROP INDEX IF EXISTS public.idx_eng_evening_plans_user_created;
DROP INDEX IF EXISTS public.idx_eng_wine_reminders_user_created;
DROP INDEX IF EXISTS public.idx_eng_wishlist_items_user_created;

-- 6) Cleanup policies from earlier engagement drafts (current migration does not create these)
DROP POLICY IF EXISTS "Admins can read all consumption history" ON public.consumption_history;
DROP POLICY IF EXISTS "Admins can read all recommendation runs" ON public.recommendation_runs;
DROP POLICY IF EXISTS "Admins can read all evening plans" ON public.evening_plans;
DROP POLICY IF EXISTS "Admins can read all sommelier conversations" ON public.sommelier_conversations;
DROP POLICY IF EXISTS "Admins can read all sommelier recommendation events"
  ON public.sommelier_recommendation_events;
DO $$
BEGIN
  IF to_regclass('public.wine_reminders') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can read all wine reminders" ON public.wine_reminders';
  END IF;
  IF to_regclass('public.wishlist_items') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can read all wishlist items" ON public.wishlist_items';
  END IF;
  IF to_regclass('public.shared_cellars') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can read all shared cellars" ON public.shared_cellars';
  END IF;
END $$;

-- 7) Verify engagement functions gone
DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public'
    AND p.proname IN (
      'admin_engagement_overview','admin_engagement_users','admin_engagement_user_detail',
      '_admin_engagement_user_metrics','touch_profile_last_active',
      'admin_engagement_config','admin_engagement_is_excluded'
    );
  IF n <> 0 THEN
    RAISE EXCEPTION 'Rollback incomplete: % engagement functions still present', n;
  END IF;
END $$;

COMMIT;

-- Existing admin RPCs (admin_overview_metrics, admin_get_users, …) must remain.
