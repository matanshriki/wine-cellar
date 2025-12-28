-- Add AI feature flags to user profiles
-- Allows per-user control of AI-generated label art feature

-- Add column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_label_art_enabled BOOLEAN DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS profiles_ai_label_art_enabled_idx 
ON public.profiles(ai_label_art_enabled) 
WHERE ai_label_art_enabled = true;

-- Add comment explaining the column
COMMENT ON COLUMN public.profiles.ai_label_art_enabled IS 
'Per-user flag: allows this user to generate AI label art. Used for gradual rollout, premium features, or cost control.';

-- Optional: Enable for existing users (comment out if you want to enable manually)
-- UPDATE public.profiles SET ai_label_art_enabled = true WHERE created_at < NOW();

