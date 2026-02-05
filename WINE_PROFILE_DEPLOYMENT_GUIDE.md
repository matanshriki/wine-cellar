# Wine Profile Feature - Deployment Guide

## ✅ What's Been Implemented

### Core Infrastructure (100% Complete)
All database migrations, Edge Functions, services, and admin tools are complete and committed.

### Files Created

1. **Database Migration** ✅
   - `supabase/migrations/20260205_add_wine_profiles.sql`
   - Adds profile columns to wines table
   - Creates profile_backfill_jobs table
   - Adds is_admin flag to profiles
   - Sets up RLS and indexes

2. **Edge Function** ✅
   - `supabase/functions/generate-wine-profile/index.ts`
   - Uses OpenAI with strict JSON schema
   - Generates profiles + computes power
   - Persists to database

3. **Client Service** ✅
   - `apps/web/src/services/wineProfileService.ts`
   - Profile reading with heuristic fallback
   - Food pairing scoring logic
   - Pairing explanation generation

4. **Admin Tool** ✅
   - `apps/web/src/components/AdminWineProfileBackfill.tsx`
   - Bulk profile generation UI
   - Progress tracking
   - Resumable jobs

5. **Documentation** ✅
   - `WINE_PROFILE_SCHEMA.md` - Schema reference
   - `WINE_PROFILE_IMPLEMENTATION_SUMMARY.md` - Full guide
   - `PLAN_EVENING_FOOD_AWARE_PATCH.md` - UI integration patches

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migration

**In Supabase Dashboard:**
1. Go to SQL Editor
2. Open a new query
3. Copy the entire content of `supabase/migrations/20260205_add_wine_profiles.sql`
4. Click "Run"
5. Verify success (should see "Success. No rows returned")

**Verify:**
```sql
-- Check wines table has new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'wines' AND column_name LIKE 'wine_profile%';

-- Should return: wine_profile, wine_profile_updated_at, wine_profile_source, wine_profile_confidence
```

---

### Step 2: Deploy Edge Function

**From terminal in project root:**
```bash
supabase functions deploy generate-wine-profile
```

**Verify:**
- Check Supabase Dashboard → Edge Functions
- Should see `generate-wine-profile` listed
- Status: Deployed

---

### Step 3: Set Admin Flag for Yourself

**In Supabase SQL Editor:**
```sql
-- Get your user ID first
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Set admin flag
UPDATE profiles SET is_admin = true WHERE id = 'YOUR_USER_ID_HERE';

-- Verify
SELECT id, email, is_admin FROM profiles WHERE is_admin = true;
```

---

### Step 4: Integrate Admin Tool in Settings

**File to modify:** `apps/web/src/pages/SettingsPage.tsx` (or wherever your settings live)

**Add import:**
```typescript
import { AdminWineProfileBackfill } from '../components/AdminWineProfileBackfill';
```

**Add component:**
```tsx
{/* In your settings page JSX, add: */}
<AdminWineProfileBackfill />
```

**Example placement:**
```tsx
{/* After your profile settings, before account deletion */}
<div className="space-y-6">
  {/* ... existing settings ... */}
  
  {/* Admin Tools Section */}
  <AdminWineProfileBackfill />
</div>
```

---

### Step 5: Apply PlanEveningModal Food-Aware Updates

**File to modify:** `apps/web/src/components/PlanEveningModal.tsx`

**Follow the patches in:** `PLAN_EVENING_FOOD_AWARE_PATCH.md`

**Summary of changes:**
1. Add food state variables (protein, sauce, spice, smoke)
2. Import `wineProfileService`
3. Replace `generateLineup()` function with food-aware version
4. Add food selection UI chips in InputStep
5. Add pairing explanations in LineupStep

**Quick verification:**
```typescript
// At the top, verify these imports exist:
import * as wineProfileService from '../services/wineProfileService';
import type { FoodProfile, WineProfile } from '../services/wineProfileService';
```

---

### Step 6: Run Backfill

1. **Build and start your app:**
   ```bash
   npm run dev
   ```

2. **Navigate to Settings page**

3. **You should see "Admin: Wine Profile Backfill" section**
   - If not visible, check:
     - Admin flag is set correctly
     - AdminWineProfileBackfill component is imported/rendered
     - No console errors

4. **Click "Start Backfill"**
   - Progress bar will show current status
   - Watch console for detailed logs
   - Typical rate: ~2 wines per second
   - For 50 wines, expect ~30 seconds

5. **Wait for completion**
   - ✅ "Backfill complete! Generated X profiles"

---

### Step 7: Test Food-Aware Planning

1. **Navigate to "Tonight's Selection"**

2. **Click "Plan an evening"**

3. **You should see:**
   - Existing occasion/group size inputs
   - **NEW:** Food selection section with chips:
     - Protein: Beef, Lamb, Chicken, Fish, Veggie, None
     - Sauce: Tomato, BBQ, Creamy, None
     - Spice: Low, Med, High
     - Smoke: Low, Med, High

