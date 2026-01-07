# Feature Flags System - User Guide

## Overview

The Wine Cellar Brain now has a production-ready **feature flag system** that allows you to control which users can access beta features like:
- 🔗 **Share Cellar** - Share a read-only link to your wine cellar
- 📸 **Multi-Bottle Import** - Import multiple bottles from a single photo

## How It Works

### Automatic Behavior
- ✅ **Development (localhost)**: All features are automatically enabled for testing
- 🏭 **Production**: Features are controlled by boolean flags in the database per user

### Database Schema

Two new columns have been added to the `profiles` table:
```sql
can_share_cellar          BOOLEAN DEFAULT FALSE
can_multi_bottle_import   BOOLEAN DEFAULT FALSE
```

## Setup Instructions

### Step 1: Run the Migration

Run the SQL migration to add the feature flag columns:

```bash
# Option A: Run in Supabase SQL Editor
# Copy the contents of ADD_FEATURE_FLAGS.sql and paste into Supabase SQL Editor

# Option B: Run via psql (if you have direct access)
psql -h your-db-host -U postgres -d postgres -f ADD_FEATURE_FLAGS.sql
```

### Step 2: Enable Features for Specific Users

**Method 1: SQL Query (Recommended)**

```sql
-- Enable Share Cellar for a specific user
UPDATE profiles 
SET can_share_cellar = TRUE 
WHERE user_id = 'user-uuid-here';

-- Enable Multi-Bottle Import for a specific user
UPDATE profiles 
SET can_multi_bottle_import = TRUE 
WHERE user_id = 'user-uuid-here';

-- Enable both features for a user
UPDATE profiles 
SET can_share_cellar = TRUE, 
    can_multi_bottle_import = TRUE 
WHERE user_id = 'user-uuid-here';

-- Enable for a user by email
UPDATE profiles 
SET can_share_cellar = TRUE, 
    can_multi_bottle_import = TRUE 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

**Method 2: Supabase Dashboard**

1. Go to Supabase Dashboard → Table Editor → `profiles`
2. Find the user by `user_id` or `display_name`
3. Click the edit icon on the row
4. Check the boxes for `can_share_cellar` and/or `can_multi_bottle_import`
5. Save changes

### Step 3: Verify Feature Access

**Check which users have features enabled:**

```sql
SELECT 
  user_id,
  display_name,
  can_share_cellar,
  can_multi_bottle_import,
  created_at
FROM profiles 
WHERE can_share_cellar = TRUE 
   OR can_multi_bottle_import = TRUE
ORDER BY created_at DESC;
```

**Get a specific user's feature flags:**

```sql
SELECT 
  display_name,
  can_share_cellar,
  can_multi_bottle_import
FROM profiles 
WHERE user_id = 'user-uuid-here';
```

## Testing in Production

### 1. Enable for Test Users First
```sql
-- Enable for yourself (get your user_id from auth.users)
UPDATE profiles 
SET can_share_cellar = TRUE, can_multi_bottle_import = TRUE 
WHERE user_id = 'your-user-id';

-- Enable for a test account
UPDATE profiles 
SET can_share_cellar = TRUE, can_multi_bottle_import = TRUE 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@example.com');
```

### 2. Verify in Production
1. Log in with the test account in production
2. Navigate to the Cellar page
3. You should see the "Share Cellar" and "Multi-Bottle Import" buttons
4. Test the features thoroughly

### 3. Gradual Rollout
Once tested, enable for more users gradually:

```sql
-- Enable for specific power users
UPDATE profiles 
SET can_share_cellar = TRUE 
WHERE user_id IN ('user1-id', 'user2-id', 'user3-id');

-- Or enable for all users (full release)
UPDATE profiles 
SET can_share_cellar = TRUE, 
    can_multi_bottle_import = TRUE;
```

## Disabling Features

To disable features for users who are having issues:

```sql
-- Disable for a specific user
UPDATE profiles 
SET can_share_cellar = FALSE, 
    can_multi_bottle_import = FALSE 
WHERE user_id = 'user-uuid-here';

-- Disable Share Cellar for everyone (emergency rollback)
UPDATE profiles 
SET can_share_cellar = FALSE;

