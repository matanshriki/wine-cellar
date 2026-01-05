# 🚨 Fix AI Generation NOW - Manual Steps

**Issue**: 401 Unauthorized error when generating AI label art

**Root Cause**: Edge Function deployed but storage bucket or authentication setup incomplete

---

## ✅ Fix Steps (Do in Order)

### Step 1: Run Terminal Commands

Open Terminal and paste these **one by one**:

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Link to correct project
npx supabase link --project-ref pktelrzyllbwrmcfgocx

# Check secrets
npx supabase secrets list
```

**Expected output**: Should show `OPENAI_API_KEY` in the list

❌ **If OPENAI_API_KEY is missing**, run:
```bash
npx supabase secrets set OPENAI_API_KEY=sk-YOUR_OPENAI_KEY_HERE
```

**Then deploy Edge Function:**
```bash
npx supabase functions deploy generate-label-art
```

---

### Step 2: Check Storage Bucket

**Go to**: https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/storage/buckets

**Look for bucket called**: `generated-labels`

✅ **If you see it** - Good! Skip to Step 3.

❌ **If it's missing** - Run this SQL:

1. Go to: https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/editor
2. Copy-paste this SQL:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-labels', 'generated-labels', true)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies
CREATE POLICY "Users can upload own generated labels"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'generated-labels' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own generated labels"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'generated-labels'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own generated labels"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'generated-labels'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view generated labels"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'generated-labels');
```

3. Click **Run**

---

### Step 3: Verify Edge Function is Deployed

**Go to**: https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/functions

**Check**: You should see `generate-label-art` with status "Deployed" (green)

❌ **If NOT deployed**, run in Terminal:
```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
npx supabase functions deploy generate-label-art
```

---

### Step 4: Check Secrets

**Go to**: https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/settings/edge-functions

**Look for**: `OPENAI_API_KEY` in the secrets list

❌ **If missing**, run in Terminal:
```bash
npx supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY_HERE
```

---

### Step 5: Test Again

1. **Hard refresh browser**: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
2. **Open your app** (localhost:5173 or Vercel URL)
3. **Click a bottle** (one without an image)
4. **Click "Generate Label Art"**
5. **Choose style** (Classic or Modern)
6. **Wait 10-30 seconds**
7. ✨ **Should work now!**

---

## 🔍 Still Not Working?

### Check Edge Function Logs Again

**Go to**: https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/functions/generate-label-art/logs

**After clicking "Generate Label Art"**, you should see NEW logs appearing (not just "booted" and "shutdown").

**Look for errors like:**
- "Not authenticated" → Hard refresh browser
- "Bucket not found" → Run storage SQL (Step 2)
- "AI image generation not configured" → Set OpenAI key (Step 4)
- "Wine not found" → Try a different bottle

---

## 📋 Quick Verification Checklist

Before testing again, verify ALL of these:

- [ ] Project linked: `npx supabase link --project-ref pktelrzyllbwrmcfgocx`
- [ ] Edge Function deployed: Check dashboard
- [ ] `OPENAI_API_KEY` secret set: `npx supabase secrets list`
- [ ] Storage bucket `generated-labels` exists: Check dashboard
- [ ] Storage RLS policies created: Run SQL above
- [ ] OpenAI billing enabled: https://platform.openai.com/account/billing
- [ ] User has `ai_label_art_enabled=true`: Check database
- [ ] Browser hard refreshed: `Cmd+Shift+R`

---

## 🎯 Most Common Issues

### Issue 1: Wrong Project ID
- Old (wrong): `oktelrzzyllbwrmcfqgocx`
- New (correct): `pktelrzyllbwrmcfgocx`

**Fix**: Re-run link command with correct ID

### Issue 2: Storage Bucket Missing
**Symptom**: 401 or "Bucket not found" error

**Fix**: Run storage SQL in Step 2

### Issue 3: OpenAI Key Not Set
**Symptom**: "AI image generation not configured"

**Fix**: Set secret in Step 4

### Issue 4: Edge Function Not Deployed
**Symptom**: "Failed to send request to Edge Function"

**Fix**: Deploy in Step 3

---

## 🚀 Automated Script (Alternative)

If you prefer, run this script (does Steps 1 & 3 automatically):

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
bash fix-ai-generation-now.sh
```

Then manually do Step 2 (storage SQL) if bucket is missing.

---

## 💡 Tips

1. **Hard refresh is crucial** - Old code might be cached
2. **Check logs after EVERY attempt** - They show exactly what failed
3. **Verify secrets with `npx supabase secrets list`** - Not just "set"
4. **Storage bucket needs BOTH bucket + policies** - Run entire SQL block

---

**Start with Step 1!** Run the Terminal commands and let me know if you get stuck on any step.

🍷 This should fix it!




