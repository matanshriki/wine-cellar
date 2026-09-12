-- Read-only diagnostic for apply_taste_profile_memory_action search_path.
-- Catalog only. Do not call the RPC. Do not select user/profile payloads.
--
-- Expected production-compatible proconfig entry:
--   search_path=public
-- (optional safe variants: public,pg_temp or pg_temp,public)

WITH overloads AS (
  SELECT
    p.oid,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    p.prosecdef,
    p.proconfig,
    pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'apply_taste_profile_memory_action'
),
target AS (
  SELECT *
  FROM overloads
  WHERE identity_args = 'p_payload jsonb'
  LIMIT 1
)
SELECT
  (SELECT identity_args FROM target) AS identity_args,
  (SELECT prosecdef FROM target) AS prosecdef,
  (SELECT proconfig FROM target) AS proconfig,
  (
    SELECT regexp_replace(
             lower(replace(replace(trim(split_part(cfg, '=', 2)), '"', ''), '''', '')),
             '\s*,\s*',
             ',',
             'g'
           )
    FROM target t
    CROSS JOIN LATERAL unnest(COALESCE(t.proconfig, ARRAY[]::text[])) AS cfg
    WHERE lower(split_part(cfg, '=', 1)) = 'search_path'
    LIMIT 1
  ) AS normalized_search_path,
  (SELECT COUNT(*)::int FROM overloads) AS overload_count;
