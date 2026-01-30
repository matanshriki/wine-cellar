-- TEST: Simulate a NEW wine event (to verify system works for new events)
-- This creates a DIFFERENT event with a new ID to test that dismissed events don't block new ones
-- Run this in Supabase SQL Editor

-- Add a new test event with different grapes to verify new events appear
INSERT INTO public.wine_events (
  name,
  date,
  tags,
  type,
  description_short,
  source_name,
  source_url
) VALUES (
  '🧪 NEW EVENT - International Chardonnay Day',
  CURRENT_DATE, -- Today
  ARRAY['chardonnay', 'white'], -- Different tags than Syrah event
  'grape',
  'Celebrate the world''s most popular white wine! Time to enjoy your Chardonnay bottles.',
  'Wine Cellar Brain Test',
  'https://www.wsetglobal.com/knowledge-centre/blog/2025/wine-and-grape-days-2026/'
);

-- Verify the new event exists
SELECT 
  id,
  name, 
  date, 
  tags,
  description_short,
  CASE 
    WHEN date BETWEEN CURRENT_DATE - INTERVAL '3 days' AND CURRENT_DATE + INTERVAL '3 days' 
    THEN '✅ ACTIVE NOW'
    ELSE '⏰ Not active'
  END as status
FROM public.wine_events 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- Check your dismissed events (should NOT include this new event ID)
-- Replace with your email to see your dismissals
SELECT 
  e.name,
  es.dismissed_at,
  es.last_shown_at
FROM public.user_event_states es
JOIN public.wine_events e ON e.id = es.event_id
WHERE es.user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com')
ORDER BY e.date DESC;

-- After running this:
-- 1. Hard refresh your app (Cmd + Shift + R)
-- 2. The NEW Chardonnay event should appear (even if you dismissed Syrah event)
-- 3. This proves the system works for new events!

-- Clean up test events when done:
-- DELETE FROM public.wine_events WHERE name LIKE '%🧪%';
