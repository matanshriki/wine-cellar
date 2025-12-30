# 🔧 Storage Upload Fix Guide

## Problem
- Avatar uploads fail with: "new row violates row-level security policy"
- Bottle image uploads fail with: "StorageApiError"
- Console shows 400 errors from Supabase Storage API

## Root Cause
**Supabase Storage RLS policies are not configured** in your production database. The migration files exist locally but haven't been applied to your Supabase project.

---

## 🚀 Quick Fix (5 Minutes)

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Select your Wine Cellar project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New Query"**

### Step 2: Run the Fix Script
1. Open the file: `FIX_STORAGE_UPLOADS.sql`
2. Copy **ALL** the SQL content
3. Paste into Supabase SQL Editor
4. Click **"Run"** (or press Cmd+Enter / Ctrl+Enter)

### Step 3: Verify Success
You should see:
```
Success. No rows returned
```

Then run this verification query:
```sql
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id IN ('avatars', 'labels');
```

Expected output:
```
avatars | avatars | true | 5242880
labels  | labels  | true | 10485760
```

### Step 4: Test in Your App
1. **Profile Page**: Try uploading an avatar
2. **Add Bottle**: Try uploading a wine label photo
3. ✅ Both should work without errors

---

## 📋 What This Fix Does

### 1. Creates Storage Buckets
- **`avatars`**: For user profile pictures (5MB limit)
- **`labels`**: For wine bottle label photos (10MB limit)

### 2. Enables Row Level Security (RLS)
- Protects storage from unauthorized access
- Only authenticated users can upload
- Users can only access their own files

### 3. Creates RLS Policies

#### Avatar Policies
- ✅ Users can **upload** to `avatars/{user_id}/avatar.jpg`
- ✅ Users can **update** their own avatar
- ✅ Users can **delete** their own avatar
- ✅ **Anyone** can view avatars (public bucket)

#### Label Image Policies
- ✅ Users can **upload** to `labels/{user_id}/{uuid}.jpg`
- ✅ Users can **read** their own label images
- ✅ Users can **update** their own label images
- ✅ Users can **delete** their own label images
- ✅ **Anyone** can view label images (public bucket)

---

## 🔍 Troubleshooting

### Still Getting Errors After Running SQL?

#### 1. Check Authentication
Open browser console and run:
```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('User ID:', session?.user?.id);
```

If `null`: User is not logged in. Log out and log back in.

#### 2. Check Bucket Creation
Run in Supabase SQL Editor:
```sql
SELECT * FROM storage.buckets;
```

If `avatars` or `labels` are missing: The INSERT failed. Check error message.

#### 3. Check Policies
Run in Supabase SQL Editor:
```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';
```

Should show 9 policies (4 for avatars, 5 for labels).

#### 4. Check File Path Format
The upload code must use the correct path format:
- Avatar: `{userId}/avatar.jpg` (no "avatars/" prefix)
- Label: `{userId}/{uuid}.jpg` (no "labels/" prefix)

The bucket name is specified in `.from('avatars')` or `.from('labels')`.

#### 5. Clear Browser Cache
Sometimes old auth tokens get cached:
1. Open DevTools → Application → Storage
2. Clear all site data
3. Log in again
4. Try upload

#### 6. Check Network Tab
1. Open DevTools → Network
2. Try upload
3. Find the failed `POST` request to `/storage/v1/object/...`
4. Check the response body for detailed error

---

## 🎯 Understanding the File Paths

### Avatar Upload
```typescript
// Code: AvatarUpload.tsx
const fileName = `${userId}/avatar.jpg`;

supabase.storage
  .from('avatars')  // Bucket name
  .upload(fileName, file);  // Path: avatars/{userId}/avatar.jpg
```

**RLS Check**: `(storage.foldername(name))[1] = auth.uid()::text`
- Extracts first folder: `{userId}`
- Compares to current user's ID
- ✅ Only passes if user is uploading to their own folder

### Label Upload
```typescript
// Code: labelScanService.ts
const fileName = `${userId}/${crypto.randomUUID()}.jpg`;

supabase.storage
  .from('labels')  // Bucket name
  .upload(fileName, compressedBlob);  // Path: labels/{userId}/{uuid}.jpg
```

**RLS Check**: Same logic, ensures `{userId}` matches `auth.uid()`

---

## 🔐 Security Explained

### Why Public Buckets?
- Buckets are marked `public: true`
- This means **anyone can read** the files (no auth required for viewing)
- This is intentional for:
  - Displaying avatars across the app
  - Showing wine label photos in recommendations

### Why RLS is Still Secure
Even though buckets are public:
- ✅ **Upload**: Only authenticated users, only to their own folder
- ✅ **Update**: Only authenticated users, only their own files
- ✅ **Delete**: Only authenticated users, only their own files
- ✅ **Read**: Anyone (needed for public display)

### Alternative: Private Buckets + Signed URLs
If you want stricter security:
1. Change `public: true` to `public: false`
2. Remove "public readable" policies
3. Generate signed URLs for displaying images:
   ```typescript
   const { data } = await supabase.storage
     .from('avatars')
     .createSignedUrl(fileName, 3600); // 1 hour expiry
   ```

**Trade-offs**:
- ✅ More secure
- ❌ URLs expire (need refresh logic)
- ❌ Extra API call per image
- ❌ CDN caching more complex

For a wine cellar app, **public buckets with RLS on write** are recommended.

---

## 📦 For Future Deployments

### Option A: Supabase CLI (Recommended for Teams)
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_ID

# Push migrations
supabase db push
```

This will apply all migration files in `/supabase/migrations/`.

### Option B: Manual SQL (Current Approach)
- Keep using the SQL Editor for one-time fixes
- Document all changes in migration files
- Apply manually when needed

---

## ✅ Post-Fix Checklist

After running the SQL fix:

- [ ] Avatar upload works (Profile page)
- [ ] Avatar displays after upload
- [ ] Avatar persists after page refresh
- [ ] Bottle image upload works (Add Bottle → Upload Photo)
- [ ] Label scan extracts wine data
- [ ] No console errors during upload
- [ ] No "row-level security policy" errors
- [ ] No 400 errors in Network tab

---

## 📞 Still Stuck?

If uploads still fail after following this guide:

1. **Check Supabase Dashboard → Storage**
   - Do you see `avatars` and `labels` buckets?
   - Click into each bucket - do you see folders like `{userId}`?

2. **Check Supabase Dashboard → Authentication**
   - Are you logged in?
   - Copy your User ID

3. **Check Supabase Dashboard → Database → Policies**
   - Filter table: `storage.objects`
   - You should see 9 policies

4. **Share Error Details**
   - Full error message from console
   - Network tab screenshot of failed request
   - Response body from failed request

---

## 🎉 Success!

Once uploads work:
- ✅ Upload your profile picture
- ✅ Add a bottle by scanning a wine label
- ✅ Enjoy your premium wine cellar app!

🍷 Cheers!



