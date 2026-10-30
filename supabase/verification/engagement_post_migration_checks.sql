-- ============================================================
-- Engagement post-migration checks
-- SQL Editor safe: CTE-based SELECTs, no TEMP tables, no BEGIN/COMMIT.
--
-- Explicit pass/fail rows. Catalog / privilege / definition checks.
-- SQL Editor or service_role success is NOT user authorization proof.
-- Simulated JWT claims below are labeled SIMULATION only.
-- ============================================================

WITH
fn_names AS (
  SELECT * FROM (VALUES
    ('admin_engagement_overview'),
    ('admin_engagement_users'),
    ('admin_engagement_user_detail'),
    ('_admin_engagement_user_metrics'),
    ('touch_profile_last_active'),
    ('admin_engagement_config'),
    ('admin_engagement_is_excluded')
  ) AS t(proname)
),
fn_rows AS (
  SELECT
    p.proname,
    p.oid,
    p.prosecdef,
    pg_get_function_identity_arguments(p.oid) AS args,
    (
      SELECT option_value
      FROM pg_options_to_table(p.proconfig)
      WHERE option_name = 'search_path'
      LIMIT 1
    ) AS search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (SELECT proname FROM fn_names)
),
checks AS (
  SELECT
    'fn_exists_' || f.proname AS check_id,
    true AS ok,
    format('SECURITY DEFINER=%s search_path=%s args=%s',
      COALESCE(r.prosecdef::text, 'missing'),
      COALESCE(r.search_path, '<default>'),
      COALESCE(r.args, '')) AS detail
  FROM fn_names f
  LEFT JOIN fn_rows r ON r.proname = f.proname
  WHERE r.oid IS NOT NULL

  UNION ALL
  SELECT
    'fn_missing_' || f.proname,
    false,
    'expected function missing'
  FROM fn_names f
  LEFT JOIN fn_rows r ON r.proname = f.proname
  WHERE r.oid IS NULL

  UNION ALL
  SELECT
    'security_definer_' || r.proname,
    r.prosecdef,
    CASE WHEN r.prosecdef THEN 'SECURITY DEFINER' ELSE 'FAIL: expected SECURITY DEFINER' END
  FROM fn_rows r
  WHERE r.proname IN (
    'admin_engagement_overview','admin_engagement_users','admin_engagement_user_detail',
    '_admin_engagement_user_metrics','touch_profile_last_active'
  )

  UNION ALL
  SELECT
    'priv_' || r.proname || '_' || role.rolname,
    CASE
      WHEN r.proname = '_admin_engagement_user_metrics' THEN
        NOT has_function_privilege(role.oid, r.oid, 'EXECUTE')
      WHEN r.proname IN (
        'admin_engagement_overview','admin_engagement_users',
        'admin_engagement_user_detail','touch_profile_last_active'
      ) THEN
        (role.rolname = 'authenticated' AND has_function_privilege(role.oid, r.oid, 'EXECUTE'))
        OR (role.rolname = 'anon' AND NOT has_function_privilege(role.oid, r.oid, 'EXECUTE'))
      ELSE true
    END,
    format('EXECUTE %s=%s', role.rolname, has_function_privilege(role.oid, r.oid, 'EXECUTE'))
  FROM fn_rows r
  CROSS JOIN pg_roles role
  WHERE r.proname IN (
    'admin_engagement_overview','admin_engagement_users','admin_engagement_user_detail',
    '_admin_engagement_user_metrics','touch_profile_last_active'
  )
  AND role.rolname IN ('anon','authenticated')

  UNION ALL
  SELECT
    'config_shape',
    (public.admin_engagement_config() ? 'observation_coverage')
      AND (public.admin_engagement_config()->>'activation_metric') = 'lifetime_observed_among_age_ge_14d'
      AND (public.admin_engagement_config()->>'scan_failure_instrumentation') = 'unknown',
    left(public.admin_engagement_config()::text, 200)
  WHERE EXISTS (SELECT 1 FROM fn_rows WHERE proname = 'admin_engagement_config')

  UNION ALL
  SELECT
    'index_' || i.relname,
    true,
    format('table=%s pred=%s', t.relname, COALESCE(pg_get_expr(ix.indpred, ix.indrelid), ''))
  FROM pg_class i
  JOIN pg_index ix ON ix.indexrelid = i.oid
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = i.relnamespace
  WHERE n.nspname = 'public'
    AND i.relname LIKE 'idx_eng_%'

  UNION ALL
  SELECT
    'baseline_' || x,
    true,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = x
    ) THEN x || ': present'
         ELSE x || ': ABSENT (ok on stub; required on real Sommi for admin-tab regression)'
    END
  FROM unnest(ARRAY[
    'admin_overview_metrics','admin_get_users','admin_get_wine_data_quality',
    'admin_get_events','admin_get_ai_calls','admin_get_ai_summary','admin_get_insights','is_admin'
  ]) AS x

  UNION ALL
  SELECT
    'no_new_eng_admin_select_policies',
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND policyname IN (
          'Admins can read all consumption history',
          'Admins can read all recommendation runs',
          'Admins can read all evening plans',
          'Admins can read all sommelier conversations',
          'Admins can read all sommelier recommendation events'
        )
    ),
    'Engagement migration must not add broad admin SELECT on raw tables (RPCs only)'
),
detail AS (
  SELECT 1 AS sort_group, check_id, ok, detail FROM checks
),
verdict AS (
  SELECT
    2 AS sort_group,
    'VERDICT'::text AS check_id,
    (COUNT(*) FILTER (WHERE NOT ok) = 0) AS ok,
    format(
      'failures=%s | %s',
      COUNT(*) FILTER (WHERE NOT ok),
      CASE WHEN COUNT(*) FILTER (WHERE NOT ok) = 0
        THEN 'POSTCHECK_OK'
        ELSE 'POSTCHECK_FAILED'
      END
    ) AS detail
  FROM checks
)
SELECT check_id, ok, detail
FROM (
  SELECT * FROM detail
  UNION ALL
  SELECT * FROM verdict
) s
ORDER BY sort_group, ok ASC, check_id;

-- Optional SIMULATION only (not authorization proof). Run separately if needed:
-- SELECT set_config('request.jwt.claim.sub', '<ADMIN_UUID>', true);
-- SELECT set_config('request.jwt.claim.role', 'authenticated', true);
-- SELECT public.admin_engagement_overview()->>'activation_metric' AS activation_metric;
-- SELECT public.admin_engagement_users(5, 0)->>'total' AS users_total;
