-- =============================================================================
-- Sommi Phase 2A — READ-ONLY post-migration verification
-- =============================================================================
--
-- PURPOSE
--   Confirm production Supabase matches migration
--   supabase/migrations/20260910_taste_profile_phase2a_atomic.sql
--   after that migration has been applied.
--
-- SAFETY CONTRACT (STRICT)
--   - Catalog queries + aggregate COUNTs only.
--   - No INSERT / UPDATE / DELETE / CREATE / ALTER / DROP / TRUNCATE.
--   - No GRANT / REVOKE / SET ROLE / DO blocks that mutate.
--   - Do NOT call apply_taste_profile_patch or apply_taste_evidence_and_canonical.
--   - Do NOT SELECT raw_text, taste_profile, preference_delta, user_id,
--     bottle_id, or other personal/content columns.
--
-- HOW TO RUN
--   Paste sections into the Supabase SQL Editor (or run the whole file).
--   Copy each result grid back for review (all sections are SAFE TO SHARE).
--
-- APPLICATION CALL SHAPES (for signature checks)
--   supabase.rpc('apply_taste_profile_patch', {
--     p_action: text, p_payload: jsonb
--   })  → jsonb
--   supabase.rpc('apply_taste_evidence_and_canonical', {
--     p_payload: jsonb
--   })  → jsonb
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- SECTION 1 | Columns on public.sommelier_feedback_events
-- WHAT: Presence, type, nullability, defaults for Phase 2A evidence columns.
-- EXPECTED HEALTHY:
--   Exactly 9 rows below, all present_ok = true.
--   data_type = 'text' for the 8 text columns; 'boolean' for applied_to_canonical.
--   is_nullable = 'YES' for all (migration did not force NOT NULL).
--   applied_to_canonical.column_default contains 'false' (or equivalent).
--   Other 8 text columns have NULL column_default.
-- SEND BACK: Full result grid.
-- -----------------------------------------------------------------------------
WITH expected(column_name, expected_udt, expected_nullable, expect_default_false) AS (
  VALUES
    ('scope',               'text',    'YES', false),
    ('polarity',            'text',    'YES', false),
    ('extraction_version',  'text',    'YES', false),
    ('locale',              'text',    'YES', false),
    ('idempotency_key',     'text',    'YES', false),
    ('status',              'text',    'YES', false),
    ('target_dimension',    'text',    'YES', false),
    ('target_value',        'text',    'YES', false),
    ('applied_to_canonical','bool',    'YES', true)
)
SELECT
  e.column_name,
  c.udt_name AS actual_udt,
  c.data_type AS actual_data_type,
  c.is_nullable AS actual_nullable,
  c.column_default AS actual_default,
  (c.column_name IS NOT NULL) AS present_ok,
  (c.udt_name = e.expected_udt) AS type_ok,
  (c.is_nullable = e.expected_nullable) AS nullable_ok,
  CASE
    WHEN e.expect_default_false THEN
      (c.column_default IS NOT NULL AND c.column_default ILIKE '%false%')
    ELSE
      (c.column_default IS NULL)
  END AS default_ok
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'sommelier_feedback_events'
 AND c.column_name = e.column_name
ORDER BY e.column_name;


-- -----------------------------------------------------------------------------
-- SECTION 2 | CHECK constraints on sommelier_feedback_events
-- WHAT: Named CHECKs from the migration exist and are valid.
-- EXPECTED HEALTHY:
--   4 rows, one per constraint name below; contype = 'c'.
--   convalidated = true (or NULL on older catalogs — still acceptable if present).
--   check_ok = true for each (definition mentions the column + NULL-or-IN pattern).
-- SEND BACK: Full result grid.
-- -----------------------------------------------------------------------------
WITH expected(conname, must_mention) AS (
  VALUES
    ('sommelier_feedback_scope_check',      'scope'),
    ('sommelier_feedback_polarity_check',   'polarity'),
    ('sommelier_feedback_status_check',     'status'),
    ('sommelier_feedback_dimension_check',  'target_dimension')
)
SELECT
  e.conname,
  (c.oid IS NOT NULL) AS present_ok,
  c.contype,
  c.convalidated,
  pg_get_constraintdef(c.oid) AS constraint_def,
  (
    c.oid IS NOT NULL
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%' || e.must_mention || '%'
    AND pg_get_constraintdef(c.oid) ILIKE '%IS NULL%'
  ) AS check_ok
FROM expected e
LEFT JOIN pg_constraint c
  ON c.conname = e.conname
 AND c.conrelid = 'public.sommelier_feedback_events'::regclass
ORDER BY e.conname;


