-- Reset Wine Event State for Testing
-- This clears the "shown today" flag so the event banner can appear again
-- Run this in Supabase SQL Editor when testing the Wine World Moments feature

-- Option 1: Clear ALL user event states (all users can see events again)
-- TRUNCATE public.user_event_states;

-- Option 2: Clear event states for YOUR user only (recommended for testing)
-- Replace YOUR_USER_ID with your actual user ID from auth.users table
DELETE FROM public.user_event_states
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'your-email@example.com' -- Replace with your email
);

-- Option 3: Clear state for a specific event only
-- DELETE FROM public.user_event_states
-- WHERE event_id = 'event-uuid-here';

-- Verify it's cleared
SELECT * FROM public.user_event_states
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'your-email@example.com' -- Replace with your email
);

-- After running this, hard refresh your app (Cmd + Shift + R) and the banner should appear!
