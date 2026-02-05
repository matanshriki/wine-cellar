-- =====================================================
-- Migration: Migrate admin table to profiles.is_admin
-- Purpose: Consolidate admin status into profiles table
--          and preserve existing is_admin() functionality
-- =====================================================

-- 1) Add is_admin column to profiles table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean DEFAULT false;
    
    -- Add index for admin queries
    CREATE INDEX idx_profiles_is_admin ON profiles (is_admin) WHERE is_admin = true;
    
    RAISE NOTICE 'Added is_admin column to profiles table';
  ELSE
    RAISE NOTICE 'is_admin column already exists in profiles table';
  END IF;
END $$;

-- 2) Migrate data from admins table to profiles.is_admin
-- Set is_admin = true for all users in the admins table
UPDATE profiles
SET is_admin = true
WHERE id IN (SELECT user_id FROM public.admins);

-- Log how many admins were migrated
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.admins;
  RAISE NOTICE 'Migrated % admin users to profiles.is_admin', admin_count;
END $$;

-- 3) Update the is_admin() RPC function to check profiles.is_admin
-- This maintains backwards compatibility with existing code
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  -- First check profiles.is_admin (new way)
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = check_user_id 
    AND is_admin = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Fallback: check admins table (old way, for safety during migration)
  IF EXISTS (
    SELECT 1 FROM public.admins 
    WHERE user_id = check_user_id
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant usage (in case it was revoked)
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;

-- 4) Add RLS policies for profiles.is_admin
-- Allow users to read their own is_admin status
-- (The existing profiles SELECT policy should cover this, but let's be explicit)

-- 5) Create a trigger to keep admins table in sync (temporary, for safety)
-- This ensures if someone adds to admins table, it updates profiles too
CREATE OR REPLACE FUNCTION sync_admin_to_profiles()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- When someone is added to admins table, set is_admin = true in profiles
    UPDATE profiles SET is_admin = true WHERE id = NEW.user_id;
    RAISE NOTICE 'Synced new admin % to profiles', NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- When someone is removed from admins table, set is_admin = false in profiles
    UPDATE profiles SET is_admin = false WHERE id = OLD.user_id;
    RAISE NOTICE 'Removed admin status for % in profiles', OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on admins table
DROP TRIGGER IF EXISTS sync_admin_to_profiles_trigger ON public.admins;
CREATE TRIGGER sync_admin_to_profiles_trigger
AFTER INSERT OR DELETE ON public.admins
FOR EACH ROW
EXECUTE FUNCTION sync_admin_to_profiles();

-- =====================================================
-- Optional: Drop admins table after confirming everything works
-- =====================================================

-- UNCOMMENT THESE LINES AFTER TESTING:
-- -- Drop the sync trigger first
-- DROP TRIGGER IF EXISTS sync_admin_to_profiles_trigger ON public.admins;
-- DROP FUNCTION IF EXISTS sync_admin_to_profiles();
-- 
-- -- Drop the admins table
-- DROP TABLE IF EXISTS public.admins CASCADE;
-- 
-- -- Update is_admin() function to only check profiles
-- CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
-- RETURNS BOOLEAN AS $$
-- BEGIN
--   RETURN EXISTS (
--     SELECT 1 FROM public.profiles 
--     WHERE id = check_user_id 
--     AND is_admin = true
--   );
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON COLUMN profiles.is_admin IS 'Admin users can access admin tools and run backfill jobs. Migrated from admins table.';

-- =====================================================
-- Verification queries
-- =====================================================

-- Check migration success:
-- SELECT p.id, p.email, p.is_admin, a.user_id as in_admins_table
-- FROM profiles p
-- LEFT JOIN admins a ON a.user_id = p.id
-- WHERE p.is_admin = true OR a.user_id IS NOT NULL;

-- Test is_admin() function:
-- SELECT is_admin(auth.uid());
