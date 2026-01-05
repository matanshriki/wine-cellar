-- Fix AI Label Art Storage Bucket
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/editor

-- Create storage bucket for AI-generated labels
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-labels', 'generated-labels', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Allow authenticated users to INSERT their own images
CREATE POLICY "Users can upload own generated labels"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-labels' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Allow authenticated users to UPDATE their own images
CREATE POLICY "Users can update own generated labels"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'generated-labels'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Allow authenticated users to DELETE their own images
CREATE POLICY "Users can delete own generated labels"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-labels'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Allow everyone to view generated labels (public bucket)
CREATE POLICY "Anyone can view generated labels"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'generated-labels');

-- Verify bucket was created
SELECT * FROM storage.buckets WHERE id = 'generated-labels';




