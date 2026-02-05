-- Evening Plans Table
-- Persistent storage for "Plan an evening" feature
-- Allows users to save, resume, and complete wine evening plans

CREATE TABLE IF NOT EXISTS public.evening_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  
  -- Metadata
  plan_name TEXT,
  occasion TEXT, -- friends, bbq, pizza, date, celebration
  group_size TEXT, -- 2-4, 5-8, 9+
  
  -- Settings (stored as JSONB for flexibility)
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Queue: ordered list of wines
  -- [{ wine_id, bottle_id, position, notes, opened, opened_quantity, rating }]
  queue JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Current position in queue
  now_playing_index INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Stats (computed on completion)
  total_bottles_opened INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS evening_plans_user_id_idx ON public.evening_plans(user_id);
CREATE INDEX IF NOT EXISTS evening_plans_status_idx ON public.evening_plans(status) WHERE status = 'active';

-- RLS Policies
ALTER TABLE public.evening_plans ENABLE ROW LEVEL SECURITY;

-- Users can only see their own plans
CREATE POLICY "Users can view their own evening plans"
ON public.evening_plans FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own plans
CREATE POLICY "Users can create their own evening plans"
ON public.evening_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own plans
CREATE POLICY "Users can update their own evening plans"
ON public.evening_plans FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own plans
CREATE POLICY "Users can delete their own evening plans"
ON public.evening_plans FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_evening_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evening_plans_updated_at
BEFORE UPDATE ON public.evening_plans
FOR EACH ROW
EXECUTE FUNCTION update_evening_plans_updated_at();

-- Comments
COMMENT ON TABLE public.evening_plans IS 'Stores persistent evening wine plans with queue and progress';
COMMENT ON COLUMN public.evening_plans.queue IS 'Ordered array of wines with metadata: [{ wine_id, bottle_id, position, notes, opened, opened_quantity, rating }]';
COMMENT ON COLUMN public.evening_plans.now_playing_index IS 'Current position in the queue (0-based index)';
