-- Add label image storage fields
-- Stores reference to uploaded label photos for bottles

-- Add label_image_url to bottles table
ALTER TABLE bottles
ADD COLUMN IF NOT EXISTS label_image_url TEXT;

-- Add label_image_url to wines table (optional, for catalog)
ALTER TABLE wines
ADD COLUMN IF NOT EXISTS label_image_url TEXT;

-- Create storage bucket for label images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'labels',
  'labels',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for labels bucket
CREATE POLICY "Users can upload their own label images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'labels' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own label images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'labels' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own label images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'labels' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own label images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'labels' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone can read label images (public bucket)
CREATE POLICY "Public label images are readable by all"
ON storage.objects FOR SELECT
USING (bucket_id = 'labels');

-- Add comments
COMMENT ON COLUMN bottles.label_image_url IS 'URL to uploaded label photo in Supabase Storage';
COMMENT ON COLUMN wines.label_image_url IS 'URL to wine label photo';

