-- Migration: Add wishlist_enabled feature flag to profiles table
-- Date: 2024-01-10
-- Description: Adds per-user feature flag for Wishlist feature

-- Step 1: Add the column with default false
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS wishlist_enabled BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Create an index for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_profiles_wishlist_enabled 
ON profiles(wishlist_enabled) 
WHERE wishlist_enabled = true;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN profiles.wishlist_enabled IS 
'Feature flag: enables Wishlist feature for this user. Default: false. Toggle in Supabase to enable for specific users.';

-- Step 4: Verify RLS is enabled on profiles table (should already exist)
-- The existing RLS policies should ensure users can only read their own profile
-- No additional RLS changes needed - users already can SELECT their own row

-- Verification query (run manually in Supabase SQL editor to check):
-- SELECT id, email, wishlist_enabled FROM profiles LIMIT 10;

