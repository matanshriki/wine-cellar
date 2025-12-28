-- Add per-user AI label art feature flag
-- Allows granular control over who can use AI generation feature

-- Add column to user_profiles table
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS ai_label_art_enabled BOOLEAN DEFAULT false;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS user_profiles_ai_label_art_enabled_idx 
ON public.user_profiles(ai_label_art_enabled) 
WHERE ai_label_art_enabled = true;

-- Add comment explaining the column
COMMENT ON COLUMN public.user_profiles.ai_label_art_enabled IS 
'Per-user feature flag for AI-generated label art. Enables "Generate Label Art" button. Default false (opt-in).';

-- Optional: Enable for specific admin users
-- UPDATE public.user_profiles 
-- SET ai_label_art_enabled = true 
-- WHERE email = 'your-admin-email@example.com';

