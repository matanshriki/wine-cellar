-- =============================================================================
-- Sommi Phase 0 — READ-ONLY live database verification (revised)
-- =============================================================================
--
-- PURPOSE
--   Resolve live-DB verification gaps from TECHNICAL_AUDIT.md / Phase 0.
--   Run manually in the Supabase SQL Editor against the target project.
--
-- SAFETY CONTRACT (STRICT)
--   - SELECT and catalog inspection only.
--   - No INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE.
--   - No GRANT, REVOKE, SET, DO, CALL, COPY.
--   - No mutating application RPCs.
--   - No transaction-based exploit test in this file.
--
-- EXECUTION STRUCTURE
--   PASS 1 — Always-safe catalog checks (run all; empty rows = object absent)
--   PASS 2 — Conditional aggregate checks (run only when listed prerequisite is true)
--   PASS 3 — Optional sensitive definition checks (manual review before sharing)
--   PASS 4 — State-changing exploit test (documented only; not SQL; not executed)
--
-- SHARE CLASSIFICATION (every query is labeled)
--   SAFE TO SHARE              — OK to paste into remediation chat as-is
--   REDACT BEFORE SHARING     — redact named fields before pasting
--   DO NOT SHARE WITHOUT MANUAL REVIEW — inspect for secrets before any export
--
-- IMPORTANT
--   An EXISTS / presence check in PASS 1 does NOT make a later PASS 2 statement
--   safe. PASS 2 queries that touch missing relations will still error. Follow
--   each PASS 2 prerequisite exactly.
--
-- HOW TO RUN
--   1. Run all of PASS 1.
--   2. From PASS 1 results, decide which PASS 2 blocks to run.
--   3. Optionally run PASS 3; review outputs before sharing.
--   4. Do not run PASS 4 from this file (not present as SQL).
--
-- =============================================================================


-- #############################################################################
-- PASS 1 — Always-safe catalog checks
-- #############################################################################
-- These queries use information_schema / pg_catalog filters only.
-- Missing tables/views yield empty result sets, not relation errors.
-- #############################################################################


-- -----------------------------------------------------------------------------
-- P1-A1 | SAFE TO SHARE
-- WHAT: Column inventory of public.profiles (empty if table missing).
-- HOW TO READ: Confirm privileged columns exist (is_admin, feature flags, etc.).
-- -----------------------------------------------------------------------------
SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'profiles'
ORDER BY c.ordinal_position;


-- -----------------------------------------------------------------------------
-- P1-A2 | SAFE TO SHARE
-- WHAT: Table- and column-level grants on profiles for named roles.
-- NOTE: information_schema uses the string 'PUBLIC' for the pseudo-role;
--       this does not require PUBLIC to exist in pg_roles.
-- HOW TO READ: authenticated UPDATE without column limits supports SEC-001.
-- -----------------------------------------------------------------------------
SELECT
  g.grantee,
  g.privilege_type,
  g.is_grantable,
  g.table_schema,
  g.table_name,
  CAST(NULL AS text) AS column_name,
  'table' AS grant_scope
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public'
  AND g.table_name = 'profiles'
  AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')

UNION ALL

SELECT
  g.grantee,
  g.privilege_type,
  g.is_grantable,
  g.table_schema,
  g.table_name,
  g.column_name,
  'column' AS grant_scope
FROM information_schema.column_privileges g
WHERE g.table_schema = 'public'
  AND g.table_name = 'profiles'
  AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')

ORDER BY grant_scope, grantee, privilege_type, column_name NULLS FIRST;


-- -----------------------------------------------------------------------------
-- P1-A3 | SAFE TO SHARE
-- WHAT: RLS policies on public.profiles (empty if table or policies missing).
-- HOW TO READ: Note command, permissive flag, USING, WITH CHECK, role OIDs.
--              Empty polroles means the policy applies to all roles.
-- -----------------------------------------------------------------------------
SELECT
  p.polname AS policy_name,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE p.polcmd::text
  END AS command,
  p.polpermissive AS is_permissive,
  cardinality(p.polroles) AS role_oid_count,
  CASE
    WHEN cardinality(p.polroles) = 0 THEN ARRAY['*all_roles*']::text[]
    ELSE ARRAY(
      SELECT r.rolname
      FROM pg_roles r
      WHERE r.oid = ANY (p.polroles)
      ORDER BY r.rolname
    )
  END AS roles,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expression
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
ORDER BY policy_name;


-- -----------------------------------------------------------------------------
-- P1-A4 | SAFE TO SHARE
-- WHAT: RLS enabled / forced flags on profiles.
-- -----------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
  AND c.relkind = 'r';


