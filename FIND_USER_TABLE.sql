-- Step 1: Find the correct user table name
-- Run this first to see what tables exist

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%user%' 
  OR table_name LIKE '%profile%'
ORDER BY table_name;

-- Alternative: List ALL tables in public schema
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public'
-- ORDER BY table_name;


