-- TEST EVENT FOR TODAY (IMMEDIATE TESTING)
-- Run this in your Supabase SQL Editor to add a test event that shows RIGHT NOW
-- Uses CURRENT_DATE so it's always today

INSERT INTO public.wine_events (
  name,
  date,
  tags,
  type,
  description_short,
  source_name,
  source_url
) VALUES (
  '🧪 Test Event - Celebrate Your Cellar!',
  CURRENT_DATE, -- Today's date
  ARRAY['cabernet sauvignon', 'cabernet', 'merlot', 'syrah', 'shiraz', 'malbec', 'red', 'chardonnay', 'white', 'sauvignon blanc'], -- Broad tags to match most wines
  'occasion',
  'A special test event to showcase Wine World Moments! This will match most wines in your cellar.',
  'Wine Cellar Brain (Test)',
  null
)
ON CONFLICT DO NOTHING;

-- Verify it was inserted and is active
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
WHERE name LIKE '%Test%'
ORDER BY date DESC;

-- To remove this test event later, run:
-- DELETE FROM public.wine_events WHERE name LIKE '%Test%';
