# 🚀 Deploy Image Storage Fix

## Prerequisites
- [ ] Local testing complete
- [ ] Dark mode V2 ready (if deploying together)
- [ ] All commits on `feature/dark-mode-v2` branch

---

## 📋 Deployment Checklist

### STEP 1: Run Database Migration

**In Supabase SQL Editor:**

1. Open your project at https://supabase.com/dashboard/project/YOUR_PROJECT
2. Go to **SQL Editor**
3. Copy contents of `supabase/migrations/20260211_add_image_paths.sql`
4. Run the migration
5. Verify success (should see "Success. No rows returned")

**What it does:**
- Adds `image_path` and `label_image_path` columns
- Adds indexes for efficient queries
- **Safe:** Keeps existing data untouched

---

### STEP 2: Deploy Edge Function

**In your terminal:**

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Deploy the backfill Edge Function
supabase functions deploy backfill-image-paths

# Verify deployment
supabase functions list
```

**Expected output:**
```
backfill-image-paths (v1)
```

---

### STEP 3: Deploy App to Vercel

**Option A: Auto-deploy (if connected to main)**
```bash
# Merge feature branch to main
git checkout main
git merge feature/dark-mode-v2
git push origin main

# Vercel will auto-deploy
```

**Option B: Keep on feature branch for testing**
```bash
# Push feature branch
git push origin feature/dark-mode-v2

# Create preview deployment in Vercel Dashboard:
# - Select feature/dark-mode-v2 branch
# - Deploy as preview
```

---

### STEP 4: Run Backfill (Admin Only)

**After deployment is live:**

1. **Open your production app** (or preview)
2. **Log in as admin**
3. **Navigate to `/profile`**
4. **Scroll to "Image Path Backfill" section**
5. **Click "Refresh Counts"**
   - Should show how many images need backfilling
6. **Click "Start Backfill"**
   - Wait for progress bar to complete
   - Should see "Backfill complete!" toast
7. **Refresh any page with images**
   - Previously broken images should reappear ✨

---

### STEP 5: Verify

**Check Image Display:**
- [ ] Open cellar page
- [ ] Images load correctly
- [ ] No broken image icons
- [ ] No 403/404 errors in console

**Check Database:**
```sql
-- Verify paths were saved
SELECT 
  id,
  wine_name,
  image_path,
  label_image_path,
  image_url
FROM wines
WHERE image_path IS NOT NULL
LIMIT 5;

SELECT 
  id,
  image_path,
  label_image_path
FROM bottles  
WHERE image_path IS NOT NULL
LIMIT 5;
```

**Check New Uploads:**
- [ ] Upload a new label photo
- [ ] Verify it appears immediately
- [ ] Check DB: `image_path` column populated
- [ ] Refresh page → image still shows

---

## 🔍 Post-Deployment Monitoring

### Watch for Issues

**In Supabase Dashboard:**
1. **Edge Functions Logs** → Check backfill-image-paths for errors
2. **Database → Storage** → Verify buckets accessible
3. **Auth → Policies** → Ensure RLS policies work

**In Browser Console:**
```
[storageImageService] Cache hit: labels:userId/uuid.jpg  ✅
[storageImageService] Generated public URL: labels:userId/uuid.jpg  ✅
```

### Performance
- URL caching should prevent redundant requests
- Images should load quickly (cached URLs)
- No slowdown in page load times

---

## 🆘 Rollback Plan (If Needed)

### If Something Breaks

**Option 1: Revert Code Only (Keep Migration)**
```bash
git revert HEAD
git push origin feature/dark-mode-v2
```

**Option 2: Full Rollback (Code + Migration)**
```bash
# Revert code
git revert HEAD
git push

# Revert migration (in Supabase SQL Editor)
ALTER TABLE bottles DROP COLUMN IF EXISTS image_path;
ALTER TABLE bottles DROP COLUMN IF EXISTS label_image_path;
ALTER TABLE wines DROP COLUMN IF EXISTS image_path;
ALTER TABLE wines DROP COLUMN IF EXISTS label_image_path;
```

**Safe:** Old `*_url` columns are untouched, so legacy flow still works

---

## 📞 Support

### Common Issues

**Issue:** Images still broken after backfill
**Fix:** Check if URLs are actually Supabase Storage URLs (not external)

**Issue:** New uploads not showing
**Fix:** Clear browser cache, check network tab for errors

**Issue:** Backfill shows 0 needing backfill but images broken
**Fix:** URLs might not match pattern. Check DB manually:
```sql
SELECT image_url FROM bottles WHERE image_url LIKE '%supabase%' LIMIT 5;
```

---

**Ready to deploy!** 🚀

Follow steps 1-5 in order. Test locally first if possible.
