# Wishlist Feature - Production Rollout Guide

## 📋 Overview

This document describes the production-ready rollout of the **Wishlist** feature for Wine Cellar Brain. The feature is **feature-flagged** at the database level, allowing per-user enablement without code changes.

**Status:** ✅ Ready for production deployment  
**Feature Flag:** `profiles.wishlist_enabled` (boolean, default: `false`)  
**Storage:** Supabase `wishlist_items` table with RLS

---

## 🎯 Feature Summary

The Wishlist feature allows users to:
- Save wines they want to purchase later (based on photo extraction or manual entry)
- Store metadata: restaurant name, personal notes, label photos
- Move wishlist items to their cellar when purchased
- Search and filter wishlist items

**Security:**
- ✅ Feature-flagged per user in database
- ✅ Row-Level Security (RLS) on all wishlist data
- ✅ Route protection (redirects if flag disabled)
- ✅ UI gating (hidden if flag disabled)
- ✅ Fail-closed approach (defaults to disabled on errors)

---

## 📁 Files Changed

### **New Files Created**

1. **SQL Migrations:**
   - `apps/api/supabase/migrations/20240110_add_wishlist_feature_flag.sql`
   - `apps/api/supabase/migrations/20240110_create_wishlist_items_table.sql`

2. **Feature Flags Infrastructure:**
   - `apps/web/src/services/featureFlagsService.ts`
   - `apps/web/src/contexts/FeatureFlagsContext.tsx`

### **Modified Files**

3. **Services:**
   - `apps/web/src/services/wishlistService.ts` - Migrated from localStorage to Supabase

4. **App Infrastructure:**
   - `apps/web/src/App.tsx` - Added FeatureFlagsProvider, FeatureFlagRoute

5. **UI Components:**
   - `apps/web/src/components/Layout.tsx` - Conditional wishlist nav item
   - `apps/web/src/components/AddBottleSheet.tsx` - Conditional wishlist button
   - `apps/web/src/pages/CellarPage.tsx` - Feature flag check for wishlist option
   - `apps/web/src/pages/WishlistPage.tsx` - Async operations, removed dev-only checks
   - `apps/web/src/components/WishlistForm.tsx` - Async operations

---

## 🗄️ Database Changes

### **Step 1: Add Feature Flag Column**

Run migration: `20240110_add_wishlist_feature_flag.sql`

```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS wishlist_enabled BOOLEAN NOT NULL DEFAULT false;
```

**What it does:**
- Adds `wishlist_enabled` column to `profiles` table
- Defaults to `false` for all users (feature disabled)
- Creates index for performance
- Existing RLS policies ensure users can only read their own profile

### **Step 2: Create Wishlist Items Table**

Run migration: `20240110_create_wishlist_items_table.sql`

```sql
CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  producer TEXT NOT NULL,
  wine_name TEXT NOT NULL,
  vintage INTEGER,
  region TEXT,
  country TEXT,
  grapes TEXT,
  color TEXT CHECK (color IN ('red', 'white', 'rose', 'sparkling')),
  restaurant_name TEXT,
  note TEXT,
  image_url TEXT,
  vivino_url TEXT,
  source TEXT DEFAULT 'wishlist-photo',
  extraction_confidence JSONB
);
```

**What it does:**
- Creates `wishlist_items` table with proper schema
- Enables Row-Level Security (RLS)
- Creates RLS policies (users can only CRUD their own items)
- Creates indexes for performance
- Adds `updated_at` trigger

---

## 🚀 Deployment Steps

### **Prerequisites**
- Supabase project with `profiles` table
- Admin access to Supabase SQL Editor

### **Step 1: Run Database Migrations**

1. Open Supabase Dashboard → SQL Editor
2. Run migration 1:
   ```bash
   # Copy contents of:
   apps/api/supabase/migrations/20240110_add_wishlist_feature_flag.sql
   ```
3. Run migration 2:
   ```bash
   # Copy contents of:
   apps/api/supabase/migrations/20240110_create_wishlist_items_table.sql
   ```
4. Verify:
   ```sql
   -- Check profiles column exists
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' AND column_name = 'wishlist_enabled';
   
   -- Check wishlist_items table exists
   SELECT * FROM wishlist_items LIMIT 1;
   
   -- Check RLS is enabled
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'wishlist_items';
   ```

### **Step 2: Deploy Code**

```bash
# Build and deploy (your normal deployment process)
npm run build
# Deploy to production (Vercel, Netlify, etc.)
```

**Important:** The feature will be **disabled by default** for all users.

### **Step 3: Enable for Test Users**

In Supabase SQL Editor:

