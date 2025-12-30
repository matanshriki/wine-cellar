-- Add cookie consent tracking to profiles table
-- Run this migration in Supabase SQL Editor

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cookie_consent_given BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cookie_consent_date TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS analytics_enabled BOOLEAN DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_cookie_consent 
ON public.profiles(cookie_consent_given);

-- Add comment
COMMENT ON COLUMN public.profiles.cookie_consent_given IS 'Whether user has given consent for cookies (NULL = not asked yet, TRUE = accepted, FALSE = rejected)';
COMMENT ON COLUMN public.profiles.cookie_consent_date IS 'When user gave or rejected consent';
COMMENT ON COLUMN public.profiles.analytics_enabled IS 'Whether user has opted in to analytics tracking';