-- -----------------------------------------------------------------------------
-- P1-A5 | SAFE TO SHARE
-- WHAT: Triggers on public.profiles (definition names only via triggerdef).
-- HOW TO READ: Expect updated_at trigger. Privilege-guard trigger unexpected if
--              SEC-001 still open.
-- -----------------------------------------------------------------------------
SELECT
  t.tgname AS trigger_name,
  pg_get_triggerdef(t.oid, true) AS trigger_definition,
  p.proname AS function_name,
  n.nspname AS function_schema
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace ns ON ns.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE ns.nspname = 'public'
  AND c.relname = 'profiles'
  AND NOT t.tgisinternal
ORDER BY t.tgname;


-- -----------------------------------------------------------------------------
-- P1-A6 | SAFE TO SHARE
-- WHAT: Metadata for functions attached to profiles triggers (NO function body).
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS is_security_definer,
  p.proconfig AS config_settings,
  COALESCE(
    (
      SELECT cfg
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
      WHERE cfg LIKE 'search_path=%'
      LIMIT 1
    ),
    '(no search_path set)'
  ) AS search_path_setting
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.oid IN (
  SELECT t.tgfoid
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relname = 'profiles'
    AND NOT t.tgisinternal
);


-- -----------------------------------------------------------------------------
-- P1-A7 | SAFE TO SHARE
-- WHAT: is_admin() metadata — owner, DEFINER, search_path (NO function body).
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  r.rolname AS owner,
  p.prosecdef AS is_security_definer,
  p.proconfig AS config_settings,
  COALESCE(
    (
      SELECT cfg
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
      WHERE cfg LIKE 'search_path=%'
      LIMIT 1
    ),
    '(no search_path set)'
  ) AS search_path_setting
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public'
  AND p.proname = 'is_admin';


-- -----------------------------------------------------------------------------
-- P1-A8 | SAFE TO SHARE
-- WHAT: EXECUTE privileges on is_admin for anon / authenticated / service_role
--       plus PUBLIC via aclexplode (PUBLIC is oid 0; not a pg_roles row).
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'anon')
      THEN has_function_privilege('anon', p.oid, 'EXECUTE')
    ELSE NULL
  END AS anon_execute,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'authenticated')
      THEN has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ELSE NULL
  END AS authenticated_execute,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
      THEN has_function_privilege('service_role', p.oid, 'EXECUTE')
    ELSE NULL
  END AS service_role_execute,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl(
      grantor, grantee, privilege_type, is_grantable
    )
    WHERE acl.privilege_type = 'EXECUTE'
      AND acl.grantee = 0
  ) AS public_execute_via_acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_admin';


-- -----------------------------------------------------------------------------
-- P1-A9 | SAFE TO SHARE
-- WHAT: Privileged / entitlement-like columns present on profiles.
-- -----------------------------------------------------------------------------
SELECT
  column_name,
  CASE
    WHEN column_name = 'is_admin' THEN 'admin'
    WHEN column_name IN (
      'ai_label_art_enabled',
      'cellar_agent_enabled',
      'csv_import_enabled',
      'plan_evening_enabled',
      'can_multi_bottle_import',
      'can_share_cellar',
      'wishlist_enabled'
    ) THEN 'feature_flag'
    WHEN column_name IN (
      'signup_source',
      'signup_medium',
      'signup_campaign',
      'last_active_at'
    ) THEN 'attribution_or_ops'
    ELSE 'other'
  END AS classification
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN (
    'is_admin',
    'ai_label_art_enabled',
    'cellar_agent_enabled',
    'csv_import_enabled',
    'plan_evening_enabled',
    'can_multi_bottle_import',
    'can_share_cellar',
    'wishlist_enabled',
    'signup_source',
    'signup_medium',
    'signup_campaign',
    'last_active_at'
  )
ORDER BY classification, column_name;


-- -----------------------------------------------------------------------------
-- P1-A12 | SAFE TO SHARE
-- WHAT: Does public.admins exist?
-- PREREQUISITE FOR: P2-A12b
-- -----------------------------------------------------------------------------
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'admins'
) AS admins_table_exists;


-- -----------------------------------------------------------------------------
-- P1-A13 | SAFE TO SHARE
-- WHAT: Does profiles.is_admin column exist?
-- PREREQUISITE FOR: P2-A10, P2-A11-opt
-- -----------------------------------------------------------------------------
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'is_admin'
) AS profiles_is_admin_column_exists;