```sql
-- Enable wishlist for a specific user
UPDATE profiles 
SET wishlist_enabled = true 
WHERE email = 'test@example.com';

-- Or by user ID
UPDATE profiles 
SET wishlist_enabled = true 
WHERE id = 'user-uuid-here';

-- Check who has it enabled
SELECT id, email, wishlist_enabled 
FROM profiles 
WHERE wishlist_enabled = true;
```

### **Step 4: Verify Rollout**

See [Testing Checklist](#-testing-checklist) below.

---

## 🧪 Testing Checklist

### **Test Case 1: Feature Disabled (Default)**

**User:** Any user with `wishlist_enabled = false`

✅ **Expected Behavior:**
- [ ] Wishlist nav item NOT visible in header/menu
- [ ] "Add to Wishlist" button NOT visible in add bottle flow
- [ ] Direct navigation to `/wishlist` redirects to `/cellar`
- [ ] Toast message: "Wishlist is not enabled for your account."
- [ ] No errors in console

**How to Test:**
1. Create a new user account
2. Verify `wishlist_enabled` is `false` in database
3. Check UI (no wishlist elements)
4. Try navigating to `https://your-app.com/wishlist` directly
5. Verify redirect to cellar

---

### **Test Case 2: Feature Enabled**

**User:** Test user with `wishlist_enabled = true`

✅ **Expected Behavior:**
- [ ] Wishlist nav item visible in header/menu
- [ ] "Add to Wishlist" button visible in add bottle flow (amber button)
- [ ] Can navigate to `/wishlist` page
- [ ] Can add wines to wishlist (via photo or manual)
- [ ] Can view wishlist items
- [ ] Can search/filter wishlist
- [ ] Can edit wishlist items
- [ ] Can remove wishlist items
- [ ] Can move items to cellar
- [ ] Moved items removed from wishlist

**How to Test:**
1. Enable feature for test user:
   ```sql
   UPDATE profiles SET wishlist_enabled = true WHERE email = 'your-email@example.com';
   ```
2. **Log out and log back in** (to reload feature flags)
3. Verify wishlist nav item appears
4. Click "Add Bottle" → Upload photo → Click "Add to Wishlist (dev)"
5. Review extracted data → Save to wishlist
6. Navigate to Wishlist page
7. Verify item appears
8. Test search
9. Test "Move to Cellar"
10. Verify item removed from wishlist and added to cellar

---

### **Test Case 3: Toggle After Login**

**Scenario:** Admin enables feature for a user who is already logged in

✅ **Expected Behavior:**
- [ ] Feature does NOT appear until user refreshes or re-logs in
- [ ] After refresh/re-login, feature appears

**How to Test:**
1. User A logs in (feature disabled)
2. Admin enables feature in database
3. User A does NOT see feature yet (cached flags)
4. User A refreshes page → Feature appears

---

### **Test Case 4: Failure Modes (Fail-Closed)**

**Scenario:** Database errors, network issues

✅ **Expected Behavior:**
- [ ] If profile fetch fails → Feature disabled (fail-closed)
- [ ] If wishlist_items fetch fails → Empty wishlist shown
- [ ] No app crashes
- [ ] Errors logged to console

**How to Test:**
1. Temporarily break database connection
2. Verify feature defaults to disabled
3. Restore connection
4. Verify feature works again

---

### **Test Case 5: RLS Security**

**Scenario:** User tries to access another user's wishlist items

✅ **Expected Behavior:**
- [ ] User can only see their own wishlist items
- [ ] Cannot query other users' items via API

**How to Test:**
1. Create User A and User B
2. Enable wishlist for both
3. User A adds items to wishlist
4. User B logs in
5. Verify User B does NOT see User A's items
6. (Optional) Try direct API call with User B's token to User A's item ID
7. Verify RLS blocks access

---

## 🔐 Security Considerations

### **Feature Flag Security**
- ✅ Feature flags stored in database (not client-side)
- ✅ Flags fetched on login and cached in React context
- ✅ Server-side RLS enforces access control
- ✅ Client-side checks are UI-only (not security boundary)

### **Data Security**
- ✅ Row-Level Security (RLS) on `wishlist_items` table
- ✅ Users can only CRUD their own items
- ✅ Foreign key cascade deletes wishlist on user deletion

### **Fail-Closed Approach**
- ✅ If feature flag fetch fails → Feature disabled
- ✅ If wishlist fetch fails → Empty list shown (not error)
- ✅ No sensitive data exposed in error messages

---

## 📊 Rollout Strategy

### **Phase 1: Internal Testing (Week 1)**
- Enable for internal team members (5-10 users)
- Test all flows thoroughly
- Fix any bugs

### **Phase 2: Beta Users (Week 2-3)**
- Enable for 50-100 beta users
- Monitor usage and errors
- Gather feedback

### **Phase 3: Gradual Rollout (Week 4+)**
- Enable for 10% of users
- Monitor performance and errors
- Increase to 25% → 50% → 100%

### **Rollback Plan**
If critical issues arise:
1. Disable feature for all users:
   ```sql
   UPDATE profiles SET wishlist_enabled = false;
   ```
2. No code rollback needed (feature just hidden)
3. Fix issues
4. Re-enable gradually

---

## 🛠️ How to Enable Wishlist for a User

### **Option 1: Supabase SQL Editor**

```sql
-- Enable for a specific user by email
UPDATE profiles 
SET wishlist_enabled = true 
WHERE email = 'user@example.com';

-- Enable for multiple users
UPDATE profiles 
SET wishlist_enabled = true 
WHERE email IN ('user1@example.com', 'user2@example.com');

-- Enable for all users (full rollout)
UPDATE profiles 
SET wishlist_enabled = true;
```

### **Option 2: Supabase Table Editor**

1. Open Supabase Dashboard
2. Go to Table Editor → `profiles`
3. Find the user row
4. Click on `wishlist_enabled` cell
5. Change to `true`
6. Save

### **Option 3: Build an Admin UI (Future Enhancement)**

Create an admin page to toggle feature flags via UI.

---

## 📈 Monitoring

### **Key Metrics to Track**

1. **Adoption:**
   ```sql
   -- How many users have wishlist enabled?
   SELECT COUNT(*) FROM profiles WHERE wishlist_enabled = true;
   
   -- How many users have added wishlist items?
   SELECT COUNT(DISTINCT user_id) FROM wishlist_items;
   ```

2. **Usage:**
   ```sql
   -- Total wishlist items
   SELECT COUNT(*) FROM wishlist_items;
   
   -- Average items per user
   SELECT AVG(item_count) FROM (
     SELECT user_id, COUNT(*) as item_count 
     FROM wishlist_items 
     GROUP BY user_id
   ) sub;
   ```

3. **Conversion:**
   ```sql
   -- How many wishlist items have been moved to cellar?
   -- (Track via tags: ['wishlist'] tag on bottles)
   SELECT COUNT(*) FROM bottles WHERE 'wishlist' = ANY(tags);
   ```

### **Error Monitoring**

Watch for:
- Console errors related to `[FeatureFlags]` or `[Wishlist]`
- Supabase RLS policy violations
- High failure rates on wishlist operations

---

## 🐛 Troubleshooting

### **Issue: User doesn't see wishlist after enabling**

**Solution:**
- User needs to refresh page or re-login
- Feature flags are cached in React context
- Flags reload on auth state change

### **Issue: "Wishlist is not enabled" despite flag being true**

**Checklist:**
1. Verify flag in database:
   ```sql
   SELECT email, wishlist_enabled FROM profiles WHERE email = 'user@example.com';
   ```
2. Check user has refreshed page
3. Check browser console for `[FeatureFlags]` logs
4. Verify no RLS policy issues

### **Issue: Cannot add items to wishlist**

**Checklist:**
1. Check browser console for errors
2. Verify RLS policies on `wishlist_items` table
3. Verify user is authenticated
4. Check Supabase logs for policy violations

---

## 📝 Summary

### **What Was Implemented**

✅ **Database:**
- `profiles.wishlist_enabled` column (feature flag)
- `wishlist_items` table with RLS

✅ **Infrastructure:**
- Feature flags service and React context
- Fail-closed approach (defaults to disabled)

✅ **Security:**
- Route protection (redirects if disabled)
- UI gating (hidden if disabled)
- RLS on all wishlist data

✅ **Features:**
- Add wines to wishlist (photo or manual)
- View/search/filter wishlist
- Edit wishlist items
- Remove wishlist items
- Move items to cellar

### **How to Enable for a User**

```sql
UPDATE profiles 
SET wishlist_enabled = true 
WHERE email = 'user@example.com';
```

User must **refresh page or re-login** to see the feature.

### **Rollback Plan**

```sql
-- Disable for all users (no code changes needed)
UPDATE profiles SET wishlist_enabled = false;
```

---

## 🎉 Ready for Production!

The Wishlist feature is now production-ready with:
- ✅ Per-user feature flags
- ✅ Secure database storage
- ✅ Row-Level Security
- ✅ Fail-closed approach
- ✅ Gradual rollout capability
- ✅ Easy rollback

**Next Steps:**
1. Run database migrations in production
2. Deploy code
3. Enable for test users
4. Verify functionality
5. Gradually roll out to all users

---

**Questions?** Check the code comments or Supabase logs for detailed debugging information.

