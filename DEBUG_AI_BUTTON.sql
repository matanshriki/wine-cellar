-- Debug: Check if AI Label Art is set up correctly

-- Step 1: Check if column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' 
  AND column_name = 'ai_label_art_enabled';
-- Expected: Should show the column exists with BOOLEAN type, default false

-- Step 2: Check your user's flag
SELECT id, email, ai_label_art_enabled, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;
-- Look for your email and check if ai_label_art_enabled is true or false

-- Step 3: If you need to enable it for your user, run this:
-- UPDATE public.profiles 
-- SET ai_label_art_enabled = true 
-- WHERE email = 'YOUR_EMAIL_HERE';
-- Then verify:
-- SELECT email, ai_label_art_enabled FROM public.profiles WHERE email = 'YOUR_EMAIL_HERE';




