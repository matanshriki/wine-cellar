-- ============================================================
-- User acquisition attribution
--
-- Adds three columns to profiles that record WHERE a user came
-- from at the moment they signed up.  The data comes from the
-- localStorage attribution already captured by aiAttribution.ts
-- (utm_source / referrer detection) and is written to the DB
-- inside SupabaseAuthContext.signUp() and after Google OAuth.
--
-- Values are immutable once set — last-touch before signup only.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_source   TEXT,
  ADD COLUMN IF NOT EXISTS signup_medium   TEXT,
  ADD COLUMN IF NOT EXISTS signup_campaign TEXT;

COMMENT ON COLUMN public.profiles.signup_source IS
  'UTM source (or referrer domain / "direct") captured at signup from localStorage first-touch attribution.';
COMMENT ON COLUMN public.profiles.signup_medium IS
  'UTM medium at signup: "ai" | "organic" | "referral" | "direct" | custom utm_medium value.';
COMMENT ON COLUMN public.profiles.signup_campaign IS
  'UTM campaign at signup, empty string when not present.';

-- Index for dashboard aggregation queries (GROUP BY signup_source / signup_medium)
CREATE INDEX IF NOT EXISTS idx_profiles_signup_source
  ON public.profiles(signup_source)
  WHERE signup_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_signup_medium
  ON public.profiles(signup_medium)
  WHERE signup_medium IS NOT NULL;


-- ── Update admin_get_users to include the new columns ─────────────────────────

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
  signup_source      TEXT,
  signup_medium      TEXT,
  signup_campaign    TEXT,
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
  WITH paged AS (
    SELECT
      p.id,
      p.email,
      p.display_name,
      p.created_at,
      p.last_active_at,
      COALESCE(p.is_admin, FALSE) AS is_admin,
      p.preferred_language,
      p.signup_source,
      p.signup_medium,
      p.signup_campaign
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
    p.signup_source,
    p.signup_medium,
    p.signup_campaign,

    (SELECT COUNT(*) FROM public.bottles b   WHERE b.user_id = p.id)  AS bottle_count,
    (SELECT COUNT(*) FROM public.wines w     WHERE w.user_id = p.id)  AS wine_count,
    (SELECT COUNT(*) FROM public.ai_usage_events ae WHERE ae.user_id = p.id) AS ai_calls_total,
    (SELECT COUNT(*) FROM public.ai_usage_events ae
      WHERE ae.user_id = p.id
        AND ae.created_at >= NOW() - INTERVAL '7 days')               AS ai_calls_7d,
    (SELECT COUNT(*) FROM public.app_events ev WHERE ev.user_id = p.id) AS events_total,
    (SELECT COUNT(*) FROM public.app_events ev
      WHERE ev.user_id = p.id
        AND ev.created_at >= NOW() - INTERVAL '7 days')               AS events_7d,
    (SELECT MAX(ev.created_at) FROM public.app_events ev WHERE ev.user_id = p.id) AS last_event_at

  FROM paged p
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_users(INT, INT) TO authenticated;


-- ── Update admin_overview_metrics to include acquisition breakdown ─────────────

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

    -- Bottles & wines
    'total_bottles',
      (SELECT COALESCE(SUM(quantity), 0) FROM public.bottles),
    'bottles_added_7d',
      (SELECT COUNT(*) FROM public.bottles
       WHERE created_at >= NOW() - INTERVAL '7 days'),
    'total_wines',
      (SELECT COUNT(*) FROM public.wines),

    -- Engagement proxy
    'users_with_bottles',
      (SELECT COUNT(DISTINCT user_id) FROM public.bottles),
    'users_with_zero_bottles',
      (SELECT COUNT(*) FROM public.profiles p
       WHERE NOT EXISTS (
         SELECT 1 FROM public.bottles b WHERE b.user_id = p.id
       )),

    -- Wine data quality
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

    -- AI usage
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

    -- Event tracking
    'events_7d',
      (SELECT COUNT(*) FROM public.app_events
       WHERE created_at >= NOW() - INTERVAL '7 days'),
    'event_active_users_7d',
      (SELECT COUNT(DISTINCT user_id) FROM public.app_events
       WHERE created_at >= NOW() - INTERVAL '7 days'
         AND user_id IS NOT NULL),

    -- ── Acquisition breakdown ─────────────────────────────────────────────
    -- Top signup sources (all time), up to 8 rows, sorted by count desc.
    -- NULL source = attribution not yet captured (pre-feature signups).
    'acquisition_by_source',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
       FROM (
         SELECT
           COALESCE(signup_source, 'unknown') AS source,
           COALESCE(signup_medium, 'unknown') AS medium,
           COUNT(*)                           AS users
         FROM public.profiles
         GROUP BY signup_source, signup_medium
         ORDER BY users DESC
         LIMIT 8
       ) t),

    -- Signups by medium (direct / organic / referral / ai / unknown)
    'acquisition_by_medium',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
       FROM (
         SELECT
           COALESCE(signup_medium, 'unknown') AS medium,
           COUNT(*)                           AS users
         FROM public.profiles
         GROUP BY signup_medium
         ORDER BY users DESC
       ) t),

    -- New users in last 7 days, broken down by source
    'new_users_by_source_7d',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
       FROM (
         SELECT
           COALESCE(signup_source, 'unknown') AS source,
           COUNT(*)                           AS users
         FROM public.profiles
         WHERE created_at >= NOW() - INTERVAL '7 days'
         GROUP BY signup_source
         ORDER BY users DESC
         LIMIT 8
       ) t)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_overview_metrics() TO authenticated;
