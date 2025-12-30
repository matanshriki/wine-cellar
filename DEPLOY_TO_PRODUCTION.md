# 🚀 Deploy to Production (Vercel + Phone Access)

**Goal**: Deploy everything so the app works on your phone with AI label generation!

**Time**: 5-10 minutes

---

## ✅ What We Need to Deploy

1. ✅ **Edge Function** (already deployed to Supabase!)
2. ✅ **Frontend Code** (push to GitHub → auto-deploys to Vercel)
3. ✅ **Environment Variables** (set in Vercel dashboard)

---

## 📋 Step-by-Step Deployment

### Step 1: Commit & Push Code to GitHub

Open Terminal and run these commands:

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Add all changes
git add -A

# Commit
git commit -m "feat: AI label art feature - production ready

- Added per-user AI label art feature flag
- Edge Function deployed for AI generation
- Improved error handling
- Added deployment guides"

# Push to GitHub
git push origin main
```

**Expected result:** Code is pushed to GitHub ✅

---

### Step 2: Set Environment Variable in Vercel

**Go to Vercel Dashboard:**
1. Open: https://vercel.com/dashboard
2. Click on your **wine-cellar** project
3. Click **Settings** tab
4. Click **Environment Variables** (left sidebar)

**Add this variable:**

| Name | Value |
|------|-------|
| `VITE_FEATURE_GENERATED_LABEL_ART` | `true` |

**Environment**: Select "Production, Preview, and Development"

Click **Save**

---

### Step 3: Trigger Vercel Deployment

**Option A - Automatic (if you pushed to GitHub):**
- Vercel auto-deploys when you push to `main`
- Wait 2-3 minutes
- Check: https://vercel.com/dashboard → Your project → Deployments

**Option B - Manual:**
1. Go to: https://vercel.com/dashboard
2. Click your project
3. Click **Deployments** tab
4. Click **...** (three dots) on latest deployment
5. Click **Redeploy**
6. Check "Use existing Build Cache" (faster)
7. Click **Redeploy**

**Wait 2-3 minutes for deployment to complete...**

---

### Step 4: Run Database Migrations on Production

**If you haven't already:**

Go to: https://supabase.com/dashboard/project/oktelrzzyllbwrmcfqgocx/editor

**Run this SQL:**

```sql
-- Add AI label art feature flag column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_label_art_enabled BOOLEAN DEFAULT false;

-- Add index
CREATE INDEX IF NOT EXISTS profiles_ai_label_art_enabled_idx 
ON public.profiles(ai_label_art_enabled) 
WHERE ai_label_art_enabled = true;

-- Enable for your user (replace with your email!)
UPDATE public.profiles 
SET ai_label_art_enabled = true 
WHERE email = 'your-email@example.com';
```

**Replace `your-email@example.com` with your actual email!**

---

### Step 5: Verify Storage Bucket Exists

Go to: https://supabase.com/dashboard/project/oktelrzzyllbwrmcfqgocx/storage/buckets

**Check if `generated-labels` bucket exists.**

❌ **If NOT**, run this SQL:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-labels', 'generated-labels', true)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies
CREATE POLICY "Users can upload own labels"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'generated-labels' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own labels"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'generated-labels'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own labels"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'generated-labels'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view labels"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'generated-labels');
```

---

### Step 6: Test on Your Phone!

1. **Open your Vercel app URL** on your phone
   - Example: `https://wine-cellar-xxx.vercel.app`
   - Or your custom domain if you set one up

2. **Login** to your account

3. **Go to Cellar**

4. **Click a bottle** (one without an image)

5. **Click "Generate Label Art"** (gold button)

6. **Choose style** (Classic or Modern)

7. **Wait 10-30 seconds**

8. ✨ **AI-generated label appears with "AI" badge!**

---

## 🔍 Troubleshooting

### "Button doesn't appear"

**Check:**
1. Did you set `VITE_FEATURE_GENERATED_LABEL_ART=true` in Vercel?
2. Did you enable `ai_label_art_enabled=true` for your user in SQL?
3. Did you redeploy after setting env var?
4. Try hard refresh on phone (pull down on page)

**Verify in browser console (on phone):**
- Open site in mobile Safari/Chrome
- Look for `[AI Label Art]` logs in console

### "401 Unauthorized" error

**Check:**
1. Is Edge Function deployed? (`npx supabase functions list`)
2. Is `generated-labels` storage bucket created?
3. Are you logged in on your phone?

**Check Edge Function logs:**
https://supabase.com/dashboard/project/oktelrzzyllbwrmcfqgocx/functions/generate-label-art/logs

### "AI generation not configured" error

**OpenAI key is missing!**

Set it:
```bash
npx supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY_HERE
```

Verify:
```bash
npx supabase secrets list
```

### Deployment stuck or failed

**Check Vercel deployment logs:**
1. Go to: https://vercel.com/dashboard
2. Click your project
3. Click **Deployments**
4. Click the latest deployment
5. Check **Build Logs** for errors

---

## ✅ Production Checklist

Before testing on phone:

- [ ] Code committed and pushed to GitHub
- [ ] Vercel env var `VITE_FEATURE_GENERATED_LABEL_ART=true` set
- [ ] Vercel deployment completed successfully
- [ ] Database migration run (ai_label_art_enabled column exists)
- [ ] Your user has `ai_label_art_enabled=true` in database
- [ ] Storage bucket `generated-labels` exists with RLS policies
- [ ] Edge Function `generate-label-art` is deployed
- [ ] OpenAI API key is set as Supabase secret
- [ ] OpenAI billing is enabled

---

## 📱 Mobile Testing Tips

### iOS (Safari)
- Hard refresh: Pull down on page
- Clear cache: Settings → Safari → Clear History and Website Data
- Add to Home Screen for PWA experience

### Android (Chrome)
- Hard refresh: Pull down on page
- Clear cache: Settings → Privacy → Clear browsing data
- Add to Home Screen for PWA experience

---

## 💰 Cost Reminder

**Production Costs:**
- Vercel: Free (Hobby plan)
- Supabase: Free (up to limits)
- OpenAI: $0.04 per AI image
- Total: ~$0.04 per image generated

**Monitoring OpenAI usage:**
https://platform.openai.com/usage

---

## 🎯 Quick Deploy Commands (All-in-One)

If you want to run everything at once:

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine

# 1. Commit and push
git add -A
git commit -m "feat: AI label art production ready"
git push origin main

# 2. Wait for Vercel to auto-deploy (2-3 minutes)
# Check: https://vercel.com/dashboard

# 3. Verify Edge Function is deployed
npx supabase functions list

# 4. Verify secrets are set
npx supabase secrets list

# Done! Test on phone.
```

---

## 🚀 You're Ready!

Once you complete all steps above:
1. Open your Vercel app URL on your phone
2. Login
3. Generate AI label art
4. Enjoy! 🍷

**Production URL**: Find it in Vercel dashboard under your project

---

**Need help?** Let me know which step you're stuck on!


