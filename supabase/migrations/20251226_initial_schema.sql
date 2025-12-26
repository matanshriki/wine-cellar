-- Wine Cellar Brain - Initial Schema
-- Separates wine catalog (wines) from inventory (bottles)
-- Implements proper multi-tenant security with RLS

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
-- User profiles (one per auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'he')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  extracted_display_name TEXT;
  extracted_first_name TEXT;
  extracted_last_name TEXT;
BEGIN
  -- Extract first_name (from Google OAuth or other providers)
  extracted_first_name := COALESCE(
    NEW.raw_user_meta_data->>'given_name',    -- Google OAuth
    NEW.raw_user_meta_data->>'first_name',    -- Other providers
    SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 1)  -- Extract from full name
  );
  
  -- Extract last_name (from Google OAuth or other providers)
  extracted_last_name := COALESCE(
    NEW.raw_user_meta_data->>'family_name',   -- Google OAuth
    NEW.raw_user_meta_data->>'last_name',     -- Other providers
    NULLIF(SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 2), '')  -- Extract from full name
  );
  
  -- Create display_name (prefer first_name for cleaner display)
  extracted_display_name := COALESCE(
    extracted_first_name,                     -- Preferred: first name only (cleaner)
    NEW.raw_user_meta_data->>'display_name',  -- Explicit display_name
    NEW.raw_user_meta_data->>'full_name',     -- Google/OAuth full_name
    NEW.raw_user_meta_data->>'name',          -- Alternative OAuth field
    CONCAT_WS(' ', extracted_first_name, extracted_last_name),  -- Constructed from first/last
    SPLIT_PART(NEW.email, '@', 1)             -- Fallback: email username
  );
  
  INSERT INTO public.profiles (id, display_name, email, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    extracted_display_name,
    NEW.email,
    extracted_first_name,
    extracted_last_name,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- WINES TABLE (Catalog)
-- ============================================
-- Wine catalog - the "label" or wine identity
CREATE TABLE public.wines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Wine identity
  producer TEXT NOT NULL,
  wine_name TEXT NOT NULL,
  vintage INTEGER,
  
  -- Location
  country TEXT,
  region TEXT,
  appellation TEXT,
  
  -- Wine characteristics
  color TEXT NOT NULL CHECK (color IN ('red', 'white', 'rose', 'sparkling')),
  grapes JSONB, -- Array of grape varieties
  
  -- External IDs
  vivino_wine_id TEXT,
  
  -- Additional info
  notes TEXT,
  image_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one wine entry per user per producer/name/vintage combo
  UNIQUE(user_id, producer, wine_name, vintage)
);

-- Indexes
CREATE INDEX wines_user_id_idx ON public.wines(user_id);
CREATE INDEX wines_color_idx ON public.wines(color);
CREATE INDEX wines_vivino_id_idx ON public.wines(vivino_wine_id) WHERE vivino_wine_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.wines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wines
CREATE POLICY "Users can view own wines"
  ON public.wines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wines"
  ON public.wines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wines"
  ON public.wines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own wines"
  ON public.wines FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- BOTTLES TABLE (Inventory)
-- ============================================
-- Physical bottle instances in user's cellar
CREATE TABLE public.bottles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wine_id UUID NOT NULL REFERENCES public.wines(id) ON DELETE CASCADE,
  
  -- Inventory
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  
  -- Purchase info
  purchase_date DATE,
  purchase_price DECIMAL(10, 2),
  purchase_location TEXT,
  
  -- Storage
  storage_location TEXT,
  bottle_size_ml INTEGER DEFAULT 750,
  
  -- Drinking window & analysis
  drink_window_start INTEGER, -- Year
  drink_window_end INTEGER,   -- Year
  readiness_status TEXT CHECK (readiness_status IN ('TooYoung', 'Approaching', 'InWindow', 'Peak', 'PastPeak', 'Unknown')),
  readiness_score INTEGER CHECK (readiness_score BETWEEN 0 AND 100),
  
  -- Serving recommendations (from AI analysis)
  serve_temp_c DECIMAL(4, 1),
  decant_minutes INTEGER,
  analysis_notes TEXT,
  analyzed_at TIMESTAMPTZ,
  
  -- Additional metadata
  tags JSONB, -- Array of strings
  image_url TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX bottles_user_id_idx ON public.bottles(user_id);
CREATE INDEX bottles_wine_id_idx ON public.bottles(wine_id);
CREATE INDEX bottles_quantity_idx ON public.bottles(quantity) WHERE quantity > 0;
CREATE INDEX bottles_readiness_idx ON public.bottles(readiness_status);

-- Enable RLS
ALTER TABLE public.bottles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bottles
CREATE POLICY "Users can view own bottles"
  ON public.bottles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bottles"
  ON public.bottles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bottles"
  ON public.bottles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bottles"
  ON public.bottles FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- CONSUMPTION_HISTORY TABLE
-- ============================================
-- Track when bottles are opened and consumed
CREATE TABLE public.consumption_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bottle_id UUID NOT NULL REFERENCES public.bottles(id) ON DELETE CASCADE,
  wine_id UUID NOT NULL REFERENCES public.wines(id) ON DELETE CASCADE,
  
  -- When & context
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occasion TEXT,
  meal_type TEXT,
  
  -- Experience
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  tasting_notes TEXT,
  meal_notes TEXT,
  
  -- Recommendation context (if opened via recommendation flow)
  vibe TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX consumption_history_user_id_idx ON public.consumption_history(user_id);
CREATE INDEX consumption_history_bottle_id_idx ON public.consumption_history(bottle_id);
CREATE INDEX consumption_history_opened_at_idx ON public.consumption_history(opened_at DESC);

-- Enable RLS
ALTER TABLE public.consumption_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consumption_history
CREATE POLICY "Users can view own history"
  ON public.consumption_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history"
  ON public.consumption_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own history"
  ON public.consumption_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own history"
  ON public.consumption_history FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- RECOMMENDATION_RUNS TABLE
-- ============================================
-- Audit trail for recommendation requests
CREATE TABLE public.recommendation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Input/output payloads for explainability
  input_payload JSONB NOT NULL,
  output_payload JSONB NOT NULL,
  
  -- Metadata
  recommendation_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX recommendation_runs_user_id_idx ON public.recommendation_runs(user_id);
CREATE INDEX recommendation_runs_created_at_idx ON public.recommendation_runs(created_at DESC);

-- Enable RLS
ALTER TABLE public.recommendation_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recommendation_runs
CREATE POLICY "Users can view own recommendations"
  ON public.recommendation_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendations"
  ON public.recommendation_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wines_updated_at
  BEFORE UPDATE ON public.wines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bottles_updated_at
  BEFORE UPDATE ON public.bottles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- HELPER VIEWS (Optional)
-- ============================================
-- View combining bottles with wine information
CREATE VIEW public.bottles_with_wine_info AS
SELECT 
  b.*,
  w.producer,
  w.wine_name,
  w.vintage,
  w.country,
  w.region,
  w.appellation,
  w.color,
  w.grapes,
  w.vivino_wine_id
FROM public.bottles b
JOIN public.wines w ON b.wine_id = w.id;

-- Grant access to the view (RLS will be enforced through base tables)
GRANT SELECT ON public.bottles_with_wine_info TO authenticated;

