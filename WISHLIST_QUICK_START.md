# Wishlist Feature - Quick Start Guide

## 🚀 Quick Deployment (5 Minutes)

### **Step 1: Run Database Migrations** (2 min)

Open Supabase SQL Editor and run these two migrations in order:

1. **Migration 1:** `apps/api/supabase/migrations/20240110_add_wishlist_feature_flag.sql`
2. **Migration 2:** `apps/api/supabase/migrations/20240110_create_wishlist_items_table.sql`

### **Step 2: Deploy Code** (2 min)

```bash
npm run build
# Deploy to your hosting (Vercel, Netlify, etc.)
```

### **Step 3: Enable for Test User** (1 min)

In Supabase SQL Editor:

```sql
UPDATE profiles 
SET wishlist_enabled = true 
WHERE email = 'your-email@example.com';
```

**Important:** User must refresh page or re-login to see the feature.

---

## ✅ Quick Test

1. Log out and log back in
2. Check if "Wishlist" appears in navigation
3. Click "Add Bottle" → Upload a wine label photo
4. Click "Add to Wishlist" (amber button)
5. Review extracted data → Save
6. Navigate to Wishlist page
7. Click "Move to Cellar" on an item
8. Verify it appears in your cellar

---

## 🔧 Enable for More Users

```sql
-- Enable for specific users
UPDATE profiles 
SET wishlist_enabled = true 
WHERE email IN ('user1@example.com', 'user2@example.com');

-- Enable for everyone (full rollout)
UPDATE profiles 
SET wishlist_enabled = true;
```

---

## 🛑 Emergency Disable

```sql
-- Disable for everyone
UPDATE profiles 
SET wishlist_enabled = false;
```

No code rollback needed!

---

## 📋 Files Changed

**New Files:**
- `apps/api/supabase/migrations/20240110_add_wishlist_feature_flag.sql`
- `apps/api/supabase/migrations/20240110_create_wishlist_items_table.sql`
- `apps/web/src/services/featureFlagsService.ts`
- `apps/web/src/contexts/FeatureFlagsContext.tsx`

**Modified Files:**
- `apps/web/src/services/wishlistService.ts` (localStorage → Supabase)
- `apps/web/src/App.tsx` (added FeatureFlagsProvider, route protection)
- `apps/web/src/components/Layout.tsx` (conditional nav item)
- `apps/web/src/components/AddBottleSheet.tsx` (conditional button)
- `apps/web/src/pages/CellarPage.tsx` (feature flag check)
- `apps/web/src/pages/WishlistPage.tsx` (async operations)
- `apps/web/src/components/WishlistForm.tsx` (async operations)

---

## 🔐 Security

- ✅ Feature flag stored in database (not client-side)
- ✅ Row-Level Security on wishlist data
- ✅ Users can only see their own wishlist items
- ✅ Route protection (redirects if disabled)
- ✅ UI gating (hidden if disabled)
- ✅ Fail-closed (defaults to disabled on errors)

---

## 📖 Full Documentation

See `WISHLIST_FEATURE_ROLLOUT.md` for:
- Detailed testing checklist
- Rollout strategy
- Monitoring queries
- Troubleshooting guide

---

## ❓ FAQ

**Q: User doesn't see wishlist after I enabled it?**  
A: User needs to refresh page or re-login. Feature flags are cached.

**Q: Can I enable it for just a few users?**  
A: Yes! Just update `wishlist_enabled = true` for specific users in the `profiles` table.

**Q: What if something breaks?**  
A: Run `UPDATE profiles SET wishlist_enabled = false;` to disable for everyone. No code changes needed.

**Q: Where is wishlist data stored?**  
A: In the `wishlist_items` table in Supabase with Row-Level Security.

---

**Ready to roll out!** 🎉
