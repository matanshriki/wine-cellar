-- Add AI-Generated Label Image Support
-- Stores metadata about AI-generated label-style artwork for bottles without real photos
-- LEGAL: Generated images are ORIGINAL artwork, not scraped or copied from any source

-- Add columns to wines table for generated label art
ALTER TABLE public.wines
ADD COLUMN IF NOT EXISTS generated_image_path TEXT,
ADD COLUMN IF NOT EXISTS generated_image_prompt_hash TEXT,
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS wines_generated_image_path_idx 
ON public.wines(generated_image_path) 
WHERE generated_image_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS wines_generated_at_idx 
ON public.wines(generated_at) 
WHERE generated_at IS NOT NULL;

-- Add comments explaining the columns
COMMENT ON COLUMN public.wines.generated_image_path IS 'Storage path to AI-generated label-style artwork (original, not scraped)';
COMMENT ON COLUMN public.wines.generated_image_prompt_hash IS 'Hash of generation prompt for idempotency - prevents regenerating identical images';
COMMENT ON COLUMN public.wines.generated_at IS 'Timestamp when label art was generated';

-- Add check constraint to ensure at least one image source
-- (Either user-provided image_url OR generated_image_path, but not required)
-- This is informational only, no hard constraint
COMMENT ON TABLE public.wines IS 'Wine catalog. Images: image_url (user-provided) preferred, generated_image_path (AI-generated) as fallback';




