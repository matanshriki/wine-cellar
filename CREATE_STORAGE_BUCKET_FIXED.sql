-- Create storage bucket for AI-generated labels (FIXED - No IF NOT EXISTS for policies)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/editor

-- Step 1: Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-labels', 'generated-labels', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Drop existing policies (if any) to avoid conflicts
DROP POLICY IF EXISTS "Users can upload own generated labels" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own generated labels" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own generated labels" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view generated labels" ON storage.objects;

-- Step 3: Create RLS policies

-- Allow authenticated users to upload their own images
CREATE POLICY "Users can upload own generated labels"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-labels' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update own generated labels"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'generated-labels'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete own generated labels"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-labels'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow everyone to view generated labels (public bucket)
CREATE POLICY "Anyone can view generated labels"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'generated-labels');

-- Step 4: Verify bucket was created
SELECT id, name, public FROM storage.buckets WHERE id = 'generated-labels';



