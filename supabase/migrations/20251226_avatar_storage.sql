-- ============================================
-- AVATAR STORAGE BUCKET SETUP
-- ============================================
-- Create storage bucket for user avatars

-- Create avatars bucket (public bucket for simplicity)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- Public bucket for easier access
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES FOR AVATARS BUCKET
-- ============================================

-- Allow users to upload their own avatar
-- Path format: avatars/{user_id}/avatar.{ext}
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
-- This allows displaying avatars without auth
CREATE POLICY "Anyone can read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- ============================================
-- NOTES:
-- ============================================
-- 1. Files are stored at: avatars/{user_id}/avatar.{ext}
-- 2. Public URLs: https://{project}.supabase.co/storage/v1/object/public/avatars/{user_id}/avatar.jpg
-- 3. RLS ensures users can only upload/update/delete their own avatars
-- 4. Old avatar files should be deleted when uploading a new one (handled in client code)