-- -----------------------------------------------------------------------------
-- P1-B1 | SAFE TO SHARE
-- WHAT: Does shared_cellars exist?
-- PREREQUISITE FOR: P2-B8
-- -----------------------------------------------------------------------------
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'shared_cellars'
) AS shared_cellars_exists;


-- -----------------------------------------------------------------------------
-- P1-B2 | SAFE TO SHARE
-- WHAT: shared_cellars columns (empty if table missing).
-- -----------------------------------------------------------------------------
SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'shared_cellars'
ORDER BY c.ordinal_position;


-- -----------------------------------------------------------------------------
-- P1-B3 | SAFE TO SHARE
-- WHAT: shared_cellars constraints (empty if table missing).
-- -----------------------------------------------------------------------------
SELECT
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc
  ON cc.constraint_schema = tc.constraint_schema
 AND cc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'shared_cellars'
ORDER BY tc.constraint_type, tc.constraint_name;


-- -----------------------------------------------------------------------------
-- P1-B4 | SAFE TO SHARE
-- WHAT: RLS flags on shared_cellars (empty if missing).
-- -----------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'shared_cellars'
  AND c.relkind = 'r';


-- -----------------------------------------------------------------------------
-- P1-B5 | SAFE TO SHARE
-- WHAT: RLS policies on shared_cellars (empty if missing).
-- HOW TO READ: USING (true) is only risky for a role if that policy applies to
--              that role (empty polroles = all roles). See P1-B10 heuristic.
-- -----------------------------------------------------------------------------
SELECT
  p.polname AS policy_name,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE p.polcmd::text
  END AS command,
  p.polpermissive AS is_permissive,
  cardinality(p.polroles) AS role_oid_count,
  CASE
    WHEN cardinality(p.polroles) = 0 THEN ARRAY['*all_roles*']::text[]
    ELSE ARRAY(
      SELECT r.rolname
      FROM pg_roles r
      WHERE r.oid = ANY (p.polroles)
      ORDER BY r.rolname
    )
  END AS roles,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expression
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'shared_cellars'
ORDER BY policy_name;


-- -----------------------------------------------------------------------------
-- P1-B6 | SAFE TO SHARE
-- WHAT: Grants on shared_cellars (information_schema PUBLIC string is OK).
-- -----------------------------------------------------------------------------
SELECT
  g.grantee,
  g.privilege_type,
  g.is_grantable
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public'
  AND g.table_name = 'shared_cellars'
  AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY g.grantee, g.privilege_type;


-- -----------------------------------------------------------------------------
-- P1-B7 | SAFE TO SHARE
-- WHAT: Indexes on shared_cellars (empty if missing).
-- -----------------------------------------------------------------------------
SELECT
  i.relname AS index_name,
  pg_get_indexdef(i.oid) AS index_definition
FROM pg_index x
JOIN pg_class t ON t.oid = x.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_class i ON i.oid = x.indexrelid
WHERE n.nspname = 'public'
  AND t.relname = 'shared_cellars'
ORDER BY i.relname;


-- -----------------------------------------------------------------------------
-- P1-B9 | SAFE TO SHARE
-- WHAT: Heuristic — any SELECT/ALL policy USING expression mentions expires_at.
-- -----------------------------------------------------------------------------
SELECT EXISTS (
  SELECT 1
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'shared_cellars'
    AND p.polcmd IN ('r', '*')
    AND COALESCE(pg_get_expr(p.polqual, p.polrelid), '') ILIKE '%expires_at%'
) AS select_policy_mentions_expires_at;


-- -----------------------------------------------------------------------------
-- P1-B10 | SAFE TO SHARE
-- WHAT: HEURISTIC only — whether catalog suggests anon SELECT may succeed.
-- HOW TO READ:
--   This is NOT a live request-level authorization test.
--   USING (true) alone is insufficient: polroles must include anon, or be empty
--   (all roles). Restrictive policies may still deny. Grants must also allow SELECT.
--   Treat output as a risk signal to investigate, not proof of exploitability.
-- -----------------------------------------------------------------------------
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public'
      AND g.table_name = 'shared_cellars'
      AND g.grantee IN ('anon', 'PUBLIC')
      AND g.privilege_type = 'SELECT'
  ) AS heuristic_anon_or_public_has_select_grant,
  EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'shared_cellars'
      AND p.polcmd IN ('r', '*')
      AND p.polpermissive IS TRUE
      AND (
        cardinality(p.polroles) = 0
        OR EXISTS (
          SELECT 1
          FROM pg_roles r
          WHERE r.oid = ANY (p.polroles)
            AND r.rolname = 'anon'
        )
      )
      AND (
        btrim(COALESCE(pg_get_expr(p.polqual, p.polrelid), '')) IN ('true', '(true)')
        OR btrim(COALESCE(pg_get_expr(p.polqual, p.polrelid), '')) ILIKE '(true)'
      )
  ) AS heuristic_permissive_using_true_applies_to_anon,
  EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'shared_cellars'
      AND p.polcmd IN ('r', '*')
      AND p.polpermissive IS FALSE
      AND (
        cardinality(p.polroles) = 0
        OR EXISTS (
          SELECT 1
          FROM pg_roles r
          WHERE r.oid = ANY (p.polroles)
            AND r.rolname = 'anon'
        )
      )
  ) AS heuristic_restrictive_select_policy_applies_to_anon,
  'HEURISTIC_ONLY_not_a_request_test' AS result_kind;