4. **Test scenarios:**

   **Steak Dinner:**
   - Protein: Beef
   - Sauce: None
   - Spice: Low
   - Smoke: Medium
   - Click "Generate lineup"
   - ✅ Should favor full-bodied, tannic reds
   - ✅ Lineup should progress from light to powerful
   - ✅ Each wine shows pairing explanation

   **Pizza Night:**
   - Protein: Chicken (or None)
   - Sauce: Tomato
   - Spice: Medium
   - Smoke: Low
   - Click "Generate lineup"
   - ✅ Should favor high-acidity wines
   - ✅ Medium-bodied wines prioritized

   **Spicy Thai:**
   - Protein: Chicken
   - Sauce: None
   - Spice: High
   - Smoke: Low
   - Click "Generate lineup"
   - ✅ Should avoid high-tannin, high-alcohol wines
   - ✅ May include off-dry wines if available

5. **Verify pairing explanations:**
   - Under each wine in lineup
   - Should see text like:
     - "Powerful match - tannins cut through rich meat"
     - "Bright acidity complements tomato perfectly"
     - "Fresh opener - awakens the palate"

---

### Step 8: Verify No Regressions

**Test these flows:**

- [ ] **Scan wine label** - Still works
- [ ] **Add bottle manually** - Still works
- [ ] **Duplicate detection** - Still works
- [ ] **Plan evening (without food)** - Still works
- [ ] **Resume evening** - Still works
- [ ] **Complete evening** - Still works, moves to history
- [ ] **Open/close bottles** - Cellar quantities update

**Check console:**
- No new errors
- Wine profile logs visible if enabled:
  - `[WineProfileService] ...`
  - `[generate-wine-profile] ...`
  - `[PlanEvening] Generated lineup with power progression...`

---

## 🐛 Troubleshooting

### Issue: Admin tool not visible

**Check:**
```sql
SELECT is_admin FROM profiles WHERE id = auth.uid();
-- Should return: is_admin = true
```

**Fix:**
```sql
UPDATE profiles SET is_admin = true WHERE id = 'YOUR_USER_ID';
```

### Issue: Backfill fails with authentication error

**Check:**
- OpenAI API key is set in Supabase Edge Functions environment
- Go to Supabase Dashboard → Edge Functions → Configuration
- Ensure `OPENAI_API_KEY` is set

### Issue: Food selection not showing

**Check:**
1. Did you apply the patches to `PlanEveningModal.tsx`?
2. Check browser console for import errors
3. Verify `wineProfileService.ts` exists in `src/services/`

### Issue: Lineup doesn't use food pairing

**Check:**
1. Verify `generateLineup()` function was replaced (not just edited)
2. Look for console log: `[PlanEvening] Generating food-aware lineup...`
3. Check that `calculateFoodPairingScore()` is being called

### Issue: Wines without profiles

**Expected behavior:**
- Heuristic fallback kicks in automatically
- Planning still works, just less accurate
- Run backfill to generate real profiles

---

## 📊 Monitoring

### Check Profile Coverage

```sql
-- Count wines with/without profiles
SELECT 
  wine_profile_source,
  COUNT(*) as count
FROM wines
GROUP BY wine_profile_source;

-- Expected after backfill:
-- ai: 45 (or however many wines you have)
-- null: 0
```

### Check Backfill Jobs

```sql
SELECT 
  id,
  status,
  total,
  processed,
  failed,
  created_at
FROM profile_backfill_jobs
ORDER BY created_at DESC
LIMIT 5;
```

### View Sample Profiles

```sql
SELECT 
  wine_name,
  producer,
  wine_profile->'power' as power,
  wine_profile->'body' as body,
  wine_profile->'tannin' as tannin,
  wine_profile_source,
  wine_profile_confidence
FROM wines
WHERE wine_profile IS NOT NULL
LIMIT 10;
```

---

## 🎯 Success Criteria

✅ **Migration applied** - New columns exist in wines table
✅ **Edge Function deployed** - Visible in Supabase dashboard
✅ **Admin tool integrated** - Visible on Settings page (admin only)
✅ **Backfill completed** - All wines have profiles
✅ **Food selection UI** - Shows in Plan an Evening modal
✅ **Food-aware scoring** - Lineup changes based on food selection
✅ **Power progression** - Wines ordered light to powerful
✅ **Pairing explanations** - Helpful text under each wine
✅ **No regressions** - All existing features still work
✅ **Graceful fallback** - Works even if profiles missing

---

## 📝 Optional Enhancements

After testing and verifying core functionality works:

1. **Add food icons** - 🥩 🐟 🍗 etc. to protein chips
2. **Save food preferences** - Remember user's typical selections
3. **Add "Why this wine?" button** - Show full pairing logic
4. **Profile confidence UI** - Show which profiles are AI vs heuristic
5. **Batch profile refresh** - Re-generate old profiles (>30 days)
6. **Profile comparison view** - Compare wines side-by-side
7. **Food pairing score badges** - Show numerical pairing score

---

## 🎉 You're Done!

You now have:
- AI-powered wine profiles
- Admin tool for bulk generation
- Food-aware evening planning
- Intelligent wine+food pairing
- Power-based lineup progression
- Helpful pairing explanations

All with the luxury design system and no new dependencies!

Next steps:
- Monitor OpenAI usage (cost)
- Gather user feedback on pairings
- Refine scoring weights if needed
- Consider adding more food categories

Enjoy planning perfectly paired evenings! 🍷🍽️✨
