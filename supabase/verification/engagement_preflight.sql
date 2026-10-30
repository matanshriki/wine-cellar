-- ============================================================
-- Engagement preflight (READ-ONLY)
-- Run BEFORE applying 20261030_admin_engagement_dashboard.sql
--
-- SQL Editor safe: one statement, no TEMP tables, no BEGIN/COMMIT.
-- (Supabase SQL Editor often auto-commits per statement, which
-- drops ON COMMIT DROP temp tables before later inserts.)
--
-- One authoritative check set drives detail rows and the verdict.
-- Any required failure blocks PREFLIGHT_OK.
-- Does not select private user content or secrets.
-- A pass means prerequisites look OK — not a deployment guarantee.
-- ============================================================

WITH
req_tables AS (
  SELECT * FROM (VALUES
    ('profiles'),('bottles'),('wines'),('consumption_history'),
    ('recommendation_runs'),('evening_plans'),('sommelier_conversations'),
    ('sommelier_recommendation_events'),('ai_usage_events'),('app_events')
  ) AS t(table_name)
),
opt_tables AS (
  SELECT * FROM (VALUES
    ('wine_reminders'),('wishlist_items'),('shared_cellars')
  ) AS t(table_name)
),
req_columns AS (
  SELECT * FROM (VALUES
    ('profiles','id','uuid'),
    ('profiles','email','text'),
    ('profiles','display_name','text'),
    ('profiles','created_at','timestamptz'),
    ('profiles','last_active_at','timestamptz'),
    ('profiles','is_admin','bool'),
    ('bottles','id','uuid'),
    ('bottles','user_id','uuid'),
    ('bottles','created_at','timestamptz'),
    ('wines','id','uuid'),
    ('wines','user_id','uuid'),
    ('wines','created_at','timestamptz'),
    ('wines','entry_source','text'),
    ('consumption_history','user_id','uuid'),
    ('consumption_history','opened_at','timestamptz'),
    ('consumption_history','user_rating','int4'),
    ('recommendation_runs','user_id','uuid'),
    ('recommendation_runs','created_at','timestamptz'),
    ('recommendation_runs','recommendation_count','int4'),
    ('evening_plans','user_id','uuid'),
    ('evening_plans','created_at','timestamptz'),
    ('evening_plans','status','text'),
    ('sommelier_conversations','id','uuid'),
    ('sommelier_conversations','user_id','uuid'),
    ('sommelier_conversations','created_at','timestamptz'),
    ('sommelier_conversations','last_message_at','timestamptz'),
    ('sommelier_conversations','messages','jsonb'),
    ('sommelier_recommendation_events','id','uuid'),
    ('sommelier_recommendation_events','user_id','uuid'),
    ('sommelier_recommendation_events','created_at','timestamptz'),
    ('sommelier_recommendation_events','chosen_bottle_ids','jsonb'),
    ('sommelier_recommendation_events','response_type','text'),
    ('ai_usage_events','user_id','uuid'),
    ('ai_usage_events','created_at','timestamptz'),
    ('ai_usage_events','request_status','text'),
    ('ai_usage_events','action_type','text'),
    ('ai_usage_events','estimated_cost_usd','numeric'),
    ('app_events','user_id','uuid'),
    ('app_events','created_at','timestamptz'),
    ('app_events','event_name','text'),
    ('app_events','metadata','jsonb')
  ) AS c(table_name, column_name, expected_udt)
),
checks AS (
  -- Required tables
  SELECT
    'required_table'::text AS check_kind,
    r.table_name AS object_name,
    true AS required,
    (to_regclass('public.' || r.table_name) IS NOT NULL) AS ok,
    CASE WHEN to_regclass('public.' || r.table_name) IS NOT NULL THEN 'present'
         ELSE 'MISSING — apply the originating Sommi migration for this table first'
    END AS detail
  FROM req_tables r

  UNION ALL
  SELECT
    'optional_table',
    o.table_name,
    false,
    (to_regclass('public.' || o.table_name) IS NOT NULL),
    CASE WHEN to_regclass('public.' || o.table_name) IS NOT NULL
      THEN 'present — optional engagement indexes will be created if missing'
      ELSE 'absent — OK; migration skips via to_regclass'
    END
  FROM opt_tables o

  UNION ALL
  SELECT
    'required_column',
    c.table_name || '.' || c.column_name || '::' || c.expected_udt,
    true,
    EXISTS (
      SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public'
        AND ic.table_name = c.table_name
        AND ic.column_name = c.column_name
        AND ic.udt_name = c.expected_udt
    ),
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public'
        AND ic.table_name = c.table_name
        AND ic.column_name = c.column_name
        AND ic.udt_name = c.expected_udt
    ) THEN 'present with expected udt_name'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public'
        AND ic.table_name = c.table_name
        AND ic.column_name = c.column_name
    ) THEN 'PRESENT BUT TYPE MISMATCH — expected udt ' || c.expected_udt
    ELSE 'MISSING column'
    END
  FROM req_columns c

  UNION ALL
  SELECT
    'optional_required_column',
    'wine_reminders.user_id/created_at',
    true,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='wine_reminders'
        AND column_name='user_id' AND udt_name='uuid'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='wine_reminders'
        AND column_name='created_at' AND udt_name='timestamptz'
    ),
    'wine_reminders present — user_id uuid + created_at timestamptz required'
  WHERE to_regclass('public.wine_reminders') IS NOT NULL

  UNION ALL
  SELECT
    'optional_required_column',
    'wishlist_items.user_id/created_at',
    true,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='wishlist_items'
        AND column_name='user_id' AND udt_name='uuid'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='wishlist_items'
        AND column_name='created_at' AND udt_name='timestamptz'
    ),
    'wishlist_items present — user_id uuid + created_at timestamptz required'
  WHERE to_regclass('public.wishlist_items') IS NOT NULL

  UNION ALL
  SELECT
    'required_function',
    'public.is_admin(uuid)->boolean',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_type ret ON ret.oid = p.prorettype
      WHERE n.nspname = 'public'
        AND p.proname = 'is_admin'
        AND p.pronargs = 1
        AND pg_catalog.format_type(p.proargtypes[0], NULL) = 'uuid'
        AND ret.typname = 'bool'
    ),
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='is_admin'
    ) THEN 'MISSING public.is_admin(uuid)'
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_type ret ON ret.oid = p.prorettype
      WHERE n.nspname='public' AND p.proname='is_admin'
        AND p.pronargs = 1
        AND pg_catalog.format_type(p.proargtypes[0], NULL) = 'uuid'
        AND ret.typname = 'bool'
    ) THEN 'signature OK'
    ELSE 'WRONG SIGNATURE/RETURN — need is_admin(uuid) returns boolean'
    END

  UNION ALL
  SELECT
    'required_rls',
    c.relname::text,
    true,
    c.relrowsecurity,
    CASE WHEN c.relrowsecurity THEN 'RLS enabled' ELSE 'RLS disabled — unexpected for Sommi' END
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'profiles','bottles','wines','consumption_history','recommendation_runs',
      'evening_plans','sommelier_conversations','sommelier_recommendation_events',
      'ai_usage_events','app_events'
    )

  UNION ALL
  SELECT
    'baseline_admin_rpc',
    x,
    false,
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname = x
    ),
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=x
    ) THEN 'present' ELSE 'MISSING — engagement can still apply; admin-tab regression incomplete' END
  FROM unnest(ARRAY[
    'admin_overview_metrics','admin_get_users','admin_get_events','admin_get_ai_calls','admin_get_insights'
  ]) AS x

  UNION ALL
  SELECT
    'collision_index',
    idx,
    false,
    to_regclass('public.' || idx) IS NULL,
    CASE WHEN to_regclass('public.' || idx) IS NULL
      THEN 'name free — migration will create'
      ELSE 'ALREADY EXISTS — migration skips create; rollback must NOT drop unless this engagement run created it (save backup output)'
    END
  FROM unnest(ARRAY[
    'idx_eng_bottles_user_created',
    'idx_eng_wines_user_entry_created',
    'idx_eng_ai_usage_user_status_created',
    'idx_eng_app_events_user_name_created',
    'idx_eng_recommendation_runs_user_created',
    'idx_eng_evening_plans_user_created',
    'idx_eng_wine_reminders_user_created',
    'idx_eng_wishlist_items_user_created'
  ]) AS idx

  UNION ALL
  SELECT
    'collision_function',
    fn,
    false,
    NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname = fn
    ),
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=fn
    ) THEN 'ALREADY EXISTS — CREATE OR REPLACE will overwrite. Run engagement_pre_change_backup.sql and save output before apply.'
       ELSE 'name free'
    END
  FROM unnest(ARRAY[
    'admin_engagement_is_excluded',
    'admin_engagement_config',
    'touch_profile_last_active',
    '_admin_engagement_user_metrics',
    'admin_engagement_overview',
    'admin_engagement_users',
    'admin_engagement_user_detail'
  ]) AS fn
),
detail AS (
  SELECT
    1 AS sort_group,
    check_kind,
    object_name,
    required,
    ok,
    detail
  FROM checks
),
verdict AS (
  SELECT
    2 AS sort_group,
    'verdict'::text AS check_kind,
    'SUMMARY'::text AS object_name,
    true AS required,
    (COUNT(*) FILTER (WHERE required AND NOT ok) = 0) AS ok,
    format(
      'required_failures=%s collision_warnings=%s | %s',
      COUNT(*) FILTER (WHERE required AND NOT ok),
      COUNT(*) FILTER (WHERE NOT required AND NOT ok AND check_kind LIKE 'collision%'),
      CASE
        WHEN COUNT(*) FILTER (WHERE required AND NOT ok) = 0
          THEN 'PREFLIGHT_OK — prerequisites passed (not a deployment guarantee)'
        ELSE 'PREFLIGHT_BLOCKED — fix required failures above before migrating'
      END
    ) AS detail
  FROM checks
)
SELECT check_kind, object_name, required, ok, detail
FROM (
  SELECT * FROM detail
  UNION ALL
  SELECT * FROM verdict
) s
ORDER BY
  sort_group,
  CASE WHEN required AND NOT ok THEN 0 WHEN required THEN 1 ELSE 2 END,
  check_kind,
  object_name;
