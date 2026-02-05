# Apply Evening Plans Migration

The console 406 error you're seeing means the `evening_plans` table doesn't exist yet in your database.

## Quick Fix

Run this command to apply the migration:

```bash
# Option 1: Reset entire database (recommended for local dev)
npx supabase db reset

# Option 2: Apply just this migration
psql $DATABASE_URL -f supabase/migrations/20260205_add_evening_plans.sql
```

## For Supabase Cloud/Production

If you're using Supabase Cloud:

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Click "New Query"
4. Copy and paste the contents of `supabase/migrations/20260205_add_evening_plans.sql`
5. Click "Run"

## Then Enable the Feature Flag

After applying the migration, enable the feature for your user:

```sql
-- Get your user ID first
SELECT id, email FROM auth.users;

-- Enable the feature flag
UPDATE profiles 
SET plan_evening_enabled = true 
WHERE id = 'YOUR_USER_ID_HERE';
```

## Verify

After applying, reload the app and the 406 error should be gone. You should see:
- ✅ No console errors
- ✅ "Plan an evening" button appears
- ✅ Wine images display correctly
