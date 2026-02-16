-- Add theme_preference column to profiles table
-- This allows users to persist their light/dark theme choice

-- Add column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS theme_preference TEXT 
DEFAULT 'light' 
CHECK (theme_preference IN ('light', 'dark'));

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_theme_preference 
ON profiles(theme_preference);

-- Add comment for documentation
COMMENT ON COLUMN profiles.theme_preference IS 
'User theme preference: light (default) or dark mode';
