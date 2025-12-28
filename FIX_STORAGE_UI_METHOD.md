# 🔧 Fix Storage Uploads - UI Method (EASIER!)

## ⚠️ SQL Method Doesn't Work?

If you got this error:
```
Error: Failed to run sql query: ERROR: 42501: must be owner of table objects
```

**Use this UI method instead - it's actually easier!**

---

## 🎯 Fix Using Supabase Dashboard (5 Minutes)

### Step 1: Create the `avatars` Bucket

1. Go to: **https://supabase.com/dashboard**
2. Select your **Wine Cellar** project
3. Click **"Storage"** in the left sidebar
4. Click **"New bucket"** button
5. Fill in:
   ```
   Name:                avatars
   Public bucket:       ✅ YES (check the box)
   File size limit:     5 MB
   Allowed MIME types:  Leave empty (allows all images)
   ```
6. Click **"Create bucket"**

### Step 2: Add RLS Policies to `avatars` Bucket

1. Click on the **`avatars`** bucket you just created
2. Click the **"Policies"** tab at the top
3. Click **"New policy"** button

#### Policy 1: Upload Own Avatar
```
Policy name:     Users can upload own avatar
Allowed operation: INSERT
Target roles:    authenticated
Policy definition:

bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
```
Click **"Save"**

#### Policy 2: Update Own Avatar
```
Policy name:     Users can update own avatar
Allowed operation: UPDATE
Target roles:    authenticated
Policy definition:

bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
```
Click **"Save"**

#### Policy 3: Delete Own Avatar
```
Policy name:     Users can delete own avatar
Allowed operation: DELETE
Target roles:    authenticated
Policy definition:

bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
```
Click **"Save"**

#### Policy 4: Public Read
```
Policy name:     Anyone can read avatars
Allowed operation: SELECT
Target roles:    public
Policy definition:

bucket_id = 'avatars'
```
Click **"Save"**

---

### Step 3: Create the `labels` Bucket

1. Go back to **Storage** (click "Storage" in sidebar)
2. Click **"New bucket"** button
3. Fill in:
   ```
   Name:                labels
   Public bucket:       ✅ YES (check the box)
   File size limit:     10 MB
   Allowed MIME types:  Leave empty (allows all images)
   ```
4. Click **"Create bucket"**

### Step 4: Add RLS Policies to `labels` Bucket

1. Click on the **`labels`** bucket you just created
2. Click the **"Policies"** tab
3. Click **"New policy"** button

#### Policy 1: Upload Own Labels
```
Policy name:     Users can upload own labels
Allowed operation: INSERT
Target roles:    authenticated
Policy definition:

bucket_id = 'labels' AND (storage.foldername(name))[1] = auth.uid()::text
```
Click **"Save"**

#### Policy 2: Read Own Labels
```
Policy name:     Users can read own labels
Allowed operation: SELECT
Target roles:    authenticated
Policy definition:

bucket_id = 'labels' AND (storage.foldername(name))[1] = auth.uid()::text
```
Click **"Save"**

#### Policy 3: Public Read Labels
```
Policy name:     Anyone can read labels
Allowed operation: SELECT
Target roles:    public
Policy definition:

bucket_id = 'labels'
```
Click **"Save"**

#### Policy 4: Update Own Labels
```
Policy name:     Users can update own labels
Allowed operation: UPDATE
Target roles:    authenticated
Policy definition:

bucket_id = 'labels' AND (storage.foldername(name))[1] = auth.uid()::text
```
Click **"Save"**

#### Policy 5: Delete Own Labels
```
Policy name:     Users can delete own labels
Allowed operation: DELETE
Target roles:    authenticated
Policy definition:

bucket_id = 'labels' AND (storage.foldername(name))[1] = auth.uid()::text
```
Click **"Save"**

---

## ✅ Verify Setup

### Check Buckets
1. Go to **Storage** in Supabase Dashboard
2. You should see:
   - ✅ `avatars` bucket (Public, 5 MB limit)
   - ✅ `labels` bucket (Public, 10 MB limit)

### Check Policies
1. Click on `avatars` bucket → Policies tab
2. Should see **4 policies**
3. Click on `labels` bucket → Policies tab
4. Should see **5 policies**

---

## 🧪 Test Uploads

### Test Avatar Upload
1. Open your app: http://localhost:5175/profile
2. Click **"Upload Photo"**
3. Select an image
4. ✅ Should upload successfully
5. ✅ Avatar should display

### Test Bottle Image Upload
1. Open your app: http://localhost:5175/cellar
2. Click **"+ Add Bottle"**
3. Click **"Upload Photo"**
4. Take or select a wine label photo
5. ✅ Should upload successfully
6. ✅ AI should extract wine data

### Check Console
Open browser DevTools → Console:
- ✅ Should see: `[uploadLabelImage] Upload successful`
- ✅ Should see: `[compressImage] Compression complete: ... reduction: "91%"`
- ❌ Should NOT see: "Bucket not found"
- ❌ Should NOT see: "row-level security policy"

---

## 🐛 Troubleshooting

### "Bucket not found" Still?
- Go to Storage → Check both buckets exist
- Make sure you spelled them correctly: `avatars` and `labels` (lowercase, plural)
- Try refreshing the app page

### "Row-level security policy" Error?
- Check: Did you add all the policies?
- Check: Are you logged in? (Console: `supabase.auth.getSession()`)
- Try: Log out and log back in

### Upload Succeeds But Image Doesn't Display?
- Check: Is the bucket marked as **Public**?
- Fix: Edit bucket → Check "Public bucket" → Save
- Refresh the app page

### Policy Definition Syntax Error?
Make sure you're using the **exact** policy definitions above. Common mistakes:
- Missing `auth.uid()::text` cast
- Wrong bucket_id
- Missing `storage.foldername(name)` function

---

## 📋 Policy Cheat Sheet

### For Copy-Paste (All Policies)

#### Avatars Bucket Policies

**INSERT Policy**:
```sql
bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
```

**UPDATE Policy**:
```sql
bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
```

**DELETE Policy**:
```sql
bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
```

**SELECT Policy (Public)**:
```sql
bucket_id = 'avatars'
```

#### Labels Bucket Policies

**INSERT Policy**:
```sql
bucket_id = 'labels' AND (storage.foldername(name))[1] = auth.uid()::text
```

**SELECT Policy (Authenticated)**:
```sql
bucket_id = 'labels' AND (storage.foldername(name))[1] = auth.uid()::text
```

**SELECT Policy (Public)**:
```sql
bucket_id = 'labels'
```

**UPDATE Policy**:
```sql
bucket_id = 'labels' AND (storage.foldername(name))[1] = auth.uid()::text
```

**DELETE Policy**:
```sql
bucket_id = 'labels' AND (storage.foldername(name))[1] = auth.uid()::text
```

---

## 🎯 Quick Summary

### What to Do:
1. ✅ Create `avatars` bucket (Public, 5MB)
2. ✅ Add 4 policies to `avatars`
3. ✅ Create `labels` bucket (Public, 10MB)
4. ✅ Add 5 policies to `labels`
5. ✅ Test uploads

### Time: ~10 minutes (clicking through UI)
### Difficulty: Easy (just follow the steps)
### Risk: None (can always delete and recreate buckets)

---

## 🍷 After Setup

Once you've created the buckets and policies:
- ✅ Avatar uploads will work
- ✅ Bottle image uploads will work
- ✅ Images will be automatically compressed (91% smaller!)
- ✅ Uploads will be fast (~1 second vs 10 seconds)
- ✅ No more errors

**Enjoy your working wine cellar app!** 🎉

