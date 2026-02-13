-- Check how many wines are missing profiles

-- Overall summary
SELECT 
  COUNT(*) as total_wines,
  COUNT(wine_profile) as wines_with_profiles,
  COUNT(*) - COUNT(wine_profile) as wines_missing_profiles,
  ROUND(COUNT(wine_profile)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 1) as coverage_percentage
FROM wines;

-- Breakdown by user
SELECT 
  u.email as user_email,
  COUNT(w.id) as total_wines,
  COUNT(w.wine_profile) as with_profile,
  COUNT(w.id) - COUNT(w.wine_profile) as missing_profile
FROM wines w
JOIN auth.users u ON w.user_id = u.id
GROUP BY u.email
HAVING COUNT(w.id) - COUNT(w.wine_profile) > 0
ORDER BY missing_profile DESC;

-- Sample of wines missing profiles
SELECT 
  wine_name,
  producer,
  color,
  grapes,
  vintage
FROM wines
WHERE wine_profile IS NULL
LIMIT 20;
