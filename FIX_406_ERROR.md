# Fix 406 Console Error

## What's Happening

You're seeing **406 (Not Acceptable)** errors in the console when the app tries to check for active evening plans. This is because the `evening_plans` database table doesn't exist yet.

## Why It's Happening

The feature flag (`plan_evening_enabled`) is turned ON for your user, so the app is trying to:
1. Check if you have an active evening plan when you visit Tonight's Selection
2. This queries the `evening_plans` table
3. But that table doesn't exist yet → 406 error

## How to Fix (Apply the Migration)

### Option 1: Using Supabase CLI (Local Development)

```bash
# Reset the entire database (recommended for local dev)
npx supabase db reset

# OR apply just the evening_plans migration
npx supabase migration up
```

### Option 2: Direct SQL (Local or Remote)

```bash
# Apply the migration file directly
psql $DATABASE_URL -f supabase/migrations/20260205_add_evening_plans.sql
```

### Option 3: Supabase Dashboard (Cloud/Production)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **"New Query"**
4. Open `supabase/migrations/20260205_add_evening_plans.sql`
5. Copy all the SQL
6. Paste into the query editor
7. Click **"Run"**

## Verify the Fix

After applying the migration:

1. ✅ Refresh your browser
2. ✅ Open the Console (F12)
3. ✅ Navigate to "Tonight's Selection"
4. ✅ The 406 errors should be gone
5. ✅ You should see: `[EveningPlanService] No active plan` (or similar success message)

## What the Migration Creates

The migration adds:
- ✅ `evening_plans` table with full schema
- ✅ RLS (Row Level Security) policies
- ✅ Indexes for performance
- ✅ Automatic `updated_at` trigger
- ✅ Foreign key to `auth.users`

## Current Workaround

I've added graceful error handling, so:
- ✅ The 406 error won't break anything
- ✅ The app still works normally
- ✅ The "Plan an evening" button still appears
- ⚠️ But you won't be able to actually create/save evening plans until you apply the migration

## After Migration

Once applied, you can:
- ✅ Create evening plans
- ✅ Plans persist across page refreshes
- ✅ Resume active plans
- ✅ Complete plans and save to history
- ✅ Full wine images in the queue player

---

**TL;DR**: Run `npx supabase db reset` or apply the SQL migration to fix the 406 error completely.
