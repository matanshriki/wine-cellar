-- Phase 2: Cellar Sommelier domain agent — memory, events, feedback, drafts
-- Minimal schema; all JSON shapes documented in API code.

CREATE TABLE IF NOT EXISTS public.sommelier_agent_memory (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sommelier_agent_memory_updated
  ON public.sommelier_agent_memory(updated_at DESC);

ALTER TABLE public.sommelier_agent_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own sommelier memory" ON public.sommelier_agent_memory;
CREATE POLICY "Users manage own sommelier memory"
  ON public.sommelier_agent_memory
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.sommelier_recommendation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_message TEXT,
  detected_intent TEXT,
  shortlist_bottle_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  chosen_bottle_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  response_type TEXT,
  explanation JSONB,
  taste_context_present BOOLEAN DEFAULT FALSE,
  outcome TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sommelier_recommendation_events_user_created
  ON public.sommelier_recommendation_events(user_id, created_at DESC);

ALTER TABLE public.sommelier_recommendation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own recommendation events" ON public.sommelier_recommendation_events;
CREATE POLICY "Users manage own recommendation events"
  ON public.sommelier_recommendation_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.sommelier_feedback_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recommendation_event_id UUID REFERENCES public.sommelier_recommendation_events(id) ON DELETE SET NULL,
  bottle_id UUID REFERENCES public.bottles(id) ON DELETE SET NULL,
  raw_text TEXT,
  structured_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  sentiment TEXT,
  preference_delta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sommelier_feedback_user_created
  ON public.sommelier_feedback_events(user_id, created_at DESC);

ALTER TABLE public.sommelier_feedback_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own sommelier feedback" ON public.sommelier_feedback_events;
CREATE POLICY "Users manage own sommelier feedback"
  ON public.sommelier_feedback_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.sommelier_tasting_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bottle_id UUID REFERENCES public.bottles(id) ON DELETE SET NULL,
  draft_text TEXT,
  source_event_id UUID REFERENCES public.sommelier_recommendation_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sommelier_drafts_user_updated
  ON public.sommelier_tasting_drafts(user_id, updated_at DESC);

ALTER TABLE public.sommelier_tasting_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own tasting drafts" ON public.sommelier_tasting_drafts;
CREATE POLICY "Users manage own tasting drafts"
  ON public.sommelier_tasting_drafts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.sommelier_agent_memory IS 'Learned sommelier preferences (styles, dislikes, regions) — optional; empty is valid.';
COMMENT ON TABLE public.sommelier_recommendation_events IS 'Agent recommendation turns with explainability payload.';
COMMENT ON TABLE public.sommelier_feedback_events IS 'User feedback translated into structured tags and preference deltas.';
COMMENT ON TABLE public.sommelier_tasting_drafts IS 'Draft tasting notes created by agent action.';
