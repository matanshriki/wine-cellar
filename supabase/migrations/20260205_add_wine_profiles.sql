-- =====================================================
-- Migration: Add Wine Profile System
-- Purpose: Store AI-generated wine profiles (body, tannin, acidity, etc.)
--          for food-aware evening planning
-- =====================================================

-- 1) Add wine profile columns to wines table
ALTER TABLE wines
ADD COLUMN IF NOT EXISTS wine_profile jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS wine_profile_updated_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS wine_profile_source text DEFAULT NULL CHECK (wine_profile_source IN ('ai', 'vivino', 'heuristic')),
ADD COLUMN IF NOT EXISTS wine_profile_confidence text DEFAULT NULL CHECK (wine_profile_confidence IN ('low', 'med', 'high'));

-- Add index for finding wines without profiles (for backfill)
CREATE INDEX IF NOT EXISTS idx_wines_missing_profile 
ON wines (user_id) 
WHERE wine_profile IS NULL;

-- Add index for profile queries
CREATE INDEX IF NOT EXISTS idx_wines_profile_source 
ON wines (wine_profile_source) 
WHERE wine_profile_source IS NOT NULL;

-- 2) Create profile backfill jobs table (for admin tracking)
CREATE TABLE IF NOT EXISTS profile_backfill_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  total int NOT NULL DEFAULT 0,
  processed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  error_details jsonb DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add index for querying jobs by user and status
CREATE INDEX IF NOT EXISTS idx_backfill_jobs_user_status 
ON profile_backfill_jobs (user_id, status);

-- Add RLS policies for backfill jobs (admin only)
ALTER TABLE profile_backfill_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all backfill jobs"
ON profile_backfill_jobs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can insert backfill jobs"
ON profile_backfill_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can update backfill jobs"
ON profile_backfill_jobs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- 3) Check if is_admin exists (it should be added by separate migration)
-- If not exists, the profile backfill RLS policies will fail gracefully
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'is_admin'
  ) THEN
    RAISE WARNING 'profiles.is_admin column does not exist yet. Run 20260205_migrate_admin_to_profiles.sql first.';
  END IF;
END $$;

-- 4) Add updated_at trigger for backfill jobs
CREATE OR REPLACE FUNCTION update_backfill_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER backfill_jobs_updated_at
BEFORE UPDATE ON profile_backfill_jobs
FOR EACH ROW
EXECUTE FUNCTION update_backfill_jobs_updated_at();

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON COLUMN wines.wine_profile IS 'AI-generated wine profile: body, tannin, acidity, oak, sweetness, power, style_tags';
COMMENT ON COLUMN wines.wine_profile_updated_at IS 'When the profile was last generated/updated';
COMMENT ON COLUMN wines.wine_profile_source IS 'Source of profile: ai (OpenAI), vivino (scraped), heuristic (client-side guess)';
COMMENT ON COLUMN wines.wine_profile_confidence IS 'Confidence level: low, med, high';

COMMENT ON TABLE profile_backfill_jobs IS 'Tracks admin-initiated bulk profile generation jobs';
COMMENT ON COLUMN profiles.is_admin IS 'Admin users can run backfill jobs and access admin tools';
