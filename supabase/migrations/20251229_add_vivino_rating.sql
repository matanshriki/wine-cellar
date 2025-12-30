-- Add Vivino rating and URL to wines table
-- This allows storing ratings from Vivino CSV imports and linking back to Vivino pages

ALTER TABLE public.wines
ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1) CHECK (rating >= 0 AND rating <= 5),
ADD COLUMN IF NOT EXISTS vivino_url TEXT;

-- Add index for rating (useful for sorting/filtering by rating)
CREATE INDEX IF NOT EXISTS wines_rating_idx ON public.wines(rating) WHERE rating IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.wines.rating IS 'Vivino community rating (0-5 stars)';
COMMENT ON COLUMN public.wines.vivino_url IS 'Link to wine page on Vivino.com';


