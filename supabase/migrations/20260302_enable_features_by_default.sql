-- Migration: Enable feature flags by default for new users
-- Date: 2026-03-02
-- Purpose: Change default values for feature flags so new users have features enabled

-- 1. Wishlist - enable by default
ALTER TABLE public.profiles 
ALTER COLUMN wishlist_enabled SET DEFAULT true;

-- 2. Can share cellar - enable by default
ALTER TABLE public.profiles 
ALTER COLUMN can_share_cellar SET DEFAULT true;

-- 3. Plan evening - enable by default
ALTER TABLE public.profiles 
ALTER COLUMN plan_evening_enabled SET DEFAULT true;

-- 4. Cellar agent - enable by default
ALTER TABLE public.profiles 
ALTER COLUMN cellar_agent_enabled SET DEFAULT true;

-- 5. Can multi bottle import - enable by default
ALTER TABLE public.profiles 
ALTER COLUMN can_multi_bottle_import SET DEFAULT true;

-- Note: This migration only affects NEW users signing up after this migration runs.
-- Existing users will keep their current values (false unless manually enabled).
-- To enable for existing users, run:
-- UPDATE public.profiles SET 
--   wishlist_enabled = true,
--   can_share_cellar = true,
--   plan_evening_enabled = true,
--   cellar_agent_enabled = true,
--   can_multi_bottle_import = true
-- WHERE <your_condition>;
