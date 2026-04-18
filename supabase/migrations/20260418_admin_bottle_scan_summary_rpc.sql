-- Stats for admin daily bottle-scan digest (SECURITY DEFINER, service_role only).
-- Counts bottles created in the window that look label-scan-driven (image paths or wines.entry_source).

CREATE OR REPLACE FUNCTION public.admin_bottle_scan_summary_stats(p_since timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH filtered AS (
  SELECT b.id, b.user_id, b.created_at
  FROM public.bottles b
  INNER JOIN public.wines w ON w.id = b.wine_id
  WHERE b.created_at >= p_since
    AND (
      w.entry_source = 'ai_scan'
      OR COALESCE(b.label_image_path, b.image_path, w.label_image_path, w.image_path) IS NOT NULL
    )
),
agg AS (
  SELECT
    COUNT(*)::bigint AS scan_count,
    COUNT(DISTINCT user_id)::bigint AS distinct_users,
    MIN(created_at) AS first_scan_at,
    MAX(created_at) AS last_scan_at
  FROM filtered
),
topu AS (
  SELECT user_id, COUNT(*)::bigint AS c
  FROM filtered
  GROUP BY user_id
  ORDER BY c DESC
  LIMIT 5
)
SELECT jsonb_build_object(
  'scan_count', COALESCE((SELECT scan_count FROM agg), 0),
  'distinct_users', COALESCE((SELECT distinct_users FROM agg), 0),
  'first_scan_at', (SELECT first_scan_at FROM agg),
  'last_scan_at', (SELECT last_scan_at FROM agg),
  'top_users', COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object('user_id', t.user_id, 'scans', t.c) ORDER BY t.c DESC)
      FROM topu AS t
    ),
    '[]'::jsonb
  )
);
$$;

COMMENT ON FUNCTION public.admin_bottle_scan_summary_stats(timestamptz) IS
  'Returns JSON aggregate for admin bottle-scan digest; executable by service_role only.';

REVOKE ALL ON FUNCTION public.admin_bottle_scan_summary_stats(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bottle_scan_summary_stats(timestamptz) TO service_role;
