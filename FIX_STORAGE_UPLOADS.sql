-- ============================================
-- STORAGE UPLOADS FIX
-- ============================================
-- This script fixes RLS policy errors for avatar and bottle image uploads
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
--
-- Symptoms fixed:
-- - "new row violates row-level security policy"
-- - "StorageApiError" on avatar upload
-- - "Failed to upload image" on bottle label scan
--
-- ============================================

-- Step 1: Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies (if any) to avoid conflicts
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own label images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own label images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own label images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own label images" ON storage.objects;
DROP POLICY IF EXISTS "Public label images are readable by all" ON storage.objects;

-- ============================================
-- AVATARS BUCKET
-- ============================================

-- Create avatars bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- Public bucket for easier access
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- RLS Policies for avatars bucket
-- Path format: avatars/{user_id}/avatar.jpg

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow anyone to read avatars (public bucket)
CREATE POLICY "Anyone can read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================
-- LABELS BUCKET (Bottle Images)
-- ============================================

-- Create labels bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'labels',
  'labels',
  true,  -- Public bucket for easier access
  10485760,  -- 10MB limit (larger for high-res label photos)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- RLS Policies for labels bucket
-- Path format: labels/{user_id}/{uuid}.jpg

-- Allow authenticated users to upload their own label images
CREATE POLICY "Users can upload their own label images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'labels'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own label images
CREATE POLICY "Users can read their own label images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'labels'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow anyone to read label images (public bucket)
CREATE POLICY "Public label images are readable by all"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'labels');

-- Allow users to update their own label images
CREATE POLICY "Users can update their own label images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'labels'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'labels'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own label images
CREATE POLICY "Users can delete their own label images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'labels'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify everything is set up:

-- 1. Check buckets exist
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id IN ('avatars', 'labels');

-- Expected output:
-- avatars | avatars | true | 5242880
-- labels  | labels  | true | 10485760

-- 2. Check RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Expected: rowsecurity = true

-- 3. Check policies exist
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- Expected: 9 policies (4 for avatars, 5 for labels)

-- ============================================
-- DONE!
-- ============================================
-- After running this script:
-- 1. Avatar uploads should work
-- 2. Bottle image uploads should work
-- 3. No more "row-level security policy" errors
--
-- Test in your app:
-- - Profile page: Upload avatar
-- - Add Bottle: Upload photo (scan label)
--
-- If you still get errors, check:
-- - Is the user authenticated? (supabase.auth.getSession())
-- - Is the user ID in the file path? ({userId}/filename.jpg)
-- - Check browser console for detailed error messages
-- ============================================