-- Disable Multi-Bottle Import for everyone
UPDATE profiles 
SET can_multi_bottle_import = FALSE;
```

## Default Settings for New Users

By default, new users will have both flags set to `FALSE`. This ensures features are opt-in only.

To change defaults for all new signups, you can:

1. **Update the migration** (before running it):
```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS can_share_cellar BOOLEAN DEFAULT TRUE,  -- Changed to TRUE
ADD COLUMN IF NOT EXISTS can_multi_bottle_import BOOLEAN DEFAULT TRUE;
```

2. **Create a trigger** (for automatic enabling after user creation):
```sql
CREATE OR REPLACE FUNCTION enable_beta_features_for_new_users()
RETURNS TRIGGER AS $$
BEGIN
  NEW.can_share_cellar = TRUE;
  NEW.can_multi_bottle_import = TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enable_beta_features
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION enable_beta_features_for_new_users();
```

## Monitoring & Analytics

**Track feature adoption:**

```sql
-- Count users with each feature enabled
SELECT 
  COUNT(*) FILTER (WHERE can_share_cellar = TRUE) as share_enabled_count,
  COUNT(*) FILTER (WHERE can_multi_bottle_import = TRUE) as multi_bottle_enabled_count,
  COUNT(*) as total_users
FROM profiles;

-- Percentage of users with features
SELECT 
  ROUND(100.0 * COUNT(*) FILTER (WHERE can_share_cellar = TRUE) / COUNT(*), 2) as share_percentage,
  ROUND(100.0 * COUNT(*) FILTER (WHERE can_multi_bottle_import = TRUE) / COUNT(*), 2) as multi_bottle_percentage
FROM profiles;
```

## Technical Details

### How the Flag Check Works

The app uses a React hook `useFeatureFlags()` that:

1. **In dev environment**: Returns `true` for all features (no DB check)
2. **In production**: 
   - Fetches the user's profile from the database
   - Returns the boolean values for each feature flag
   - Caches the result for the session

### Performance
- Feature flags are loaded once when the CellarPage mounts
- No repeated database calls during the session
- Lightweight query (indexed for fast lookups)

### Code Location
- **Hook**: `apps/web/src/hooks/useFeatureFlags.ts`
- **Usage**: `apps/web/src/pages/CellarPage.tsx`
- **Migration**: `ADD_FEATURE_FLAGS.sql`

## Troubleshooting

### Feature not showing up for a user

1. **Check if the flag is enabled**:
```sql
SELECT can_share_cellar, can_multi_bottle_import 
FROM profiles 
WHERE user_id = 'user-uuid';
```

2. **Check if the profile exists**:
```sql
SELECT * FROM profiles WHERE user_id = 'user-uuid';
```

3. **If profile doesn't exist, create it**:
```sql
INSERT INTO profiles (user_id, display_name, can_share_cellar, can_multi_bottle_import)
VALUES ('user-uuid', 'User Name', TRUE, TRUE);
```

4. **Ask user to log out and log back in** (to refresh the feature flags)

### Feature showing for everyone (even though flags are FALSE)

- Make sure you're testing in **production**, not localhost
- Localhost always shows all features for development

## Rollout Strategy Recommendation

### Phase 1: Internal Testing (1 week)
```sql
-- Enable for team members only
UPDATE profiles SET can_share_cellar = TRUE, can_multi_bottle_import = TRUE 
WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@yourcompany.com');
```

### Phase 2: Beta Users (2 weeks)
```sql
-- Enable for first 50 users
UPDATE profiles SET can_share_cellar = TRUE 
WHERE user_id IN (
  SELECT user_id FROM profiles ORDER BY created_at LIMIT 50
);
```

### Phase 3: Gradual Rollout (1 month)
```sql
-- Enable for 10% of users randomly
UPDATE profiles SET can_share_cellar = TRUE 
WHERE random() < 0.1;
```

### Phase 4: Full Release
```sql
-- Enable for everyone
UPDATE profiles SET can_share_cellar = TRUE, can_multi_bottle_import = TRUE;
```

## Security Notes

- ✅ Feature flags are checked on the **client-side only** (UX control)
- ✅ No sensitive data is exposed through these features
- ✅ Share links use base64-encoded data (dev-only feature, no backend storage)
- ⚠️ If you add backend operations, ensure proper RLS policies are in place

## Questions?

If you have questions about the feature flag system, check:
- The migration file: `ADD_FEATURE_FLAGS.sql`
- The hook implementation: `apps/web/src/hooks/useFeatureFlags.ts`
- The usage examples: `apps/web/src/pages/CellarPage.tsx`

