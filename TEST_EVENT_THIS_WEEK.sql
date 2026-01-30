-- TEST EVENT FOR THIS WEEK
-- Run this in your Supabase SQL Editor to add a test event
-- This will show up in your cellar if you have any Cabernet, red wines, or similar

-- Calculate this week's date (adjust if needed)
-- Current date: 2026-01-30
-- This sets the event to Feb 1, 2026 (this Saturday)

INSERT INTO public.wine_events (
  name,
  date,
  tags,
  type,
  description_short,
  source_name,
  source_url
) VALUES (
  'International Cabernet Sauvignon Week',
  '2026-02-01', -- This Saturday (adjust if needed: use CURRENT_DATE or any date this week)
  ARRAY['cabernet sauvignon', 'cabernet', 'cab sauv', 'red'],
  'grape',
  'Celebrate the king of red grapes with bold structure, dark fruit, and legendary aging potential.',
  'Wine Cellar Brain Test',
  'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'
)
ON CONFLICT DO NOTHING;

-- Verify it was inserted
SELECT 
  name, 
  date, 
  tags,
  description_short,
  CASE 
    WHEN date BETWEEN CURRENT_DATE - INTERVAL '3 days' AND CURRENT_DATE + INTERVAL '3 days' 
    THEN '✅ ACTIVE (within window)'
    ELSE '⏰ Not yet active'
  END as status
FROM public.wine_events 
WHERE name LIKE '%Test%' OR name LIKE '%Cabernet%'
ORDER BY date;