-- -----------------------------------------------------------------------------
-- P1-C1 | SAFE TO SHARE
-- WHAT: Does bottles_with_wine_info exist?
-- PREREQUISITE FOR: P3-C2-def (optional)
-- -----------------------------------------------------------------------------
SELECT EXISTS (
  SELECT 1
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name = 'bottles_with_wine_info'
) AS bottles_with_wine_info_exists;


-- -----------------------------------------------------------------------------
-- P1-C2 | SAFE TO SHARE
-- WHAT: View metadata without full definition body.
--        Includes boolean whether definition text mentions opened_at.
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  c.relname AS view_name,
  r.rolname AS owner,
  c.reloptions AS reloptions,
  (pg_get_viewdef(c.oid, true) ILIKE '%opened_at%') AS view_definition_mentions_opened_at
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_roles r ON r.oid = c.relowner
WHERE n.nspname = 'public'
  AND c.relname = 'bottles_with_wine_info'
  AND c.relkind = 'v';


-- -----------------------------------------------------------------------------
-- P1-C3 | SAFE TO SHARE
-- WHAT: Grants on bottles_with_wine_info (empty if missing).
-- -----------------------------------------------------------------------------
SELECT
  g.grantee,
  g.privilege_type
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public'
  AND g.table_name = 'bottles_with_wine_info'
  AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY g.grantee, g.privilege_type;


-- -----------------------------------------------------------------------------
-- P1-C4 | SAFE TO SHARE
-- WHAT: Does bottles.opened_at exist?
-- -----------------------------------------------------------------------------
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'bottles'
    AND column_name = 'opened_at'
) AS bottles_opened_at_exists;


-- -----------------------------------------------------------------------------
-- P1-C5 | SAFE TO SHARE
-- WHAT: Does consumption_history.opened_at exist?
-- -----------------------------------------------------------------------------
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'consumption_history'
    AND column_name = 'opened_at'
) AS consumption_history_opened_at_exists;


-- -----------------------------------------------------------------------------
-- P1-D1 | SAFE TO SHARE
-- WHAT: Does wishlist_items exist?
-- -----------------------------------------------------------------------------
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'wishlist_items'
) AS wishlist_items_exists;


-- -----------------------------------------------------------------------------
-- P1-D2 | SAFE TO SHARE
-- WHAT: Does profiles.wishlist_enabled exist?
-- -----------------------------------------------------------------------------
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'wishlist_enabled'
) AS profiles_wishlist_enabled_exists;


-- -----------------------------------------------------------------------------
-- P1-D3 | SAFE TO SHARE
-- WHAT: wishlist_items columns (empty if missing).
-- -----------------------------------------------------------------------------
SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'wishlist_items'
ORDER BY c.ordinal_position;


-- -----------------------------------------------------------------------------
-- P1-D4 | SAFE TO SHARE
-- WHAT: wishlist_items constraints (empty if missing).
-- -----------------------------------------------------------------------------
SELECT
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc
  ON cc.constraint_schema = tc.constraint_schema
 AND cc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'wishlist_items'
ORDER BY tc.constraint_type, tc.constraint_name;


-- -----------------------------------------------------------------------------
-- P1-D5a | SAFE TO SHARE
-- WHAT: wishlist_items RLS flags (empty if missing).
-- -----------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'wishlist_items'
  AND c.relkind = 'r';


-- -----------------------------------------------------------------------------
-- P1-D5b | SAFE TO SHARE
-- WHAT: wishlist_items policies (empty if missing).
-- -----------------------------------------------------------------------------
SELECT
  p.polname AS policy_name,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE p.polcmd::text
  END AS command,
  p.polpermissive AS is_permissive,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expression
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'wishlist_items'
ORDER BY policy_name;


