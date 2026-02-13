# 🚀 Deploy Readiness Backfill - Quick Start

## What You Need to Do

Follow these 4 steps to deploy the global readiness backfill system.

---

## ✅ Step 1: Run Database Migration

**Go to**: Supabase SQL Editor
https://supabase.com/dashboard/project/atclcvilibemcfqocx/sql

**Copy and run**: `supabase/migrations/20260211_add_readiness_backfill.sql`

**What it does**:
- Adds missing readiness fields to bottles table
- Creates `readiness_backfill_jobs` tracking table
- Adds indexes for efficient queries
- Creates helper function `count_bottles_needing_readiness()`

---

## ✅ Step 2: Deploy Edge Function

**Go to**: Supabase Functions
https://supabase.com/dashboard/project/atclcvilibemcfqocx/functions

**Steps**:
1. Click "Create a new function"
2. Name: `backfill-readiness`
3. Copy code from: `supabase/functions/backfill-readiness/index.ts`
4. Paste into editor
5. Click "Deploy function"

---

## ✅ Step 3: Make Yourself Admin

**Run this SQL**:

```sql
UPDATE profiles 
SET is_admin = true 
WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE');
```

Replace `YOUR_EMAIL_HERE` with your account email.

---

## ✅ Step 4: Run the Backfill

1. **Go to**: Your app → Profile page
2. **Scroll down**: Find "🍷 Admin: Readiness Backfill" section
3. **Select mode**: "Stale or Missing" (recommended for first run)
4. **Click**: "Start Backfill"
5. **Wait**: Progress bar will show real-time updates
6. **Done**: Toast notification when complete

---

## What It Does

Computes for **every bottle** in the database:
- `readiness_score` (0-100) - How ready to drink
- `readiness_status` - TooYoung / Approaching / Peak / InWindow / PastPeak
- `drink_window_start/end` - Optimal drinking years
- `readiness_confidence` - low / med / high
- `readiness_reasons` - Array of explanations
- `readiness_version` - Algorithm version (for cache invalidation)
- `readiness_updated_at` - Timestamp

---

## Backfill Modes

**Missing Only** (fastest):
- Only processes bottles without readiness data
- Use for: Regular maintenance after adding new bottles

**Stale or Missing** (recommended):
- Processes missing + outdated (version != 2)
- Use for: First run, after algorithm updates

**Force All** (slowest):
- Recomputes everything
- Use for: Complete reset, major changes

---

## Expected Results

After completion:
- ✅ All bottles have readiness scores
- ✅ Drink windows computed
- ✅ Confidence levels assigned
- ✅ Reasons provided for each bottle

**Verify**:
```sql
-- Should return 0
SELECT COUNT(*) 
FROM bottles 
WHERE readiness_score IS NULL 
   OR readiness_status IS NULL 
   OR readiness_updated_at IS NULL;
```

---

## Performance

- **Speed**: ~200-300 bottles/minute
- **Safety**: Batched (200 bottles per batch)
- **Resumable**: Can cancel and resume anytime
- **Live**: Safe to run while users are active

---

## Need Help?

See full documentation: `READINESS_BACKFILL_GUIDE.md`

**Common issues**:
- "Not admin" → Run Step 3
- "Function not found" → Deploy Step 2
- "Job stuck" → Cancel and restart

---

## Summary

1. ✅ Run migration SQL
2. ✅ Deploy Edge Function
3. ✅ Make yourself admin
4. ✅ Click "Start Backfill" in Profile page

**Time to deploy**: ~5 minutes
**Time to run**: ~3-5 minutes for 1000 bottles

That's it! 🎉
