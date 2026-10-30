-- ============================================================
-- Admin Engagement & Health Dashboard
--
-- Feature-scoped objects (safe names):
--   Functions: admin_engagement_*, touch_profile_last_active,
--              _admin_engagement_user_metrics
--   Indexes:   idx_eng_*
-- Dashboard uses SECURITY DEFINER RPCs only — no new broad admin
-- SELECT policies on raw product tables.
--
-- Sync rules with: apps/web/src/lib/admin/engagementRules.ts
-- Reporting timezone: UTC. Windows half-open at fixed as-of T.
-- ============================================================

BEGIN;

-- ── Exclusion helper ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_engagement_is_excluded(
  p_email TEXT,
  p_is_admin BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE(p_is_admin, FALSE)
    OR COALESCE(p_email, '') ILIKE '%@example.com'
    OR COALESCE(p_email, '') ILIKE '%@sommi.test'
    OR COALESCE(p_email, '') ILIKE 'test%@%'
    OR COALESCE(p_email, '') ILIKE '%+test%@%'
    OR COALESCE(p_email, '') ILIKE '%+admin%@sommi%'
    OR COALESCE(p_email, '') ILIKE 'demo+%@%';
$$;

COMMENT ON FUNCTION public.admin_engagement_is_excluded(TEXT, BOOLEAN) IS
  'Exclusion rule for internal/test accounts in engagement metrics. Admins excluded by default.';

REVOKE ALL ON FUNCTION public.admin_engagement_is_excluded(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_engagement_is_excluded(TEXT, BOOLEAN) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_engagement_config()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'reporting_timezone', 'UTC',
    'onboarding_days', 14,
    'window_days', 28,
    'comparable_history_days', 56,
    'dormant_days', 60,
    'power_min_active_days', 8,
    'regular_min_active_days', 3,
    'at_risk_prev_min_active_days', 3,
    'at_risk_current_max_active_days', 1,
    'at_risk_min_days_since_last', 14,
    'declining_drop_ratio', 0.5,
    'declining_min_absolute_drop', 2,
    'min_lifetime_active_days_for_risk', 3,
    'window_boundaries',
      'Fixed as-of T (UTC). current=[T-28d,T); previous=[T-56d,T-28d). Non-overlapping half-open.',
    'as_of_override',
      'Optional GUC app.engagement_as_of (timestamptz) for deterministic tests; default NOW(). Future rows (ts >= T) are excluded.',
    'observation_coverage',
      'observed_retained_comparable means account age>=56 so both windows exist AND retained durable rows yield a non-empty comparison. It is NOT complete instrumentation or retention proof. Missing/deleted/unlogged activity must not be treated as confirmed inactivity.',
    'chat_cadence',
      'Sommelier cadence uses per-message timestamps with non-empty user+assistant content on the same UTC day. last_message_at is never used as daily history. Messages without parseable timestamps do not create cadence days.',
    'recommendation_sources',
      'Delivered recommendation_runs (recommendation_count>0) plus agent sommelier_recommendation_events with non-empty chosen_bottle_ids. Current app writers persist agent events; recommendation_runs has no active apps/ writers found (legacy/historical rows only if present). Counts may over-count if both logged the same turn (no shared id).',
    'activation_metric',
      'lifetime_observed_among_age_ge_14d',
    'ai_failure_statuses',
      'failed and error only; blocked*/success/other are not counted as AI failures.',
    'scan_failure_instrumentation',
      'unknown',
    'heuristics_note',
      'Initial thresholds are heuristics for wine-app cadence, not validated churn predictions.'
  );
$$;

REVOKE ALL ON FUNCTION public.admin_engagement_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_engagement_config() TO authenticated;


-- ── Login heartbeat (caller only; last_active_at only) ────────────────────────

CREATE OR REPLACE FUNCTION public.touch_profile_last_active()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET last_active_at = NOW()
  WHERE id = auth.uid()
    AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '1 hour');
END;
$$;

COMMENT ON FUNCTION public.touch_profile_last_active() IS
  'Sets profiles.last_active_at = now() for auth.uid() only. Throttled 1/hour. Not meaningful engagement.';

REVOKE ALL ON FUNCTION public.touch_profile_last_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_profile_last_active() FROM anon;
GRANT EXECUTE ON FUNCTION public.touch_profile_last_active() TO authenticated;


-- ── Feature-scoped indexes (idx_eng_*); skip if name already taken ────────────

DO $$
BEGIN
  IF to_regclass('public.idx_eng_bottles_user_created') IS NULL THEN
    EXECUTE 'CREATE INDEX idx_eng_bottles_user_created ON public.bottles (user_id, created_at DESC)';
  END IF;
  IF to_regclass('public.idx_eng_wines_user_entry_created') IS NULL THEN
    EXECUTE $i$CREATE INDEX idx_eng_wines_user_entry_created ON public.wines (user_id, created_at DESC) WHERE entry_source = 'ai_scan'$i$;
  END IF;
  IF to_regclass('public.idx_eng_ai_usage_user_status_created') IS NULL THEN
    EXECUTE $i$CREATE INDEX idx_eng_ai_usage_user_status_created ON public.ai_usage_events (user_id, created_at DESC) WHERE request_status IN ('failed', 'error')$i$;
  END IF;
  IF to_regclass('public.idx_eng_app_events_user_name_created') IS NULL THEN
    EXECUTE 'CREATE INDEX idx_eng_app_events_user_name_created ON public.app_events (user_id, event_name, created_at DESC)';
  END IF;
  IF to_regclass('public.idx_eng_recommendation_runs_user_created') IS NULL THEN
    EXECUTE 'CREATE INDEX idx_eng_recommendation_runs_user_created ON public.recommendation_runs (user_id, created_at DESC)';
  END IF;
  IF to_regclass('public.idx_eng_evening_plans_user_created') IS NULL THEN
    EXECUTE 'CREATE INDEX idx_eng_evening_plans_user_created ON public.evening_plans (user_id, created_at DESC)';
  END IF;
  IF to_regclass('public.wine_reminders') IS NOT NULL
     AND to_regclass('public.idx_eng_wine_reminders_user_created') IS NULL THEN
    EXECUTE 'CREATE INDEX idx_eng_wine_reminders_user_created ON public.wine_reminders (user_id, created_at DESC)';
  END IF;
  IF to_regclass('public.wishlist_items') IS NOT NULL
     AND to_regclass('public.idx_eng_wishlist_items_user_created') IS NULL THEN
    EXECUTE 'CREATE INDEX idx_eng_wishlist_items_user_created ON public.wishlist_items (user_id, created_at DESC)';
  END IF;
END $$;


