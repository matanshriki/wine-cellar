-- Fix Security Definer View Issue
-- Issue: bottles_with_wine_info view flagged as SECURITY DEFINER
-- Solution: Explicitly recreate view WITHOUT SECURITY DEFINER to rely on RLS

-- Drop the existing view
DROP VIEW IF EXISTS public.bottles_with_wine_info;

-- Recreate the view WITHOUT SECURITY DEFINER
-- This will use SECURITY INVOKER (default), which means:
-- 1. It respects RLS policies on underlying tables
-- 2. Users only see data they have permission to access
-- 3. No privilege escalation risk
CREATE VIEW public.bottles_with_wine_info
WITH (security_invoker = true)
AS
SELECT 
  b.id,
  b.user_id,
  b.wine_id,
  b.quantity,
  b.purchase_date,
  b.purchase_price,
  b.purchase_location,
  b.storage_location,
  b.bottle_size_ml,
  b.notes,
  b.image_url,
  b.tags,
  b.opened_at,
  b.created_at,
  b.updated_at,
  -- Wine information
  w.producer,
  w.wine_name,
  w.vintage,
  w.country,
  w.region,
  w.regional_wine_style,
  w.appellation,
  w.color,
  w.grapes,
  w.vivino_wine_id,
  w.vivino_url,
  w.rating,
  w.image_url as wine_image_url,
  w.notes as wine_notes,
  w.generated_image_path,
  w.generated_image_prompt_hash,
  w.generated_at
FROM public.bottles b
JOIN public.wines w ON b.wine_id = w.id;

-- Grant SELECT permission to authenticated users
-- RLS policies on bottles and wines tables will enforce data access
GRANT SELECT ON public.bottles_with_wine_info TO authenticated;

-- Add comment explaining security model
COMMENT ON VIEW public.bottles_with_wine_info IS 
'View combining bottles and wines data. Uses security_invoker=true to enforce RLS policies from underlying tables (bottles, wines). Users can only see their own data through RLS.';

