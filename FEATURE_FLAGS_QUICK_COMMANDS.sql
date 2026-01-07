-- ====================================
-- FEATURE FLAGS - QUICK REFERENCE
-- ====================================

-- ┌─────────────────────────────────┐
-- │ ENABLE FEATURES FOR USERS       │
-- └─────────────────────────────────┘

-- Enable Share Cellar for a specific user (by id)
UPDATE profiles 
SET can_share_cellar = TRUE 
WHERE id = 'your-user-id-here';

-- Enable Multi-Bottle Import for a specific user
UPDATE profiles 
SET can_multi_bottle_import = TRUE 
WHERE id = 'your-user-id-here';

-- Enable BOTH features for a user
UPDATE profiles 
SET can_share_cellar = TRUE, 
    can_multi_bottle_import = TRUE 
WHERE id = 'your-user-id-here';

-- Enable for a user by email
UPDATE profiles 
SET can_share_cellar = TRUE, 
    can_multi_bottle_import = TRUE 
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);

-- Enable for yourself (replace with your email)
UPDATE profiles 
SET can_share_cellar = TRUE, 
    can_multi_bottle_import = TRUE 
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);


-- ┌─────────────────────────────────┐
-- │ CHECK FEATURE STATUS            │
-- └─────────────────────────────────┘

-- Check which users have features enabled
SELECT 
  id,
  display_name,
  can_share_cellar,
  can_multi_bottle_import,
  created_at
FROM profiles 
WHERE can_share_cellar = TRUE 
   OR can_multi_bottle_import = TRUE
ORDER BY created_at DESC;

-- Check a specific user's flags (by email)
SELECT 
  p.display_name,
  u.email,
  p.can_share_cellar,
  p.can_multi_bottle_import
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE u.email = 'user@example.com';

-- Count how many users have each feature
SELECT 
  COUNT(*) FILTER (WHERE can_share_cellar = TRUE) as share_enabled,
  COUNT(*) FILTER (WHERE can_multi_bottle_import = TRUE) as multi_bottle_enabled,
  COUNT(*) as total_users
FROM profiles;


-- ┌─────────────────────────────────┐
-- │ BULK OPERATIONS                 │
-- └─────────────────────────────────┘

-- Enable Share Cellar for ALL users
UPDATE profiles 
SET can_share_cellar = TRUE;

-- Enable Multi-Bottle Import for ALL users
UPDATE profiles 
SET can_multi_bottle_import = TRUE;

-- Enable for first 10 users (beta testers)
UPDATE profiles 
SET can_share_cellar = TRUE, 
    can_multi_bottle_import = TRUE 
WHERE id IN (
  SELECT id FROM profiles ORDER BY created_at LIMIT 10
);

-- Enable for 10% of users randomly (gradual rollout)
UPDATE profiles 
SET can_share_cellar = TRUE 
WHERE random() < 0.1;


-- ┌─────────────────────────────────┐
-- │ DISABLE / ROLLBACK              │
-- └─────────────────────────────────┘

-- Disable Share Cellar for a specific user
UPDATE profiles 
SET can_share_cellar = FALSE 
WHERE id = 'user-id-here';

-- Disable both features for a user
UPDATE profiles 
SET can_share_cellar = FALSE, 
    can_multi_bottle_import = FALSE 
WHERE id = 'user-id-here';

-- Emergency: Disable Share Cellar for EVERYONE
UPDATE profiles 
SET can_share_cellar = FALSE;

-- Emergency: Disable Multi-Bottle Import for EVERYONE
UPDATE profiles 
SET can_multi_bottle_import = FALSE;


-- ┌─────────────────────────────────┐
-- │ FIND USERS                      │
-- └─────────────────────────────────┘

-- Find user_id by email
SELECT id as user_id, email 
FROM auth.users 
WHERE email = 'user@example.com';

-- List all users with their feature flags
SELECT 
  u.email,
  p.display_name,
  p.can_share_cellar,
  p.can_multi_bottle_import,
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.created_at DESC
LIMIT 20;

-- Find users without profiles (need to create one)
SELECT u.id, u.email 
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL;


-- ┌─────────────────────────────────┐
-- │ CREATE MISSING PROFILES         │
-- └─────────────────────────────────┘

-- Create profile for a user without one (enable features)
INSERT INTO profiles (id, display_name, can_share_cellar, can_multi_bottle_import)
VALUES (
  'user-id-here', 
  'User Name', 
  TRUE,  -- Share Cellar
  TRUE   -- Multi-Bottle Import
);

-- Create profiles for all users who don't have one (with features enabled)
INSERT INTO profiles (id, display_name, can_share_cellar, can_multi_bottle_import)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  TRUE,
  TRUE
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL;


-- ┌─────────────────────────────────┐
-- │ ANALYTICS / REPORTING           │
-- └─────────────────────────────────┘

-- Feature adoption rate
SELECT 
  ROUND(100.0 * COUNT(*) FILTER (WHERE can_share_cellar = TRUE) / COUNT(*), 2) 
    as share_percentage,
  ROUND(100.0 * COUNT(*) FILTER (WHERE can_multi_bottle_import = TRUE) / COUNT(*), 2) 
    as multi_bottle_percentage
FROM profiles;

-- Users by feature combination
SELECT 
  can_share_cellar,
  can_multi_bottle_import,
  COUNT(*) as user_count
FROM profiles
GROUP BY can_share_cellar, can_multi_bottle_import
ORDER BY user_count DESC;

-- Recent feature enablements (if you track changes)
SELECT 
  display_name,
  can_share_cellar,
  can_multi_bottle_import,
  updated_at
FROM profiles 
WHERE updated_at > NOW() - INTERVAL '7 days'
  AND (can_share_cellar = TRUE OR can_multi_bottle_import = TRUE)
ORDER BY updated_at DESC;

