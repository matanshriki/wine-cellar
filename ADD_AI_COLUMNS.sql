-- Add columns for AI-generated label art to wines table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/editor

ALTER TABLE public.wines 
ADD COLUMN IF NOT EXISTS generated_image_path TEXT,
ADD COLUMN IF NOT EXISTS generated_image_prompt_hash TEXT,
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS wines_generated_image_path_idx ON public.wines(generated_image_path);
CREATE INDEX IF NOT EXISTS wines_generated_image_prompt_hash_idx ON public.wines(generated_image_prompt_hash);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'wines' 
  AND column_name IN ('generated_image_path', 'generated_image_prompt_hash', 'generated_at');



