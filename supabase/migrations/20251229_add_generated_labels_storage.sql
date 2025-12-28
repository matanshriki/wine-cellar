-- Create storage bucket for AI-generated label art
-- LEGAL: Stores ORIGINAL AI-generated artwork only, no scraped content

-- Create bucket for generated labels
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-labels', 'generated-labels', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Users can INSERT their own generated labels
CREATE POLICY "Users can upload their own generated labels"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-labels' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can UPDATE their own generated labels  
CREATE POLICY "Users can update their own generated labels"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'generated-labels'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can DELETE their own generated labels
CREATE POLICY "Users can delete their own generated labels"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-labels'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Anyone can SELECT generated labels (public bucket)
CREATE POLICY "Anyone can view generated labels"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'generated-labels');

