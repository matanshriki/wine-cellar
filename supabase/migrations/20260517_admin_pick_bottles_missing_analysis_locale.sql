-- RPC: pick bottle IDs that have analysis in some form but are missing a non-empty
-- analysis_data slice for the requested locale. Used only by Edge (service_role).
--
-- Verification SQL (run in SQL editor after deploy):
--
-- Count bottles missing Hebrew slice (have legacy summary OR any valid en/he slice, but no he summary):
-- SELECT count(*) FROM public.bottles b
-- WHERE b.quantity > 0 AND NOT (b.id::text LIKE 'demo-%') AND b.readiness_label IS NOT NULL
--   AND (
--     (b.analysis_summary IS NOT NULL AND trim(b.analysis_summary) <> '')
--     OR (b.analysis_data IS NOT NULL AND (
--       (b.analysis_data ? 'en' AND length(trim(b.analysis_data->'en'->>'summary')) > 0)
--       OR (b.analysis_data ? 'he' AND length(trim(b.analysis_data->'he'->>'summary')) > 0)
--     ))
--   )
--   AND (
--     b.analysis_data IS NULL OR NOT (b.analysis_data ? 'he')
--     OR length(trim(coalesce(b.analysis_data->'he'->>'summary', ''))) = 0
--   );
--
-- Count missing English slice (swap 'he' for 'en' in the last block).
--
-- Fully localized (both en and he summaries non-empty):
-- SELECT count(*) FROM public.bottles b
-- WHERE b.quantity > 0 AND NOT (b.id::text LIKE 'demo-%')
--   AND b.analysis_data IS NOT NULL
--   AND b.analysis_data ? 'en' AND length(trim(b.analysis_data->'en'->>'summary')) > 0
--   AND b.analysis_data ? 'he' AND length(trim(b.analysis_data->'he'->>'summary')) > 0;

CREATE OR REPLACE FUNCTION public.admin_pick_bottles_missing_analysis_locale(
  p_target text,
  p_limit integer,
  p_after uuid DEFAULT NULL
)
RETURNS TABLE (bottle_id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT b.id AS bottle_id
  FROM public.bottles b
  WHERE p_target IN ('en', 'he')
    AND b.quantity > 0
    AND NOT (b.id::text LIKE 'demo-%')
    AND b.readiness_label IS NOT NULL
    AND (
      (b.analysis_summary IS NOT NULL AND trim(b.analysis_summary) <> '')
      OR (
        b.analysis_data IS NOT NULL
        AND (
          (b.analysis_data ? 'en' AND length(trim(b.analysis_data->'en'->>'summary')) > 0)
          OR (b.analysis_data ? 'he' AND length(trim(b.analysis_data->'he'->>'summary')) > 0)
        )
      )
    )
    AND (
      (p_target = 'he' AND (
        b.analysis_data IS NULL
        OR NOT (b.analysis_data ? 'he')
        OR length(trim(coalesce(b.analysis_data->'he'->>'summary', ''))) = 0
      ))
      OR
      (p_target = 'en' AND (
        b.analysis_data IS NULL
        OR NOT (b.analysis_data ? 'en')
        OR length(trim(coalesce(b.analysis_data->'en'->>'summary', ''))) = 0
      ))
    )
    AND (p_after IS NULL OR b.id > p_after)
  ORDER BY b.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100);
$$;

COMMENT ON FUNCTION public.admin_pick_bottles_missing_analysis_locale(text, integer, uuid) IS
  'Admin Edge only: bottle IDs missing analysis_data[p_target] summary. Callable with service_role.';

REVOKE ALL ON FUNCTION public.admin_pick_bottles_missing_analysis_locale(text, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_pick_bottles_missing_analysis_locale(text, integer, uuid) TO service_role;
