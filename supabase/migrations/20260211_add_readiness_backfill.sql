-- =====================================================
-- Migration: Add Readiness Backfill Infrastructure
-- Purpose: Add missing readiness fields + job tracking for global backfill
-- =====================================================

-- ============================================
-- PART 1: Add Missing Readiness Fields to Bottles
-- ============================================

-- Add confidence, reasons, version, and updated_at
ALTER TABLE bottles
ADD COLUMN IF NOT EXISTS readiness_confidence TEXT CHECK (readiness_confidence IN ('low', 'med', 'high')),
ADD COLUMN IF NOT EXISTS readiness_reasons JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS readiness_version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS readiness_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Add helpful indexes for backfill queries
CREATE INDEX IF NOT EXISTS idx_bottles_readiness_version 
ON bottles (readiness_version, id) 
WHERE readiness_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bottles_missing_readiness 
ON bottles (id) 
WHERE readiness_score IS NULL OR readiness_updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bottles_readiness_updated_at 
ON bottles (readiness_updated_at DESC NULLS LAST);

-- ============================================
-- PART 2: Readiness Backfill Jobs Table
-- ============================================

CREATE TABLE IF NOT EXISTS readiness_backfill_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Job configuration
  mode TEXT NOT NULL CHECK (mode IN ('missing_only', 'stale_or_missing', 'force_all')),
  batch_size INTEGER NOT NULL DEFAULT 200,
  current_version INTEGER NOT NULL DEFAULT 2, -- READINESS_VERSION
  
  -- Progress tracking
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  cursor TEXT DEFAULT NULL, -- Last processed bottle ID
  processed INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  
  -- Error tracking
  error_details JSONB DEFAULT NULL,
  failures JSONB DEFAULT '[]'::jsonb, -- Array of {bottle_id, reason}
  
  -- Metadata
  started_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  estimated_total INTEGER DEFAULT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ DEFAULT NULL,
  finished_at TIMESTAMPTZ DEFAULT NULL
);

-- Indexes for querying jobs
CREATE INDEX IF NOT EXISTS idx_readiness_jobs_status 
ON readiness_backfill_jobs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_readiness_jobs_started_by 
ON readiness_backfill_jobs (started_by, created_at DESC);

-- Enable RLS
ALTER TABLE readiness_backfill_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admin-only access
CREATE POLICY "Admins can view all readiness backfill jobs"
ON readiness_backfill_jobs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can insert readiness backfill jobs"
ON readiness_backfill_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can update readiness backfill jobs"
ON readiness_backfill_jobs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_readiness_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER readiness_jobs_updated_at
BEFORE UPDATE ON readiness_backfill_jobs
FOR EACH ROW
EXECUTE FUNCTION update_readiness_jobs_updated_at();

-- ============================================
-- PART 3: Helper Functions
-- ============================================

-- Function to count bottles needing backfill
CREATE OR REPLACE FUNCTION count_bottles_needing_readiness(
  p_mode TEXT DEFAULT 'missing_only',
  p_current_version INTEGER DEFAULT 2
)
RETURNS INTEGER AS $$
DECLARE
  result INTEGER;
BEGIN
  IF p_mode = 'missing_only' THEN
    SELECT COUNT(*)
    INTO result
    FROM bottles
    WHERE readiness_score IS NULL 
       OR readiness_status IS NULL 
       OR readiness_updated_at IS NULL;
       
  ELSIF p_mode = 'stale_or_missing' THEN
    SELECT COUNT(*)
    INTO result
    FROM bottles
    WHERE (readiness_score IS NULL 
           OR readiness_status IS NULL 
           OR readiness_updated_at IS NULL)
       OR (readiness_version IS NULL OR readiness_version != p_current_version);
       
  ELSIF p_mode = 'force_all' THEN
    SELECT COUNT(*)
    INTO result
    FROM bottles;
    
  ELSE
    result := 0;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION count_bottles_needing_readiness TO authenticated;

-- ============================================
-- Comments
-- ============================================

COMMENT ON COLUMN bottles.readiness_confidence IS 'Confidence in readiness calculation: low, med, high';
COMMENT ON COLUMN bottles.readiness_reasons IS 'Array of short explanations for readiness status';
COMMENT ON COLUMN bottles.readiness_version IS 'Version of readiness algorithm used';
COMMENT ON COLUMN bottles.readiness_updated_at IS 'When readiness was last computed';

COMMENT ON TABLE readiness_backfill_jobs IS 'Tracks global readiness backfill jobs (admin-triggered)';
COMMENT ON COLUMN readiness_backfill_jobs.mode IS 'Backfill mode: missing_only, stale_or_missing, or force_all';
COMMENT ON COLUMN readiness_backfill_jobs.cursor IS 'Last processed bottle ID for resumability';
COMMENT ON COLUMN readiness_backfill_jobs.failures IS 'Array of failed bottles: [{bottle_id, reason}]';
