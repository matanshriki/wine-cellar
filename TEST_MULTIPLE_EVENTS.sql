-- TEST MULTIPLE EVENTS (FOR CAROUSEL TESTING)
-- This script adds 2 test events for the same day to test the carousel feature
-- Run this in your Supabase SQL Editor

-- =============================================================================
-- STEP 1: ADD TWO TEST EVENTS FOR TODAY
-- =============================================================================

-- Event 1: Syrah Day (matches Syrah/Shiraz bottles)
INSERT INTO public.wine_events (
  name,
  date,
  tags,
  type,
  description_short,
  source_name,
  source_url
) VALUES (
  '🧪 TEST Event 1 - International Syrah Day',
  CURRENT_DATE, -- Today
  ARRAY['syrah', 'shiraz', 'red'], -- Tags to match your Syrah bottles
  'grape',
  'Celebrate the bold and spicy Syrah grape from around the world!',
  'Wine Cellar Brain (Test)',
  'https://www.wsetglobal.com/knowledge-centre/blog/2025/wine-and-grape-days-2026/'
)
ON CONFLICT DO NOTHING;

-- Event 2: Chardonnay Day (matches Chardonnay bottles)
INSERT INTO public.wine_events (
  name,
  date,
  tags,
  type,
  description_short,
  source_name,
  source_url
) VALUES (
  '🧪 TEST Event 2 - International Chardonnay Day',
  CURRENT_DATE, -- Today (same day as Event 1!)
  ARRAY['chardonnay', 'white'], -- Tags to match your Chardonnay bottles
  'grape',
  'Celebrate the world''s most popular white wine grape!',
  'Wine Cellar Brain (Test)',
  'https://www.wsetglobal.com/knowledge-centre/blog/2025/wine-and-grape-days-2026/'
)
ON CONFLICT DO NOTHING;

-- Optional: Event 3 - Malbec Day (if you want to test 3 events)
-- Uncomment the block below to add a third event
/*
INSERT INTO public.wine_events (
  name,
  date,
  tags,
  type,
  description_short,
  source_name,
  source_url
) VALUES (
  '🧪 TEST Event 3 - International Malbec Day',
  CURRENT_DATE,
  ARRAY['malbec', 'red'],
  'grape',
  'Celebrate Argentina''s signature grape variety!',
  'Wine Cellar Brain (Test)',
  'https://www.wsetglobal.com/knowledge-centre/blog/2025/wine-and-grape-days-2026/'
)
ON CONFLICT DO NOTHING;
*/

-- =============================================================================
-- STEP 2: VERIFY TEST EVENTS WERE ADDED
-- =============================================================================

SELECT 
  id,
  name, 
  date, 
  tags,
  type,
  description_short,
  CASE 
    WHEN date BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE + INTERVAL '7 days' 
    THEN '✅ ACTIVE NOW (will show in app)'
    ELSE '⏰ Not active (outside window)'
  END as status
FROM public.wine_events 
WHERE name LIKE '%TEST%'
ORDER BY date DESC, name ASC;

-- Expected result: You should see 2 events with "✅ ACTIVE NOW"

-- =============================================================================
-- WHAT TO DO NEXT:
-- =============================================================================

-- 1. Run the INSERT statements above
-- 2. Verify you see 2 events in the results
-- 3. Go to your app and hard refresh (Cmd + Shift + R)
-- 4. You should see the carousel with arrows and dots:
--    - Event 1 (Syrah) with ◀ ▶ arrows
--    - Indicator: • ○ (1/2)
--    - Click ▶ to see Event 2 (Chardonnay)
--    - Auto-rotates every 10 seconds
-- 5. Test dismissing one event → should show only the other
-- 6. Test "Show My Bottles" → should filter by that grape

-- =============================================================================
-- BONUS: CHECK YOUR USER EVENT STATES (to see tracking)
-- =============================================================================

-- Replace 'your-email@example.com' with your actual email
SELECT 
  e.name as event_name,
  e.date as event_date,
  es.seen_at,
  es.last_shown_at,
  es.dismissed_at,
  CASE 
    WHEN es.dismissed_at IS NOT NULL THEN '❌ Dismissed'
    WHEN es.last_shown_at IS NOT NULL THEN '✅ Shown'
    WHEN es.seen_at IS NOT NULL THEN '👀 Seen'
    ELSE '🆕 Not seen yet'
  END as status
FROM public.wine_events e
LEFT JOIN public.user_event_states es ON e.id = es.event_id
LEFT JOIN auth.users u ON es.user_id = u.id
WHERE e.name LIKE '%TEST%'
  AND (u.email = 'your-email@example.com' OR u.email IS NULL)
ORDER BY e.date DESC, e.name ASC;

-- Expected: After viewing in app, you'll see "Shown" status for both events
