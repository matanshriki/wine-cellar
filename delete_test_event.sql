-- Delete the test event for today
DELETE FROM public.wine_events 
WHERE name = 'International Cabernet Sauvignon Day' 
  AND date = CURRENT_DATE;

-- Verify it was deleted
SELECT COUNT(*) as remaining_events_today
FROM public.wine_events 
WHERE date = CURRENT_DATE;
