-- Wine Cellar Brain - Seed Data
-- Seeds curated wine events from WSET 2026 calendar

-- ============================================
-- WINE EVENTS - 2026 Calendar
-- ============================================
-- Source: WSET - Wine and grape days 2026
-- https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/

INSERT INTO public.wine_events (name, date, tags, type, description_short, source_name, source_url) VALUES
  ('International Syrah Day', '2026-02-16', ARRAY['syrah', 'shiraz', 'red'], 'grape', 
   'Celebrate this versatile red grape - peppery Syrah or fruity Shiraz, same noble variety.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('International Riesling Day', '2026-03-13', ARRAY['riesling', 'white'], 'grape',
   'Celebrate one of the world''s most noble white grapes with refreshing acidity and versatility.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('International Malbec Day', '2026-04-17', ARRAY['malbec', 'red'], 'grape',
   'Honor Argentina''s signature red grape known for its bold, fruit-forward character.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('International Sauvignon Blanc Day', '2026-05-01', ARRAY['sauvignon blanc', 'sauvignon', 'white'], 'grape',
   'Raise a glass to this crisp, aromatic white grape with vibrant citrus and herbaceous notes.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('International Chardonnay Day', '2026-05-21', ARRAY['chardonnay', 'white'], 'grape',
   'The world''s most popular white grape - from buttery to mineral, oak to stainless.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('International Rosé Day', '2026-06-12', ARRAY['rosé', 'rose', 'pink'], 'wine',
   'Celebrate summer''s favorite wine - pink, refreshing, and perfect for any occasion.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('International Albariño Day', '2026-08-01', ARRAY['albariño', 'albarino', 'white'], 'grape',
   'Discover Spain''s coastal treasure - a crisp white grape perfect for seafood pairing.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('International Pinot Noir Day', '2026-08-18', ARRAY['pinot noir', 'pinot', 'red'], 'grape',
   'The heartbreak grape - elegant, delicate, and expressive of terroir like no other.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('International Cabernet Sauvignon Day', '2026-08-30', ARRAY['cabernet sauvignon', 'cabernet', 'red'], 'grape',
   'The king of red grapes - bold, structured, and age-worthy with dark fruit and tannins.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('International Grenache/Garnacha Day', '2026-09-18', ARRAY['grenache', 'garnacha', 'red'], 'grape',
   'Honor this warm-climate red grape with juicy red fruit and soft, approachable tannins.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('World Champagne Day', '2026-10-23', ARRAY['champagne', 'sparkling'], 'wine',
   'Pop the cork for the world''s most celebrated sparkling wine from France''s Champagne region.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('International Tempranillo Day', '2026-11-07', ARRAY['tempranillo', 'red'], 'grape',
   'Spain''s noble red grape - the backbone of Rioja and Ribera del Duero wines.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('International Merlot Day', '2026-11-07', ARRAY['merlot', 'red'], 'grape',
   'Soft, approachable, and versatile - Merlot deserves more love than it gets.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('Beaujolais Nouveau Day', '2026-11-19', ARRAY['beaujolais', 'gamay', 'red'], 'occasion',
   'The third Thursday in November - celebrate France''s youngest wine of the year!',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/'),
  
  ('International Sangiovese Day', '2026-12-04', ARRAY['sangiovese', 'red'], 'grape',
   'Italy''s most planted red grape - the heart of Chianti, Brunello, and more.',
   'WSET', 'https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/')
ON CONFLICT DO NOTHING;

