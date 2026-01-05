-- ============================================
-- SIMPLE STORAGE FIX - Run this in Supabase SQL Editor
-- ============================================
-- This script creates storage buckets and RLS policies for uploads
-- If you get permission errors, use the UI method instead (FIX_STORAGE_UI_METHOD.md)
-- ============================================

-- Step 1: Create the buckets (this should work for everyone)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']),
  ('labels', 'labels', true, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Step 2: Create policies for avatars bucket
-- Note: If these fail with "must be owner" error, use the UI method instead

-- Clean up existing policies first (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read avatars" ON storage.objects;

-- Avatar policies
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Step 3: Clean up existing label policies
DROP POLICY IF EXISTS "Users can upload their own label images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own label images" ON storage.objects;
DROP POLICY IF EXISTS "Public label images are readable by all" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own label images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own label images" ON storage.objects;

-- Label policies
CREATE POLICY "Users can upload their own label images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'labels' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own label images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'labels' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public label images are readable by all"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'labels');

CREATE POLICY "Users can update their own label images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'labels' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'labels' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own label images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'labels' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these queries to verify everything worked:

-- Check buckets exist:
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id IN ('avatars', 'labels');

-- Check policies exist (should show 9 policies):
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- ============================================
-- DONE!
-- ============================================
-- If you got "Success. No rows returned" and the verification queries show results,
-- then everything worked!
--
-- If you got "must be owner of table objects" error:
-- → Use the UI method instead: Open FIX_STORAGE_UI_METHOD.md
-- → The UI method is actually easier and doesn't require SQL knowledge
-- ============================================




