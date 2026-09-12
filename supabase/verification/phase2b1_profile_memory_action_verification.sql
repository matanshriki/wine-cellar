-- Post-migration verification for apply_taste_profile_memory_action
-- Read-only checks. Do not run as a migration.

-- 1) Function exists
SELECT
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'apply_taste_profile_memory_action'
  ) AS function_exists_ok;

-- 2) Grants: authenticated + service_role only
SELECT
  has_function_privilege('authenticated', 'public.apply_taste_profile_memory_action(jsonb)', 'execute')
    AS authenticated_execute_ok,
  has_function_privilege('service_role', 'public.apply_taste_profile_memory_action(jsonb)', 'execute')
    AS service_role_execute_ok;

-- 3) Comment present (no pending_confirmation path)
SELECT
  (
    SELECT obj_description(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'apply_taste_profile_memory_action'
    LIMIT 1
  ) ILIKE '%pending_confirmation%' AS comment_mentions_no_pending_ok;

-- 4) Function source encodes operation-scoped idempotency (not action/value forever)
SELECT
  (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'apply_taste_profile_memory_action'
    LIMIT 1
  ) ILIKE '%profile_memory_action_%' AS operation_key_prefix_ok,
  (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'apply_taste_profile_memory_action'
    LIMIT 1
  ) ILIKE '%idempotency_conflict%' AS payload_conflict_ok,
  (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'apply_taste_profile_memory_action'
    LIMIT 1
  ) NOT ILIKE '%pending_confirmation''%' AS no_insert_pending_ok;

-- 5) Prior Phase 2B.1 RPCs still present (compatibility)
SELECT
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_taste_pending_confirmation'
  ) AS create_pending_still_present_ok,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'resolve_taste_confirmation'
  ) AS resolve_pending_still_present_ok;