-- ── Internal metrics helper ───────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public._admin_engagement_user_metrics();
CREATE OR REPLACE FUNCTION public._admin_engagement_user_metrics()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  is_admin BOOLEAN,
  is_excluded BOOLEAN,
  account_age_days INT,
  bottle_count BIGINT,
  scan_wine_count BIGINT,
  recommendation_count BIGINT,
  recommendation_runs_delivered BIGINT,
  agent_recommendations_delivered BIGINT,
  conversation_count BIGINT,
  consumption_count BIGINT,
  evening_plan_count BIGINT,
  reminder_count BIGINT,
  wishlist_count BIGINT,
  ai_calls_total BIGINT,
  ai_failed_total BIGINT,
  ai_failed_28d BIGINT,
  scan_failed_28d BIGINT,
  is_activated BOOLEAN,
  first_value_at TIMESTAMPTZ,
  last_meaningful_at TIMESTAMPTZ,
  days_since_last_meaningful INT,
  active_days_7d INT,
  active_days_28d INT,
  active_days_prev_28d INT,
  lifetime_active_days INT,
  actions_28d INT,
  actions_prev_28d INT,
  bottles_28d BIGINT,
  scans_28d BIGINT,
  recommendations_28d BIGINT,
  conversations_touched_28d BIGINT,
  consumptions_28d BIGINT,
  ai_calls_28d BIGINT,
  observation_coverage TEXT,
  as_of TIMESTAMPTZ,
  chat_history_complete BOOLEAN,
  segment TEXT,
  risk TEXT,
  segment_reason TEXT,
  risk_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_as_of TIMESTAMPTZ;
  v_cur_start TIMESTAMPTZ;
  v_prev_start TIMESTAMPTZ;
  v_day7 TIMESTAMPTZ;
