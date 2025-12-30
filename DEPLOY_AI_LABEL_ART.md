# 🚀 Deploy AI Label Art Feature

**Goal**: Deploy the Edge Function so "Generate Label Art" button actually works!

**Time**: ~15 minutes  
**Cost**: $0.04 per image generated (OpenAI DALL-E 3)

---

## 📋 Prerequisites

You'll need:
1. ✅ **Supabase CLI** installed
2. ✅ **OpenAI API Key** (requires billing enabled)
3. ✅ **Database migrations** already run (you did this!)

---

## 🔧 Step-by-Step Deployment

### Step 1: Install Supabase CLI

**Mac/Linux:**
```bash
brew install supabase/tap/supabase
```

**Windows:**
```bash
npm install -g supabase
```

**Verify installation:**
```bash
supabase --version
```

Expected output: `supabase 1.x.x` or similar

---

### Step 2: Login to Supabase

```bash
supabase login
```

This will:
1. Open your browser
2. Ask you to authorize the CLI
3. Generate an access token

**Expected output:**
```
✅ You are now logged in!
```

---

### Step 3: Link to Your Project

From your project root:

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
supabase link --project-ref oktelrzzyllbwrmcfqgocx
```

**You'll be prompted for:**
- Database password (your Supabase database password)

**Expected output:**
```
✅ Linked to project oktelrzzyllbwrmcfqgocx
```

**💡 Tip**: If you forgot your database password, you can reset it in:
`Supabase Dashboard → Settings → Database → Reset password`

---

### Step 4: Get OpenAI API Key

1. Go to: https://platform.openai.com/api-keys
2. Sign in (or create account if needed)
3. Click **"Create new secret key"**
4. Give it a name: `wine-cellar-label-art`
5. **Copy the key** (it starts with `sk-...`)

**⚠️ IMPORTANT**: 
- Save the key somewhere safe - you can't see it again!
- OpenAI requires billing to be set up: https://platform.openai.com/account/billing
- Minimum payment: $5 (gets you 125 AI images)

**Cost breakdown:**
- DALL-E 3: $0.04 per 1024×1024 image
- Example: 100 images = $4

---

### Step 5: Set OpenAI API Key as Supabase Secret

Replace `sk-YOUR_KEY_HERE` with your actual OpenAI key:

```bash
supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY_HERE
```

**Expected output:**
```
✅ Set secret OPENAI_API_KEY
```

**Optional** - Set custom model/size (defaults shown):
```bash
supabase secrets set AI_IMAGE_MODEL=dall-e-3
supabase secrets set AI_IMAGE_SIZE=1024x1024
```

---

### Step 6: Run Storage Migration (if not already done)

Check if `generated-labels` bucket exists:

Go to: **Supabase Dashboard → Storage**

If you **DON'T** see a bucket called `generated-labels`, run this SQL:

```sql
-- Create generated-labels storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-labels', 'generated-labels', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to INSERT their own images
CREATE POLICY "Users can upload their own generated labels"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-labels' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to UPDATE their own images
CREATE POLICY "Users can update their own generated labels"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'generated-labels'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to DELETE their own images
CREATE POLICY "Users can delete their own generated labels"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-labels'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow everyone to view generated labels (public bucket)
CREATE POLICY "Anyone can view generated labels"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'generated-labels');
```

**Expected result**: Bucket `generated-labels` appears in Storage dashboard

---

### Step 7: Deploy the Edge Function

```bash
supabase functions deploy generate-label-art
```

**Expected output:**
```
✅ Deploying function generate-label-art
✅ Function URL: https://oktelrzzyllbwrmcfqgocx.supabase.co/functions/v1/generate-label-art
```

**⏱️ This takes ~30-60 seconds**

---

### Step 8: Verify Deployment

**Option A - Check Supabase Dashboard:**
1. Go to: **Supabase Dashboard → Edge Functions**
2. You should see `generate-label-art` listed
3. Status should be **"Deployed"**

**Option B - Test with curl:**
```bash
curl -i https://oktelrzzyllbwrmcfqgocx.supabase.co/functions/v1/generate-label-art
```

**Expected response:** HTTP 401 (authentication required) - this is good! It means the function is deployed and working.

---

### Step 9: Test in Browser

1. **Hard refresh** browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Go to your cellar
3. Click a **bottle with no image**
4. Click **"Generate Label Art"** (gold button)
5. Choose **Classic** or **Modern**
6. Wait **10-30 seconds** (OpenAI processing)
7. ✅ **Image should appear with "AI" badge!**

---

## 🐛 Troubleshooting

### "command not found: supabase"
**Fix:** Install Supabase CLI (Step 1)

### "Not logged in"
**Fix:** Run `supabase login` (Step 2)

### "Project not found"
**Fix:** Check your project ref is correct: `oktelrzzyllbwrmcfqgocx`

### "Invalid OpenAI API key"
**Fix:**
- Verify key starts with `sk-`
- Check billing is enabled on OpenAI account
- Regenerate key if needed

### "Storage bucket not found"
**Fix:** Run the storage migration SQL (Step 6)

### "AI image generation not configured"
**Fix:** Verify secret was set:
```bash
supabase secrets list
```
Should show `OPENAI_API_KEY`

### Function deploys but button still fails
**Fix:**
1. Check Edge Function logs: `Supabase Dashboard → Edge Functions → generate-label-art → Logs`
2. Look for errors
3. Common issues:
   - OpenAI key invalid
   - Billing not enabled
   - Storage bucket missing

---

## 💰 Cost Management

### Current Setup
- **Per image**: $0.04 (1024×1024 DALL-E 3)
- **Caching**: Yes (same prompt = free)
- **Per-user flags**: You control who can generate

### Monitor Usage
```sql
-- Count AI-generated images per user
SELECT 
  up.email,
  COUNT(w.generated_image_path) as images_generated,
  COUNT(w.generated_image_path) * 0.04 as estimated_cost_usd
