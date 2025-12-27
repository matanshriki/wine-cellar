-- ============================================================================
-- CLEAR DATABASE - Remove all wine/bottle/history data, keep users
-- ============================================================================
-- 
-- This script deletes all wine-related data while preserving:
-- - Users (auth.users)
-- - User profiles (profiles table)
--
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/editor
-- ============================================================================

-- Step 1: Delete consumption history (opened bottles)
-- Must delete first due to foreign key constraint to bottles
DELETE FROM public.consumption_history;

-- Step 2: Delete recommendation runs
DELETE FROM public.recommendation_runs;

-- Step 3: Delete all bottles (user inventory)
DELETE FROM public.bottles;

-- Step 4: Delete all wines (wine catalog)
DELETE FROM public.wines;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check remaining data counts:
SELECT 
  (SELECT COUNT(*) FROM public.wines) as wines_count,
  (SELECT COUNT(*) FROM public.bottles) as bottles_count,
  (SELECT COUNT(*) FROM public.consumption_history) as history_count,
  (SELECT COUNT(*) FROM public.recommendation_runs) as recommendations_count,
  (SELECT COUNT(*) FROM public.profiles) as profiles_count;

-- Expected result:
-- wines_count: 0
-- bottles_count: 0
-- history_count: 0
-- recommendations_count: 0
-- profiles_count: [your user count] (should NOT be 0)

-- ============================================================================
-- RESET AUTO-INCREMENT SEQUENCES (OPTIONAL)
-- ============================================================================
-- Uncomment if you want to reset ID sequences back to 1:

-- ALTER SEQUENCE IF EXISTS wines_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS bottles_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS consumption_history_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS recommendation_runs_id_seq RESTART WITH 1;

-- ============================================================================
-- WHAT IS PRESERVED
-- ============================================================================
-- ✅ Users (auth.users table)
-- ✅ User profiles (profiles table)
-- ✅ Profile avatars (avatars storage bucket)
-- ✅ Database schema (tables, RLS policies, triggers)

-- ============================================================================
-- WHAT IS DELETED
-- ============================================================================
-- ❌ All wines
-- ❌ All bottles
-- ❌ All consumption history
-- ❌ All recommendation runs
-- ❌ Label images (optional - see below)

-- ============================================================================
-- OPTIONAL: CLEAR STORAGE BUCKETS
-- ============================================================================
-- If you also want to delete uploaded label images:

-- List all files in labels bucket:
-- SELECT * FROM storage.objects WHERE bucket_id = 'labels';

-- Delete all label images:
-- DELETE FROM storage.objects WHERE bucket_id = 'labels';

-- Note: Avatar images in 'avatars' bucket are preserved (users keep their profile pics)


