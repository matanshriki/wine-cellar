# 🔧 Fix "Bucket not found" Error for Avatar Upload

## **Problem**
When uploading a profile photo, you see: **"Bucket not found"**

## **Root Cause**
The Supabase Storage bucket for avatars hasn't been created in your production database yet.

---

## **Fix (5 minutes)**

### **Step 1: Open Supabase Dashboard**
1. Go to: https://supabase.com/dashboard
2. Select your project: **pktelrzyllbwrmcfgocx**
3. Click **"SQL Editor"** in the left sidebar

### **Step 2: Run the SQL**
1. Click **"New Query"**
2. Copy and paste this SQL:

```sql
-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create storage policies
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
```

3. Click **"Run"** (or press Ctrl/Cmd + Enter)
4. Wait for success message

### **Step 3: Verify Bucket Created**
1. In the same SQL Editor, run this verification query:

```sql
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'avatars';
```

2. You should see:
```
id: avatars
name: avatars
public: true
file_size_limit: 5242880
```

### **Step 4: Test Upload**
1. Go back to your app: https://wine-cellar-brain.vercel.app
2. Navigate to Profile page
3. Click "Upload Photo"
4. Select/take a photo
5. Should now work! ✅

---

## **Alternative: Create Bucket via UI**

If SQL doesn't work, you can create the bucket via UI:

1. In Supabase Dashboard → **Storage**
2. Click **"New Bucket"**
3. Settings:
   - **Name**: `avatars`
   - **Public**: ✅ Yes
   - **File size limit**: `5MB`
   - **Allowed MIME types**: `image/jpeg, image/jpg, image/png, image/webp, image/gif`
4. Click **"Create"**
5. Then click on the `avatars` bucket → **"Policies"**
6. Add these 4 policies:
   - **Upload own avatar**: `INSERT` for authenticated users where `auth.uid() = (storage.foldername(name))[1]`
   - **Update own avatar**: `UPDATE` for authenticated users where `auth.uid() = (storage.foldername(name))[1]`
   - **Delete own avatar**: `DELETE` for authenticated users where `auth.uid() = (storage.foldername(name))[1]`
   - **Read all avatars**: `SELECT` for everyone

---

## **Troubleshooting**

### **Error: "relation already exists"**
- Some policies may already exist. That's OK!
- The SQL uses `ON CONFLICT DO NOTHING` to skip existing items

### **Error: "permission denied"**
- Make sure you're logged in as the project owner
- Check that RLS is enabled on `storage.objects`

### **Upload still fails after running SQL**
1. Check browser console for errors (F12 → Console tab)
2. Verify your Supabase project URL is correct in `.env`
3. Try logging out and back in to refresh auth token
4. Check Storage → Buckets in Supabase dashboard to confirm `avatars` exists

### **Photo uploads but doesn't show**
- The bucket must be **public** (check in Storage settings)
- RLS policies must allow `SELECT` for everyone
- Check the `avatar_url` in your profile table

---

## **Files Reference**

- **Migration file**: `/supabase/migrations/20251226_avatar_storage.sql`
- **Fix SQL**: `/AVATAR_STORAGE_FIX.sql` (just created)
- **This guide**: `/FIX_AVATAR_UPLOAD.md`

---

## **What This Does**

1. ✅ Creates `avatars` storage bucket (public, 5MB limit)
2. ✅ Enables Row Level Security on storage
3. ✅ Allows users to upload/update/delete their own avatars
4. ✅ Allows anyone to view avatars (for display across app)
5. ✅ Stores avatars at: `avatars/{user_id}/avatar.{ext}`

---

## **After Fix Works**

Your profile photo upload will work and photos will be stored at:
```
https://pktelrzyllbwrmcfgocx.supabase.co/storage/v1/object/public/avatars/{your_user_id}/avatar.jpg
```

The photo will appear:
- In the user menu (top right)
- On the profile page
- Anywhere your name appears in the app

---

**Need Help?** If this doesn't work, share:
1. The error message from browser console (F12)
2. Screenshot of Storage → Buckets in Supabase dashboard
3. Result of the verification SQL query


