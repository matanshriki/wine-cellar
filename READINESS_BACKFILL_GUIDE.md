## Readiness Backfill System - Deployment Guide

This guide walks through deploying the **Global Readiness Backfill** system that computes drink windows and readiness scores for ALL bottles in the database.

---

## Overview

The readiness backfill system provides:

- ✅ **Global backfill** for all bottles (not per-user)
- ✅ **Deterministic** readiness calculation (same input → same output)
- ✅ **Batched processing** (200 bottles per batch, resumable)
- ✅ **Admin-only** triggering with luxury progress UI
- ✅ **Versioning** to track algorithm changes
- ✅ **Explainable** with reasons for each bottle

---

## Step 1: Run Database Migration

Run this SQL in your Supabase SQL Editor:

**File**: `supabase/migrations/20260211_add_readiness_backfill.sql`

```bash
# Or via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Copy the entire migration file
# 3. Run it
```

This adds:
- Missing readiness fields to `bottles` table:
  - `readiness_confidence` (TEXT: low/med/high)
  - `readiness_reasons` (JSONB: array of strings)
  - `readiness_version` (INTEGER: algorithm version)
  - `readiness_updated_at` (TIMESTAMPTZ: last computed time)
- New table: `readiness_backfill_jobs` (tracks global jobs)
- Indexes for efficient backfill queries
- Helper function: `count_bottles_needing_readiness()`

---

## Step 2: Deploy Edge Function

Deploy the `backfill-readiness` Edge Function:

### Option A: Supabase CLI

```bash
cd /path/to/wine
npx supabase functions deploy backfill-readiness
```

### Option B: Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/functions
2. Click "Create Function"
3. Name: `backfill-readiness`
4. Copy code from `supabase/functions/backfill-readiness/index.ts`
5. Paste and deploy

---

## Step 3: Make Yourself Admin

```sql
-- Run in Supabase SQL Editor
UPDATE profiles 
SET is_admin = true 
WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com');
```

---

## Step 4: Access the Backfill UI

1. **Go to**: Profile page (`/profile`)
2. **Scroll down**: You'll see two admin sections:
   - 🔧 Admin: Wine Profile Backfill
   - 🍷 Admin: Readiness Backfill ← **This one**

---

## Step 5: Run the Backfill

### UI Overview

**Mode Selection**:
- `Missing Only`: Only bottles without readiness data
- `Stale or Missing`: Missing + outdated (version != 2)
- `Force All`: Recompute everything

**Controls**:
- **Start Backfill**: Begin new job
- **Resume Backfill**: Continue interrupted job
- **Cancel**: Stop processing

**Progress Display**:
- Progress bar with percentage
- Bottles processed counter
- Updated / Skipped / Failed counts
- Real-time updates

### Recommended Workflow

1. **First run**: Use "Stale or Missing" mode
   - This processes all bottles without readiness OR with old version
2. **Wait**: Progress updates automatically
3. **Completion**: Toast notification when done
4. **Verify**: Check "X bottles need processing" count drops to 0

---

## How It Works

### Deterministic Readiness Calculation

For each bottle:

1. **Get wine data**: vintage, color, grapes, region, wine_profile
2. **Validate vintage**: Must be 1900–current year
3. **Calculate age**: `currentYear - vintage`
4. **Apply logic by type**:

   **Sparkling**:
   - 0-5 years: Ready (score 80-85)
   - 5+ years: Past peak (score 60)
   - Confidence: HIGH

   **White/Rosé**:
   - 0-3 years: Peak (score 75-85)
   - 3-7 years: Still good (score 70)
   - 7+ years: Past peak (score 55)
   - Confidence: MED

   **Red** (profile-aware):
   - Extract `wine_profile` (body, tannin, acidity, oak, power)
   - Calculate structure score (0-25)
   - Determine aging potential: low/medium/high
   - Set thresholds based on potential:
     - **High potential**: hold 4+ years, peak 6-15, max 25
     - **Medium**: hold 2 years, peak 3-8, max 15
     - **Low**: hold 1 year, peak 2-5, max 8
   - Assign status: TooYoung / Approaching / Peak / InWindow / PastPeak
   - Confidence: HIGH (with profile), LOW (heuristic)

5. **Set fields**:
   - `readiness_score` (0-100)
   - `readiness_status` (enum)
   - `drink_window_start/end` (years)
   - `readiness_confidence` (low/med/high)
   - `readiness_reasons` (array of explanations)
   - `readiness_version` (2)
   - `readiness_updated_at` (now)

### Batching & Resumability

- **Batch size**: 200 bottles per call (configurable)
- **Cursor-based**: Tracks last processed bottle ID
- **Jobs table**: Stores progress in `readiness_backfill_jobs`
- **Concurrency**: 5 bottles processed in parallel
- **Safety**: Max 500 iterations per UI session

### Performance

- **Speed**: ~200 bottles/minute (depends on DB latency)
- **Memory**: Batched, never loads all bottles at once
- **Network**: Efficient queries with wine data caching per batch

---

## Verification

### Check Missing Bottles

```sql
-- Count bottles without readiness
SELECT COUNT(*) 
FROM bottles 
WHERE readiness_score IS NULL 
   OR readiness_status IS NULL 
   OR readiness_updated_at IS NULL;

-- Should be 0 after backfill completes
```

