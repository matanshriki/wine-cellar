-- =============================================================================
-- Sommi Phase 2B.1 — READ-ONLY post-migration verification
-- =============================================================================
-- Catalog + aggregate counts only. Do not call mutation RPCs.
-- Do not SELECT raw_text, taste_profile, user IDs, or personal data.
-- =============================================================================

-- SECTION 1 | New columns
SELECT
  column_name,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sommelier_feedback_events'
  AND column_name IN (
    'confirmation_expires_at',
    'resolved_at',
    'conversation_id'
  )
ORDER BY column_name;
-- EXPECTED: 3 rows; timestamptz/timestamptz/uuid; all nullable.

-- SECTION 2 | Status CHECK includes new values
SELECT
  conname,
  pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conrelid = 'public.sommelier_feedback_events'::regclass
  AND conname = 'sommelier_feedback_status_check';
-- EXPECTED: definition includes pending_confirmation, applied, rejected, expired.

-- SECTION 3 | Partial unique pending indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'sommelier_feedback_events'
  AND indexname IN (
    'uq_sommelier_feedback_pending_confirm_conv',
    'uq_sommelier_feedback_pending_confirm_user'
  )
ORDER BY indexname;
-- EXPECTED: both present; UNIQUE + status = pending_confirmation.

-- SECTION 4 | RPC signatures / overloads
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  pg_catalog.format_type(p.prorettype, NULL) AS return_type,
  COUNT(*) OVER (PARTITION BY p.proname) AS overload_count
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_taste_pending_confirmation',
    'resolve_taste_confirmation'
  )
ORDER BY p.proname;
-- EXPECTED: one overload each; identity jsonb → jsonb.

-- SECTION 5 | SECURITY INVOKER + search_path
SELECT
  p.proname,
  p.prosecdef AS is_security_definer,
  (NOT p.prosecdef) AS is_security_invoker,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_taste_pending_confirmation',
    'resolve_taste_confirmation'
  );
-- EXPECTED: is_security_definer=false; proconfig contains search_path=public.

-- SECTION 6 | Grants
SELECT
  p.proname,
  has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_taste_pending_confirmation',
    'resolve_taste_confirmation'
  );
-- EXPECTED: public/anon false; authenticated true.

-- SECTION 7 | Aggregates (no PII)
SELECT
  (SELECT COUNT(*) FROM public.sommelier_feedback_events
    WHERE status = 'pending_confirmation') AS pending_confirmation_count,
  (SELECT COUNT(*) FROM public.sommelier_feedback_events
    WHERE confirmation_expires_at IS NOT NULL) AS rows_with_expiry_set,
  (SELECT COUNT(*) FROM public.sommelier_feedback_events) AS feedback_total;
-- EXPECTED immediately after migration: pending_confirmation_count = 0.

-- SECTION 8 | RLS still enabled
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'sommelier_feedback_events',
    'profiles',
    'sommelier_agent_memory'
  )
ORDER BY c.relname;
-- EXPECTED: rls_enabled=true for all.

-- SECTION 9 | Pass/fail dashboard
SELECT
  (
    SELECT COUNT(*) = 3 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sommelier_feedback_events'
      AND column_name IN ('confirmation_expires_at','resolved_at','conversation_id')
  ) AS columns_ok,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sommelier_feedback_events'::regclass
      AND conname = 'sommelier_feedback_status_check'
      AND pg_get_constraintdef(oid) ILIKE '%pending_confirmation%'
      AND pg_get_constraintdef(oid) ILIKE '%expired%'
  ) AS status_check_ok,
  (
    SELECT COUNT(*) = 2 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'sommelier_feedback_events'
      AND indexname IN (
        'uq_sommelier_feedback_pending_confirm_conv',
        'uq_sommelier_feedback_pending_confirm_user'
      )
  ) AS pending_indexes_ok,
  (
    SELECT COUNT(*) = 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_taste_pending_confirmation'
  ) AS create_rpc_ok,
  (
    SELECT COUNT(*) = 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'resolve_taste_confirmation'
  ) AS resolve_rpc_ok,
  (
    SELECT BOOL_AND(NOT p.prosecdef)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_taste_pending_confirmation',
        'resolve_taste_confirmation'
      )
  ) AS both_invoker_ok,
  (
    SELECT COUNT(*) = 0 FROM public.sommelier_feedback_events
    WHERE status = 'pending_confirmation'
  ) AS zero_pending_after_migration_ok;
