-- Wine World Moments - Event System
-- Adds curated wine/grape day events and user interaction tracking

-- ============================================
-- WINE_EVENTS TABLE
-- ============================================
-- Curated wine/grape celebration days (seeded from WSET calendar)
CREATE TABLE public.wine_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  tags TEXT[] DEFAULT '{}', -- e.g., ['syrah', 'shiraz'] or ['sparkling', 'champagne']
  type TEXT NOT NULL CHECK (type IN ('grape', 'wine', 'occasion')),
  description_short TEXT, -- 1-2 line description for banner
  source_name TEXT, -- e.g., 'WSET'
  source_url TEXT, -- Attribution link
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient date-range queries
CREATE INDEX idx_wine_events_date ON public.wine_events(date);
CREATE INDEX idx_wine_events_tags ON public.wine_events USING gin(tags);

-- Enable RLS (events are public read-only)
ALTER TABLE public.wine_events ENABLE ROW LEVEL SECURITY;

-- Anyone can read events
CREATE POLICY "Wine events are publicly readable"
  ON public.wine_events FOR SELECT
  USING (true);

-- Only admins can modify events (handled via service role)
CREATE POLICY "Only service role can modify events"
  ON public.wine_events FOR ALL
  USING (false);

-- ============================================
-- USER_EVENT_STATES TABLE
-- ============================================
-- Tracks user interaction with events (dismissed, seen, last shown)
CREATE TABLE public.user_event_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.wine_events(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ, -- User clicked "Don't show again"
  seen_at TIMESTAMPTZ, -- First time user saw the event
  last_shown_at TIMESTAMPTZ, -- Last time event was displayed to user
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one state record per user per event
  UNIQUE(user_id, event_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_user_event_states_user ON public.user_event_states(user_id);
CREATE INDEX idx_user_event_states_event ON public.user_event_states(event_id);
CREATE INDEX idx_user_event_states_dismissed ON public.user_event_states(dismissed_at) WHERE dismissed_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.user_event_states ENABLE ROW LEVEL SECURITY;

-- Users can view their own event states
CREATE POLICY "Users can view own event states"
  ON public.user_event_states FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own event states
CREATE POLICY "Users can insert own event states"
  ON public.user_event_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own event states
CREATE POLICY "Users can update own event states"
  ON public.user_event_states FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if an event is currently active (within display window)
CREATE OR REPLACE FUNCTION public.is_event_active(
  event_date DATE,
  days_before INTEGER DEFAULT 3,
  days_after INTEGER DEFAULT 3
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN CURRENT_DATE >= (event_date - days_before) 
    AND CURRENT_DATE <= (event_date + days_after);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get active events for a user (not dismissed, within window, not shown today)
CREATE OR REPLACE FUNCTION public.get_active_events_for_user(
  p_user_id UUID,
  days_before INTEGER DEFAULT 3,
  days_after INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  date DATE,
  tags TEXT[],
  type TEXT,
  description_short TEXT,
  source_name TEXT,
  source_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.date,
    e.tags,
    e.type,
    e.description_short,
    e.source_name,
    e.source_url
  FROM public.wine_events e
  LEFT JOIN public.user_event_states ues 
    ON e.id = ues.event_id AND ues.user_id = p_user_id
  WHERE 
    -- Event is within active window
    public.is_event_active(e.date, days_before, days_after)
    -- User hasn't dismissed it
    AND (ues.dismissed_at IS NULL OR ues.dismissed_at IS NULL)
    -- Either never shown, or not shown today
    AND (ues.last_shown_at IS NULL OR DATE(ues.last_shown_at) < CURRENT_DATE)
  ORDER BY 
    -- Prioritize events happening today
    ABS(EXTRACT(DAY FROM (e.date - CURRENT_DATE))) ASC,
    -- Then by event date
    e.date ASC
  LIMIT 1; -- Return only the best match
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_event_active TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_events_for_user TO authenticated;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.update_wine_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_wine_events_updated_at
  BEFORE UPDATE ON public.wine_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wine_events_updated_at();

CREATE TRIGGER trigger_user_event_states_updated_at
  BEFORE UPDATE ON public.user_event_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wine_events_updated_at();
