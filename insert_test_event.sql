-- Insert a test Wine Event for TODAY
-- This will appear in your app immediately!

INSERT INTO public.wine_events (
  name,
  date,
  tags,
  type,
  description_short,
  source_name,
  source_url
) VALUES (
  'International Cabernet Sauvignon Day',
  CURRENT_DATE, -- Today's date
  ARRAY['cabernet sauvignon', 'cabernet', 'red'], -- Tags to match wines
  'grape',
  'Celebrate the world''s most beloved red grape! Perfect time to open that special Cab.',
  'Wine Lovers Calendar',
  'https://example.com/cabernet-day'
);

-- Verify it was inserted
SELECT 
  name, 
  date, 
  tags, 
  type, 
  description_short
FROM public.wine_events 
WHERE date = CURRENT_DATE;