-- -----------------------------------------------------------------------------
-- SECTION 3 | Partial unique idempotency index
-- WHAT: uq_sommelier_feedback_idempotency on (user_id, idempotency_key)
--       WHERE idempotency_key IS NOT NULL.
-- EXPECTED HEALTHY:
--   index_exists = true
--   indexdef UNIQUE on (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
--   columns_ok = true, predicate_ok = true
-- SEND BACK: Full result grid.
-- -----------------------------------------------------------------------------
SELECT
  i.indexname AS index_name,
  true AS index_exists,
  i.indexdef,
  (i.indexdef ILIKE '%UNIQUE%') AS is_unique_ok,
  (i.indexdef ILIKE '%user_id%' AND i.indexdef ILIKE '%idempotency_key%') AS columns_ok,
  (
    i.indexdef ILIKE '%WHERE%'
    AND i.indexdef ILIKE '%idempotency_key%IS NOT NULL%'
  ) AS predicate_ok
FROM pg_indexes i
WHERE i.schemaname = 'public'
  AND i.tablename = 'sommelier_feedback_events'
  AND i.indexname = 'uq_sommelier_feedback_idempotency';

-- Presence probe if the index is missing (returns a single false row)
SELECT
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'sommelier_feedback_events'
      AND indexname = 'uq_sommelier_feedback_idempotency'
  ) AS index_exists;


-- -----------------------------------------------------------------------------
-- SECTION 4 | RPC existence, signatures, return types, overload count
-- WHAT: Exact overloads matching application rpc() argument names/types.
-- EXPECTED HEALTHY:
--   4A: Exactly one overload per name (overload_count_for_name = 1).
--   4B: Both present_ok / signature_ok = true.
--     apply_taste_profile_patch(text, jsonb) → jsonb  args p_action, p_payload
--     apply_taste_evidence_and_canonical(jsonb) → jsonb  arg p_payload
-- SEND BACK: Full result grids (4A + 4B).
-- -----------------------------------------------------------------------------

-- 4A: All overloads of the two public RPCs (should be exactly one each)
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  pg_get_function_arguments(p.oid) AS full_args,
  pg_catalog.format_type(p.prorettype, NULL) AS return_type,
  COUNT(*) OVER (PARTITION BY p.proname) AS overload_count_for_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'apply_taste_profile_patch',
    'apply_taste_evidence_and_canonical'
  )
ORDER BY p.proname, identity_args;

-- 4B: Signature match vs application calls
WITH expected AS (
  SELECT * FROM (VALUES
    (
      'apply_taste_profile_patch',
      'text, jsonb',
      'jsonb',
      ARRAY['p_action', 'p_payload']::text[]
    ),
    (
      'apply_taste_evidence_and_canonical',
      'jsonb',
      'jsonb',
      ARRAY['p_payload']::text[]
    )
  ) AS v(function_name, identity_args, return_type, arg_names)
)
SELECT
  e.function_name,
  e.identity_args AS expected_identity_args,
  e.return_type AS expected_return_type,
  e.arg_names AS expected_arg_names,
  (p.oid IS NOT NULL) AS present_ok,
  pg_get_function_identity_arguments(p.oid) AS actual_identity_args,
  pg_catalog.format_type(p.prorettype, NULL) AS actual_return_type,
  COALESCE(p.proargnames, ARRAY[]::text[]) AS actual_arg_names,
  (
    p.oid IS NOT NULL
    AND pg_get_function_identity_arguments(p.oid) = e.identity_args
    AND pg_catalog.format_type(p.prorettype, NULL) = e.return_type
    AND COALESCE(p.proargnames, ARRAY[]::text[]) @> e.arg_names
  ) AS signature_ok
FROM expected e
LEFT JOIN pg_proc p
  ON p.proname = e.function_name
 AND p.pronamespace = 'public'::regnamespace
 AND pg_get_function_identity_arguments(p.oid) = e.identity_args
ORDER BY e.function_name;


-- -----------------------------------------------------------------------------
-- SECTION 5 | SECURITY INVOKER + fixed search_path
-- WHAT: prosecdef must be false (INVOKER). proconfig must set search_path=public.
-- EXPECTED HEALTHY:
--   Two rows (one per intended overload).
--   is_security_invoker = true, is_security_definer = false.
--   search_path_ok = true (proconfig contains search_path=public).
-- SEND BACK: Full result grid.
-- -----------------------------------------------------------------------------
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef AS is_security_definer,
  (NOT p.prosecdef) AS is_security_invoker,
  p.proconfig AS proconfig,
  (
    EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
      WHERE cfg = 'search_path=public'
         OR cfg LIKE 'search_path=public,%'
         OR cfg = 'search_path="public"'
    )
  ) AS search_path_ok
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    (p.proname = 'apply_taste_profile_patch'
      AND pg_get_function_identity_arguments(p.oid) = 'text, jsonb')
    OR
    (p.proname = 'apply_taste_evidence_and_canonical'
      AND pg_get_function_identity_arguments(p.oid) = 'jsonb')
  )
