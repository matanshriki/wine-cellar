-- Enable Multi-Bottle Import for Specific User
-- Run this in Supabase SQL Editor to enable multi-bottle import for a user

-- Option 1: Enable by email
UPDATE public.profiles
SET can_multi_bottle_import = true
WHERE email = 'user@example.com';

-- Option 2: Enable by user ID
UPDATE public.profiles
SET can_multi_bottle_import = true
WHERE id = 'user-uuid-here';

-- Option 3: Enable for all users (use with caution!)
-- UPDATE public.profiles
-- SET can_multi_bottle_import = true;

-- Verify the change
SELECT 
  id,
  display_name,
  email,
  can_multi_bottle_import,
  can_share_cellar
FROM public.profiles
WHERE can_multi_bottle_import = true;
