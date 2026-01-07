# Fix for Step 1 Error

## What Was the Problem?

The error `column "user_id" does not exist` occurred because:
- Your `profiles` table uses **`id`** as the primary key
- The original migration tried to create an index using `user_id` (which doesn't exist)

## ✅ Fixed Files

I've corrected all the SQL files to use `id` instead of `user_id`:

1. ✅ `ADD_FEATURE_FLAGS_SIMPLE.sql` - Simplest version (no index)
2. ✅ `ADD_FEATURE_FLAGS_CORRECTED.sql` - Full version with corrected index
3. ✅ `FEATURE_FLAGS_QUICK_COMMANDS.sql` - All commands updated
4. ✅ `apps/web/src/hooks/useFeatureFlags.ts` - Code updated to use `id`

## 🚀 Quick Fix - Run This Now

In your Supabase SQL Editor, run:

```sql
-- Add the feature flag columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS can_share_cellar BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_multi_bottle_import BOOLEAN DEFAULT FALSE;
```

That's it! ✅

## Optional: Add Index for Better Performance

If you want to add an index (recommended for production), run:

```sql
-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_feature_flags 
ON profiles(id, can_share_cellar, can_multi_bottle_import);
```

## Next Steps

### Step 2: Enable Features for Your Account

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE profiles 
SET can_share_cellar = TRUE, 
    can_multi_bottle_import = TRUE 
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

### Step 3: Verify It Worked

```sql
-- Check your feature flags
SELECT 
  id,
  display_name,
  email,
  can_share_cellar,
  can_multi_bottle_import
FROM profiles 
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

You should see:
- `can_share_cellar: true`
- `can_multi_bottle_import: true`

### Step 4: Test in Production

1. Deploy your app to production
2. Log in with your account
3. Navigate to the Cellar page
4. You should see the "Share Cellar" and "Multi-Bottle Import" buttons

## Troubleshooting

If you still see errors, run this to check your profiles table structure:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```

The primary key should be called `id` (not `user_id`).

## Files You Can Use

- **`ADD_FEATURE_FLAGS_SIMPLE.sql`** - Just adds the columns (safest)
- **`ADD_FEATURE_FLAGS_CORRECTED.sql`** - Adds columns + index (recommended)
- **`FEATURE_FLAGS_QUICK_COMMANDS.sql`** - Copy-paste commands for managing features

All files now use the correct column name (`id`). 🎉