BEGIN
  BEGIN
    v_as_of := NULLIF(current_setting('app.engagement_as_of', true), '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    v_as_of := NULL;
  END;
  v_as_of := COALESCE(v_as_of, NOW());
  v_cur_start := v_as_of - INTERVAL '28 days';
  v_prev_start := v_as_of - INTERVAL '56 days';
  v_day7 := v_as_of - INTERVAL '7 days';

  DROP TABLE IF EXISTS pg_temp._eng_activity;
  CREATE TEMP TABLE _eng_activity (
    user_id UUID,
    ts TIMESTAMPTZ,
    family TEXT
  ) ON COMMIT DROP;

  -- Cellar family
  INSERT INTO pg_temp._eng_activity (user_id, ts, family)
  SELECT b.user_id, b.created_at, 'cellar' FROM public.bottles b
  WHERE b.created_at < v_as_of
  UNION
  SELECT w.user_id, w.created_at, 'cellar' FROM public.wines w
  WHERE w.entry_source = 'ai_scan' AND w.created_at < v_as_of;

  INSERT INTO pg_temp._eng_activity (user_id, ts, family)
  SELECT c.user_id, c.opened_at, 'consumption'
  FROM public.consumption_history c
  WHERE c.opened_at < v_as_of;

  -- Delivered recommendations: runs + agent events with chosen bottles
  INSERT INTO pg_temp._eng_activity (user_id, ts, family)
  SELECT r.user_id, r.created_at, 'recommendation'
  FROM public.recommendation_runs r
  WHERE COALESCE(r.recommendation_count, 0) > 0 AND r.created_at < v_as_of
  UNION
  SELECT sre.user_id, sre.created_at, 'recommendation'
  FROM public.sommelier_recommendation_events sre
  WHERE jsonb_typeof(sre.chosen_bottle_ids) = 'array'
    AND jsonb_array_length(sre.chosen_bottle_ids) > 0
    AND sre.created_at < v_as_of;

  INSERT INTO pg_temp._eng_activity (user_id, ts, family)
  SELECT ep.user_id, ep.created_at, 'evening'
  FROM public.evening_plans ep
  WHERE ep.created_at < v_as_of;

  -- Sommelier cadence: per-message timestamps only (never last_message_at alone)
  INSERT INTO pg_temp._eng_activity (user_id, ts, family)
  SELECT x.user_id, x.day_start, 'sommelier'
  FROM (
    SELECT
      sc.user_id,
      ((parsed.ts AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'UTC') AS day_start
    FROM public.sommelier_conversations sc
    CROSS JOIN LATERAL (
      SELECT
        CASE
          WHEN COALESCE(elem->>'timestamp', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            THEN (elem->>'timestamp')::timestamptz
          ELSE NULL
        END AS ts,
        COALESCE(elem->>'role', '') AS role,
        NULLIF(btrim(COALESCE(elem->>'content', '')), '') AS content
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(sc.messages) = 'array' THEN sc.messages ELSE '[]'::jsonb END
      ) AS t(elem)
    ) parsed
    WHERE parsed.ts IS NOT NULL
      AND parsed.ts < v_as_of
      AND parsed.content IS NOT NULL
      AND parsed.role IN ('user', 'assistant')
    GROUP BY sc.user_id, (parsed.ts AT TIME ZONE 'UTC')::date
    HAVING bool_or(parsed.role = 'user') AND bool_or(parsed.role = 'assistant')
  ) x;

  INSERT INTO pg_temp._eng_activity (user_id, ts, family)
  SELECT ae.user_id, ae.created_at, 'ai'
  FROM public.ai_usage_events ae
  WHERE ae.user_id IS NOT NULL
    AND ae.request_status = 'success'
    AND ae.created_at < v_as_of;

  IF to_regclass('public.wine_reminders') IS NOT NULL THEN
    EXECUTE format($q$
      INSERT INTO pg_temp._eng_activity (user_id, ts, family)
      SELECT wr.user_id, wr.created_at, 'reminder'
      FROM public.wine_reminders wr
      WHERE wr.created_at < %L::timestamptz
    $q$, v_as_of);
  END IF;
  IF to_regclass('public.wishlist_items') IS NOT NULL THEN
    EXECUTE format($q$
      INSERT INTO pg_temp._eng_activity (user_id, ts, family)
      SELECT wi.user_id, wi.created_at, 'wishlist'
      FROM public.wishlist_items wi
      WHERE wi.created_at < %L::timestamptz
    $q$, v_as_of);
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT p.id, p.email, p.display_name, p.created_at, p.last_active_at,
           COALESCE(p.is_admin, FALSE) AS is_admin,
           public.admin_engagement_is_excluded(p.email, COALESCE(p.is_admin, FALSE)) AS is_excluded
    FROM public.profiles p
  ),
  day_agg AS (
    SELECT
      a.user_id,
      COUNT(DISTINCT (a.ts AT TIME ZONE 'UTC')::date) FILTER (
        WHERE a.ts >= v_day7 AND a.ts < v_as_of
      )::INT AS active_days_7d,
      COUNT(DISTINCT (a.ts AT TIME ZONE 'UTC')::date) FILTER (
        WHERE a.ts >= v_cur_start AND a.ts < v_as_of
      )::INT AS active_days_28d,
      COUNT(DISTINCT (a.ts AT TIME ZONE 'UTC')::date) FILTER (
        WHERE a.ts >= v_prev_start AND a.ts < v_cur_start
      )::INT AS active_days_prev_28d,
      COUNT(DISTINCT (a.ts AT TIME ZONE 'UTC')::date) FILTER (
        WHERE a.ts < v_as_of
      )::INT AS lifetime_active_days,
      COUNT(DISTINCT ((a.ts AT TIME ZONE 'UTC')::date::text || '|' || a.family)) FILTER (
        WHERE a.ts >= v_cur_start AND a.ts < v_as_of
      )::INT AS actions_28d,
      COUNT(DISTINCT ((a.ts AT TIME ZONE 'UTC')::date::text || '|' || a.family)) FILTER (
        WHERE a.ts >= v_prev_start AND a.ts < v_cur_start
      )::INT AS actions_prev_28d,
      MAX(a.ts) FILTER (WHERE a.ts < v_as_of) AS last_meaningful_at
    FROM pg_temp._eng_activity a
    GROUP BY a.user_id
  ),
  chat_meta AS (
    SELECT
      sc.user_id,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(sc.messages) = 'array' THEN sc.messages ELSE '[]'::jsonb END
          ) m
          WHERE COALESCE(m->>'role','') = 'user'
            AND NULLIF(btrim(COALESCE(m->>'content','')), '') IS NOT NULL
            AND COALESCE(m->>'timestamp','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        )
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(sc.messages) = 'array' THEN sc.messages ELSE '[]'::jsonb END
          ) m
          WHERE COALESCE(m->>'role','') = 'assistant'
            AND NULLIF(btrim(COALESCE(m->>'content','')), '') IS NOT NULL
            AND COALESCE(m->>'timestamp','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        )
      ) AS meaningful_ts_conversations,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(sc.messages) = 'array' THEN sc.messages ELSE '[]'::jsonb END
          ) m
          WHERE COALESCE(m->>'role','') = 'user'
            AND NULLIF(btrim(COALESCE(m->>'content','')), '') IS NOT NULL
        )
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(sc.messages) = 'array' THEN sc.messages ELSE '[]'::jsonb END
          ) m
          WHERE COALESCE(m->>'role','') = 'assistant'
            AND NULLIF(btrim(COALESCE(m->>'content','')), '') IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(sc.messages) = 'array' THEN sc.messages ELSE '[]'::jsonb END
          ) m
          WHERE COALESCE(m->>'timestamp','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        )
      ) AS legacy_content_no_ts_conversations,
      BOOL_AND(
        NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(sc.messages) = 'array' THEN sc.messages ELSE '[]'::jsonb END
          ) m
          WHERE NULLIF(btrim(COALESCE(m->>'content','')), '') IS NOT NULL
            AND COALESCE(m->>'role','') IN ('user','assistant')
            AND NOT (COALESCE(m->>'timestamp','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
        )
      ) AS all_content_msgs_timestamped,
      MIN(sc.created_at) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(sc.messages) = 'array' THEN sc.messages ELSE '[]'::jsonb END
          ) m
          WHERE COALESCE(m->>'role','') = 'user'
            AND NULLIF(btrim(COALESCE(m->>'content','')), '') IS NOT NULL
        )
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(sc.messages) = 'array' THEN sc.messages ELSE '[]'::jsonb END
          ) m
          WHERE COALESCE(m->>'role','') = 'assistant'
            AND NULLIF(btrim(COALESCE(m->>'content','')), '') IS NOT NULL
        )
      ) AS first_meaningful_chat_created_at
    FROM public.sommelier_conversations sc
    GROUP BY sc.user_id
  ),
  counts AS (
    SELECT
      e.id AS user_id,
      (SELECT COUNT(*) FROM public.bottles b WHERE b.user_id = e.id) AS bottle_count,
      (SELECT COUNT(*) FROM public.wines w WHERE w.user_id = e.id AND w.entry_source = 'ai_scan') AS scan_wine_count,
      (SELECT COUNT(*) FROM public.recommendation_runs r
        WHERE r.user_id = e.id AND COALESCE(r.recommendation_count, 0) > 0) AS recommendation_runs_delivered,
      (SELECT COUNT(*) FROM public.sommelier_recommendation_events sre
        WHERE sre.user_id = e.id
          AND jsonb_typeof(sre.chosen_bottle_ids) = 'array'
          AND jsonb_array_length(sre.chosen_bottle_ids) > 0) AS agent_recommendations_delivered,
      COALESCE(cm.meaningful_ts_conversations, 0) + COALESCE(cm.legacy_content_no_ts_conversations, 0) AS conversation_count,
      (SELECT COUNT(*) FROM public.consumption_history c WHERE c.user_id = e.id) AS consumption_count,
      (SELECT COUNT(*) FROM public.evening_plans ep WHERE ep.user_id = e.id) AS evening_plan_count,
      (SELECT COUNT(*)::BIGINT FROM pg_temp._eng_activity a WHERE a.user_id = e.id AND a.family = 'reminder') AS reminder_count,
      (SELECT COUNT(*)::BIGINT FROM pg_temp._eng_activity a WHERE a.user_id = e.id AND a.family = 'wishlist') AS wishlist_count,
      (SELECT COUNT(*) FROM public.ai_usage_events ae
        WHERE ae.user_id = e.id AND ae.request_status = 'success') AS ai_calls_total,
      (SELECT COUNT(*) FROM public.ai_usage_events ae
        WHERE ae.user_id = e.id AND ae.request_status IN ('failed', 'error')) AS ai_failed_total,
      (SELECT COUNT(*) FROM public.ai_usage_events ae
        WHERE ae.user_id = e.id AND ae.request_status IN ('failed', 'error')
          AND ae.created_at >= v_cur_start AND ae.created_at < v_as_of) AS ai_failed_28d,
      (SELECT COUNT(*) FROM public.app_events ev
        WHERE ev.user_id = e.id AND ev.event_name = 'bottle_scan_failed'
          AND ev.created_at >= v_cur_start AND ev.created_at < v_as_of) AS scan_failed_28d,
      (SELECT COUNT(*) FROM public.app_events ev
        WHERE ev.user_id = e.id AND ev.event_name = 'bottle_added') AS bottle_added_events,
      (SELECT MIN(b.created_at) FROM public.bottles b WHERE b.user_id = e.id) AS first_bottle_at,
      (SELECT MIN(w.created_at) FROM public.wines w WHERE w.user_id = e.id AND w.entry_source = 'ai_scan') AS first_scan_at,
      (SELECT MIN(r.created_at) FROM public.recommendation_runs r
        WHERE r.user_id = e.id AND COALESCE(r.recommendation_count, 0) > 0) AS first_rec_run_at,
      (SELECT MIN(sre.created_at) FROM public.sommelier_recommendation_events sre
        WHERE sre.user_id = e.id
          AND jsonb_typeof(sre.chosen_bottle_ids) = 'array'
          AND jsonb_array_length(sre.chosen_bottle_ids) > 0) AS first_agent_rec_at,
      cm.first_meaningful_chat_created_at AS first_chat_at,
      (SELECT MIN(c.opened_at) FROM public.consumption_history c WHERE c.user_id = e.id) AS first_consumption_at,
      (SELECT MIN(ev.created_at) FROM public.app_events ev
        WHERE ev.user_id = e.id AND ev.event_name = 'bottle_added') AS first_bottle_event_at,
      (SELECT COUNT(*) FROM public.bottles b
        WHERE b.user_id = e.id AND b.created_at >= v_cur_start AND b.created_at < v_as_of) AS bottles_28d,
      (SELECT COUNT(*) FROM public.wines w
        WHERE w.user_id = e.id AND w.entry_source = 'ai_scan'
          AND w.created_at >= v_cur_start AND w.created_at < v_as_of) AS scans_28d,
      (
        (SELECT COUNT(*) FROM public.recommendation_runs r
          WHERE r.user_id = e.id AND COALESCE(r.recommendation_count, 0) > 0
            AND r.created_at >= v_cur_start AND r.created_at < v_as_of)
        +
        (SELECT COUNT(*) FROM public.sommelier_recommendation_events sre
          WHERE sre.user_id = e.id
            AND jsonb_typeof(sre.chosen_bottle_ids) = 'array'
            AND jsonb_array_length(sre.chosen_bottle_ids) > 0
            AND sre.created_at >= v_cur_start AND sre.created_at < v_as_of)
      ) AS recommendations_28d,
      (SELECT COUNT(DISTINCT (a.ts AT TIME ZONE 'UTC')::date)
        FROM pg_temp._eng_activity a
        WHERE a.user_id = e.id AND a.family = 'sommelier'
          AND a.ts >= v_cur_start AND a.ts < v_as_of) AS conversations_touched_28d,
      (SELECT COUNT(*) FROM public.consumption_history c
        WHERE c.user_id = e.id AND c.opened_at >= v_cur_start AND c.opened_at < v_as_of) AS consumptions_28d,
      (SELECT COUNT(*) FROM public.ai_usage_events ae
        WHERE ae.user_id = e.id AND ae.request_status = 'success'
          AND ae.created_at >= v_cur_start AND ae.created_at < v_as_of) AS ai_calls_28d,
      COALESCE(cm.all_content_msgs_timestamped, TRUE) AS chat_history_complete,
      COALESCE(cm.legacy_content_no_ts_conversations, 0) AS legacy_chat_no_ts
    FROM eligible e
    LEFT JOIN chat_meta cm ON cm.user_id = e.id
  ),
  joined AS (
    SELECT
      e.id AS user_id, e.email, e.display_name, e.created_at, e.last_active_at, e.is_admin, e.is_excluded,
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_as_of - e.created_at)) / 86400))::INT AS account_age_days,
      c.bottle_count, c.scan_wine_count,
      (c.recommendation_runs_delivered + c.agent_recommendations_delivered) AS recommendation_count,
      c.recommendation_runs_delivered, c.agent_recommendations_delivered,
      c.conversation_count, c.consumption_count,
      c.evening_plan_count, c.reminder_count, c.wishlist_count, c.ai_calls_total, c.ai_failed_total,
      c.ai_failed_28d, c.scan_failed_28d,
      (c.bottle_count > 0 OR c.scan_wine_count > 0
        OR c.recommendation_runs_delivered > 0 OR c.agent_recommendations_delivered > 0
        OR c.conversation_count > 0 OR c.consumption_count > 0
        OR c.bottle_added_events > 0) AS is_activated,
      (SELECT MIN(ts) FROM (VALUES
        (c.first_bottle_at),(c.first_scan_at),(c.first_rec_run_at),(c.first_agent_rec_at),
        (c.first_chat_at),(c.first_consumption_at),(c.first_bottle_event_at)
      ) t(ts) WHERE ts IS NOT NULL) AS first_value_at,
      d.last_meaningful_at,
      CASE WHEN d.last_meaningful_at IS NULL THEN NULL
           ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_as_of - d.last_meaningful_at)) / 86400))::INT
      END AS days_since_last_meaningful,
      COALESCE(d.active_days_7d, 0) AS active_days_7d,
      COALESCE(d.active_days_28d, 0) AS active_days_28d,
      COALESCE(d.active_days_prev_28d, 0) AS active_days_prev_28d,
      COALESCE(d.lifetime_active_days, 0) AS lifetime_active_days,
      COALESCE(d.actions_28d, 0) AS actions_28d,
      COALESCE(d.actions_prev_28d, 0) AS actions_prev_28d,
      c.bottles_28d, c.scans_28d, c.recommendations_28d, c.conversations_touched_28d,
      c.consumptions_28d, c.ai_calls_28d,
      c.chat_history_complete,
      c.legacy_chat_no_ts
    FROM eligible e
    LEFT JOIN counts c ON c.user_id = e.id
    LEFT JOIN day_agg d ON d.user_id = e.id
  ),
  classified AS (
    SELECT j.*,
      CASE
        WHEN j.account_age_days < 56 THEN 'insufficient_account_age'
        WHEN j.lifetime_active_days < 3 THEN 'insufficient_lifetime_activity'
        WHEN j.active_days_28d = 0 AND j.active_days_prev_28d = 0 THEN 'empty_comparison_windows'
        -- Incomplete chat timestamps: do not allow confident period-over-period risk
        WHEN j.chat_history_complete IS NOT TRUE OR j.legacy_chat_no_ts > 0 THEN 'incomplete_source_history'
        ELSE 'observed_retained_comparable'
      END AS observation_coverage
    FROM joined j
  )
  SELECT
    c.user_id, c.email, c.display_name, c.created_at, c.last_active_at, c.is_admin, c.is_excluded,
    c.account_age_days, c.bottle_count, c.scan_wine_count, c.recommendation_count,
    c.recommendation_runs_delivered, c.agent_recommendations_delivered,
    c.conversation_count, c.consumption_count, c.evening_plan_count, c.reminder_count, c.wishlist_count,
    c.ai_calls_total, c.ai_failed_total, c.ai_failed_28d, c.scan_failed_28d, c.is_activated, c.first_value_at,
    c.last_meaningful_at, c.days_since_last_meaningful, c.active_days_7d, c.active_days_28d,
    c.active_days_prev_28d, c.lifetime_active_days, c.actions_28d, c.actions_prev_28d,
    c.bottles_28d, c.scans_28d, c.recommendations_28d, c.conversations_touched_28d,
    c.consumptions_28d, c.ai_calls_28d, c.observation_coverage, v_as_of AS as_of,
    c.chat_history_complete,
    CASE
      WHEN c.account_age_days < 14 THEN 'new'
      WHEN NOT c.is_activated THEN 'not_activated'
      WHEN c.days_since_last_meaningful IS NOT NULL AND c.days_since_last_meaningful >= 60 THEN 'dormant'
      WHEN c.active_days_28d >= 8 THEN 'power_user'
      WHEN c.active_days_28d >= 3 THEN 'regular'
      ELSE 'occasional_engaged'
    END AS segment,
    CASE
      WHEN c.days_since_last_meaningful IS NOT NULL AND c.days_since_last_meaningful >= 60
        AND c.active_days_28d = 0 AND c.active_days_prev_28d = 0 THEN 'prolonged_inactivity'
      WHEN c.observation_coverage IN (
        'insufficient_account_age', 'insufficient_lifetime_activity',
        'empty_comparison_windows', 'incomplete_source_history'
      ) THEN 'insufficient_history'
      WHEN c.active_days_prev_28d >= 3 AND c.active_days_28d <= 1
        AND c.days_since_last_meaningful IS NOT NULL AND c.days_since_last_meaningful >= 14
        THEN 'at_risk_of_disengagement'
      WHEN c.active_days_prev_28d >= 2
        AND c.active_days_28d < c.active_days_prev_28d * 0.5
        AND (c.active_days_prev_28d - c.active_days_28d) >= 2 THEN 'declining_engagement'
      ELSE 'no_detected_decline'
    END AS risk,
    CASE
      WHEN c.account_age_days < 14 THEN format('Signed up %s day(s) ago; still within 14-day onboarding window.', c.account_age_days)
      WHEN NOT c.is_activated THEN format('Signed up %s days ago; no observed retained first-value (bottle, delivered run/agent recommendation with chosen bottles, meaningful chat with content, consumption, or scan wine). Unlogged surfaces remain uncertain.', c.account_age_days)
      WHEN c.days_since_last_meaningful IS NOT NULL AND c.days_since_last_meaningful >= 60 THEN
        format('No observed retained meaningful activity for %s days (threshold 60).', c.days_since_last_meaningful)
      WHEN c.active_days_28d >= 8 THEN format('%s observed retained active day(s) in [T-28d, T) (power ≥8).', c.active_days_28d)
      WHEN c.active_days_28d >= 3 THEN format('%s observed retained active day(s) in [T-28d, T).', c.active_days_28d)
      WHEN c.active_days_28d > 0 THEN format('%s observed retained active day(s) in current window (infrequent).', c.active_days_28d)
      ELSE format('Activated; last observed retained activity %s day(s) ago; below regular cadence.', COALESCE(c.days_since_last_meaningful::text, '—'))
    END AS segment_reason,
    CASE
      WHEN c.days_since_last_meaningful IS NOT NULL AND c.days_since_last_meaningful >= 60
        AND c.active_days_28d = 0 AND c.active_days_prev_28d = 0 THEN
        format('No observed retained meaningful activity for %s days; both half-open 28d windows empty — not scored as no decline.', c.days_since_last_meaningful)
      WHEN c.observation_coverage = 'insufficient_account_age' THEN
        format('Account age %sd < 56d: previous window not fully observable for this account. Age is eligibility only, not tracking completeness.', c.account_age_days)
      WHEN c.observation_coverage = 'insufficient_lifetime_activity' THEN
        format('Only %s observed retained lifetime active day(s); need ≥3 before scoring engagement risk.', c.lifetime_active_days)
      WHEN c.observation_coverage = 'empty_comparison_windows' THEN
        'Both observed retained comparison windows are empty; zeros are not confirmed total inactivity (deletes/unlogged paths possible). No period-over-period risk scored.'
      WHEN c.observation_coverage = 'incomplete_source_history' THEN
        'Chat/message timestamp history is incomplete for at least one conversation; last_message_at is not used as daily history. Period-over-period decline conclusions are suppressed.'
      WHEN c.active_days_prev_28d >= 3 AND c.active_days_28d <= 1
        AND c.days_since_last_meaningful IS NOT NULL AND c.days_since_last_meaningful >= 14 THEN
        format('%s observed retained active day(s) in [T-28d, T), down from %s in [T-56d, T-28d); %s days since last observed activity.',
          c.active_days_28d, c.active_days_prev_28d, c.days_since_last_meaningful)
      WHEN c.active_days_prev_28d >= 2
        AND c.active_days_28d < c.active_days_prev_28d * 0.5
        AND (c.active_days_prev_28d - c.active_days_28d) >= 2 THEN
        format('%s observed retained active day(s) in [T-28d, T), down from %s in [T-56d, T-28d).',
          c.active_days_28d, c.active_days_prev_28d)
      ELSE
        format('%s observed retained active day(s) in [T-28d, T) vs %s in [T-56d, T-28d).',
          c.active_days_28d, c.active_days_prev_28d)
    END AS risk_reason
  FROM classified c;
