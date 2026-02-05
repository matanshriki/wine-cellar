-- View Wine Profiles in Supabase Dashboard

-- ========================================
-- 1. See all your wine profiles (ordered by power)
-- ========================================
SELECT 
  wine_name,
  producer,
  vintage,
  wine_profile->'body' as body,
  wine_profile->'tannin' as tannin,
  wine_profile->'acidity' as acidity,
  wine_profile->'oak' as oak,
  wine_profile->'sweetness' as sweetness,
  wine_profile->'power' as power,
  wine_profile->'style_tags' as style_tags,
  wine_profile->'confidence' as confidence,
  wine_profile_source,
  wine_profile_updated_at
FROM wines
WHERE wine_profile IS NOT NULL
  AND user_id = auth.uid()
ORDER BY (wine_profile->>'power')::int DESC;

-- ========================================
-- 2. Profile coverage summary
-- ========================================
SELECT 
  COUNT(*) as total_wines,
  COUNT(wine_profile) as wines_with_profiles,
  COUNT(*) - COUNT(wine_profile) as wines_without_profiles,
  ROUND(COUNT(wine_profile)::numeric / COUNT(*)::numeric * 100, 1) as coverage_percentage
FROM wines
WHERE user_id = auth.uid();

-- ========================================
-- 3. See your most powerful wines
-- ========================================
SELECT 
  wine_name,
  producer,
  vintage,
  (wine_profile->>'power')::int as power,
  (wine_profile->>'body')::int as body,
  (wine_profile->>'tannin')::int as tannin,
  wine_profile->'style_tags' as style_tags
FROM wines
WHERE wine_profile IS NOT NULL
  AND user_id = auth.uid()
ORDER BY (wine_profile->>'power')::int DESC
LIMIT 10;

-- ========================================
-- 4. See your lightest/most delicate wines
-- ========================================
SELECT 
  wine_name,
  producer,
  vintage,
  (wine_profile->>'power')::int as power,
  (wine_profile->>'body')::int as body,
  (wine_profile->>'acidity')::int as acidity,
  wine_profile->'style_tags' as style_tags
FROM wines
WHERE wine_profile IS NOT NULL
  AND user_id = auth.uid()
ORDER BY (wine_profile->>'power')::int ASC
LIMIT 10;

-- ========================================
-- 5. See wines by confidence level
-- ========================================
SELECT 
  wine_profile->>'confidence' as confidence,
  COUNT(*) as count
FROM wines
WHERE wine_profile IS NOT NULL
  AND user_id = auth.uid()
GROUP BY wine_profile->>'confidence'
ORDER BY count DESC;

-- ========================================
-- 6. View backfill job history
-- ========================================
SELECT 
  id,
  status,
  total,
  processed,
  failed,
  created_at,
  updated_at,
  ROUND((processed::numeric / total::numeric * 100), 1) as progress_percentage
FROM profile_backfill_jobs
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

-- ========================================
-- 7. Find wines without profiles (need backfill)
-- ========================================
SELECT 
  wine_name,
  producer,
  vintage,
  color,
  region
FROM wines
WHERE wine_profile IS NULL
  AND user_id = auth.uid()
ORDER BY wine_name;

-- ========================================
-- 8. Profile source breakdown
-- ========================================
SELECT 
  wine_profile_source as source,
  COUNT(*) as count,
  ROUND(AVG((wine_profile->>'confidence' = 'high')::int::numeric) * 100, 1) as high_confidence_percentage
FROM wines
WHERE wine_profile IS NOT NULL
  AND user_id = auth.uid()
GROUP BY wine_profile_source;

-- ========================================
-- 9. Average profile characteristics
-- ========================================
SELECT 
  ROUND(AVG((wine_profile->>'body')::numeric), 1) as avg_body,
  ROUND(AVG((wine_profile->>'tannin')::numeric), 1) as avg_tannin,
  ROUND(AVG((wine_profile->>'acidity')::numeric), 1) as avg_acidity,
  ROUND(AVG((wine_profile->>'oak')::numeric), 1) as avg_oak,
  ROUND(AVG((wine_profile->>'sweetness')::numeric), 1) as avg_sweetness,
  ROUND(AVG((wine_profile->>'power')::numeric), 1) as avg_power
FROM wines
WHERE wine_profile IS NOT NULL
  AND user_id = auth.uid();

-- ========================================
-- 10. Full profile details for a specific wine
-- ========================================
-- Replace 'Wine Name Here' with your wine name
SELECT 
  wine_name,
  producer,
  vintage,
  color,
  region,
  country,
  wine_profile,
  wine_profile_source,
  wine_profile_confidence,
  wine_profile_updated_at
FROM wines
WHERE wine_name ILIKE '%Amarone%'  -- Change this to search
  AND user_id = auth.uid();
