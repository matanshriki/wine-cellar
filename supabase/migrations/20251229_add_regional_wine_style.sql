-- Add regional_wine_style column to wines table
-- This column stores wine classification/style information (e.g., "Bordeaux Blend", "Super Tuscan", "Rioja Reserva")
-- Separate from the geographic "region" field to distinguish style from location

ALTER TABLE public.wines
ADD COLUMN IF NOT EXISTS regional_wine_style TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS wines_regional_wine_style_idx 
ON public.wines(regional_wine_style) 
WHERE regional_wine_style IS NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.wines.regional_wine_style IS 'Wine style classification (e.g., "Bordeaux Blend", "Super Tuscan", "Rioja Reserva") - distinct from geographic region';