### Check Readiness Distribution

```sql
-- See readiness status distribution
SELECT 
  readiness_status,
  COUNT(*) as count,
  ROUND(AVG(readiness_score), 1) as avg_score
FROM bottles
WHERE readiness_status IS NOT NULL
GROUP BY readiness_status
ORDER BY count DESC;
```

### Check Confidence Levels

```sql
-- See confidence distribution
SELECT 
  readiness_confidence,
  COUNT(*) as count,
  ROUND(AVG(readiness_score), 1) as avg_score
FROM bottles
WHERE readiness_confidence IS NOT NULL
GROUP BY readiness_confidence;
```

### View Sample Results

```sql
-- See recent readiness computations
SELECT 
  w.wine_name,
  w.producer,
  w.vintage,
  b.readiness_score,
  b.readiness_status,
  b.drink_window_start || '-' || b.drink_window_end as window,
  b.readiness_confidence,
  b.readiness_reasons,
  b.readiness_updated_at
FROM bottles b
JOIN wines w ON b.wine_id = w.id
WHERE b.readiness_updated_at IS NOT NULL
ORDER BY b.readiness_updated_at DESC
LIMIT 20;
```

---

## Troubleshooting

### "Job not starting"

**Check**:
1. Are you admin? Run: `SELECT is_admin FROM profiles WHERE id = auth.uid()`
2. Is Edge Function deployed? Test in Supabase Dashboard
3. Browser console errors?

### "Job stuck / not progressing"

**Fix**:
1. Cancel the job
2. Check `readiness_backfill_jobs` table:
   ```sql
   SELECT * FROM readiness_backfill_jobs ORDER BY created_at DESC LIMIT 5;
   ```
3. Manually set status to 'cancelled' if needed:
   ```sql
   UPDATE readiness_backfill_jobs 
   SET status = 'cancelled' 
   WHERE id = 'YOUR_JOB_ID';
   ```
4. Start a new job

### "Many failures"

**Debug**:
```sql
-- Check failures in last job
SELECT 
  failures 
FROM readiness_backfill_jobs 
ORDER BY created_at DESC 
LIMIT 1;
```

**Common causes**:
- Missing wine data (wine_id references deleted wine)
- Invalid vintage format
- Database constraint violations

---

## Maintenance

### When to Re-run Backfill

Run backfill when:
1. **Algorithm updated**: Increment `READINESS_VERSION` in code, run "Stale or Missing"
2. **New bottles added**: Run "Missing Only" periodically
3. **Wine profiles updated**: Run "Stale or Missing" to recalculate with new data

### Monitoring Job History

```sql
-- View all jobs
SELECT 
  id,
  mode,
  status,
  processed,
  updated,
  failed,
  created_at,
  finished_at,
  finished_at - started_at as duration
FROM readiness_backfill_jobs
ORDER BY created_at DESC
LIMIT 10;
```

### Cleanup Old Jobs

```sql
-- Keep last 10, delete older completed jobs
DELETE FROM readiness_backfill_jobs
WHERE status = 'completed'
  AND id NOT IN (
    SELECT id FROM readiness_backfill_jobs 
    WHERE status = 'completed'
    ORDER BY created_at DESC 
    LIMIT 10
  );
```

---

## Integration with App Features

### Features Using Readiness Data

The following features now read from standardized readiness fields:

1. **Analyze Cellar** (`BulkAnalysisModal.tsx`)
   - Drink window distribution
   - Ready vs Hold counts

2. **Drink Window Timeline** (`DrinkWindowTimeline.tsx`)
   - Visual timeline of cellar maturity

3. **Tonight's Selection** (`TonightsOrbit.tsx`)
   - Prioritizes "Ready" wines
   - Filters out "TooYoung"

4. **Bottle Cards** (`BottleCard.tsx`)
   - Displays readiness badge
   - Shows drink window years

5. **Wine Details Modal** (`WineDetailsModal.tsx`)
   - Shows full readiness explanation
   - Displays confidence level

### Fallback Behavior

If a bottle is missing readiness data at runtime:
- **UI**: Shows "Unknown" status
- **Recommendations**: Uses heuristic fallback (age-based)
- **Solution**: Run backfill to compute

---

## FAQ

**Q: How long does it take?**
A: ~3-5 minutes for 1000 bottles

**Q: Can I run it while users are active?**
A: Yes, safe to run anytime. Uses batches to avoid locking.

**Q: What if I interrupt it?**
A: Job is resumable. Click "Resume Backfill" to continue.

**Q: Does it re-analyze existing wines?**
A: Depends on mode:
- "Missing Only": No, skips existing
- "Stale or Missing": Yes, if version changed
- "Force All": Yes, everything

**Q: What if wine has no profile?**
A: Uses heuristic based on region/grapes/color. Confidence set to "low".

---

## Summary

✅ **Deployed**: Migration + Edge Function
✅ **Accessible**: Admin UI in Profile page
✅ **Running**: One-click backfill with progress
✅ **Verified**: 0 bottles missing readiness
✅ **Integrated**: All features use standardized fields

Your cellar now has deterministic, explainable readiness scores for every bottle!