END;
$$;

REVOKE ALL ON FUNCTION public._admin_engagement_user_metrics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._admin_engagement_user_metrics() FROM anon;
REVOKE ALL ON FUNCTION public._admin_engagement_user_metrics() FROM authenticated;


-- ── Overview RPC ──────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_engagement_overview();
CREATE OR REPLACE FUNCTION public.admin_engagement_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_last_active_tracked_count BIGINT;
  v_as_of TIMESTAMPTZ;
BEGIN
  IF public.is_admin(auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  BEGIN
    v_as_of := NULLIF(current_setting('app.engagement_as_of', true), '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    v_as_of := NULL;
  END;
  v_as_of := COALESCE(v_as_of, NOW());

  SELECT COUNT(*) INTO v_last_active_tracked_count
  FROM public.profiles WHERE last_active_at IS NOT NULL;

  WITH m AS (
    SELECT * FROM public._admin_engagement_user_metrics()
    WHERE NOT is_excluded
  ),
  totals AS (
    SELECT
      COUNT(*) AS total_users,
      COUNT(*) FILTER (WHERE created_at >= v_as_of - INTERVAL '7 days') AS new_signups_7d,
      COUNT(*) FILTER (WHERE created_at >= v_as_of - INTERVAL '28 days') AS new_signups_28d,
      COUNT(*) FILTER (WHERE active_days_7d > 0) AS meaningfully_active_7d,
      COUNT(*) FILTER (WHERE active_days_28d > 0) AS meaningfully_active_28d,
      COUNT(*) FILTER (WHERE account_age_days >= 14) AS activation_denominator,
      COUNT(*) FILTER (WHERE account_age_days >= 14 AND is_activated) AS activation_numerator,
      COUNT(*) FILTER (WHERE segment = 'new') AS seg_new,
      COUNT(*) FILTER (WHERE segment = 'not_activated') AS seg_not_activated,
      COUNT(*) FILTER (WHERE segment = 'occasional_engaged') AS seg_occasional,
      COUNT(*) FILTER (WHERE segment = 'regular') AS seg_regular,
      COUNT(*) FILTER (WHERE segment = 'power_user') AS seg_power,
      COUNT(*) FILTER (WHERE segment = 'dormant') AS seg_dormant,
      COUNT(*) FILTER (WHERE risk = 'no_detected_decline') AS risk_none,
      COUNT(*) FILTER (WHERE risk = 'declining_engagement') AS risk_declining,
      COUNT(*) FILTER (WHERE risk = 'at_risk_of_disengagement') AS risk_at_risk,
      COUNT(*) FILTER (WHERE risk = 'insufficient_history') AS risk_insufficient,
      COUNT(*) FILTER (WHERE risk = 'prolonged_inactivity') AS risk_prolonged,
      COUNT(*) FILTER (WHERE bottle_count > 0) AS adopted_bottles,
      COUNT(*) FILTER (WHERE scan_wine_count > 0) AS adopted_scans,
      COUNT(*) FILTER (WHERE recommendation_count > 0) AS adopted_recommendations,
      COUNT(*) FILTER (WHERE conversation_count > 0) AS adopted_sommelier,
      COUNT(*) FILTER (WHERE consumption_count > 0) AS adopted_consumption,
      COUNT(*) FILTER (WHERE evening_plan_count > 0) AS adopted_evening_plans,
      COUNT(*) FILTER (WHERE reminder_count > 0) AS adopted_reminders,
      COUNT(*) FILTER (WHERE wishlist_count > 0) AS adopted_wishlist,
      COUNT(*) FILTER (WHERE ai_calls_total > 0) AS adopted_ai,
      COUNT(*) FILTER (WHERE ai_failed_28d > 0) AS users_with_ai_failures_28d,
      COUNT(*) FILTER (WHERE scan_failed_28d > 0) AS users_with_scan_failures_28d
    FROM m
  ),
  excluded AS (
    SELECT COUNT(*) AS excluded_count
    FROM public._admin_engagement_user_metrics()
    WHERE is_excluded
  )
  SELECT jsonb_build_object(
    'config', public.admin_engagement_config(),
    'generated_at', v_as_of,
    'as_of', v_as_of,
    'reporting_timezone', 'UTC',
    'exclusions', jsonb_build_object(
      'rule', 'Admins + emails matching @example.com, @sommi.test, test*@, *+test*@, demo+*, *+admin*@sommi*',
      'excluded_count', (SELECT excluded_count FROM excluded),
      'visible', true
    ),
    'data_coverage', jsonb_build_object(
      'historical_tables', ARRAY[
        'profiles','bottles','wines(entry_source)','consumption_history',
        'recommendation_runs','sommelier_recommendation_events(chosen_bottle_ids)',
        'evening_plans','sommelier_conversations(messages.timestamp)',
        'ai_usage_events','wine_reminders','wishlist_items'
      ],
      'app_events_tracking_since', NULL,
      'scan_failure_instrumentation', 'unknown',
      'last_active_at_users_tracked', v_last_active_tracked_count,
      'last_active_at_note',
        CASE WHEN v_last_active_tracked_count = 0
          THEN 'last_active_at not yet written for any user — do not treat as zero activity'
          ELSE 'last_active_at is a login heartbeat; meaningful activity uses outcome tables'
        END,
      'limitations', ARRAY[
        'Metrics describe observed retained activity only — not complete product instrumentation',
        'Missing, deleted, or unlogged rows must not be read as confirmed inactivity',
        'Sommelier cadence uses per-message timestamps with non-empty user+assistant content; last_message_at is never daily history',
        'Messages without parseable timestamps do not create cadence days; incomplete chat history suppresses confident decline risk',
        'Agent recommendations counted when chosen_bottle_ids is a non-empty array (insert-after-recommend audit; outcome may still be pending)',
        'recommendation_runs retained if present, but current apps/ code does not write that table — agent events are the live recommendation source; overlap may double-count if both exist',
        'AI failures counted only for request_status in (failed, error)',
        'bottle_scan_failed instrumentation start is unknown — never derive it from MIN(app_events.created_at)',
        'Cellar Agent Express AI logging may be under-represented in ai_usage_events',
        'observed_retained_comparable is account-window eligibility plus retained rows — not tracking completeness',
        'Period-over-period risk requires observed_retained_comparable coverage'
      ]
    ),
    'totals', (SELECT to_jsonb(t.*) FROM totals t),
    'activation_rate', (
      SELECT CASE
        WHEN activation_denominator = 0 THEN NULL
        ELSE ROUND((activation_numerator::NUMERIC / activation_denominator) * 100, 1)
      END
      FROM totals
    ),
    'activation_metric', 'lifetime_observed_among_age_ge_14d',
    'activation_window_days', 14,
    'activation_rate_note',
      'Share of accounts aged ≥14d with any lifetime observed retained first-value signal. Not a 14-day conversion rate.',
    'feature_adoption', (
      SELECT jsonb_build_object(
        'bottles', adopted_bottles,
        'scans', adopted_scans,
        'recommendations', adopted_recommendations,
        'sommelier', adopted_sommelier,
        'consumption', adopted_consumption,
        'evening_plans', adopted_evening_plans,
        'reminders', adopted_reminders,
        'wishlist', adopted_wishlist,
        'ai_features', adopted_ai
      ) FROM totals
    ),
    'error_signals_28d', (
      SELECT jsonb_build_object(
        'users_with_ai_failures', users_with_ai_failures_28d,
        'users_with_scan_failures', users_with_scan_failures_28d,
        'scan_failures_note',
          'bottle_scan_failed via trackEvent; instrumentation start unknown — missing is not zero failures',
        'ai_failure_statuses', 'failed,error'
      ) FROM totals
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_engagement_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_engagement_overview() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_engagement_overview() TO authenticated;


-- ── Users list RPC ────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_engagement_users(
  INT, INT, TEXT, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, BOOLEAN
);
CREATE OR REPLACE FUNCTION public.admin_engagement_users(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_segment TEXT DEFAULT NULL,
  p_risk TEXT DEFAULT NULL,
  p_feature TEXT DEFAULT NULL,
  p_min_account_age_days INT DEFAULT NULL,
  p_max_account_age_days INT DEFAULT NULL,
  p_activity_window TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'last_meaningful_at',
  p_sort_dir TEXT DEFAULT 'desc',
  p_include_excluded BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total BIGINT;
  v_rows JSONB;
BEGIN
  IF public.is_admin(auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  WITH base AS (
    SELECT *
    FROM public._admin_engagement_user_metrics() m
    WHERE (p_include_excluded OR NOT m.is_excluded)
      AND (p_search IS NULL OR p_search = '' OR
           m.email ILIKE '%' || p_search || '%' OR
           COALESCE(m.display_name, '') ILIKE '%' || p_search || '%')
      AND (p_segment IS NULL OR p_segment = '' OR m.segment = p_segment)
      AND (p_risk IS NULL OR p_risk = '' OR m.risk = p_risk)
      AND (p_min_account_age_days IS NULL OR m.account_age_days >= p_min_account_age_days)
      AND (p_max_account_age_days IS NULL OR m.account_age_days <= p_max_account_age_days)
      AND (
        p_feature IS NULL OR p_feature = '' OR
        (p_feature = 'bottles' AND m.bottle_count > 0) OR
        (p_feature = 'scans' AND m.scan_wine_count > 0) OR
        (p_feature = 'recommendations' AND m.recommendation_count > 0) OR
        (p_feature = 'sommelier' AND m.conversation_count > 0) OR
        (p_feature = 'consumption' AND m.consumption_count > 0) OR
        (p_feature = 'evening_plans' AND m.evening_plan_count > 0) OR
        (p_feature = 'reminders' AND m.reminder_count > 0) OR
        (p_feature = 'ai' AND m.ai_calls_total > 0) OR
        (p_feature = 'errors_28d' AND (m.ai_failed_28d > 0 OR m.scan_failed_28d > 0))
      )
      AND (
        p_activity_window IS NULL OR p_activity_window = '' OR p_activity_window = 'any' OR
        (p_activity_window = '7d' AND m.active_days_7d > 0) OR
        (p_activity_window = '28d' AND m.active_days_28d > 0) OR
        (p_activity_window = 'none_28d' AND m.active_days_28d = 0)
      )
  ),
  counted AS (
    SELECT COUNT(*) AS total FROM base
  ),
  sorted AS (
    SELECT *
    FROM base
    ORDER BY
      CASE WHEN p_sort = 'created_at' AND lower(p_sort_dir) = 'asc' THEN created_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'created_at' AND lower(p_sort_dir) <> 'asc' THEN created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'last_meaningful_at' AND lower(p_sort_dir) = 'asc' THEN last_meaningful_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'last_meaningful_at' AND lower(p_sort_dir) <> 'asc' THEN last_meaningful_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'active_days_28d' AND lower(p_sort_dir) = 'asc' THEN active_days_28d END ASC NULLS LAST,
      CASE WHEN p_sort = 'active_days_28d' AND lower(p_sort_dir) <> 'asc' THEN active_days_28d END DESC NULLS LAST,
      CASE WHEN p_sort = 'account_age_days' AND lower(p_sort_dir) = 'asc' THEN account_age_days END ASC NULLS LAST,
      CASE WHEN p_sort = 'account_age_days' AND lower(p_sort_dir) <> 'asc' THEN account_age_days END DESC NULLS LAST,
      CASE WHEN p_sort = 'bottle_count' AND lower(p_sort_dir) = 'asc' THEN bottle_count END ASC NULLS LAST,
      CASE WHEN p_sort = 'bottle_count' AND lower(p_sort_dir) <> 'asc' THEN bottle_count END DESC NULLS LAST,
      created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    OFFSET GREATEST(0, COALESCE(p_offset, 0))
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(s))
       FROM (
         SELECT
           user_id, email, display_name, created_at, last_active_at, is_admin, is_excluded,
           account_age_days, is_activated, first_value_at, last_meaningful_at,
           days_since_last_meaningful, active_days_7d, active_days_28d, active_days_prev_28d,
           lifetime_active_days, actions_28d, actions_prev_28d,
           bottle_count, scan_wine_count, recommendation_count,
           recommendation_runs_delivered, agent_recommendations_delivered,
           conversation_count, consumption_count, evening_plan_count, reminder_count, wishlist_count,
           ai_calls_total, ai_calls_28d, ai_failed_28d, scan_failed_28d,
           bottles_28d, scans_28d, recommendations_28d, conversations_touched_28d, consumptions_28d,
           observation_coverage, as_of, chat_history_complete,
           segment, risk, segment_reason, risk_reason,
           CASE
             WHEN active_days_prev_28d = 0 AND active_days_28d = 0 THEN 'flat'
             WHEN active_days_28d > active_days_prev_28d THEN 'up'
             WHEN active_days_28d < active_days_prev_28d THEN 'down'
             ELSE 'flat'
           END AS activity_trend
         FROM sorted
       ) s),
      '[]'::jsonb
    )
  INTO v_total, v_rows;

  RETURN jsonb_build_object(
    'total', v_total,
    'limit', GREATEST(1, LEAST(COALESCE(p_limit, 50), 200)),
    'offset', GREATEST(0, COALESCE(p_offset, 0)),
    'reporting_timezone', 'UTC',
    'users', v_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_engagement_users(
  INT, INT, TEXT, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, BOOLEAN
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_engagement_users(
  INT, INT, TEXT, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, BOOLEAN
) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_engagement_users(
  INT, INT, TEXT, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, BOOLEAN
) TO authenticated;


-- ── User detail RPC ───────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_engagement_user_detail(UUID);
CREATE OR REPLACE FUNCTION public.admin_engagement_user_detail(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_as_of TIMESTAMPTZ;
  v_timeline JSONB;
  v_ai_failures JSONB;
  v_scan_failures JSONB;
  v_suggestions JSONB;
BEGIN
  IF public.is_admin(auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT * INTO v_user
  FROM public._admin_engagement_user_metrics() m
  WHERE m.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_as_of := v_user.as_of;

  WITH events AS (
    SELECT b.created_at AS at, 'bottle_added'::text AS kind,
           jsonb_build_object('bottle_id', b.id) AS meta
    FROM public.bottles b WHERE b.user_id = p_user_id
      AND b.created_at >= v_as_of - INTERVAL '90 days' AND b.created_at < v_as_of
    UNION ALL
    SELECT w.created_at, 'scan_wine_added',
           jsonb_build_object('wine_id', w.id, 'entry_source', w.entry_source)
    FROM public.wines w WHERE w.user_id = p_user_id AND w.entry_source = 'ai_scan'
      AND w.created_at >= v_as_of - INTERVAL '90 days' AND w.created_at < v_as_of
    UNION ALL
    SELECT c.opened_at, 'consumption',
           jsonb_build_object('rating', c.user_rating)
    FROM public.consumption_history c WHERE c.user_id = p_user_id
      AND c.opened_at >= v_as_of - INTERVAL '90 days' AND c.opened_at < v_as_of
    UNION ALL
    SELECT r.created_at, 'recommendation_run',
           jsonb_build_object('count', r.recommendation_count)
    FROM public.recommendation_runs r WHERE r.user_id = p_user_id
      AND r.created_at >= v_as_of - INTERVAL '90 days' AND r.created_at < v_as_of
      AND COALESCE(r.recommendation_count, 0) > 0
    UNION ALL
    SELECT sre.created_at, 'agent_recommendation',
           jsonb_build_object(
             'event_id', sre.id,
             'chosen_count', jsonb_array_length(sre.chosen_bottle_ids),
             'response_type', sre.response_type
           )
    FROM public.sommelier_recommendation_events sre
    WHERE sre.user_id = p_user_id
      AND jsonb_typeof(sre.chosen_bottle_ids) = 'array'
      AND jsonb_array_length(sre.chosen_bottle_ids) > 0
      AND sre.created_at >= v_as_of - INTERVAL '90 days' AND sre.created_at < v_as_of
    UNION ALL
    SELECT ep.created_at, 'evening_plan',
           jsonb_build_object('status', ep.status)
    FROM public.evening_plans ep WHERE ep.user_id = p_user_id
      AND ep.created_at >= v_as_of - INTERVAL '90 days' AND ep.created_at < v_as_of
    UNION ALL
    SELECT day_start, 'sommelier_meaningful_day',
           jsonb_build_object('conversation_id', conversation_id)
    FROM (
      SELECT
        sc.id AS conversation_id,
        ((parsed.ts AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'UTC') AS day_start
      FROM public.sommelier_conversations sc
      CROSS JOIN LATERAL (
        SELECT
          CASE
            WHEN COALESCE(elem->>'timestamp', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
              THEN (elem->>'timestamp')::timestamptz
            ELSE NULL
          END AS ts,
          COALESCE(elem->>'role', '') AS role,
          NULLIF(btrim(COALESCE(elem->>'content', '')), '') AS content
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(sc.messages) = 'array' THEN sc.messages ELSE '[]'::jsonb END
        ) AS t(elem)
      ) parsed
      WHERE sc.user_id = p_user_id
        AND parsed.ts IS NOT NULL
        AND parsed.ts < v_as_of
        AND parsed.ts >= v_as_of - INTERVAL '90 days'
        AND parsed.content IS NOT NULL
        AND parsed.role IN ('user', 'assistant')
      GROUP BY sc.id, (parsed.ts AT TIME ZONE 'UTC')::date
      HAVING bool_or(parsed.role = 'user') AND bool_or(parsed.role = 'assistant')
    ) chat_days
    UNION ALL
    SELECT ae.created_at, 'ai_call',
           jsonb_build_object('action_type', ae.action_type, 'status', ae.request_status)
    FROM public.ai_usage_events ae WHERE ae.user_id = p_user_id
      AND ae.created_at >= v_as_of - INTERVAL '90 days' AND ae.created_at < v_as_of
      AND ae.request_status = 'success'
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.at DESC), '[]'::jsonb)
  INTO v_timeline
  FROM (
    SELECT * FROM events ORDER BY at DESC LIMIT 80
  ) e;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_ai_failures
  FROM (
    SELECT ae.created_at, ae.action_type, ae.request_status, ae.estimated_cost_usd
    FROM public.ai_usage_events ae
    WHERE ae.user_id = p_user_id
      AND ae.request_status IN ('failed', 'error')
      AND ae.created_at >= v_as_of - INTERVAL '90 days' AND ae.created_at < v_as_of
    ORDER BY ae.created_at DESC
    LIMIT 20
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_scan_failures
  FROM (
    SELECT ev.created_at, ev.metadata
    FROM public.app_events ev
    WHERE ev.user_id = p_user_id
      AND ev.event_name = 'bottle_scan_failed'
      AND ev.created_at >= v_as_of - INTERVAL '90 days' AND ev.created_at < v_as_of
    ORDER BY ev.created_at DESC
    LIMIT 20
  ) x;

  SELECT jsonb_agg(s) INTO v_suggestions
  FROM (
    SELECT * FROM (
      SELECT 1 AS ord,
        'Improve onboarding before first value'::text AS title,
        'User is past the 14-day window with no observed retained first-value action.'::text AS evidence,
        'Investigate where signup → first bottle/scan/recommendation drops off.'::text AS action
      WHERE v_user.segment = 'not_activated'
      UNION ALL
      SELECT 2,
        'Investigate recent technical failures',
        format('AI failures (failed/error, 28d): %s; scan failures (28d): %s.', v_user.ai_failed_28d, v_user.scan_failed_28d),
        'Review failure metadata near last meaningful activity. Do not assume causation.'
      WHERE v_user.ai_failed_28d > 0 OR v_user.scan_failed_28d > 0
      UNION ALL
      SELECT 3,
        'Study power-user feature mix',
        format('Power signals: %s active days / %s actions in 28d.', v_user.active_days_28d, v_user.actions_28d),
        'Compare which features sustained power users rely on vs occasional users.'
      WHERE v_user.segment = 'power_user'
      UNION ALL
      SELECT 4,
        'Review engagement decline vs prior cadence',
        v_user.risk_reason,
        'Compare current vs previous 28-day windows; consider wine-app seasonality.'
      WHERE v_user.risk IN ('declining_engagement', 'at_risk_of_disengagement')
      UNION ALL
      SELECT 5,
        'Re-activation after dormancy',
        v_user.segment_reason,
        'Confirm last successful journeys; avoid messaging from this dashboard.'
      WHERE v_user.segment = 'dormant'
    ) q
    ORDER BY ord
  ) s;

  RETURN jsonb_build_object(
    'reporting_timezone', 'UTC',
    'as_of', v_as_of,
    'config', public.admin_engagement_config(),
    'user', to_jsonb(v_user),
    'classification', jsonb_build_object(
      'segment', v_user.segment,
      'risk', v_user.risk,
      'segment_reason', v_user.segment_reason,
      'risk_reason', v_user.risk_reason,
      'observation_coverage', v_user.observation_coverage,
      'observed_evidence', jsonb_build_array(
        format('As-of (UTC): %s', v_as_of),
        format('Account age: %s days (signup %s)', v_user.account_age_days, v_user.created_at::date),
        format('Activated: %s (first value at %s)', v_user.is_activated, COALESCE(v_user.first_value_at::text, 'n/a')),
        format('Recommendations: runs_delivered=%s agent_delivered=%s (sum may over-count overlapping turns)',
          v_user.recommendation_runs_delivered, v_user.agent_recommendations_delivered),
        format('Active days: %s in [T-28d,T) vs %s in [T-56d,T-28d) (lifetime %s)',
          v_user.active_days_28d, v_user.active_days_prev_28d, v_user.lifetime_active_days),
        format('Chat history complete for cadence: %s', v_user.chat_history_complete),
        format('Last observed retained activity: %s (%s days ago)',
          COALESCE(v_user.last_meaningful_at::text, 'none'),
          COALESCE(v_user.days_since_last_meaningful::text, 'n/a'))
      ),
      'possible_explanations', jsonb_build_array(
        'Seasonal / occasion-driven wine usage',
        'Got value then paused',
        'Stuck in onboarding or a failed journey',
        'Unknown — insufficient signals'
      ),
      'unknown_causes', jsonb_build_array(
        'Motivations cannot be inferred from private chat content',
        'Observed zeros do not prove dissatisfaction or total inactivity',
        'Errors near last activity do not prove causation',
        'Unlogged Agent paths and hard deletes may under-observe'
      ),
      'data_sufficiency', CASE
        WHEN v_user.observation_coverage = 'observed_retained_comparable' THEN 'observed_retained_comparable'
        ELSE 'insufficient'
      END
    ),
    'comparable_periods', jsonb_build_object(
      'current_28d', jsonb_build_object(
        'active_days', v_user.active_days_28d,
        'actions', v_user.actions_28d,
        'bottles', v_user.bottles_28d,
        'scans', v_user.scans_28d,
        'recommendations', v_user.recommendations_28d,
        'sommelier', v_user.conversations_touched_28d,
        'consumptions', v_user.consumptions_28d,
        'ai_calls', v_user.ai_calls_28d
      ),
      'previous_28d', jsonb_build_object(
        'active_days', v_user.active_days_prev_28d,
        'actions', v_user.actions_prev_28d
      )
    ),
    'feature_breakdown', jsonb_build_object(
      'bottles_total', v_user.bottle_count,
      'scan_wines_total', v_user.scan_wine_count,
      'recommendations_total', v_user.recommendation_count,
      'recommendation_runs_delivered', v_user.recommendation_runs_delivered,
      'agent_recommendations_delivered', v_user.agent_recommendations_delivered,
      'conversations_total', v_user.conversation_count,
      'consumptions_total', v_user.consumption_count,
      'evening_plans_total', v_user.evening_plan_count,
      'reminders_total', v_user.reminder_count,
      'wishlist_total', v_user.wishlist_count,
      'ai_calls_total', v_user.ai_calls_total,
      'ai_failed_total', v_user.ai_failed_total
    ),
    'timeline', v_timeline,
    'technical_failures', jsonb_build_object(
      'ai_failures_90d', v_ai_failures,
      'scan_failures_90d', v_scan_failures,
      'scan_failures_coverage',
        'bottle_scan_failed via trackEvent; instrumentation start unknown — empty list is not proof of zero failures'
    ),
    'suggested_actions', COALESCE(v_suggestions, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_engagement_user_detail(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_engagement_user_detail(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_engagement_user_detail(UUID) TO authenticated;

COMMIT;
