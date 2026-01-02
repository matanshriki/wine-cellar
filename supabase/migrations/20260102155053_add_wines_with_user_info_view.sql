-- Create a view that shows wines with user information
-- This makes it easier to see who owns each wine in the database

-- Drop the view if it already exists
DROP VIEW IF EXISTS public.wines_with_user_info;

-- Create the view
CREATE VIEW public.wines_with_user_info 
WITH (security_invoker = true)
AS
SELECT 
  w.id,
  w.wine_name,
  w.producer,
  w.vintage,
  w.region,
  w.country,
  w.color,
  w.grapes,
  w.rating,
  w.vivino_url,
  w.image_url,
  w.regional_wine_style,
  w.user_id,
  -- User information from profiles
  p.display_name as user_display_name,
  p.email as user_email,
  p.first_name as user_first_name,
  p.last_name as user_last_name,
  -- Timestamps
  w.created_at,
  w.updated_at
FROM 
  public.wines w
LEFT JOIN 
  public.profiles p ON w.user_id = p.id
ORDER BY 
  w.created_at DESC;

-- Grant access to authenticated users
GRANT SELECT ON public.wines_with_user_info TO authenticated;

-- Add comment explaining the view
COMMENT ON VIEW public.wines_with_user_info IS 'Wine catalog with user information for easier database browsing';