FROM profiles up
LEFT JOIN wines w ON w.user_id = up.id AND w.generated_image_path IS NOT NULL
WHERE up.ai_label_art_enabled = true
GROUP BY up.email
ORDER BY images_generated DESC;
```

### Rate Limiting (Optional Future Feature)
You could add:
- Max X images per day per user
- Cooldown between generations
- Total image limit per user

---

## 🔐 Security Notes

✅ **What's Secure:**
- OpenAI key stored as Supabase secret (server-side only)
- User authentication required
- Wine ownership verified
- RLS policies on storage

❌ **What's NOT Sent:**
- API keys to frontend
- User can't see/modify secrets
- Images stored per user (isolated)

---

## ✅ Success Checklist

After deployment, verify:

- [ ] Supabase CLI installed and logged in
- [ ] Project linked successfully
- [ ] OpenAI API key set as secret
- [ ] Edge Function deployed (shows in dashboard)
- [ ] Storage bucket `generated-labels` exists
- [ ] Button works without errors
- [ ] Image generates in 10-30 seconds
- [ ] "AI" badge appears on generated images
- [ ] Cached images load instantly (second generation)

---

## 📊 What Happens When User Clicks "Generate Label Art"

1. **Frontend** → Builds safe prompt (sanitized text)
2. **Frontend** → Hashes prompt (SHA-256)
3. **Frontend** → Calls Edge Function with wine ID + prompt
4. **Edge Function** → Verifies user owns the wine
5. **Edge Function** → Checks if image already generated (cache hit)
6. **Edge Function** → If cache miss, calls OpenAI API
7. **OpenAI** → Generates image (~10-30 seconds)
8. **Edge Function** → Downloads image from OpenAI
9. **Edge Function** → Uploads to Supabase Storage
10. **Edge Function** → Updates wine record with path + hash
11. **Frontend** → Displays image with "AI" badge
12. **Next time** → Instant (cached)

---

## 🎯 Quick Reference Commands

```bash
# Login to Supabase
supabase login

# Link project
supabase link --project-ref oktelrzzyllbwrmcfqgocx

# Set OpenAI key
supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY_HERE

# Deploy function
supabase functions deploy generate-label-art

# List secrets (verify)
supabase secrets list

# View function logs
supabase functions logs generate-label-art --tail
```

---

## 🚀 Ready to Deploy?

Start with **Step 1** and follow each step in order.

**Estimated time**: 15 minutes  
**Estimated cost**: $0 to deploy, $0.04 per image generated

---

## 💡 After Deployment

Once deployed, you can:
- ✅ Generate unlimited AI label art (costs apply)
- ✅ Enable/disable for specific users (per-user flag)
- ✅ Monitor usage via SQL queries
- ✅ Cache prevents duplicate generation costs
- ✅ Share bottles with AI-generated labels

---

**Need help?** Check the troubleshooting section or reach out!

🍷 Happy generating!



