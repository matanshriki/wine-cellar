-- ============================================
-- AVATAR STORAGE BUCKET SETUP (Production Fix)
-- ============================================
-- Run this SQL in your Supabase SQL Editor to fix "Bucket not found" error

-- Step 1: Create avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- Public bucket for easier access
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 3: Create storage policies for avatars bucket
-- Allow users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow anyone to read avatars (public bucket)
CREATE POLICY "Anyone can read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this after to verify the bucket was created:
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'avatars';

-- Should return:
-- id: avatars
-- name: avatars
-- public: true
-- file_size_limit: 5242880



