-- Add plan_evening_enabled feature flag to profiles
-- Enables/disables "Plan an evening" luxury planner feature
-- Default: false (opt-in feature)

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_evening_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add index for faster queries when filtering by this flag
CREATE INDEX IF NOT EXISTS profiles_plan_evening_enabled_idx 
ON public.profiles(plan_evening_enabled) 
WHERE plan_evening_enabled = true;

-- Add comment
COMMENT ON COLUMN public.profiles.plan_evening_enabled IS 'Feature flag: enables Plan an evening luxury planner';
