-- ============================================================
-- Fix admin_get_users() statement timeout
--
-- Root cause: the previous implementation did 4 LEFT JOINs against
-- bottles, wines, ai_usage_events, and app_events simultaneously,
-- producing an enormous Cartesian product before GROUP BY collapsed
-- it.  With even a modest number of rows per user the intermediate
-- result set grows exponentially → statement timeout.
--
-- Fix: paginate profiles FIRST (CTE returns at most p_limit rows),
-- then compute each aggregate with a targeted correlated subquery
-- that can use an index seek on user_id.  No join, no Cartesian
-- product, O(p_limit × 6) index lookups.
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_get_users(INT, INT);
CREATE OR REPLACE FUNCTION public.admin_get_users(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  user_id            UUID,
  email              TEXT,
  display_name       TEXT,
  created_at         TIMESTAMPTZ,
  last_active_at     TIMESTAMPTZ,
  is_admin           BOOLEAN,
  preferred_language TEXT,
  bottle_count       BIGINT,
  wine_count         BIGINT,
  ai_calls_total     BIGINT,
  ai_calls_7d        BIGINT,
  events_total       BIGINT,
  events_7d          BIGINT,
  last_event_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN QUERY
  -- Step 1: grab only the page of profiles we actually need.
  -- All subsequent aggregates run against this tiny result set.
  WITH paged AS (
    SELECT
      p.id,
      p.email,
      p.display_name,
      p.created_at,
      p.last_active_at,
      COALESCE(p.is_admin, FALSE) AS is_admin,
      p.preferred_language
    FROM public.profiles p
    ORDER BY p.created_at DESC
    LIMIT  p_limit
    OFFSET p_offset
  )
  SELECT
    p.id                AS user_id,
    p.email,
    p.display_name,
    p.created_at,
    p.last_active_at,
    p.is_admin,
    p.preferred_language,

    -- Correlated subqueries: one index seek per user per metric.
    (SELECT COUNT(*) FROM public.bottles b
      WHERE b.user_id = p.id)                                        AS bottle_count,

    (SELECT COUNT(*) FROM public.wines w
      WHERE w.user_id = p.id)                                        AS wine_count,

    (SELECT COUNT(*) FROM public.ai_usage_events ae
      WHERE ae.user_id = p.id)                                       AS ai_calls_total,

    (SELECT COUNT(*) FROM public.ai_usage_events ae
      WHERE ae.user_id = p.id
        AND ae.created_at >= NOW() - INTERVAL '7 days')              AS ai_calls_7d,

    (SELECT COUNT(*) FROM public.app_events ev
      WHERE ev.user_id = p.id)                                       AS events_total,

    (SELECT COUNT(*) FROM public.app_events ev
      WHERE ev.user_id = p.id
        AND ev.created_at >= NOW() - INTERVAL '7 days')              AS events_7d,

    (SELECT MAX(ev.created_at) FROM public.app_events ev
      WHERE ev.user_id = p.id)                                       AS last_event_at

  FROM paged p
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_users(INT, INT) TO authenticated;
