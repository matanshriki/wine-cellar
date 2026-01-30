-- Fix the source URL for all events (update to correct WSET blog link)

UPDATE public.wine_events 
SET source_url = 'https://www.wsetglobal.com/knowledge-centre/blog/2025/wine-and-grape-days-2026/'
WHERE source_url = 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'
   OR source_url IS NULL;

-- Verify the update
SELECT name, source_url 
FROM public.wine_events 
ORDER BY date;
