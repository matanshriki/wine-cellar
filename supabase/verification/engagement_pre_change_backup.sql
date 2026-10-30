-- ============================================================
-- READ-ONLY pre-change definition export
-- Run BEFORE applying 20261030_admin_engagement_dashboard.sql
-- Save the result set offline. Use it to restore CREATE OR REPLACE
-- targets if rollback must reinstate a prior body.
--
-- Does not modify the database.
-- ============================================================

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'INVOKER' END AS security,
  (
    SELECT option_value
    FROM pg_options_to_table(p.proconfig)
    WHERE option_name = 'search_path'
    LIMIT 1
  ) AS search_path,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'admin_engagement_is_excluded',
    'admin_engagement_config',
    'touch_profile_last_active',
    '_admin_engagement_user_metrics',
    'admin_engagement_overview',
    'admin_engagement_users',
    'admin_engagement_user_detail'
  )
ORDER BY 1, 2;

-- Index collision snapshot for idx_eng_* names
SELECT
  i.relname AS index_name,
  t.relname AS table_name,
  pg_get_indexdef(i.oid) AS indexdef
FROM pg_class i
JOIN pg_index ix ON ix.indexrelid = i.oid
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_namespace n ON n.oid = i.relnamespace
WHERE n.nspname = 'public'
  AND i.relname LIKE 'idx_eng_%'
ORDER BY 1;
