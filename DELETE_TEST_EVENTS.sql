-- DELETE TEST EVENTS
-- Run this AFTER you're done testing to clean up the database
-- This removes all test events and their user states

-- =============================================================================
-- STEP 1: DELETE USER EVENT STATES FOR TEST EVENTS
-- =============================================================================

-- This ensures no orphaned records in user_event_states table
DELETE FROM public.user_event_states
WHERE event_id IN (
  SELECT id FROM public.wine_events WHERE name LIKE '%TEST%'
);

-- =============================================================================
-- STEP 2: DELETE TEST EVENTS
-- =============================================================================

DELETE FROM public.wine_events 
WHERE name LIKE '%TEST%' OR name LIKE '%🧪%';

-- Alternative: Delete by specific name if you want to be more precise
-- DELETE FROM public.wine_events WHERE name = '🧪 TEST Event 1 - International Syrah Day';
-- DELETE FROM public.wine_events WHERE name = '🧪 TEST Event 2 - International Chardonnay Day';

-- =============================================================================
-- STEP 3: VERIFY TEST EVENTS WERE DELETED
-- =============================================================================

-- This should return 0 rows
SELECT 
  id,
  name, 
  date
FROM public.wine_events 
WHERE name LIKE '%TEST%' OR name LIKE '%🧪%';

-- Expected result: No rows (empty result set)

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

SELECT 
  '✅ Test events deleted successfully!' as message,
  'You can now hard refresh your app (Cmd + Shift + R)' as next_step,
  'The banner should disappear (no active events)' as expected_result;

-- =============================================================================
-- BONUS: RESTORE REAL EVENTS (if you deleted them by mistake)
-- =============================================================================

-- If you accidentally deleted real events, restore them by re-running:
-- /Users/matanshr/Desktop/Projects/Playground/wine/supabase/seed.sql
-- This will re-insert the WSET 2026 calendar events
