# Migration Order for Wine Profiles

## Issue
You have an existing `admins` table that needs to be migrated to `profiles.is_admin` before running the wine profiles migration.

## Solution: Run Migrations in This Order

### Step 1: Migrate Admin Table (FIRST)
**File:** `supabase/migrations/20260205_migrate_admin_to_profiles.sql`

This migration:
- ✅ Adds `is_admin` column to profiles table
- ✅ Migrates all users from `admins` table to `profiles.is_admin`
- ✅ Updates `is_admin()` RPC function to check profiles first
- ✅ Creates sync trigger (keeps admins table working temporarily)
- ✅ Preserves all existing functionality

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste entire content of:
-- supabase/migrations/20260205_migrate_admin_to_profiles.sql
```

**Verify success:**
```sql
-- Check that is_admin column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'is_admin';

-- Check that admins were migrated
SELECT id, email, is_admin 
FROM profiles 
WHERE is_admin = true;

-- Test the is_admin() function
SELECT is_admin(auth.uid());
```

---

### Step 2: Add Wine Profiles (SECOND)
**File:** `supabase/migrations/20260205_add_wine_profiles.sql`

This migration adds:
- Wine profile columns to wines table
- Profile backfill jobs table
- RLS policies for admin access

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste entire content of:
-- supabase/migrations/20260205_add_wine_profiles.sql
```

**Verify success:**
```sql
-- Check wine profile columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'wines' AND column_name LIKE 'wine_profile%';

-- Check backfill jobs table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'profile_backfill_jobs';
```

---

## What This Does

### Before Migration
- ✅ Admins tracked in separate `admins` table
- ✅ `is_admin()` RPC function checks `admins` table
- ✅ AdminEnrichPage uses `is_admin()` - keeps working

### During Migration
- ✅ `is_admin` column added to profiles
- ✅ All admins copied to profiles.is_admin
- ✅ `is_admin()` function checks BOTH tables (safe!)
- ✅ Sync trigger keeps both tables in sync

### After Migration
- ✅ `is_admin()` function works exactly as before
- ✅ New code can check `profiles.is_admin` directly
- ✅ Old code using `is_admin()` RPC still works
- ✅ `admins` table can be kept or dropped (your choice)

---

## Optional: Clean Up Admins Table

After testing and confirming everything works, you can optionally remove the `admins` table:

**Run this AFTER testing:**
```sql
-- 1. Drop the sync trigger
DROP TRIGGER IF EXISTS sync_admin_to_profiles_trigger ON public.admins;
DROP FUNCTION IF EXISTS sync_admin_to_profiles();

-- 2. Drop the admins table
DROP TABLE IF EXISTS public.admins CASCADE;

-- 3. Simplify is_admin() function to only check profiles
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = check_user_id 
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
```

---

## Migration Safety

This approach is **safe** because:
1. ✅ Both systems work during migration
2. ✅ No data loss - admins table preserved initially
3. ✅ Backwards compatible - `is_admin()` checks both places
4. ✅ New features work with profiles.is_admin
5. ✅ Old features keep using `is_admin()` RPC
6. ✅ Can rollback by keeping admins table

---

## Next Steps After Migrations

1. **Verify admin status:**
   ```sql
   SELECT is_admin(auth.uid());
   ```

2. **Deploy Edge Function:**
   ```bash
   supabase functions deploy generate-wine-profile
   ```

3. **Test admin tools:**
   - Visit Settings page
   - You should see "Admin: Wine Profile Backfill" section
   - AdminEnrichPage should still work

4. **Run backfill:**
   - Click "Start Backfill"
   - Generate profiles for existing wines

---

## Troubleshooting

### "is_admin column does not exist"
→ Run Step 1 first: `20260205_migrate_admin_to_profiles.sql`

### "Admin tool not visible"
```sql
-- Check your admin status:
SELECT id, email, is_admin FROM profiles WHERE id = auth.uid();

-- If false, manually set:
UPDATE profiles SET is_admin = true WHERE id = 'YOUR_USER_ID';
```

### "is_admin() returns false but I'm in admins table"
```sql
-- Check if you're in admins table:
SELECT * FROM admins WHERE user_id = auth.uid();

-- Re-run migration Step 1 to sync
```

### "Want to keep admins table"
That's fine! The migration is designed to work with both. The sync trigger will keep them in sync. You don't have to drop the admins table.

---

## Summary

✅ **Run Step 1 FIRST** - Migrate admin to profiles
✅ **Run Step 2 SECOND** - Add wine profiles
✅ **Test everything** - Verify admin tools work
✅ **Optional cleanup** - Drop admins table later if desired

This preserves all your existing admin functionality while adding the new wine profile features!
