-- =====================================================
-- Migration: Add Theme Preference to Profiles
-- Purpose: Store user's preferred theme (white/red)
-- =====================================================

-- Add theme_preference column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'white' CHECK (theme_preference IN ('white', 'red'));

-- Add index for theme queries (optional, for analytics)
CREATE INDEX IF NOT EXISTS idx_profiles_theme_preference 
ON profiles (theme_preference);

-- Add comment
COMMENT ON COLUMN profiles.theme_preference IS 'User theme preference: white (light) or red (luxury dark)';

-- RLS is already enabled on profiles table, no changes needed
-- Users can read/update their own theme_preference through existing policies
