-- Add feature flags to profiles table
-- These flags control access to beta features in production

-- Step 1: Add columns for feature flags (this should work regardless of schema)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS can_share_cellar BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_multi_bottle_import BOOLEAN DEFAULT FALSE;

-- Step 2: Add helpful comments
COMMENT ON COLUMN profiles.can_share_cellar IS 'Feature flag: Allow user to share their cellar (beta feature)';
COMMENT ON COLUMN profiles.can_multi_bottle_import IS 'Feature flag: Allow user to import multiple bottles from one photo (beta feature)';

-- Step 3: Create index for faster lookups
-- NOTE: Replace 'id' with your actual primary key column name if different
-- Common names: id, user_id, profile_id
-- Run CHECK_PROFILES_SCHEMA.sql first to see your column names if unsure
CREATE INDEX IF NOT EXISTS idx_profiles_feature_flags 
ON profiles(id, can_share_cellar, can_multi_bottle_import);

-- ============================================================
-- DONE! The columns are now added.
-- ============================================================

-- Next steps: Enable features for specific users
-- (Run these commands separately after checking your schema)

-- Example 1: Enable for a specific user by ID
-- UPDATE profiles SET can_share_cellar = TRUE, can_multi_bottle_import = TRUE 
-- WHERE id = 'your-user-id-here';

-- Example 2: Enable for yourself by email (adjust column names as needed)
-- UPDATE profiles 
-- SET can_share_cellar = TRUE, can_multi_bottle_import = TRUE 
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');

-- Example 3: Enable for all users (testing only)
-- UPDATE profiles SET can_share_cellar = TRUE, can_multi_bottle_import = TRUE;

-- Check which users have features enabled:
-- SELECT id, display_name, can_share_cellar, can_multi_bottle_import 
-- FROM profiles 
-- WHERE can_share_cellar = TRUE OR can_multi_bottle_import = TRUE;

