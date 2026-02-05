-- Check the wine vs bottle count discrepancy

-- 1. Total unique wines in database
SELECT COUNT(*) as total_wines 
FROM wines;

-- 2. Total bottles (sum of quantities)
SELECT SUM(quantity) as total_bottles 
FROM wines 
WHERE quantity > 0;

-- 3. Wines with quantity = 0 (opened/finished)
SELECT COUNT(*) as wines_with_zero_quantity 
FROM wines 
WHERE quantity = 0;

-- 4. Wines with profiles
SELECT COUNT(*) as wines_with_profiles 
FROM wines 
WHERE wine_profile IS NOT NULL;

-- 5. Sample of wines to understand the data
SELECT 
  wine_name,
  producer,
  vintage,
  quantity,
  CASE WHEN wine_profile IS NOT NULL THEN 'Yes' ELSE 'No' END as has_profile
FROM wines
ORDER BY quantity DESC, wine_name
LIMIT 10;
