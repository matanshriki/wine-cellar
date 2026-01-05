# ⚠️ RUN THIS NOW TO FIX UPLOADS

## The Error You're Seeing:
```
Storage bucket not found. Please ensure the "labels" bucket exists in Supabase Storage.
```

## The Fix (5 Minutes):

### Step 1: Open Supabase SQL Editor
1. Go to: **https://supabase.com/dashboard**
2. Click on your **Wine Cellar** project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New Query"**

### Step 2: Copy This SQL
Open the file **`FIX_STORAGE_UPLOADS.sql`** in this repo and copy ALL the content.

### Step 3: Paste and Run
1. Paste the SQL into the editor
2. Click **"Run"** (or press Cmd+Enter)
3. Wait for "Success. No rows returned"

### Step 4: Verify
Run this query:
```sql
SELECT id, name FROM storage.buckets WHERE id IN ('avatars', 'labels');
```

You should see:
```
avatars | avatars
labels  | labels
```

### Step 5: Try Upload Again
- Reload your app
- Try uploading a bottle image
- ✅ Should work now!

---

## Why This Happens
The storage buckets don't exist in your Supabase project yet. The SQL script creates them and sets up permissions.

## After Running SQL
- Avatar uploads will work
- Bottle image uploads will work
- No more "bucket not found" errors

---

**This is a ONE-TIME setup.** Once you run the SQL, uploads will work forever.

🍷 Do this now, then try uploading again!