ORDER BY p.proname;


-- -----------------------------------------------------------------------------
-- SECTION 6 | Execute privileges (PUBLIC / anon / authenticated / service_role)
-- WHAT: Intended grants only — authenticated + service_role EXECUTE;
--       PUBLIC and anon must NOT have EXECUTE.
-- EXPECTED HEALTHY:
--   For each of the two functions:
--     public_has_execute = false
--     anon_has_execute = false
--     authenticated_has_execute = true
--     service_role_has_execute = true  (migration grants it)
--     grants_ok = true
-- SEND BACK: Full result grids (6A + 6B).
-- -----------------------------------------------------------------------------
WITH fns AS (
  SELECT
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS identity_args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (
      (p.proname = 'apply_taste_profile_patch'
        AND pg_get_function_identity_arguments(p.oid) = 'text, jsonb')
      OR
      (p.proname = 'apply_taste_evidence_and_canonical'
        AND pg_get_function_identity_arguments(p.oid) = 'jsonb')
    )
)
SELECT
  f.proname AS function_name,
  f.identity_args,
  has_function_privilege('public', f.oid, 'EXECUTE') AS public_has_execute,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    THEN has_function_privilege('anon', f.oid, 'EXECUTE')
    ELSE NULL
  END AS anon_has_execute,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
    THEN has_function_privilege('authenticated', f.oid, 'EXECUTE')
    ELSE NULL
  END AS authenticated_has_execute,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
    THEN has_function_privilege('service_role', f.oid, 'EXECUTE')
    ELSE NULL
  END AS service_role_has_execute,
  (
    NOT COALESCE(has_function_privilege('public', f.oid, 'EXECUTE'), false)
    AND NOT COALESCE(
      CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
           THEN has_function_privilege('anon', f.oid, 'EXECUTE') END,
      false
    )
    AND COALESCE(
      CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
           THEN has_function_privilege('authenticated', f.oid, 'EXECUTE') END,
      false
    )
  ) AS grants_ok
FROM fns f
ORDER BY f.proname;

-- 6B: Enumerate EXECUTE grantees (SAFE TO SHARE — role names only)
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'apply_taste_profile_patch',
    'apply_taste_evidence_and_canonical'
  )
  AND privilege_type = 'EXECUTE'
ORDER BY routine_name, grantee;


-- -----------------------------------------------------------------------------
-- SECTION 7 | Aggregate row counts (no personal data)
-- WHAT: Table sizes + nullability compatibility of new columns.
-- EXPECTED HEALTHY:
--   feedback_total >= 0 (informative).
--   Existing pre-migration rows should appear in
--     rows_with_all_new_text_columns_null (new text cols are nullable).
--   applied_to_canonical_false_or_null_count should equal feedback_total
--     immediately after migration (DEFAULT false applied to existing rows).
--   applied_to_canonical_true_count = 0 if no app canonical writes yet.
--   profiles_with_explicit_key_count = 0 if kill-switch never wrote;
--     migration never injects explicit.
-- SEND BACK: Full result grid (aggregates only).
-- -----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM public.sommelier_feedback_events) AS feedback_total,
  (SELECT COUNT(*) FROM public.sommelier_feedback_events
    WHERE scope IS NULL
      AND polarity IS NULL
      AND extraction_version IS NULL
      AND locale IS NULL
      AND idempotency_key IS NULL
      AND status IS NULL
      AND target_dimension IS NULL
      AND target_value IS NULL
  ) AS rows_with_all_new_text_columns_null,
  (SELECT COUNT(*) FROM public.sommelier_feedback_events
    WHERE scope IS NOT NULL
       OR polarity IS NOT NULL
       OR extraction_version IS NOT NULL
       OR locale IS NOT NULL
       OR idempotency_key IS NOT NULL
       OR status IS NOT NULL
       OR target_dimension IS NOT NULL
       OR target_value IS NOT NULL
  ) AS rows_with_any_new_evidence_populated,
  (SELECT COUNT(*) FROM public.sommelier_feedback_events
    WHERE applied_to_canonical IS TRUE
  ) AS applied_to_canonical_true_count,
  (SELECT COUNT(*) FROM public.sommelier_feedback_events
    WHERE applied_to_canonical IS FALSE OR applied_to_canonical IS NULL
  ) AS applied_to_canonical_false_or_null_count,
  (SELECT COUNT(*) FROM public.profiles) AS profiles_total,
  (SELECT COUNT(*) FROM public.profiles
    WHERE taste_profile IS NOT NULL
      AND jsonb_typeof(taste_profile) = 'object'
      AND (taste_profile ? 'explicit')
  ) AS profiles_with_explicit_key_count,
  (SELECT COUNT(*) FROM public.sommelier_agent_memory) AS agent_memory_total;