-- -----------------------------------------------------------------------------
-- P1-D6a | SAFE TO SHARE
-- WHAT: wishlist_items grants (empty if missing).
-- -----------------------------------------------------------------------------
SELECT
  g.grantee,
  g.privilege_type
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public'
  AND g.table_name = 'wishlist_items'
  AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY g.grantee, g.privilege_type;


-- -----------------------------------------------------------------------------
-- P1-D6b | SAFE TO SHARE
-- WHAT: wishlist_items indexes (empty if missing).
-- -----------------------------------------------------------------------------
SELECT
  i.relname AS index_name,
  pg_get_indexdef(i.oid) AS index_definition
FROM pg_index x
JOIN pg_class t ON t.oid = x.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_class i ON i.oid = x.indexrelid
WHERE n.nspname = 'public'
  AND t.relname = 'wishlist_items'
ORDER BY i.relname;


-- -----------------------------------------------------------------------------
-- P1-E0 | SAFE TO SHARE
-- WHAT: Does supabase_migrations.schema_migrations exist?
-- PREREQUISITE FOR: P2-C6, P2-D7, P2-E1, P2-E2
-- -----------------------------------------------------------------------------
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'supabase_migrations'
    AND table_name = 'schema_migrations'
) AS schema_migrations_exists;


-- -----------------------------------------------------------------------------
-- P1-E3 | SAFE TO SHARE
-- WHAT: Boolean inventory of expected objects (catalog only).
-- -----------------------------------------------------------------------------
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') AS has_profiles,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wines') AS has_wines,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bottles') AS has_bottles,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'consumption_history') AS has_consumption_history,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_entitlements') AS has_user_entitlements,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_ai_credits') AS has_user_ai_credits,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_usage_events') AS has_ai_usage_events,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wishlist_items') AS has_wishlist_items,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_cellars') AS has_shared_cellars,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admins') AS has_admins,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces') AS has_baby_workspaces,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'babies') AS has_baby_babies,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'consumption_history' AND column_name = 'opened_quantity') AS has_opened_quantity,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bottles' AND column_name = 'opened_at') AS has_bottles_opened_at,
  EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'bottles_with_wine_info') AS has_bottles_with_wine_info,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ) AS has_is_admin,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reset_monthly_credits'
  ) AS has_reset_monthly_credits,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'process_ai_credit_usage'
  ) AS has_process_ai_credit_usage,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  ) AS has_handle_new_user;


-- -----------------------------------------------------------------------------
-- P1-F1 | SAFE TO SHARE
-- WHAT: Is pg_cron extension installed?
-- -----------------------------------------------------------------------------
SELECT EXISTS (
  SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
) AS pg_cron_installed;


-- -----------------------------------------------------------------------------
-- P1-F1b | SAFE TO SHARE
-- WHAT: Does cron.job relation exist (independent of extension row)?
-- PREREQUISITE FOR: P2-F2
-- -----------------------------------------------------------------------------
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'cron'
    AND table_name = 'job'
) AS cron_job_table_exists;


-- -----------------------------------------------------------------------------
-- P1-F3 | SAFE TO SHARE
-- WHAT: pg_cron installed + reset_monthly_credits function exists.
-- -----------------------------------------------------------------------------
SELECT
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS pg_cron_installed,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'reset_monthly_credits'
  ) AS reset_monthly_credits_function_exists;


-- -----------------------------------------------------------------------------
-- P1-G1 | SAFE TO SHARE
-- WHAT: public SECURITY DEFINER functions — metadata + EXECUTE grants.
--       PUBLIC EXECUTE via aclexplode (grantee oid 0). No function bodies.
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  r.rolname AS owner,
  p.prosecdef AS is_security_definer,
  COALESCE(
    (
      SELECT cfg
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
      WHERE cfg LIKE 'search_path=%'
      LIMIT 1
    ),
    '(no search_path set)'
  ) AS search_path_setting,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = 'anon')
      THEN has_function_privilege('anon', p.oid, 'EXECUTE')
    ELSE NULL
  END AS anon_execute,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = 'authenticated')
      THEN has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ELSE NULL
  END AS authenticated_execute,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = 'service_role')
      THEN has_function_privilege('service_role', p.oid, 'EXECUTE')
    ELSE NULL
  END AS service_role_execute,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl(
      grantor, grantee, privilege_type, is_grantable
    )
    WHERE acl.privilege_type = 'EXECUTE'
      AND acl.grantee = 0
  ) AS public_execute_via_acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public'
  AND p.prosecdef IS TRUE
