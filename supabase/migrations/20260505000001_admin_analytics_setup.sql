-- ============================================================
-- Admin Intelligence: analytics setup
--
-- 1. Add last_active_at column to profiles
-- 2. Add admin SELECT policies to core tables
-- 3. Add admin SELECT policy to ai_usage_events (already has data)
-- 4. Create admin RPC functions (all SECURITY DEFINER, admin-only)
--    - admin_overview_metrics()
--    - admin_get_users(limit, offset)
--    - admin_get_wine_data_quality(limit, offset)
--    - admin_get_events(limit, offset, event_name_filter)
--    - admin_get_ai_calls(limit, offset)
--    - admin_get_ai_summary()
--    - admin_get_insights()
-- ============================================================


-- ── 1. Profile: last_active_at ────────────────────────────────────────────────
-- Nullable. Updated externally (e.g. on login) via UPDATE profiles SET last_active_at = now().
-- Starts as NULL for all existing users until tracking is enabled.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.last_active_at IS
  'Set to NOW() on every successful login. NULL for users who signed up before
   this tracking was added. Used for "active users" metrics in the admin dashboard.';


-- ── 2. Admin SELECT policies on core tables ───────────────────────────────────
-- These allow admins to query all users' data for the dashboard.
-- Regular users are unaffected — their existing own-row policies still apply.

-- profiles: admins can read all rows
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- wines: admins can read all wines
DROP POLICY IF EXISTS "Admins can read all wines" ON public.wines;
CREATE POLICY "Admins can read all wines"
  ON public.wines FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- bottles: admins can read all bottles
DROP POLICY IF EXISTS "Admins can read all bottles" ON public.bottles;
CREATE POLICY "Admins can read all bottles"
  ON public.bottles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ai_usage_events: admins can read all AI usage (existing table, already has data)
DROP POLICY IF EXISTS "Admins can read all ai usage events" ON public.ai_usage_events;
CREATE POLICY "Admins can read all ai usage events"
  ON public.ai_usage_events FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));


-- ── 3. admin_overview_metrics() ──────────────────────────────────────────────
-- Returns a single JSONB object with all KPI counts for the Overview tab.
-- Metrics that depend on app_events (events_7d, active_users_7d_events)
-- will return 0 until trackEvent() instrumentation populates the table.

