-- =============================================================================
-- Sommi Phase 0 — PASS 1 ONLY (single-result, paste once)
-- =============================================================================
-- Read-only. Returns ONE row with column "pass1" (jsonb) containing all checks.
-- Paste this entire file into Supabase SQL Editor → Run → copy the JSON result.
-- SAFE TO SHARE as-is (no function bodies, no emails, no cellar contents).
-- =============================================================================

SELECT jsonb_build_object(

  -- Presence / prerequisites
  'P1-A12', jsonb_build_object(
    'admins_table_exists', EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'admins'
    )
  ),
  'P1-A13', jsonb_build_object(
    'profiles_is_admin_column_exists', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin'
    )
  ),
  'P1-B1', jsonb_build_object(
    'shared_cellars_exists', EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'shared_cellars'
    )
  ),
  'P1-C1', jsonb_build_object(
    'bottles_with_wine_info_exists', EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = 'bottles_with_wine_info'
    )
  ),
  'P1-C4', jsonb_build_object(
    'bottles_opened_at_exists', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bottles' AND column_name = 'opened_at'
    )
  ),
  'P1-C5', jsonb_build_object(
    'consumption_history_opened_at_exists', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'consumption_history' AND column_name = 'opened_at'
    )
  ),
  'P1-D1', jsonb_build_object(
    'wishlist_items_exists', EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'wishlist_items'
    )
  ),
  'P1-D2', jsonb_build_object(
    'profiles_wishlist_enabled_exists', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'wishlist_enabled'
    )
  ),
  'P1-E0', jsonb_build_object(
    'schema_migrations_exists', EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
    )
  ),
  'P1-F1', jsonb_build_object(
    'pg_cron_installed', EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    )
  ),
  'P1-F1b', jsonb_build_object(
    'cron_job_table_exists', EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'cron' AND table_name = 'job'
    )
  ),
  'P1-F3', jsonb_build_object(
    'pg_cron_installed', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'),
    'reset_monthly_credits_function_exists', EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'reset_monthly_credits'
    )
  ),
  'P1-H0', jsonb_build_object(
    'consumption_history_exists', EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'consumption_history'
    ),
    'opened_quantity_column_exists', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'consumption_history' AND column_name = 'opened_quantity'
    ),
    'bottles_exists', EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'bottles'
    )
  ),

  -- Profiles columns
  'P1-A1', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'ordinal_position', c.ordinal_position,
      'column_name', c.column_name,
      'data_type', c.data_type,
      'udt_name', c.udt_name,
      'is_nullable', c.is_nullable,
      'column_default', c.column_default
    ) ORDER BY c.ordinal_position)
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'profiles'
  ), '[]'::jsonb),

  -- Profiles grants
  'P1-A2', COALESCE((
    SELECT jsonb_agg(x ORDER BY x->>'grant_scope', x->>'grantee', x->>'privilege_type', x->>'column_name')
    FROM (
      SELECT jsonb_build_object(
        'grantee', g.grantee,
        'privilege_type', g.privilege_type,
        'is_grantable', g.is_grantable,
        'table_schema', g.table_schema,
        'table_name', g.table_name,
        'column_name', NULL,
        'grant_scope', 'table'
      ) AS x
      FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public' AND g.table_name = 'profiles'
        AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
      UNION ALL
      SELECT jsonb_build_object(
        'grantee', g.grantee,
        'privilege_type', g.privilege_type,
        'is_grantable', g.is_grantable,
        'table_schema', g.table_schema,
        'table_name', g.table_name,
        'column_name', g.column_name,
        'grant_scope', 'column'
      )
      FROM information_schema.column_privileges g
      WHERE g.table_schema = 'public' AND g.table_name = 'profiles'
        AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
    ) s
  ), '[]'::jsonb),

  -- Profiles RLS policies
  'P1-A3', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'policy_name', p.polname,
      'command', CASE p.polcmd
        WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' ELSE p.polcmd::text END,
      'is_permissive', p.polpermissive,
      'role_oid_count', cardinality(p.polroles),
      'roles', CASE
        WHEN cardinality(p.polroles) = 0 THEN ARRAY['*all_roles*']::text[]
        ELSE ARRAY(SELECT r.rolname FROM pg_roles r WHERE r.oid = ANY (p.polroles) ORDER BY r.rolname)
      END,
      'using_expression', pg_get_expr(p.polqual, p.polrelid),
      'with_check_expression', pg_get_expr(p.polwithcheck, p.polrelid)
    ) ORDER BY p.polname)
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles'
  ), '[]'::jsonb),

  'P1-A4', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table_name', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    ))
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles' AND c.relkind = 'r'
  ), '[]'::jsonb),

  'P1-A5', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'trigger_name', t.tgname,
      'trigger_definition', pg_get_triggerdef(t.oid, true),
      'function_name', p.proname,
      'function_schema', n.nspname
    ) ORDER BY t.tgname)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND c.relname = 'profiles' AND NOT t.tgisinternal
  ), '[]'::jsonb),

  'P1-A6', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema_name', n.nspname,
      'function_name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'is_security_definer', p.prosecdef,
      'config_settings', to_jsonb(p.proconfig),
      'search_path_setting', COALESCE(
        (SELECT cfg FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
         WHERE cfg LIKE 'search_path=%' LIMIT 1),
        '(no search_path set)'
      )
    ))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.oid IN (
      SELECT t.tgfoid FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relname = 'profiles' AND NOT t.tgisinternal
    )
  ), '[]'::jsonb),

  'P1-A7', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema_name', n.nspname,
      'function_name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'owner', r.rolname,
      'is_security_definer', p.prosecdef,
      'config_settings', to_jsonb(p.proconfig),
      'search_path_setting', COALESCE(
        (SELECT cfg FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
         WHERE cfg LIKE 'search_path=%' LIMIT 1),
        '(no search_path set)'
      )
    ))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ), '[]'::jsonb),

  'P1-A8', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema_name', n.nspname,
      'function_name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'anon_execute', CASE WHEN EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'anon')
        THEN has_function_privilege('anon', p.oid, 'EXECUTE') ELSE NULL END,
      'authenticated_execute', CASE WHEN EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'authenticated')
        THEN has_function_privilege('authenticated', p.oid, 'EXECUTE') ELSE NULL END,
      'service_role_execute', CASE WHEN EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
        THEN has_function_privilege('service_role', p.oid, 'EXECUTE') ELSE NULL END,
      'public_execute_via_acl', EXISTS (
        SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl(grantor, grantee, privilege_type, is_grantable)
        WHERE acl.privilege_type = 'EXECUTE' AND acl.grantee = 0
      )
    ))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ), '[]'::jsonb),

  'P1-A9', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'column_name', column_name,
      'classification', CASE
        WHEN column_name = 'is_admin' THEN 'admin'
        WHEN column_name IN (
          'ai_label_art_enabled','cellar_agent_enabled','csv_import_enabled',
          'plan_evening_enabled','can_multi_bottle_import','can_share_cellar','wishlist_enabled'
        ) THEN 'feature_flag'
        WHEN column_name IN ('signup_source','signup_medium','signup_campaign','last_active_at')
          THEN 'attribution_or_ops'
        ELSE 'other'
      END
    ) ORDER BY column_name)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name IN (
        'is_admin','ai_label_art_enabled','cellar_agent_enabled','csv_import_enabled',
        'plan_evening_enabled','can_multi_bottle_import','can_share_cellar','wishlist_enabled',
        'signup_source','signup_medium','signup_campaign','last_active_at'
      )
  ), '[]'::jsonb),

  -- Shared cellars catalog
  'P1-B2', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'ordinal_position', c.ordinal_position,
      'column_name', c.column_name,
      'data_type', c.data_type,
      'is_nullable', c.is_nullable,
      'column_default', c.column_default
    ) ORDER BY c.ordinal_position)
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'shared_cellars'
  ), '[]'::jsonb),

  'P1-B3', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'constraint_name', tc.constraint_name,
      'constraint_type', tc.constraint_type,
      'check_clause', cc.check_clause
    ) ORDER BY tc.constraint_type, tc.constraint_name)
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.check_constraints cc
      ON cc.constraint_schema = tc.constraint_schema AND cc.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = 'shared_cellars'
  ), '[]'::jsonb),

  'P1-B4', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table_name', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    ))
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'shared_cellars' AND c.relkind = 'r'
  ), '[]'::jsonb),

  'P1-B5', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'policy_name', p.polname,
      'command', CASE p.polcmd
        WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' ELSE p.polcmd::text END,
      'is_permissive', p.polpermissive,
      'role_oid_count', cardinality(p.polroles),
      'roles', CASE
        WHEN cardinality(p.polroles) = 0 THEN ARRAY['*all_roles*']::text[]
        ELSE ARRAY(SELECT r.rolname FROM pg_roles r WHERE r.oid = ANY (p.polroles) ORDER BY r.rolname)
      END,
      'using_expression', pg_get_expr(p.polqual, p.polrelid),
      'with_check_expression', pg_get_expr(p.polwithcheck, p.polrelid)
    ) ORDER BY p.polname)
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'shared_cellars'
  ), '[]'::jsonb),

  'P1-B6', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'grantee', g.grantee,
      'privilege_type', g.privilege_type,
      'is_grantable', g.is_grantable
    ) ORDER BY g.grantee, g.privilege_type)
    FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public' AND g.table_name = 'shared_cellars'
      AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
  ), '[]'::jsonb),

  'P1-B7', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'index_name', i.relname,
      'index_definition', pg_get_indexdef(i.oid)
    ) ORDER BY i.relname)
    FROM pg_index x
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname = 'public' AND t.relname = 'shared_cellars'
  ), '[]'::jsonb),

  'P1-B9', jsonb_build_object(
    'select_policy_mentions_expires_at', EXISTS (
      SELECT 1 FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'shared_cellars'
        AND p.polcmd IN ('r', '*')
        AND COALESCE(pg_get_expr(p.polqual, p.polrelid), '') ILIKE '%expires_at%'
    )
  ),

  'P1-B10', jsonb_build_object(
    'heuristic_anon_or_public_has_select_grant', EXISTS (
      SELECT 1 FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public' AND g.table_name = 'shared_cellars'
        AND g.grantee IN ('anon', 'PUBLIC') AND g.privilege_type = 'SELECT'
    ),
    'heuristic_permissive_using_true_applies_to_anon', EXISTS (
      SELECT 1 FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'shared_cellars'
        AND p.polcmd IN ('r', '*')
        AND p.polpermissive IS TRUE
        AND (
          cardinality(p.polroles) = 0
          OR EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid = ANY (p.polroles) AND r.rolname = 'anon')
        )
        AND (
          btrim(COALESCE(pg_get_expr(p.polqual, p.polrelid), '')) IN ('true', '(true)')
          OR btrim(COALESCE(pg_get_expr(p.polqual, p.polrelid), '')) ILIKE '(true)'
        )
    ),
    'heuristic_restrictive_select_policy_applies_to_anon', EXISTS (
      SELECT 1 FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'shared_cellars'
        AND p.polcmd IN ('r', '*')
        AND p.polpermissive IS FALSE
        AND (
          cardinality(p.polroles) = 0
          OR EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid = ANY (p.polroles) AND r.rolname = 'anon')
        )
    ),
    'result_kind', 'HEURISTIC_ONLY_not_a_request_test'
  ),

  -- View metadata (no full body)
  'P1-C2', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema_name', n.nspname,
      'view_name', c.relname,
      'owner', r.rolname,
      'reloptions', to_jsonb(c.reloptions),
      'view_definition_mentions_opened_at', (pg_get_viewdef(c.oid, true) ILIKE '%opened_at%')
    ))
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r ON r.oid = c.relowner
    WHERE n.nspname = 'public' AND c.relname = 'bottles_with_wine_info' AND c.relkind = 'v'
  ), '[]'::jsonb),

  'P1-C3', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'grantee', g.grantee,
      'privilege_type', g.privilege_type
    ) ORDER BY g.grantee, g.privilege_type)
    FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public' AND g.table_name = 'bottles_with_wine_info'
      AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
  ), '[]'::jsonb),

  -- Wishlist catalog
  'P1-D3', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'ordinal_position', c.ordinal_position,
      'column_name', c.column_name,
      'data_type', c.data_type,
      'is_nullable', c.is_nullable,
      'column_default', c.column_default
    ) ORDER BY c.ordinal_position)
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'wishlist_items'
  ), '[]'::jsonb),

  'P1-D4', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'constraint_name', tc.constraint_name,
      'constraint_type', tc.constraint_type,
      'check_clause', cc.check_clause
    ) ORDER BY tc.constraint_type, tc.constraint_name)
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.check_constraints cc
      ON cc.constraint_schema = tc.constraint_schema AND cc.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = 'wishlist_items'
  ), '[]'::jsonb),

  'P1-D5a', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table_name', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    ))
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'wishlist_items' AND c.relkind = 'r'
  ), '[]'::jsonb),

  'P1-D5b', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'policy_name', p.polname,
      'command', CASE p.polcmd
        WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' ELSE p.polcmd::text END,
      'is_permissive', p.polpermissive,
      'using_expression', pg_get_expr(p.polqual, p.polrelid),
      'with_check_expression', pg_get_expr(p.polwithcheck, p.polrelid)
    ) ORDER BY p.polname)
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'wishlist_items'
  ), '[]'::jsonb),

  'P1-D6a', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'grantee', g.grantee,
      'privilege_type', g.privilege_type
    ) ORDER BY g.grantee, g.privilege_type)
    FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public' AND g.table_name = 'wishlist_items'
      AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
  ), '[]'::jsonb),

  'P1-D6b', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'index_name', i.relname,
      'index_definition', pg_get_indexdef(i.oid)
    ) ORDER BY i.relname)
    FROM pg_index x
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname = 'public' AND t.relname = 'wishlist_items'
  ), '[]'::jsonb),

  -- Object inventory
  'P1-E3', jsonb_build_object(
    'has_profiles', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'),
    'has_wines', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wines'),
    'has_bottles', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bottles'),
    'has_consumption_history', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'consumption_history'),
    'has_user_entitlements', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_entitlements'),
    'has_user_ai_credits', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_ai_credits'),
    'has_ai_usage_events', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_usage_events'),
    'has_wishlist_items', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wishlist_items'),
    'has_shared_cellars', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_cellars'),
    'has_admins', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admins'),
    'has_baby_workspaces', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces'),
    'has_baby_babies', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'babies'),
    'has_opened_quantity', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'consumption_history' AND column_name = 'opened_quantity'),
    'has_bottles_opened_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bottles' AND column_name = 'opened_at'),
    'has_bottles_with_wine_info', EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'bottles_with_wine_info'),
    'has_is_admin', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'is_admin'),
    'has_reset_monthly_credits', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'reset_monthly_credits'),
    'has_process_ai_credit_usage', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'process_ai_credit_usage'),
    'has_handle_new_user', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'handle_new_user')
  ),

  -- SECURITY DEFINER inventory (metadata only — no bodies)
  'P1-G1', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema_name', n.nspname,
      'function_name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'owner', r.rolname,
      'is_security_definer', p.prosecdef,
      'search_path_setting', COALESCE(
        (SELECT cfg FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
         WHERE cfg LIKE 'search_path=%' LIMIT 1),
        '(no search_path set)'
      ),
      'anon_execute', CASE WHEN EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = 'anon')
        THEN has_function_privilege('anon', p.oid, 'EXECUTE') ELSE NULL END,
      'authenticated_execute', CASE WHEN EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = 'authenticated')
        THEN has_function_privilege('authenticated', p.oid, 'EXECUTE') ELSE NULL END,
      'service_role_execute', CASE WHEN EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = 'service_role')
        THEN has_function_privilege('service_role', p.oid, 'EXECUTE') ELSE NULL END,
      'public_execute_via_acl', EXISTS (
        SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl(grantor, grantee, privilege_type, is_grantable)
        WHERE acl.privilege_type = 'EXECUTE' AND acl.grantee = 0
      )
    ) ORDER BY p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname = 'public' AND p.prosecdef IS TRUE
  ), '[]'::jsonb),

  'P1-H1', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'column_name', column_name,
      'data_type', data_type,
      'is_nullable', is_nullable,
      'column_default', column_default
    ) ORDER BY column_name)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'consumption_history'
      AND column_name IN (
        'id','user_id','bottle_id','wine_id',
        'opened_quantity','opened_at','status','undone_at','idempotency_key'
      )
  ), '[]'::jsonb)

) AS pass1;
