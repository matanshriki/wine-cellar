-- Enable CSV Import for Specific Users
-- Run this script to grant CSV import permission to specific users

-- Replace 'user@example.com' with the actual user's email
-- You can add multiple emails separated by commas

UPDATE public.profiles
SET csv_import_enabled = true
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN (
    'your-email@example.com',  -- Replace with actual email
    'admin@example.com',        -- Add more emails as needed
    'power-user@example.com'
  )
);

-- Verify the update
SELECT 
  p.id,
  u.email,
  p.display_name,
  p.csv_import_enabled,
  p.updated_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.csv_import_enabled = true
ORDER BY p.updated_at DESC;

-- To disable CSV import for a user:
-- UPDATE public.profiles
-- SET csv_import_enabled = false
-- WHERE id IN (SELECT id FROM auth.users WHERE email = 'user@example.com');
