-- ============================================================
-- Expand daily bottle digest to cover ALL additions, not just AI scans.
--
-- Previously the RPC filtered to bottles where:
--   wines.entry_source = 'ai_scan' OR any image path column is set
--
-- Now it counts every bottle created in the window and adds a
-- breakdown by entry_source (ai_scan, manual, vivino, csv_import).
-- The existing JSON field names (scan_count, top_users.scans, etc.)
-- are kept for backward compatibility; a new "by_source" array is added.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_bottle_scan_summary_stats(p_since timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH filtered AS (
  SELECT
    b.id,
    b.user_id,
    b.created_at,
    COALESCE(w.entry_source, 'manual') AS source
  FROM public.bottles b
  LEFT JOIN public.wines w ON w.id = b.wine_id
  WHERE b.created_at >= p_since
),
agg AS (
  SELECT
    COUNT(*)::bigint          AS bottles_added,
    COUNT(DISTINCT user_id)::bigint AS distinct_users,
    MIN(created_at)           AS first_at,
    MAX(created_at)           AS last_at
  FROM filtered
),
by_source AS (
  SELECT source, COUNT(*)::bigint AS cnt
  FROM filtered
  GROUP BY source
  ORDER BY cnt DESC
),
topu AS (
  SELECT user_id, COUNT(*)::bigint AS c
  FROM filtered
  GROUP BY user_id
  ORDER BY c DESC
  LIMIT 5
)
SELECT jsonb_build_object(
  'scan_count',     COALESCE((SELECT bottles_added   FROM agg), 0),
  'distinct_users', COALESCE((SELECT distinct_users  FROM agg), 0),
  'first_scan_at',  (SELECT first_at FROM agg),
  'last_scan_at',   (SELECT last_at  FROM agg),
  'by_source', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object('source', s.source, 'count', s.cnt)
        ORDER BY s.cnt DESC
      )
      FROM by_source AS s
    ),
    '[]'::jsonb
  ),
  'top_users', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object('user_id', t.user_id, 'scans', t.c)
        ORDER BY t.c DESC
      )
      FROM topu AS t
    ),
    '[]'::jsonb
  )
);
$$;

COMMENT ON FUNCTION public.admin_bottle_scan_summary_stats(timestamptz) IS
  'Returns JSON aggregate for the admin daily bottle-additions digest.
   Counts ALL bottles created in the window (manual, ai_scan, vivino, csv_import).
   Includes a by_source breakdown and top-5 users. Executable by service_role only.';

-- Permissions unchanged — service_role only, PUBLIC revoked.
REVOKE ALL ON FUNCTION public.admin_bottle_scan_summary_stats(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bottle_scan_summary_stats(timestamptz) TO service_role;
