-- Check user info and recent activity
-- User ID: 38effa6f-df61-45ad-9862-beb7ffeb362c

-- 1. Check user profile
SELECT 
  id,
  email,
  display_name,
  preferred_language,
  created_at as user_joined_at,
  cookie_consent_given,
  analytics_enabled
FROM public.profiles
WHERE id = '38effa6f-df61-45ad-9862-beb7ffeb362c';

-- 2. Check user's bottles (recent activity)
SELECT 
  b.id,
  b.created_at,
  b.image_url,
  w.wine_name,
  w.producer
FROM public.bottles b
LEFT JOIN public.wines w ON b.wine_id = w.id
WHERE b.user_id = '38effa6f-df61-45ad-9862-beb7ffeb362c'
ORDER BY b.created_at DESC
LIMIT 10;

-- 3. Check if any bottles were created in last hour
SELECT 
  COUNT(*) as bottles_added_last_hour,
  MAX(created_at) as most_recent_bottle
FROM public.bottles
WHERE user_id = '38effa6f-df61-45ad-9862-beb7ffeb362c'
  AND created_at > NOW() - INTERVAL '1 hour';

