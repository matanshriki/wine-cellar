-- =============================================================================
-- Sommi Phase 0 — PASS 2 ONLY (single-result, paste once)
-- Prerequisites from your PASS 1 (all satisfied):
--   A12/A13 true, B1 true, E0 true, F1b true, H0 all true
-- Read-only. Returns ONE row "pass2" (jsonb). SAFE TO SHARE (no emails).
-- =============================================================================

SELECT jsonb_build_object(

  'P2-A10', (
    SELECT jsonb_build_object('admin_profile_count', COUNT(*))
    FROM public.profiles
    WHERE is_admin IS TRUE
  ),

  'P2-A11-opt', (
    SELECT jsonb_build_object(
      'admin_profile_count', COUNT(*),
      'admin_roster_fingerprint', md5(string_agg(id::text, ',' ORDER BY id::text))
    )
    FROM public.profiles
    WHERE is_admin IS TRUE
  ),

  'P2-A12b', jsonb_build_object(
    'admins_table_count', (SELECT COUNT(*) FROM public.admins),
    'profiles_is_admin_count', (SELECT COUNT(*) FROM public.profiles WHERE is_admin IS TRUE)
  ),

  'P2-B8', (
    SELECT jsonb_build_object(
      'total_rows', COUNT(*),
      'active_or_no_expiry_rows', COUNT(*) FILTER (
        WHERE expires_at IS NULL OR expires_at > NOW()
      ),
      'expired_rows', COUNT(*) FILTER (
        WHERE expires_at IS NOT NULL AND expires_at <= NOW()
      )
    )
    FROM public.shared_cellars
  ),

  'P2-C6', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('version', version, 'name', name) ORDER BY version)
    FROM supabase_migrations.schema_migrations
    WHERE version LIKE '%20251226%'
       OR version LIKE '%20251231%'
       OR name ILIKE '%bottles_with_wine%'
       OR name ILIKE '%security_definer_view%'
       OR name ILIKE '%initial_schema%'
  ), '[]'::jsonb),

  'P2-D7', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('version', version, 'name', name) ORDER BY version)
    FROM supabase_migrations.schema_migrations
    WHERE name ILIKE '%wishlist%'
       OR version LIKE '%20240110%'
       OR version LIKE '%20260302%'
  ), '[]'::jsonb),

  'P2-E1', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('version', version, 'name', name) ORDER BY version)
    FROM supabase_migrations.schema_migrations
  ), '[]'::jsonb),

  'P2-E2', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'token', s.token,
      'matched_in_schema_migrations', EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations m
        WHERE m.version ILIKE '%' || s.token || '%'
           OR m.name ILIKE '%' || s.token || '%'
      )
    ) ORDER BY s.token)
    FROM (
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
        'CREATE_SHARED_CELLARS',
        '20260810_restore_and_reschedule_monthly_credits'
      ]) AS token
    ) s
  ), '[]'::jsonb),

  'P2-F2', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'jobname', jobname,
      'schedule', schedule,
      'active', active,
      'command_classification', CASE
        WHEN command ILIKE '%reset_monthly_credits%' THEN 'contains_reset_monthly_credits'
        WHEN command ILIKE '%reset_free_user_credits%' THEN 'contains_reset_free_user_credits'
        WHEN command ILIKE '%http%'
          OR command ILIKE '%Bearer%'
          OR command ILIKE '%apikey%'
          OR command ILIKE '%secret%'
          OR command ILIKE '%token%'
          THEN 'REDACTED_possible_secret_bearing'
        ELSE 'other_non_secret_classified'
      END,
      'command_length_chars', length(command),
      'command_md5', md5(command)
    ) ORDER BY jobname)
    FROM cron.job
    WHERE jobname ILIKE '%credit%'
       OR jobname ILIKE '%reset%'
       OR command ILIKE '%reset_monthly_credits%'
       OR command ILIKE '%reset_free_user_credits%'
  ), '[]'::jsonb),

  'P2-H2a', (
    SELECT jsonb_build_object('event_count', COUNT(*))
    FROM public.consumption_history
  ),

  'P2-H2b', (
    SELECT jsonb_build_object(
      'sum_opened_quantity', COALESCE(SUM(opened_quantity), 0)
    )
    FROM public.consumption_history
  ),

  'P2-H3', (
    SELECT jsonb_build_object('zero_quantity_bottle_rows', COUNT(*))
    FROM public.bottles
    WHERE quantity = 0
  ),

  'P2-H4', (
    SELECT jsonb_build_object('negative_quantity_bottle_rows', COUNT(*))
    FROM public.bottles
    WHERE quantity < 0
  )

) AS pass2;
