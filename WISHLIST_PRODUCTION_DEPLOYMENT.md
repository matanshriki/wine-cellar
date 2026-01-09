# 🚀 Wishlist Feature - Production Deployment Guide

## ✅ Deployment Ready

The Wishlist feature is now **production-ready** with real-time feature flag updates!

---

## 📋 What Changed

### **Task A: Production Readiness**
✅ Removed all dev-only guards from Wishlist feature
✅ Feature is now gated by `wishlist_enabled` flag (not localhost)
✅ Updated UI labels (removed "DEV" badges)
✅ Security: Routes are blocked when flag is false (not just UI hidden)

### **Task B: Real-Time Feature Flag Refresh**
✅ Implemented Supabase Realtime subscription to `profiles` table
✅ Flag changes reflect instantly (no logout/login required)
✅ Toast notifications when flags change:
   - "New feature enabled: Wishlist ✅" (when enabled)
   - "Wishlist feature disabled for your account" (when disabled)
✅ Auto-redirect from `/wishlist` if flag becomes false while user is on page
✅ Fallback: Window focus refresh (in case Realtime missed an update)
✅ Fail-closed: If fetch fails, feature is disabled by default

### **Task C: Documentation & Verification**
✅ Updated README.md with Wishlist feature description
✅ Updated database schema documentation
✅ Added deployment environment variables guide
✅ Updated migration list (includes new wishlist tables)
✅ Build passes successfully (no TypeScript errors)

---

## 📂 Files Changed

### **Modified Files:**
1. `/apps/web/src/contexts/FeatureFlagsContext.tsx`
   - Added Supabase Realtime subscription for profile changes
   - Added `detectFlagChanges()` with toast notifications
   - Added auto-redirect when flags disable
   - Added window focus refresh as fallback
   
2. `/apps/web/src/pages/WishlistPage.tsx`
   - Removed "DEV" badge from header
   - Updated comments (no longer "dev-only")

3. `/apps/web/src/components/WishlistForm.tsx`
   - Updated title translation key (removed "(Dev)")

4. `/apps/web/src/i18n/locales/en.json`
   - Changed "Add to Wishlist (Dev)" → "Add to Wishlist"

5. `/README.md`
   - Added Wishlist to features list
   - Added `wishlist_items` table to schema docs
   - Added `wishlist_enabled` flag to profiles table docs
   - Added Wishlist usage guide (section 6)
   - Updated migration list with new wishlist migrations
   - Updated environment variables with deployment notes

### **Database Migrations (Already Created):**
- `apps/api/supabase/migrations/20240110_add_wishlist_feature_flag.sql`
- `apps/api/supabase/migrations/20240110_create_wishlist_items_table.sql`

---

## 🗄️ Database Setup (If Not Already Applied)

Run these migrations in **Supabase SQL Editor** (in order):

### 1. Add Wishlist Feature Flag
```sql
-- apps/api/supabase/migrations/20240110_add_wishlist_feature_flag.sql

ALTER TABLE profiles
ADD COLUMN wishlist_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE profiles
SET wishlist_enabled = FALSE
WHERE wishlist_enabled IS NULL;
```

### 2. Create Wishlist Items Table
```sql
-- apps/api/supabase/migrations/20240110_create_wishlist_items_table.sql

CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  producer TEXT,
  wine_name TEXT,
  vintage INT,
  region TEXT,
  country TEXT,
  grapes TEXT,
  color TEXT,
  image_url TEXT,
  restaurant_name TEXT,
  note TEXT,
  vivino_url TEXT,
  confidence JSONB
);

CREATE INDEX idx_wishlist_items_user_id ON wishlist_items (user_id);
CREATE INDEX idx_wishlist_items_created_at ON wishlist_items (created_at DESC);
CREATE INDEX idx_wishlist_items_search ON wishlist_items (lower(producer), lower(wine_name), lower(restaurant_name));

ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wishlist items."
ON wishlist_items FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wishlist items."
ON wishlist_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wishlist items."
ON wishlist_items FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wishlist items."
ON wishlist_items FOR DELETE
USING (auth.uid() = user_id);
```