ORDER BY p.proname, arguments;


-- -----------------------------------------------------------------------------
-- P1-H1 | SAFE TO SHARE
-- WHAT: consumption_history columns related to open/undo (empty if table missing).
-- -----------------------------------------------------------------------------
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'consumption_history'
  AND column_name IN (
    'id', 'user_id', 'bottle_id', 'wine_id',
    'opened_quantity', 'opened_at',
    'status', 'undone_at', 'idempotency_key'
  )
ORDER BY column_name;


-- -----------------------------------------------------------------------------
-- P1-H0 | SAFE TO SHARE
-- WHAT: Prerequisites for PASS 2 inventory aggregates.
-- -----------------------------------------------------------------------------
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'consumption_history'
  ) AS consumption_history_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consumption_history'
      AND column_name = 'opened_quantity'
  ) AS opened_quantity_column_exists,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bottles'
  ) AS bottles_exists;


-- #############################################################################
-- PASS 2 — Conditional aggregate checks
-- #############################################################################
-- Run each block ONLY when its prerequisite from PASS 1 is true.
-- These statements reference live tables/columns and WILL ERROR if missing.
-- #############################################################################


-- -----------------------------------------------------------------------------
-- P2-A10 | SAFE TO SHARE
-- PREREQUISITE: P1-A13.profiles_is_admin_column_exists = true
--                (and profiles table exists — implied by P1-A1 non-empty)
-- WHAT: Count of admin profiles (no PII).
-- -----------------------------------------------------------------------------
SELECT COUNT(*) AS admin_profile_count
FROM public.profiles
WHERE is_admin IS TRUE;


-- -----------------------------------------------------------------------------
-- P2-A11-opt | REDACT BEFORE SHARING (optional — skip unless needed)
-- PREREQUISITE: P1-A13.profiles_is_admin_column_exists = true
-- WHAT: Non-reversible roster fingerprint for comparing known admin sets.
--       Does NOT return emails or raw UUIDs.
-- HOW TO READ: Compare admin_roster_fingerprint to a locally computed hash of
--              your known admin UUID list (sorted, concatenated, md5).
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*) AS admin_profile_count,
  md5(
    string_agg(id::text, ',' ORDER BY id::text)
  ) AS admin_roster_fingerprint
FROM public.profiles
WHERE is_admin IS TRUE;


-- -----------------------------------------------------------------------------
-- P2-A11-emails | REDACT BEFORE SHARING (OPTIONAL — prefer P2-A11-opt)
-- PREREQUISITE: P1-A13.profiles_is_admin_column_exists = true
-- WHAT: Admin id + email for offline roster verification ONLY.
--       Do not include in the standard results-to-share set.
-- -----------------------------------------------------------------------------
SELECT
  id,
  email
FROM public.profiles
WHERE is_admin IS TRUE
ORDER BY email NULLS LAST;


-- -----------------------------------------------------------------------------
-- P2-A12b | SAFE TO SHARE
-- PREREQUISITE: P1-A12.admins_table_exists = true
--               AND P1-A13.profiles_is_admin_column_exists = true
-- WHAT: Dual admin model counts.
-- -----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM public.admins) AS admins_table_count,
  (SELECT COUNT(*) FROM public.profiles WHERE is_admin IS TRUE) AS profiles_is_admin_count;


-- -----------------------------------------------------------------------------
-- P2-B8 | SAFE TO SHARE
-- PREREQUISITE: P1-B1.shared_cellars_exists = true
-- WHAT: Aggregate share counts only (no IDs / payloads).
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (
    WHERE expires_at IS NULL OR expires_at > NOW()
  ) AS active_or_no_expiry_rows,
  COUNT(*) FILTER (
    WHERE expires_at IS NOT NULL AND expires_at <= NOW()
  ) AS expired_rows
FROM public.shared_cellars;


-- -----------------------------------------------------------------------------
-- P2-C6 | SAFE TO SHARE
-- PREREQUISITE: P1-E0.schema_migrations_exists = true
-- WHAT: Migration history rows related to initial schema / view fix.
-- -----------------------------------------------------------------------------
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '%20251226%'
   OR version LIKE '%20251231%'
   OR name ILIKE '%bottles_with_wine%'
   OR name ILIKE '%security_definer_view%'
   OR name ILIKE '%initial_schema%'
ORDER BY version;


-- -----------------------------------------------------------------------------
-- P2-D7 | SAFE TO SHARE
-- PREREQUISITE: P1-E0.schema_migrations_exists = true
-- WHAT: Migration history mentions of wishlist.
-- -----------------------------------------------------------------------------
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE name ILIKE '%wishlist%'
   OR version LIKE '%20240110%'
   OR version LIKE '%20260302%'
