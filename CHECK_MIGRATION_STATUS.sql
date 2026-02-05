-- Check if evening_plans table exists and is properly set up

-- 1. Check if table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'evening_plans';

-- 2. Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'evening_plans'
ORDER BY ordinal_position;

-- 3. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'evening_plans';

-- 4. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'evening_plans';

-- 5. Check indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'evening_plans';

-- 6. Count existing evening plans
SELECT 
  status,
  COUNT(*) as count
FROM evening_plans
GROUP BY status;
