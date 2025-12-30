-- Add per-user AI label art feature flag
-- FIXED: Uses 'profiles' table (not 'user_profiles')

-- Add column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_label_art_enabled BOOLEAN DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS profiles_ai_label_art_enabled_idx 
ON public.profiles(ai_label_art_enabled) 
WHERE ai_label_art_enabled = true;

-- Add comment explaining the column
COMMENT ON COLUMN public.profiles.ai_label_art_enabled IS 
'Per-user feature flag for AI-generated label art. Enables "Generate Label Art" button. Default false (opt-in).';

-- Optional: Enable for specific admin users
-- UPDATE public.profiles 
-- SET ai_label_art_enabled = true 
-- WHERE email = 'your-admin-email@example.com';