ORDER BY version;


-- -----------------------------------------------------------------------------
-- P2-E1 | SAFE TO SHARE
-- PREREQUISITE: P1-E0.schema_migrations_exists = true
-- WHAT: Full applied migration version list (metadata only).
-- -----------------------------------------------------------------------------
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;


-- -----------------------------------------------------------------------------
-- P2-E2 | SAFE TO SHARE
-- PREREQUISITE: P1-E0.schema_migrations_exists = true
-- WHAT: Heuristic match of suspicious / manual filenames to applied versions.
-- -----------------------------------------------------------------------------
WITH suspects AS (
  SELECT unnest(ARRAY[
    '001_initial_schema',
    '002_rls_policies',
    '003_realtime',
    'RUN_IMAGE_PATHS_MIGRATION',
    'backfill_readiness_all_users',
    'backfill_image_paths_one_time',
    'backfill_label_image_urls',
    'diagnose_and_repair_images',
    'fix_expired_image_urls_in_place',
    'fix_expired_wishlist_image_urls',
    '20251231_fix_security_definer_view',
    '20251226_initial_schema',
    '20240110_create_wishlist',
    '20240110_add_wishlist',
    'shared_cellars',
    'CREATE_SHARED_CELLARS'
  ]) AS token
)
SELECT
  s.token,
  EXISTS (
    SELECT 1
    FROM supabase_migrations.schema_migrations m
    WHERE m.version ILIKE '%' || s.token || '%'
       OR m.name ILIKE '%' || s.token || '%'
  ) AS matched_in_schema_migrations
FROM suspects s
ORDER BY s.token;


-- -----------------------------------------------------------------------------
-- P2-F2 | SAFE TO SHARE
-- PREREQUISITE: P1-F1b.cron_job_table_exists = true
-- WHAT: Credit-related cron jobs — name, schedule, active, classification, hash.
--       Does NOT return raw command, username, nodename, nodeport, or database.
-- -----------------------------------------------------------------------------
SELECT
  jobname,
  schedule,
  active,
  CASE
    WHEN command ILIKE '%reset_monthly_credits%' THEN 'contains_reset_monthly_credits'
    WHEN command ILIKE '%reset_free_user_credits%' THEN 'contains_reset_free_user_credits'
    WHEN command ILIKE '%http%'
      OR command ILIKE '%Bearer%'
      OR command ILIKE '%apikey%'
      OR command ILIKE '%secret%'
      OR command ILIKE '%token%'
      THEN 'REDACTED_possible_secret_bearing'
    ELSE 'other_non_secret_classified'
  END AS command_classification,
  length(command) AS command_length_chars,
  md5(command) AS command_md5
FROM cron.job
WHERE jobname ILIKE '%credit%'
   OR jobname ILIKE '%reset%'
   OR command ILIKE '%reset_monthly_credits%'
   OR command ILIKE '%reset_free_user_credits%'
ORDER BY jobname;


-- -----------------------------------------------------------------------------
-- P2-H2a | SAFE TO SHARE
-- PREREQUISITE: P1-H0.consumption_history_exists = true
-- WHAT: Event count only (safe even if opened_quantity column is absent).
-- -----------------------------------------------------------------------------
SELECT COUNT(*) AS event_count
FROM public.consumption_history;


-- -----------------------------------------------------------------------------
-- P2-H2b | SAFE TO SHARE
-- PREREQUISITE: P1-H0.consumption_history_exists = true
--               AND P1-H0.opened_quantity_column_exists = true
-- WHAT: Sum of opened_quantity (aggregates only).
-- -----------------------------------------------------------------------------
SELECT COALESCE(SUM(opened_quantity), 0) AS sum_opened_quantity
FROM public.consumption_history;


-- -----------------------------------------------------------------------------
-- P2-H3 | SAFE TO SHARE
-- PREREQUISITE: P1-H0.bottles_exists = true
-- WHAT: Count of zero-quantity bottle rows.
-- -----------------------------------------------------------------------------
SELECT COUNT(*) AS zero_quantity_bottle_rows
FROM public.bottles
WHERE quantity = 0;


-- -----------------------------------------------------------------------------
-- P2-H4 | SAFE TO SHARE
-- PREREQUISITE: P1-H0.bottles_exists = true
-- WHAT: Count of negative-quantity bottle rows (expect 0).
-- -----------------------------------------------------------------------------
SELECT COUNT(*) AS negative_quantity_bottle_rows
FROM public.bottles
WHERE quantity < 0;