DROP FUNCTION IF EXISTS public.admin_overview_metrics();
CREATE OR REPLACE FUNCTION public.admin_overview_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN jsonb_build_object(
    -- Users
    'total_users',
      (SELECT COUNT(*) FROM public.profiles),
    'new_users_7d',
      (SELECT COUNT(*) FROM public.profiles
       WHERE created_at >= NOW() - INTERVAL '7 days'),

    -- Bottles & wines (real data from existing tables)
    'total_bottles',
      (SELECT COALESCE(SUM(quantity), 0) FROM public.bottles),
    'bottles_added_7d',
      (SELECT COUNT(*) FROM public.bottles
       WHERE created_at >= NOW() - INTERVAL '7 days'),
    'total_wines',
      (SELECT COUNT(*) FROM public.wines),

    -- Engagement proxy: users who have at least one bottle
    'users_with_bottles',
      (SELECT COUNT(DISTINCT user_id) FROM public.bottles),
    'users_with_zero_bottles',
      (SELECT COUNT(*) FROM public.profiles p
       WHERE NOT EXISTS (
         SELECT 1 FROM public.bottles b WHERE b.user_id = p.id
       )),

    -- Wine data quality (real data from wines table)
    'wines_missing_food_pairing',
      (SELECT COUNT(*) FROM public.wines WHERE food_pairing IS NULL),
    'wines_missing_image',
      (SELECT COUNT(*) FROM public.wines WHERE image_url IS NULL),
    'wines_missing_region',
      (SELECT COUNT(*) FROM public.wines WHERE region IS NULL AND country IS NULL),
    'wines_missing_grapes',
      (SELECT COUNT(*) FROM public.wines
       WHERE grapes IS NULL OR grapes = 'null'::jsonb OR grapes = '[]'::jsonb),
    'wines_low_confidence',
      (SELECT COUNT(*) FROM public.wines
       WHERE wine_profile_confidence = 'low' OR food_pairing_confidence = 'low'),
    'bottles_not_analyzed',
      (SELECT COUNT(*) FROM public.bottles WHERE analyzed_at IS NULL),
    'bottles_no_drink_window',
      (SELECT COUNT(*) FROM public.bottles
       WHERE drink_window_start IS NULL AND drink_window_end IS NULL),

    -- AI usage (real data from ai_usage_events — already has rows from analyze-wine etc.)
    'ai_calls_7d',
      (SELECT COUNT(*) FROM public.ai_usage_events
       WHERE created_at >= NOW() - INTERVAL '7 days'),
    'ai_failed_7d',
      (SELECT COUNT(*) FROM public.ai_usage_events
       WHERE created_at >= NOW() - INTERVAL '7 days'
         AND request_status <> 'success'),
    'ai_cost_7d_usd',
      (SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM public.ai_usage_events
       WHERE created_at >= NOW() - INTERVAL '7 days'),
    'ai_active_users_7d',
      (SELECT COUNT(DISTINCT user_id) FROM public.ai_usage_events
       WHERE created_at >= NOW() - INTERVAL '7 days'),

    -- Event tracking (starts at 0 until app_events receives data)
    'events_7d',
      (SELECT COUNT(*) FROM public.app_events
       WHERE created_at >= NOW() - INTERVAL '7 days'),
    'event_active_users_7d',
      (SELECT COUNT(DISTINCT user_id) FROM public.app_events
       WHERE created_at >= NOW() - INTERVAL '7 days'
         AND user_id IS NOT NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_overview_metrics() TO authenticated;


-- ── 4. admin_get_users() ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_get_users(INT, INT);
CREATE OR REPLACE FUNCTION public.admin_get_users(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  user_id          UUID,
  email            TEXT,
  display_name     TEXT,
  created_at       TIMESTAMPTZ,
  last_active_at   TIMESTAMPTZ,
  is_admin         BOOLEAN,
  preferred_language TEXT,
  bottle_count     BIGINT,
  wine_count       BIGINT,
  ai_calls_total   BIGINT,
  ai_calls_7d      BIGINT,
  events_total     BIGINT,
  events_7d        BIGINT,
  last_event_at    TIMESTAMPTZ
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
  SELECT
    p.id                                           AS user_id,
    p.email,
    p.display_name,
    p.created_at,
    p.last_active_at,
    COALESCE(p.is_admin, FALSE)                    AS is_admin,
    p.preferred_language,
    COUNT(DISTINCT b.id)                           AS bottle_count,
    COUNT(DISTINCT w.id)                           AS wine_count,
    COUNT(DISTINCT ae.id)                          AS ai_calls_total,
    COUNT(DISTINCT ae.id) FILTER (
      WHERE ae.created_at >= NOW() - INTERVAL '7 days'
    )                                              AS ai_calls_7d,
    COUNT(DISTINCT ev.id)                          AS events_total,
    COUNT(DISTINCT ev.id) FILTER (
      WHERE ev.created_at >= NOW() - INTERVAL '7 days'
    )                                              AS events_7d,
    MAX(ev.created_at)                             AS last_event_at
  FROM public.profiles p
  LEFT JOIN public.bottles b       ON b.user_id = p.id
  LEFT JOIN public.wines   w       ON w.user_id = p.id
  LEFT JOIN public.ai_usage_events ae ON ae.user_id = p.id
  LEFT JOIN public.app_events      ev ON ev.user_id = p.id
  GROUP BY p.id, p.email, p.display_name, p.created_at,
           p.last_active_at, p.is_admin, p.preferred_language
  ORDER BY p.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_users(INT, INT) TO authenticated;


-- ── 5. admin_get_wine_data_quality() ─────────────────────────────────────────
-- Returns wines ordered by number of data gaps (most gaps first).

DROP FUNCTION IF EXISTS public.admin_get_wine_data_quality(INT, INT);
CREATE OR REPLACE FUNCTION public.admin_get_wine_data_quality(
  p_limit  INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  wine_id                 UUID,
  user_id                 UUID,
  user_email              TEXT,
  producer                TEXT,
  wine_name               TEXT,
  vintage                 INTEGER,
  country                 TEXT,
  region                  TEXT,
  color                   TEXT,
  has_image               BOOLEAN,
  has_food_pairing        BOOLEAN,
  has_wine_profile        BOOLEAN,
  has_grapes              BOOLEAN,
  has_drink_window        BOOLEAN,
  food_pairing_confidence TEXT,
  wine_profile_confidence TEXT,
  gap_count               INT,
  created_at              TIMESTAMPTZ
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
  SELECT
    w.id                                               AS wine_id,
    w.user_id,
    p.email                                            AS user_email,
    w.producer,
    w.wine_name,
    w.vintage,
    w.country,
    w.region,
    w.color,
    (w.image_url IS NOT NULL)                          AS has_image,
    (w.food_pairing IS NOT NULL)                       AS has_food_pairing,
    (w.wine_profile IS NOT NULL)                       AS has_wine_profile,
    (
      w.grapes IS NOT NULL
      AND w.grapes <> 'null'::jsonb
      AND w.grapes <> '[]'::jsonb
    )                                                  AS has_grapes,
    EXISTS (
      SELECT 1 FROM public.bottles b
      WHERE b.wine_id = w.id
        AND b.drink_window_start IS NOT NULL
    )                                                  AS has_drink_window,
    w.food_pairing_confidence,
    w.wine_profile_confidence,
    (
      CASE WHEN w.image_url IS NULL          THEN 1 ELSE 0 END +
      CASE WHEN w.food_pairing IS NULL        THEN 1 ELSE 0 END +
      CASE WHEN w.wine_profile IS NULL        THEN 1 ELSE 0 END +
      CASE WHEN w.grapes IS NULL
            OR w.grapes = 'null'::jsonb
            OR w.grapes = '[]'::jsonb         THEN 1 ELSE 0 END +
      CASE WHEN w.country IS NULL
            AND w.region IS NULL              THEN 1 ELSE 0 END
    )                                                  AS gap_count,
    w.created_at
  FROM public.wines w
  LEFT JOIN public.profiles p ON p.id = w.user_id
  ORDER BY gap_count DESC, w.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_wine_data_quality(INT, INT) TO authenticated;


-- ── 6. admin_get_events() ─────────────────────────────────────────────────────
-- Returns app_events rows. Will return 0 rows until trackEvent() is instrumented.

DROP FUNCTION IF EXISTS public.admin_get_events(INT, INT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_get_events(
  p_limit       INT  DEFAULT 100,
  p_offset      INT  DEFAULT 0,
  p_event_name  TEXT DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  user_id     UUID,
  user_email  TEXT,
  event_name  TEXT,
  event_type  TEXT,
  source      TEXT,
  page        TEXT,
  session_id  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ
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
  SELECT
    e.id,
    e.user_id,
    p.email          AS user_email,
    e.event_name,
    e.event_type,
    e.source,
    e.page,
    e.session_id,
    e.metadata,
    e.created_at
  FROM public.app_events e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE (p_event_name IS NULL OR e.event_name = p_event_name)
  ORDER BY e.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_events(INT, INT, TEXT) TO authenticated;


-- ── 7. admin_get_ai_calls() ───────────────────────────────────────────────────
-- Recent individual AI calls from ai_usage_events (has real data from analyze-wine etc.)

DROP FUNCTION IF EXISTS public.admin_get_ai_calls(INT, INT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_get_ai_calls(
  p_limit   INT  DEFAULT 100,
  p_offset  INT  DEFAULT 0,
  p_status  TEXT DEFAULT NULL   -- NULL = all, 'failed', 'error', 'success'
)
RETURNS TABLE (
  id                  UUID,
  user_id             UUID,
  user_email          TEXT,
  action_type         TEXT,
  model_name          TEXT,
  request_status      TEXT,
  input_tokens        INTEGER,
  output_tokens       INTEGER,
  estimated_cost_usd  NUMERIC,
  metadata            JSONB,
  created_at          TIMESTAMPTZ
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
  SELECT
    ae.id,
    ae.user_id,
    p.email             AS user_email,
    ae.action_type,
    ae.model_name,
    ae.request_status,
    ae.input_tokens,
    ae.output_tokens,
    ae.estimated_cost_usd,
    ae.metadata,
    ae.created_at
  FROM public.ai_usage_events ae
  LEFT JOIN public.profiles p ON p.id = ae.user_id
  WHERE (p_status IS NULL OR ae.request_status = p_status)
  ORDER BY ae.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_ai_calls(INT, INT, TEXT) TO authenticated;


-- ── 8. admin_get_ai_summary() ────────────────────────────────────────────────
-- Aggregated AI usage by action_type (feature). Real data from ai_usage_events.

DROP FUNCTION IF EXISTS public.admin_get_ai_summary();
CREATE OR REPLACE FUNCTION public.admin_get_ai_summary()
RETURNS TABLE (
  action_type        TEXT,
  model_name         TEXT,
  total_calls        BIGINT,
  success_count      BIGINT,
  failure_count      BIGINT,
  total_input_tokens BIGINT,
  total_output_tokens BIGINT,
  total_cost_usd     NUMERIC,
  calls_7d           BIGINT,
  cost_7d_usd        NUMERIC,
  failure_rate       NUMERIC
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
  SELECT
    ae.action_type,
    ae.model_name,
    COUNT(*)                                            AS total_calls,
    COUNT(*) FILTER (WHERE ae.request_status = 'success') AS success_count,
    COUNT(*) FILTER (WHERE ae.request_status <> 'success') AS failure_count,
    COALESCE(SUM(ae.input_tokens), 0)::BIGINT           AS total_input_tokens,
    COALESCE(SUM(ae.output_tokens), 0)::BIGINT          AS total_output_tokens,
    COALESCE(SUM(ae.estimated_cost_usd), 0)             AS total_cost_usd,
    COUNT(*) FILTER (
      WHERE ae.created_at >= NOW() - INTERVAL '7 days'
    )                                                   AS calls_7d,
    COALESCE(SUM(ae.estimated_cost_usd) FILTER (
      WHERE ae.created_at >= NOW() - INTERVAL '7 days'
    ), 0)                                               AS cost_7d_usd,
    CASE WHEN COUNT(*) > 0
      THEN ROUND(
        COUNT(*) FILTER (WHERE ae.request_status <> 'success')::NUMERIC
        / COUNT(*)::NUMERIC * 100, 1
      )
      ELSE 0
    END                                                 AS failure_rate
  FROM public.ai_usage_events ae
  GROUP BY ae.action_type, ae.model_name
  ORDER BY total_calls DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_ai_summary() TO authenticated;


-- ── 9. admin_get_insights() ──────────────────────────────────────────────────
-- Surfaces high-signal product improvement signals.
-- Metrics from app_events will return 0/empty until tracking is active.

DROP FUNCTION IF EXISTS public.admin_get_insights();
CREATE OR REPLACE FUNCTION public.admin_get_insights()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_ai_7d        BIGINT;
  v_failed_ai_7d       BIGINT;
  v_top_failing_action TEXT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT COUNT(*) INTO v_total_ai_7d
  FROM public.ai_usage_events
  WHERE created_at >= NOW() - INTERVAL '7 days';

  SELECT COUNT(*) INTO v_failed_ai_7d
  FROM public.ai_usage_events
  WHERE created_at >= NOW() - INTERVAL '7 days'
    AND request_status <> 'success';

  SELECT action_type INTO v_top_failing_action
  FROM public.ai_usage_events
  WHERE created_at >= NOW() - INTERVAL '7 days'
    AND request_status <> 'success'
  GROUP BY action_type
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    -- Derived from real existing data:
    'users_no_bottles',
      (SELECT COUNT(*) FROM public.profiles p
       WHERE NOT EXISTS (SELECT 1 FROM public.bottles b WHERE b.user_id = p.id)),

    'wines_missing_food_pairing',
      (SELECT COUNT(*) FROM public.wines WHERE food_pairing IS NULL),

    'wines_missing_image',
      (SELECT COUNT(*) FROM public.wines WHERE image_url IS NULL),

    'wines_missing_region_or_country',
      (SELECT COUNT(*) FROM public.wines WHERE region IS NULL AND country IS NULL),

    'bottles_not_analyzed',
      (SELECT COUNT(*) FROM public.bottles WHERE analyzed_at IS NULL),

    'bottles_no_drink_window',
      (SELECT COUNT(*) FROM public.bottles
       WHERE drink_window_start IS NULL AND drink_window_end IS NULL),

    'low_confidence_wines',
      (SELECT COUNT(*) FROM public.wines
       WHERE wine_profile_confidence = 'low' OR food_pairing_confidence = 'low'),

    -- AI health (real data from ai_usage_events):
    'ai_failure_rate_7d_pct',
      CASE WHEN v_total_ai_7d > 0
        THEN ROUND(v_failed_ai_7d::NUMERIC / v_total_ai_7d * 100, 1)
        ELSE 0
      END,

    'top_failing_ai_action', COALESCE(v_top_failing_action, null),

    -- Event-based signals (0 / empty until trackEvent() is instrumented):
    'scan_starts_7d',
      (SELECT COUNT(*) FROM public.app_events
       WHERE event_name = 'bottle_scan_started'
         AND created_at >= NOW() - INTERVAL '7 days'),

    'scan_failures_7d',
      (SELECT COUNT(*) FROM public.app_events
       WHERE event_name = 'bottle_scan_failed'
         AND created_at >= NOW() - INTERVAL '7 days'),

    'analysis_failures_7d',
      (SELECT COUNT(*) FROM public.app_events
       WHERE event_name = 'wine_analysis_failed'
         AND created_at >= NOW() - INTERVAL '7 days'),

    'top_events_7d',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
       FROM (
         SELECT event_name, COUNT(*) AS count
         FROM public.app_events
         WHERE created_at >= NOW() - INTERVAL '7 days'
         GROUP BY event_name
         ORDER BY count DESC
         LIMIT 10
       ) t)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_insights() TO authenticated;
