-- ============================================================
-- Admin Intelligence: app_events table
-- Tracks internal product events from frontend and Edge Functions.
-- This table starts empty; events accumulate as trackEvent() is called.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable so pre-auth and anonymous events can be recorded.
  -- RLS enforces that authenticated users can only insert their own user_id.
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name  TEXT        NOT NULL,
  event_type  TEXT,
  source      TEXT,
  page        TEXT,
  session_id  TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Core lookup indexes
CREATE INDEX IF NOT EXISTS idx_app_events_user_id
  ON public.app_events(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_events_event_name
  ON public.app_events(event_name);

CREATE INDEX IF NOT EXISTS idx_app_events_event_type
  ON public.app_events(event_type)
  WHERE event_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_events_source
  ON public.app_events(source)
  WHERE source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_events_page
  ON public.app_events(page)
  WHERE page IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_events_created_at
  ON public.app_events(created_at DESC);

-- GIN index enables fast metadata filtering (e.g. metadata->>'wine_id')
CREATE INDEX IF NOT EXISTS idx_app_events_metadata
  ON public.app_events USING gin(metadata);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users may insert events for themselves.
-- user_id must equal auth.uid() OR be NULL (for events fired before user_id is known).
DROP POLICY IF EXISTS "Users can insert own events" ON public.app_events;
CREATE POLICY "Users can insert own events"
  ON public.app_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Anonymous (pre-auth) inserts are allowed with null user_id only.
DROP POLICY IF EXISTS "Anon can insert events" ON public.app_events;
CREATE POLICY "Anon can insert events"
  ON public.app_events FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Only admins can SELECT events (all users' data).
DROP POLICY IF EXISTS "Admins can read all events" ON public.app_events;
CREATE POLICY "Admins can read all events"
  ON public.app_events FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

COMMENT ON TABLE public.app_events IS
  'Internal product event ledger. Populated by trackEvent() from the frontend and Edge Functions.
   Starts empty — events accumulate as instrumentation is added to the codebase.';