-- #############################################################################
-- PASS 3 — Optional sensitive definition checks
-- #############################################################################
-- WARNING
--   These queries return full function or view source via pg_get_functiondef /
--   pg_get_viewdef. Source may contain hardcoded URLs, tokens, headers, or
--   other secrets.
--   Manually inspect every row before export.
--   Do NOT include PASS 3 outputs in the standard results-to-share set.
--   Classification: DO NOT SHARE WITHOUT MANUAL REVIEW
-- #############################################################################


-- -----------------------------------------------------------------------------
-- P3-A6-def | DO NOT SHARE WITHOUT MANUAL REVIEW
-- PREREQUISITE: P1-A5 returned at least one profiles trigger (optional).
-- WHAT: Full bodies of functions attached to profiles triggers.
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.oid IN (
  SELECT t.tgfoid
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relname = 'profiles'
    AND NOT t.tgisinternal
);


-- -----------------------------------------------------------------------------
-- P3-A7-def | DO NOT SHARE WITHOUT MANUAL REVIEW
-- PREREQUISITE: P1-A7 returned is_admin (optional).
-- WHAT: Full is_admin() function body.
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_admin';


-- -----------------------------------------------------------------------------
-- P3-C2-def | DO NOT SHARE WITHOUT MANUAL REVIEW
-- PREREQUISITE: P1-C1.bottles_with_wine_info_exists = true
-- WHAT: Exact bottles_with_wine_info view definition text.
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  c.relname AS view_name,
  pg_get_viewdef(c.oid, true) AS view_definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'bottles_with_wine_info'
  AND c.relkind = 'v';


-- -----------------------------------------------------------------------------
-- P3-G2 | DO NOT SHARE WITHOUT MANUAL REVIEW
-- PREREQUISITE: none (catalog-safe) but evaluates full DEFINER bodies server-side.
-- WHAT: Heuristic which DEFINER functions reference privileged table names.
--       Output is metadata flags only (no body column), but computation loads
--       full definitions — inspect locally; prefer not to share unless needed.
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  (
    def ILIKE '%profiles%'
    OR def ILIKE '%user_ai_credits%'
    OR def ILIKE '%user_entitlements%'
    OR def ILIKE '%admins%'
    OR def ILIKE '%ai_usage_events%'
    OR def ILIKE '%paddle_events%'
  ) AS references_privileged_tables_heuristic,
  CASE WHEN def ILIKE '%profiles%' THEN 'profiles ' ELSE '' END
    || CASE WHEN def ILIKE '%user_ai_credits%' THEN 'user_ai_credits ' ELSE '' END
    || CASE WHEN def ILIKE '%user_entitlements%' THEN 'user_entitlements ' ELSE '' END
    || CASE WHEN def ILIKE '%admins%' THEN 'admins ' ELSE '' END
    || CASE WHEN def ILIKE '%ai_usage_events%' THEN 'ai_usage_events ' ELSE '' END
    || CASE WHEN def ILIKE '%paddle_events%' THEN 'paddle_events ' ELSE '' END
    AS matched_tables
FROM (
  SELECT
    p.oid,
    p.proname,
    p.pronamespace,
    pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  WHERE p.prosecdef IS TRUE
) p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;


-- -----------------------------------------------------------------------------
-- P3-G3-def | DO NOT SHARE WITHOUT MANUAL REVIEW
-- PREREQUISITE: none (optional). Prefer limit to named functions of interest.
-- WHAT: Full bodies of all public SECURITY DEFINER functions.
--       HIGH SENSITIVITY — may embed secrets. Do not export blindly.
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef IS TRUE
ORDER BY p.proname, arguments;


-- #############################################################################
-- PASS 4 — State-changing exploit test (DOCUMENTED ONLY — NOT EXECUTED HERE)
-- #############################################################################
--
-- This file intentionally contains NO SQL for privilege-escalation probes.
--
-- A disposable-account PostgREST UPDATE test (profiles.is_admin = true) is
-- described in PHASE_0_VERIFICATION.md section 3.1.
--
-- Do not run it unless you explicitly authorize a state-changing test.
-- Do not add exploit UPDATE/INSERT statements to this file.
--
-- #############################################################################


-- =============================================================================
-- END OF READ-ONLY VERIFICATION SCRIPT
-- =============================================================================
-- Standard results-to-share: PASS 1 (all) + selected PASS 2 blocks.
-- Exclude: P2-A11-emails, all of PASS 3, unless manually reviewed.
-- =============================================================================
)
