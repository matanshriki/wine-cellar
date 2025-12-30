# Enable AI Label Generation Feature

## ✅ Step-by-Step Setup Guide

### 1. **Re-enable the Feature Code** ✅ (DONE)
The code is now re-enabled in `apps/web/src/services/labelArtService.ts`

---

### 2. **Set Environment Variables**

#### **Frontend (.env file)**
Add to `apps/web/.env`:
```bash
VITE_FEATURE_GENERATED_LABEL_ART=true
```

#### **Backend (Supabase Edge Function Secrets)**
Set these secrets in Supabase Dashboard:

**Option A: Via Supabase Dashboard**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Edge Functions**
4. Add these secrets:
   - `OPENAI_API_KEY` = your OpenAI API key
   - `AI_IMAGE_MODEL` = `dall-e-3` (optional, defaults to dall-e-3)
   - `AI_IMAGE_SIZE` = `1024x1024` (optional, defaults to 1024x1024)

**Option B: Via Supabase CLI**
```bash
# Set OpenAI API Key (REQUIRED)
npx supabase secrets set OPENAI_API_KEY=sk-your-key-here --project-ref YOUR_PROJECT_REF

# Optional: Set custom model
npx supabase secrets set AI_IMAGE_MODEL=dall-e-3 --project-ref YOUR_PROJECT_REF

# Optional: Set custom size
npx supabase secrets set AI_IMAGE_SIZE=1024x1024 --project-ref YOUR_PROJECT_REF
```

---

### 3. **Create Storage Bucket**

Run this SQL in Supabase SQL Editor:

```sql
-- Create storage bucket for generated label art
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-labels',
  'generated-labels',
  true,  -- Public bucket so images can be displayed
  10485760,  -- 10MB limit per file
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
CREATE POLICY IF NOT EXISTS "Users can upload their own generated labels"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'generated-labels' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY IF NOT EXISTS "Users can update their own generated labels"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'generated-labels' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY IF NOT EXISTS "Anyone can view generated labels"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'generated-labels');

CREATE POLICY IF NOT EXISTS "Users can delete their own generated labels"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'generated-labels' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

### 4. **Enable Feature for Your User**

Run this SQL in Supabase SQL Editor (replace with your email):

```sql
-- Enable AI Label Art for your user
UPDATE public.profiles 
SET ai_label_art_enabled = true 
WHERE email = 'your-email@example.com';

-- Or enable for ALL users:
-- UPDATE public.profiles SET ai_label_art_enabled = true;
```

**Verify it worked:**
```sql
SELECT email, ai_label_art_enabled 
FROM public.profiles 
WHERE email = 'your-email@example.com';
```

You should see `ai_label_art_enabled` = `true`

---

### 5. **Deploy Edge Function**

Deploy the `generate-label-art` Edge Function to Supabase:

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Deploy the Edge Function
npx supabase functions deploy generate-label-art --project-ref YOUR_PROJECT_REF

# Verify deployment
npx supabase functions list --project-ref YOUR_PROJECT_REF
```

**Find your project ref:**
- Supabase Dashboard → Project Settings → General → Reference ID

---

### 6. **Get an OpenAI API Key**

If you don't have one:

1. Go to [platform.openai.com](https://platform.openai.com/)
2. Sign up / Log in
3. Go to **API Keys** section
4. Click **Create new secret key**
5. Copy the key (starts with `sk-`)
6. Add credits to your account (DALL-E 3 costs ~$0.04 per image)

**Pricing:**
- DALL-E 3 (1024×1024): $0.040 per image
- DALL-E 3 (1024×1792 or 1792×1024): $0.080 per image

---

### 7. **Build & Deploy the Frontend**

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Build
npm run build

# Commit changes
git add apps/web/src/services/labelArtService.ts
git commit -m "feat: re-enable AI Label generation feature"
git push origin main

# Vercel will auto-deploy or use: vercel --prod
```

---

### 8. **Test the Feature**

1. **Open your app** (after deployment)
2. **Go to Cellar page**
3. **Click Details** on any bottle
4. You should now see **"Generate AI Label Art"** button
5. **Click it** and choose **Modern** or **Classic**
6. Wait ~10-15 seconds for OpenAI to generate
7. **Success!** The generated label should appear

**Check console logs:**
```
[AI Label Art] Feature flag check: { envVar: 'true', enabled: true }
[AI Label Art] User flag (ai_label_art_enabled): true → ENABLED ✅
[AI Label Client] Invoking Edge Function...
[AI Label Client] Response received: { hasData: true, hasError: false }
```

---

## 🔍 Troubleshooting

### "Button doesn't appear"

**Check 1: Frontend env var**
```bash
# In apps/web/.env
VITE_FEATURE_GENERATED_LABEL_ART=true
```

**Check 2: User profile**
```sql
-- In Supabase SQL Editor
SELECT email, ai_label_art_enabled FROM profiles WHERE email = 'your-email';
```

**Check 3: Console logs**
Open browser console and look for:
```
[AI Label Art] Feature flag check: ...
[AI Label Art] User flag: ...
```

### "401 Unauthorized" error

**Check 1: Edge Function is deployed**
```bash
npx supabase functions list --project-ref YOUR_REF
```

**Check 2: User is logged in**
- Try logging out and back in
- Check console for session errors

**Check 3: Edge Function has correct permissions**
- The function checks `wine.user_id === user.id`
- Make sure the wine belongs to the logged-in user

### "503 AI image generation not configured"

**Missing OpenAI API Key in Edge Function:**
```bash
# Set it:
npx supabase secrets set OPENAI_API_KEY=sk-your-key --project-ref YOUR_REF

# Verify:
npx supabase secrets list --project-ref YOUR_REF
```

### "Failed to store image"

**Storage bucket doesn't exist or wrong permissions:**
- Run the storage bucket SQL again (Step 3)
- Check Supabase Dashboard → Storage → Buckets
- Should see "generated-labels" bucket with "Public" enabled

### Edge Function logs

**View real-time logs:**
```bash
npx supabase functions logs generate-label-art --project-ref YOUR_REF
```

---

## 📊 What It Does

1. **User clicks "Generate AI Label Art"**
2. **Frontend** builds a safe prompt (no trademarks, generic wine label concept)
3. **Edge Function** receives request and authenticates user
4. **Checks for cached image** (idempotency - same prompt returns same image)
5. **Calls OpenAI DALL-E 3** to generate the image
6. **Downloads the image** from OpenAI temporary URL
7. **Uploads to Supabase Storage** in `generated-labels` bucket
8. **Updates wine record** with image path and prompt hash
9. **Returns public URL** to frontend
10. **Frontend displays** the generated label art

---

## 💰 Cost Estimation

**Per Image Generation:**
- DALL-E 3 (1024×1024): $0.04 USD

**Caching:**
- Same wine + same style → **uses cached image** (free)
- Different style → new image generated
- Changed prompt (wine name/region changed) → new image

**Example:**
- 100 bottles × 1 style each = **$4.00**
- 100 bottles × 2 styles each = **$8.00**
- Regenerations are cached, so no extra cost unless wine data changes

---

## 🔐 Security & Legal

**Legal Compliance:**
- ✅ Generates **ORIGINAL artwork only**
- ✅ NO scraping of real wine labels
- ✅ NO trademark reproduction
- ✅ NO brand logos or recognizable layouts
- ✅ Uses only generic metadata (wine name, vintage, region)
- ✅ Sanitizes inputs to prevent infringement

**Security:**
- ✅ User authentication required
- ✅ RLS policies on storage bucket
- ✅ User can only generate for their own wines
- ✅ OpenAI API key stored as secret (not in code)

---

## 📁 Related Files

- **Frontend Service**: `apps/web/src/services/labelArtService.ts`
- **Edge Function**: `supabase/functions/generate-label-art/index.ts`
- **Storage SQL**: `CREATE_STORAGE_BUCKET_FIXED.sql`
- **Component**: `apps/web/src/components/WineDetailsModal.tsx`

---

## ✅ Summary Checklist

- [ ] Environment variable set: `VITE_FEATURE_GENERATED_LABEL_ART=true`
- [ ] OpenAI API key set in Supabase secrets
- [ ] Storage bucket created (`generated-labels`)
- [ ] User profile enabled: `ai_label_art_enabled = true`
- [ ] Edge Function deployed to Supabase
- [ ] Frontend built and deployed
- [ ] Tested: Button appears and generates successfully

---

**Status**: ✅ Code Re-enabled  
**Next**: Follow setup steps 2-8  
**Last Updated**: December 29, 2025


