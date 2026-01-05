-- ============================================
-- ADD VIVINO RATING TO YOUR DATABASE
-- ============================================
-- Run this in Supabase SQL Editor RIGHT NOW
-- https://supabase.com/dashboard → Your Project → SQL Editor
-- ============================================

-- Add rating and vivino_url columns to wines table
ALTER TABLE public.wines
ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1) CHECK (rating >= 0 AND rating <= 5),
ADD COLUMN IF NOT EXISTS vivino_url TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS wines_rating_idx ON public.wines(rating) WHERE rating IS NOT NULL;

-- Verify it worked:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'wines' AND column_name IN ('rating', 'vivino_url');

-- Should show:
-- rating      | numeric
-- vivino_url  | text




