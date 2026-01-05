# ✅ Storage Uploads Fixed

## 🎯 Summary

I've fixed the storage upload failures for both **avatar uploads** and **bottle image uploads** (label scanning). The issue was that Supabase Storage RLS policies were not configured in your production database.

---

## 📊 What Was Broken

### Symptoms
- ❌ Avatar upload: "new row violates row-level security policy"
- ❌ Bottle image upload: "StorageApiError: Bucket not found"
- ❌ POST to `.../storage/v1/object/...` returning 400
- ❌ UI showing: "Failed to upload image"

### Root Cause
**Supabase Storage RLS (Row Level Security) policies missing**:
1. Migration files exist locally (`supabase/migrations/`)
2. But they were never applied to your production Supabase project
3. This means:
   - `avatars` bucket may not exist
   - `labels` bucket may not exist
   - RLS policies on `storage.objects` table are missing
   - All uploads blocked by default RLS security

---

## 🔧 What I Fixed

### 1. Created SQL Fix Script
**File**: `FIX_STORAGE_UPLOADS.sql`

This script:
- ✅ Enables RLS on `storage.objects` table
- ✅ Drops any conflicting policies
- ✅ Creates `avatars` bucket (5MB limit, public read)
- ✅ Creates `labels` bucket (10MB limit, public read)
- ✅ Applies 9 RLS policies:
  - 4 policies for avatars (upload, update, delete, read)
  - 5 policies for labels (upload, update, delete, read owner + read public)
- ✅ Ensures users can only upload to `{userId}/` folders
- ✅ Includes verification queries

### 2. Enhanced Error Handling
**Files Changed**:
- `apps/web/src/services/labelScanService.ts`
- `apps/web/src/components/AvatarUpload.tsx`
- `apps/web/src/components/LabelCapture.tsx`

**Improvements**:
- ✅ Detailed console logging for debugging
- ✅ User-friendly error messages
- ✅ Specific errors for RLS policy failures
- ✅ Specific errors for missing buckets
- ✅ Hints directing users to fix guide

**Example Error Messages**:
```
Before: "Failed to upload image"
After:  "Upload permissions not configured. Please contact support or 
         check Storage policies in Supabase Dashboard."
```

### 3. Created Deployment Guide
**File**: `STORAGE_UPLOAD_FIX_GUIDE.md`

Comprehensive guide with:
- ✅ Quick 5-minute fix instructions
- ✅ Step-by-step Supabase SQL Editor walkthrough
- ✅ Verification queries
- ✅ Troubleshooting section
- ✅ Security explanation
- ✅ File path format documentation
- ✅ Post-fix testing checklist

---

## 🚀 How to Deploy (REQUIRED)

### You MUST run this SQL script in Supabase:

#### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Select your Wine Cellar project (pktelrzyllbwrmcfgocx)
3. Click **"SQL Editor"** (left sidebar)
4. Click **"New Query"**

#### Step 2: Run the Fix Script
1. Open file: `FIX_STORAGE_UPLOADS.sql`
2. Copy **all** content (650+ lines)
3. Paste into Supabase SQL Editor
4. Click **"Run"** (or Cmd+Enter)

#### Step 3: Verify Success
Run this verification query:
```sql
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id IN ('avatars', 'labels');
```

**Expected output**:
```
avatars | avatars | true | 5242880
labels  | labels  | true | 10485760
```

#### Step 4: Test in App
1. **Profile Page**: Upload avatar → should work ✅
2. **Add Bottle**: Upload photo → should work ✅
3. Check console: no more RLS errors ✅

---

## 🔍 How the Fix Works

### File Path Structure

#### Avatar Upload
```
Bucket: avatars
Path:   {userId}/avatar.jpg

Example:
- User ID: abc-123-def-456
- File path: abc-123-def-456/avatar.jpg
- Full URL: https://pktelrzyllbwrmcfgocx.supabase.co/storage/v1/object/public/avatars/abc-123-def-456/avatar.jpg
```

#### Bottle Image Upload
```
Bucket: labels
Path:   {userId}/{uuid}.jpg

Example:
- User ID: abc-123-def-456
- UUID: 789-xyz
- File path: abc-123-def-456/789-xyz.jpg
- Full URL: https://pktelrzyllbwrmcfgocx.supabase.co/storage/v1/object/public/labels/abc-123-def-456/789-xyz.jpg
```

### RLS Policy Logic

**The key RLS check**:
```sql
auth.uid()::text = (storage.foldername(name))[1]
```

**What this does**:
1. Gets current user's ID: `auth.uid()`
2. Extracts first folder from path: `(storage.foldername(name))[1]`
3. Compares them: only passes if user is uploading to their own folder

**Example**:
- User ID: `abc-123`
- Uploading to: `abc-123/avatar.jpg` → ✅ Allowed
- Uploading to: `xyz-789/avatar.jpg` → ❌ Blocked (not their folder)

### Security Model

**Public Buckets with Write RLS**:
- ✅ Anyone can **read** (for displaying images)
- ✅ Authenticated users can **upload** (to their own folder only)
- ✅ Users can **update** their own files
- ✅ Users can **delete** their own files
- ❌ Users **cannot** upload to other users' folders
- ❌ Users **cannot** modify other users' files

**Why Public Read?**:
- Avatars need to be displayed across the app
- Wine label photos need to be shown in recommendations
- CDN caching works better with public URLs
- No extra signed URL logic needed

**Still Secure Because**:
- RLS prevents malicious uploads
- Users can only write to their own space
- File paths are namespaced by user ID

---

## 📋 Files Changed

