-- Migration: Add cellar_agent_enabled flag to profiles
-- Purpose: Feature flag for Cellar Sommelier (AI chat assistant)
-- Date: 2026-01-11

-- Add the feature flag column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS cellar_agent_enabled boolean NOT NULL DEFAULT false;

-- Add index for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_profiles_cellar_agent_enabled 
ON profiles(cellar_agent_enabled) 
WHERE cellar_agent_enabled = true;

-- Verify RLS is in place (should already exist from previous migrations)
-- Users can only read their own profile
-- No changes needed if RLS already exists

-- Add comment for documentation
COMMENT ON COLUMN profiles.cellar_agent_enabled IS 
'Feature flag: Enable Cellar Sommelier AI assistant for this user';