-- -----------------------------------------------------------------------------
-- SECTION 8 | Migration did not execute backfill / canonical writes
-- WHAT: Aggregate evidence that migration was additive DDL only.
-- EXPECTED HEALTHY (right after migration, before CANONICAL_TASTE_WRITES=ON traffic):
--   applied_to_canonical_true_count = 0
--   profiles_with_explicit_key_count = 0
--   evidence_rpc_present / patch_rpc_present = true
-- SEND BACK: Full result grid.
-- -----------------------------------------------------------------------------
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sommelier_feedback_events'
      AND column_name = 'applied_to_canonical'
  ) AS applied_to_canonical_column_present,
  (
    SELECT COUNT(*) FROM public.sommelier_feedback_events
    WHERE applied_to_canonical IS TRUE
  ) AS applied_to_canonical_true_count,
  (
    SELECT COUNT(*) FROM public.profiles
    WHERE taste_profile IS NOT NULL
      AND jsonb_typeof(taste_profile) = 'object'
      AND (taste_profile ? 'explicit')
  ) AS profiles_with_explicit_key_count,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'apply_taste_evidence_and_canonical'
  ) AS evidence_rpc_present,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'apply_taste_profile_patch'
  ) AS patch_rpc_present,
  (
    SELECT COUNT(*) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE '\_taste%' ESCAPE '\'
  ) AS taste_helper_function_count;


-- -----------------------------------------------------------------------------
-- SECTION 9 | RLS remains enabled on affected tables
-- WHAT: relrowsecurity for feedback events, profiles, agent memory.
-- EXPECTED HEALTHY:
--   All three: rls_enabled = true.
-- SEND BACK: Full result grid.
-- -----------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'sommelier_feedback_events',
    'profiles',
    'sommelier_agent_memory'
  )
ORDER BY c.relname;


-- -----------------------------------------------------------------------------
-- SECTION 10 | Pass/fail summary (boolean checklist)
-- WHAT: Single-row dashboard of critical checks.
-- EXPECTED HEALTHY: every *_ok column = true.
-- SEND BACK: This single row (plus any failing detail sections above).
-- -----------------------------------------------------------------------------
SELECT
  (
    SELECT COUNT(*) = 9
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sommelier_feedback_events'
      AND column_name IN (
        'scope','polarity','extraction_version','locale','idempotency_key',
        'status','target_dimension','target_value','applied_to_canonical'
      )
  ) AS columns_ok,
  (
    SELECT COUNT(*) = 4
    FROM pg_constraint
    WHERE conrelid = 'public.sommelier_feedback_events'::regclass
      AND conname IN (
        'sommelier_feedback_scope_check',
        'sommelier_feedback_polarity_check',
        'sommelier_feedback_status_check',
        'sommelier_feedback_dimension_check'
      )
      AND contype = 'c'
  ) AS checks_ok,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'sommelier_feedback_events'
      AND indexname = 'uq_sommelier_feedback_idempotency'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%user_id%'
      AND indexdef ILIKE '%idempotency_key%'
      AND indexdef ILIKE '%WHERE%'
  ) AS idempotency_index_ok,
  (
    SELECT COUNT(*) = 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'apply_taste_profile_patch'
  ) AS patch_single_overload_ok,
  (
    SELECT COUNT(*) = 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'apply_taste_evidence_and_canonical'
  ) AS evidence_single_overload_ok,
  (
    SELECT BOOL_AND(NOT p.prosecdef)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'apply_taste_profile_patch',
        'apply_taste_evidence_and_canonical'
      )
  ) AS both_security_invoker_ok,
  (
    SELECT BOOL_AND(
      EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
        WHERE cfg = 'search_path=public' OR cfg LIKE 'search_path=public,%'
      )
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'apply_taste_profile_patch',
        'apply_taste_evidence_and_canonical'
      )
  ) AS both_search_path_ok,
  (
    SELECT BOOL_AND(
      NOT COALESCE(has_function_privilege('public', p.oid, 'EXECUTE'), false)
      AND NOT COALESCE(
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
             THEN has_function_privilege('anon', p.oid, 'EXECUTE') END,
        false
      )
      AND COALESCE(
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
             THEN has_function_privilege('authenticated', p.oid, 'EXECUTE') END,
        false
      )
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'apply_taste_profile_patch',
        'apply_taste_evidence_and_canonical'
      )
  ) AS execute_grants_ok,
  (
    SELECT BOOL_AND(c.relrowsecurity)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'sommelier_feedback_events',
        'profiles',
        'sommelier_agent_memory'
      )
  ) AS rls_ok;