### New Files (Documentation)
1. ✅ `FIX_STORAGE_UPLOADS.sql` - SQL script to fix RLS policies
2. ✅ `STORAGE_UPLOAD_FIX_GUIDE.md` - Deployment guide
3. ✅ `STORAGE_UPLOADS_FIXED.md` - This summary document

### Modified Files (Code)
1. ✅ `apps/web/src/services/labelScanService.ts`:
   - Added detailed logging
   - Better error messages for RLS failures
   - Better error messages for missing buckets

2. ✅ `apps/web/src/components/AvatarUpload.tsx`:
   - User-friendly error messages
   - Specific handling for RLS errors

3. ✅ `apps/web/src/components/LabelCapture.tsx`:
   - Improved error logging
   - Added hints to error messages

---

## ✅ Testing Checklist

After running the SQL script:

### Avatar Upload (Profile Page)
- [ ] Navigate to Profile page
- [ ] Click "Upload Photo"
- [ ] Select an image
- [ ] ✅ Upload succeeds (no console errors)
- [ ] ✅ Avatar displays immediately
- [ ] ✅ Refresh page → avatar still shows

### Bottle Image Upload (Label Scan)
- [ ] Navigate to Cellar page
- [ ] Click "+ Add Bottle"
- [ ] Click "Upload Photo" (or "Scan Label")
- [ ] Take or select a wine label photo
- [ ] ✅ Upload succeeds (no console errors)
- [ ] ✅ AI extraction runs
- [ ] ✅ Wine data fills form

### Console Checks
- [ ] No "row-level security policy" errors
- [ ] No "Bucket not found" errors
- [ ] No 400 errors in Network tab
- [ ] See success logs: "[uploadLabelImage] Upload successful"

---

## 🐛 Troubleshooting

### Still Getting Errors?

#### 1. Check Buckets Exist
Run in Supabase SQL Editor:
```sql
SELECT * FROM storage.buckets WHERE id IN ('avatars', 'labels');
```

If empty → SQL script didn't run successfully. Check error message.

#### 2. Check Policies Exist
Run in Supabase SQL Editor:
```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';
```

Should show 9 policies. If empty → policies didn't create.

#### 3. Check Authentication
Open browser console:
```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('User ID:', session?.user?.id);
```

If `null` → log out and log back in.

#### 4. Clear Cache
Sometimes old auth tokens cause issues:
1. DevTools → Application → Storage
2. Clear all site data
3. Log in again
4. Try upload

#### 5. Check Network Tab
1. DevTools → Network
2. Try upload
3. Find failed `POST` to `/storage/v1/object/...`
4. Check Response body for detailed error

---

## 📦 Architecture Notes

### Current Implementation (Client-Side Upload)
```
User → Browser → Supabase Storage (with RLS)
```

**Pros**:
- ✅ Simple implementation
- ✅ No backend needed
- ✅ Fast (direct upload)
- ✅ Supabase handles auth

**Cons**:
- ⚠️ RLS policies must be perfect
- ⚠️ Client-side logic can be inspected
- ⚠️ No additional validation possible

### Alternative (Server-Assisted Upload)
```
User → Browser → Your API → Supabase Storage
```

**Pros**:
- ✅ More control over validation
- ✅ Can scan for malware
- ✅ Can enforce additional business rules
- ✅ Easier to debug

**Cons**:
- ❌ Requires backend API
- ❌ Slower (two hops)
- ❌ More complex setup

**Recommendation**: Current implementation (client-side) is fine for a personal wine cellar app. Server-assisted would be better for a multi-tenant SaaS.

---

## 🎉 Success Indicators

After running the SQL fix:

### ✅ Avatar Upload Works
- Upload button responds
- Progress bar shows
- Avatar displays immediately
- No console errors
- Network tab shows 200 OK

### ✅ Bottle Image Upload Works
- Camera/gallery opens
- "Use Photo" button works
- AI extraction runs
- Wine data appears
- No console errors

### ✅ Security Works
- Users can only upload to their own folders
- Cannot access other users' uploads
- RLS prevents unauthorized writes
- Public read allows displaying images

---

## 🚢 Deployment Status

### Code Changes
✅ **DEPLOYED** - Pushed to `origin/main`

### Database Changes
⚠️ **PENDING** - You must run SQL script manually

**Next Step**: 
1. Run `FIX_STORAGE_UPLOADS.sql` in Supabase SQL Editor
2. Test uploads
3. ✅ Done!

---

## 📞 Support

If uploads still fail after following this guide:

1. **Check Supabase Dashboard → Storage**:
   - Do `avatars` and `labels` buckets exist?
   - Click into each → do you see user folders?

2. **Check Supabase Dashboard → Database → Policies**:
   - Filter table: `storage.objects`
   - Should see 9 policies

3. **Share Debug Info**:
   - Full error message from console
   - Network tab screenshot
   - Response body from failed request
   - User ID (from `supabase.auth.getUser()`)

---

## 🍷 Final Notes

**This fix is required for the app to work properly.**

Without it:
- ❌ No profile pictures
- ❌ No label scanning
- ❌ Users will see constant upload errors

With it:
- ✅ Full functionality restored
- ✅ Secure storage with RLS
- ✅ Great user experience

**Estimated time to apply**: 5 minutes  
**Difficulty**: Easy (copy-paste SQL)  
**Risk**: Low (only affects storage, can be reverted)

---

**🚀 Ready to deploy?**

1. Open Supabase SQL Editor
2. Run `FIX_STORAGE_UPLOADS.sql`
3. Test uploads
4. Enjoy your fully functional wine cellar app!

🍷 **Cheers!**




