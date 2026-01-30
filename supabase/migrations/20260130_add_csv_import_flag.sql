-- Add CSV Import Feature Flag to Profiles
-- This allows us to enable CSV import for specific users only
-- Most users don't use CSV import, so we'll keep it disabled by default

-- Add csv_import_enabled column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS csv_import_enabled BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.csv_import_enabled IS 
'Feature flag: Enables CSV import button for this user. Default: false (disabled for most users)';

-- Optional: Enable CSV import for admin users or early adopters
-- Uncomment and replace 'admin@example.com' with actual admin emails
/*
UPDATE public.profiles
SET csv_import_enabled = true
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('admin@example.com', 'power-user@example.com')
);
*/

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'csv_import_enabled';

-- Show sample data (should all be false by default)
SELECT 
  id,
  display_name,
  csv_import_enabled,
  created_at
FROM public.profiles
LIMIT 5;
