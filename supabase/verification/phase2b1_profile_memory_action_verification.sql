-- =============================================================================
-- Read-only post-migration verification dashboard:
--   public.apply_taste_profile_memory_action(jsonb)
--   from supabase/migrations/20260912_taste_profile_memory_action.sql
--
-- Run this ENTIRE file in Supabase SQL Editor.
-- It returns ONE summary row. Every data column ends in _ok (boolean).
--
-- SAFE: catalog / privilege / source-text checks only.
-- DO NOT run as a migration.
-- DO NOT SELECT profile/user payload rows.
-- DO NOT CALL apply_taste_profile_memory_action or any mutation RPC.
-- =============================================================================

WITH fn AS (
  SELECT
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    pg_get_functiondef(p.oid) AS def,
    p.prosecdef AS is_security_definer,
    p.proacl,
    p.proowner,
    p.proconfig,
    obj_description(p.oid) AS comment
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'apply_taste_profile_memory_action'
),
fn_one AS (
  SELECT *
  FROM fn
  WHERE identity_args = 'p_payload jsonb'
  LIMIT 1
),
checks AS (
  SELECT
    -- Existence / signature / overload
    (SELECT COUNT(*) = 1 FROM fn) AS function_exists_ok,
    (SELECT COUNT(*) = 1 FROM fn) AS single_overload_ok,
    EXISTS (
      SELECT 1 FROM fn_one WHERE identity_args = 'p_payload jsonb'
    ) AS exact_signature_ok,

    -- Security posture
    COALESCE((SELECT NOT is_security_definer FROM fn_one), false) AS security_invoker_ok,
    -- Authoritative fixed search_path check uses pg_proc.proconfig.
    -- pg_get_functiondef often rewrites "SET search_path = public" to
    -- "SET search_path TO 'public'", so def-string matching alone is a false negative.
    COALESCE(
      (
        SELECT bool_or(
          lower(split_part(cfg, '=', 1)) = 'search_path'
          AND regexp_replace(
                lower(replace(replace(trim(split_part(cfg, '=', 2)), '"', ''), '''', '')),
                '\s*,\s*',
                ',',
                'g'
              ) IN ('public', 'public,pg_temp', 'pg_temp,public')
        )
        FROM fn_one f
        CROSS JOIN LATERAL unnest(COALESCE(f.proconfig, ARRAY[]::text[])) AS cfg
      ),
      false
    ) AS fixed_search_path_ok,
    COALESCE(
      (SELECT position('auth.uid()' IN def) > 0 FROM fn_one),
      false
    ) AS uses_auth_uid_ok,

    -- Grants
    COALESCE(
      has_function_privilege(
        'authenticated',
        'public.apply_taste_profile_memory_action(jsonb)',
        'execute'
      ),
      false
    ) AS authenticated_execute_ok,
    COALESCE(
      has_function_privilege(
        'service_role',
        'public.apply_taste_profile_memory_action(jsonb)',
        'execute'
      ),
      false
    ) AS service_role_execute_ok,
    COALESCE(
      NOT has_function_privilege(
        'anon',
        'public.apply_taste_profile_memory_action(jsonb)',
        'execute'
      ),
      false
    ) AS anon_execute_denied_ok,
    COALESCE(
      NOT EXISTS (
        SELECT 1
        FROM fn_one f
        CROSS JOIN LATERAL aclexplode(COALESCE(f.proacl, acldefault('f', f.proowner))) a
        WHERE a.grantee = 0
          AND a.privilege_type = 'EXECUTE'
      ),
      false
    ) AS public_execute_denied_ok,

    -- Idempotency implementation
    COALESCE(
      (SELECT position('profile_memory_action_' IN def) > 0 FROM fn_one),
      false
    ) AS operation_idempotency_key_ok,
    COALESCE(
      (
        SELECT position('invalid_operation_id' IN def) > 0
            OR position('invalid_idempotency_key' IN def) > 0
        FROM fn_one
      ),
      false
    ) AS operation_id_validation_ok,
    COALESCE(
      (SELECT position('idempotency_conflict' IN def) > 0 FROM fn_one),
      false
    ) AS same_operation_different_payload_rejected_ok,

    -- Supported action/dimension validation
    COALESCE(
      (
        SELECT position('''replace''' IN def) > 0
           AND position('''remove''' IN def) > 0
           AND position('invalid_action' IN def) > 0
        FROM fn_one
      ),
      false
    ) AS action_validation_ok,
    COALESCE(
      (
        SELECT position('''region''' IN def) > 0
           AND position('''grape''' IN def) > 0
           AND position('''body''' IN def) > 0
           AND position('''style''' IN def) > 0
           AND position('invalid_dimension' IN def) > 0
        FROM fn_one
      ),
      false
    ) AS dimension_validation_ok,
    COALESCE(
      (SELECT position('unsupported_profile_action' IN def) > 0 FROM fn_one),
      false
    ) AS unsupported_combo_rejected_ok,

    -- Profile API action coverage (RPC action+dimension pairs)
    COALESCE(
      (
        SELECT
          position('v_dim IN (''region'', ''grape'', ''style'')' IN def) > 0
          OR position('v_dim IN (''region'',''grape'',''style'')' IN def) > 0
        FROM fn_one
      ),
      false
    ) AS remove_region_grape_style_ok,
    COALESCE(
      (
        SELECT
          position('v_action = ''replace'' AND v_dim = ''body''' IN def) > 0
          OR position('v_action=''replace'' AND v_dim=''body''' IN def) > 0
        FROM fn_one
      ),
      false
    ) AS replace_body_ok,
    COALESCE(
      (
        SELECT
          position('v_action = ''remove'' AND v_dim = ''body''' IN def) > 0
          OR position('v_action=''remove'' AND v_dim=''body''' IN def) > 0
        FROM fn_one
      ),
      false
    ) AS clear_body_ok,
    COALESCE(
      (
        SELECT position('styles_liked' IN def) > 0
           AND position('styles_disliked' IN def) > 0
           AND (
             position('v_dim IN (''region'', ''grape'', ''style'')' IN def) > 0
             OR position('v_dim IN (''region'',''grape'',''style'')' IN def) > 0
           )
        FROM fn_one
      ),
      false
    ) AS remove_style_support_ok,

    -- Evidence write semantics
    COALESCE(
      (
        SELECT position(', ''applied''' IN def) > 0
            OR position(',''applied''' IN def) > 0
            OR position('status = ''applied''' IN def) > 0
        FROM fn_one
      ),
      false
    ) AS inserts_evidence_as_applied_ok,
    COALESCE(
      (
        SELECT
          position('INSERT INTO public.sommelier_feedback_events' IN def) > 0
          AND position('''pending_confirmation''' IN substring(
                def
                from position('INSERT INTO public.sommelier_feedback_events' IN def)
                for 1200
              )) = 0
        FROM fn_one
      ),
      false
    ) AS no_pending_confirmation_insert_ok,
    COALESCE(
      (SELECT coalesce(comment, '') ILIKE '%pending_confirmation%' FROM fn_one),
      false
    ) AS comment_documents_no_pending_ok,

    -- RLS (catalog flags only; no row reads)
    COALESCE(
      (
        SELECT c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'profiles'
      ),
      false
    ) AS profiles_rls_enabled_ok,
    COALESCE(
      (
        SELECT c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'sommelier_feedback_events'
      ),
      false
    ) AS feedback_events_rls_enabled_ok,

    -- Compatibility (chat RPCs still present)
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'create_taste_pending_confirmation'
    ) AS create_pending_still_present_ok,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'resolve_taste_confirmation'
    ) AS resolve_pending_still_present_ok,

    -- Script safety markers (always true for this read-only file)
    true AS verification_readonly_ok,
    true AS no_user_data_selected_ok,
    true AS no_mutation_rpc_invoked_ok
)
SELECT
  function_exists_ok,
  single_overload_ok,
  exact_signature_ok,
  security_invoker_ok,
  fixed_search_path_ok,
  uses_auth_uid_ok,
  authenticated_execute_ok,
  service_role_execute_ok,
  anon_execute_denied_ok,
  public_execute_denied_ok,
  operation_idempotency_key_ok,
  operation_id_validation_ok,
  same_operation_different_payload_rejected_ok,
  action_validation_ok,
  dimension_validation_ok,
  unsupported_combo_rejected_ok,
  remove_region_grape_style_ok,
  replace_body_ok,
  clear_body_ok,
  remove_style_support_ok,
  inserts_evidence_as_applied_ok,
  no_pending_confirmation_insert_ok,
  comment_documents_no_pending_ok,
  profiles_rls_enabled_ok,
  feedback_events_rls_enabled_ok,
  create_pending_still_present_ok,
  resolve_pending_still_present_ok,
  verification_readonly_ok,
  no_user_data_selected_ok,
  no_mutation_rpc_invoked_ok,
  (
    function_exists_ok
    AND single_overload_ok
    AND exact_signature_ok
    AND security_invoker_ok
    AND fixed_search_path_ok
    AND uses_auth_uid_ok
    AND authenticated_execute_ok
    AND service_role_execute_ok
    AND anon_execute_denied_ok
    AND public_execute_denied_ok
    AND operation_idempotency_key_ok
    AND operation_id_validation_ok
    AND same_operation_different_payload_rejected_ok
    AND action_validation_ok
    AND dimension_validation_ok
    AND unsupported_combo_rejected_ok
    AND remove_region_grape_style_ok
    AND replace_body_ok
    AND clear_body_ok
    AND remove_style_support_ok
    AND inserts_evidence_as_applied_ok
    AND no_pending_confirmation_insert_ok
    AND comment_documents_no_pending_ok
    AND profiles_rls_enabled_ok
    AND feedback_events_rls_enabled_ok
    AND create_pending_still_present_ok
    AND resolve_pending_still_present_ok
    AND verification_readonly_ok
    AND no_user_data_selected_ok
    AND no_mutation_rpc_invoked_ok
  ) AS all_checks_ok
FROM checks;
