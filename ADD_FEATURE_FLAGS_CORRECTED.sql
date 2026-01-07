-- Add feature flags to profiles table
-- These flags control access to beta features in production

-- Add columns for feature flags
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS can_share_cellar BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_multi_bottle_import BOOLEAN DEFAULT FALSE;

-- Add helpful comment
COMMENT ON COLUMN profiles.can_share_cellar IS 'Feature flag: Allow user to share their cellar (beta feature)';
COMMENT ON COLUMN profiles.can_multi_bottle_import IS 'Feature flag: Allow user to import multiple bottles from one photo (beta feature)';

-- Create index for faster feature flag lookups (using 'id' not 'user_id')
CREATE INDEX IF NOT EXISTS idx_profiles_feature_flags 
ON profiles(id, can_share_cellar, can_multi_bottle_import);

-- Example: Enable for specific users (update these ids as needed)
-- UPDATE profiles SET can_share_cellar = TRUE WHERE id = 'your-user-id-here';
-- UPDATE profiles SET can_multi_bottle_import = TRUE WHERE id = 'your-user-id-here';

-- To enable for all existing users (if you want to test):
-- UPDATE profiles SET can_share_cellar = TRUE, can_multi_bottle_import = TRUE;

-- To check which users have features enabled:
-- SELECT id, display_name, can_share_cellar, can_multi_bottle_import FROM profiles WHERE can_share_cellar = TRUE OR can_multi_bottle_import = TRUE;