### 3. Enable Realtime for Profiles Table

In **Supabase Dashboard > Database > Replication**:
- Find `profiles` table
- Enable Realtime for `UPDATE` events

---

## 🚀 Deployment Steps

### **Step 1: Verify Git Status**

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
git status
```

### **Step 2: Stage All Changes**

```bash
git add .
```

### **Step 3: Commit Changes**

**Suggested commit message:**

```bash
git commit -m "feat: Production-ready Wishlist with real-time feature flags

- Remove dev-only guards from Wishlist feature
- Implement Supabase Realtime for instant flag updates
- Add toast notifications when flags change
- Auto-redirect from /wishlist when flag disabled
- Update documentation (README, migrations, env vars)
- Fail-closed security: features disabled by default

Changes:
- FeatureFlagsContext: Realtime subscription + window focus fallback
- WishlistPage/Form: Remove DEV badges
- README: Add Wishlist docs and deployment guide
- Build passes ✅ (967.08 kB, 275.53 kB gzipped)

Feature flag rollout:
1. Deploy to production (all users see wishlist_enabled=false)
2. Enable for test users: UPDATE profiles SET wishlist_enabled=true WHERE email='test@example.com'
3. Users see changes instantly (no logout required)
4. Gradually roll out to more users"
```

### **Step 4: Push to GitHub**

```bash
git push origin main
```

### **Step 5: Deploy to Vercel**

Vercel will auto-deploy on push if connected to GitHub.

**OR manually deploy:**

```bash
vercel --prod
```

### **Step 6: Verify Environment Variables in Vercel**

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables**

Ensure these are set for **Production, Preview, and Development**:

```bash
# REQUIRED
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# OPTIONAL
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_ANALYTICS_ENABLED=true
VITE_FEATURE_GENERATED_LABEL_ART=true
```

### **Step 7: Update Supabase Auth URLs**

**Supabase Dashboard → Authentication → URL Configuration:**

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: Add your Vercel domains:
  ```
  http://localhost:5173
  https://your-app.vercel.app
  https://*.vercel.app
  ```

---

## 🧪 Post-Deployment Testing

### **1. Verify Feature Flag is Disabled by Default**

1. Login to your production app
2. Check that Wishlist is **NOT visible** in navigation
3. Try navigating to `/wishlist` → should redirect to `/cellar` with toast

### **2. Enable Wishlist for Test User**

In **Supabase SQL Editor**:

```sql
-- Replace with your test user's email
UPDATE profiles
SET wishlist_enabled = true
WHERE email = 'your-test-email@example.com';
```

### **3. Test Real-Time Flag Update**

**WITHOUT LOGGING OUT:**

1. Keep app open in browser
2. Run the SQL update above in Supabase
3. Within 1-2 seconds, you should see:
   - Toast: "New feature enabled: Wishlist ✅"
   - Wishlist appears in navigation menu
   - You can now access `/wishlist`

### **4. Test Flag Disable**

**While on the `/wishlist` page:**

```sql
UPDATE profiles
SET wishlist_enabled = false
WHERE email = 'your-test-email@example.com';
```

Expected behavior:
- Toast: "Wishlist feature disabled for your account"
- Immediate redirect to `/cellar`
- Wishlist disappears from navigation

### **5. Test Window Focus Fallback**

1. Enable flag in Supabase
2. Switch to another app/tab for 30 seconds
3. Switch back to the Wine Cellar app
4. Flag update should be reflected (silent refresh)

---

## 🎯 Gradual Rollout Strategy

### **Phase 1: Internal Testing (1-2 users)**
```sql
UPDATE profiles
SET wishlist_enabled = true
WHERE email IN (
  'admin@example.com',
  'tester@example.com'
);
```

### **Phase 2: Beta Users (10-20 users)**
```sql
UPDATE profiles
SET wishlist_enabled = true
WHERE email LIKE '%@yourdomain.com'; -- Your domain
```

### **Phase 3: Public Rollout (All users)**
```sql
UPDATE profiles
SET wishlist_enabled = true;
```

**To disable for everyone (emergency rollback):**
```sql
UPDATE profiles
SET wishlist_enabled = false;
```

---

## 🔒 Security Checklist

✅ **UI Gating**: Wishlist navigation hidden when flag is false
✅ **Route Gating**: `/wishlist` redirects to `/cellar` when flag is false
✅ **Database RLS**: `wishlist_items` table has user-scoped policies
✅ **Fail Closed**: If flag fetch fails, defaults to disabled
✅ **Real-time Safety**: Flag changes trigger immediate UI updates + redirects
✅ **Session Persistence**: Works without logout/login

---

## 📈 Monitoring

### **Check Realtime Subscription Status**

In browser console (while logged in):

```javascript
// Should see these logs:
// [FeatureFlagsContext] Setting up Realtime subscription for user: <uuid>
// [FeatureFlagsContext] Realtime subscription status: SUBSCRIBED
```

### **Test Manual Refetch**

```javascript
// In browser console
window.location.reload(); // Should re-fetch flags on load
```

### **Check Flag State**

```javascript
// In browser console (React DevTools)
// Look for FeatureFlagsContext provider
// flags: { wishlistEnabled: true/false }
```

---

## 🐛 Troubleshooting

### **Flag changes not reflecting instantly**

1. Check Supabase Realtime is enabled for `profiles` table:
   - Dashboard → Database → Replication → `profiles` → Enable
2. Check browser console for Realtime subscription status:
   - Should say "SUBSCRIBED"
3. Fallback: Focus refresh should pick it up within 1-2 seconds

### **"Wishlist is not enabled for your account" on access**

- Expected behavior if flag is false
- Enable flag in Supabase SQL Editor for that user

### **Build fails on Vercel**

- Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Vercel env vars
- Check root directory is set to `apps/web` in Vercel settings

### **Realtime not working on production**

- Supabase free tier includes Realtime
- Ensure Realtime is enabled for your project in Supabase Dashboard
- Check quota limits (shouldn't be an issue for profile updates)

---

## 📊 Performance Notes

- **Build size**: 967 KB (275 KB gzipped) - within acceptable range
- **Realtime overhead**: Minimal (single subscription per user session)
- **Flag fetch**: Cached in React Context, only fetched on auth change
- **Focus refresh**: Debounced, minimal impact on performance

---

## ✅ Deployment Checklist

Before pushing to production:

- [x] Remove dev-only guards
- [x] Implement real-time flag updates
- [x] Add toast notifications
- [x] Add route protection
- [x] Update documentation
- [x] Verify build passes
- [x] Test migrations in Supabase
- [x] Update README.md

After deployment:

- [ ] Run migrations in production Supabase
- [ ] Enable Realtime for profiles table
- [ ] Verify env vars in Vercel
- [ ] Test flag enable/disable with test user
- [ ] Test real-time updates (no logout)
- [ ] Monitor Realtime subscription status
- [ ] Gradual rollout to users

---

## 🎉 Ready to Deploy!

Run these commands when you're ready:

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
git add .
git commit -m "feat: Production-ready Wishlist with real-time feature flags"
git push origin main
```

Then monitor Vercel deployment dashboard or run:

```bash
vercel --prod
```

**Note**: Vercel auto-deploys if GitHub integration is set up.

---

**Questions or issues?** Check the troubleshooting section above or review the changes in:
- `apps/web/src/contexts/FeatureFlagsContext.tsx` (Realtime logic)
- `apps/web/src/services/featureFlagsService.ts` (Flag fetching)
- `README.md` (Comprehensive docs)

Good luck with the deployment! 🚀🍷

