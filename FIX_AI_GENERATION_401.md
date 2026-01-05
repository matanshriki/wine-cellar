# 🔧 Fix AI Generation 401 Error

**Error**: "Edge Function returned a non-2xx status code" (401 Unauthorized)

**Cause**: Edge Function can't authenticate the user properly.

---

## ✅ Quick Fix - 3 Steps

### Step 1: Check if Edge Function is Deployed

Go to: https://supabase.com/dashboard/project/oktelrzzyllbwrmcfqgocx/functions

**You should see:**
- `generate-label-art` listed
- Status: "Deployed" (green)

If NOT deployed, run:
```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
npx supabase functions deploy generate-label-art
```

---

### Step 2: Verify Storage Bucket Exists

Go to: https://supabase.com/dashboard/project/oktelrzzyllbwrmcfqgocx/storage/buckets

**Check if `generated-labels` bucket exists:**

❌ **If NOT**, run this SQL in Supabase SQL Editor:

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

---

### Step 3: Check Edge Function Logs

Go to: https://supabase.com/dashboard/project/oktelrzzyllbwrmcfqgocx/functions/generate-label-art/logs

**Look for the most recent error log.**

**Common issues you might see:**

#### Issue A: "Not authenticated"
**Fix**: Hard refresh browser (`Cmd+Shift+R`) and try again

#### Issue B: "AI image generation not configured"
**Fix**: OpenAI key is missing. Set it:
```bash
npx supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY_HERE
```

Verify it's set:
```bash
npx supabase secrets list
```

Should show `OPENAI_API_KEY`

#### Issue C: "Wine not found"
**Fix**: Database sync issue. Try clicking a different bottle.

#### Issue D: Edge Function CORS error
**Fix**: Redeploy with CORS fix (see below)

---

## 🔍 Debug: Check What's Actually Wrong

### A. Check Edge Function Deployment Status
```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
npx supabase functions list
```

Should show `generate-label-art` in the list.

### B. Check OpenAI Key is Set
```bash
npx supabase secrets list
```

Should show:
```
OPENAI_API_KEY (set)
```

If not set:
```bash
npx supabase secrets set OPENAI_API_KEY=sk-YOUR_OPENAI_KEY_HERE
```

### C. Test Edge Function Manually

Run this in Terminal (replace `YOUR_ACCESS_TOKEN` with your actual token):

```bash
curl -X POST \
  'https://oktelrzzyllbwrmcfqgocx.supabase.co/functions/v1/generate-label-art' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "wineId": "test",
    "bottleId": "test",
    "prompt": "test",
    "promptHash": "test",
    "style": "classic"
  }'
```

**To get your access token:**
1. Open browser console (F12)
2. Run: `JSON.parse(localStorage.getItem('sb-oktelrzzyllbwrmcfqgocx-auth-token')).access_token`
3. Copy the token

---

## 🚀 Most Likely Fix (Try This First)

The 401 error is usually because the Edge Function isn't properly deployed or the storage bucket is missing.

### Quick Fix:
```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine

# 1. Redeploy the function
npx supabase functions deploy generate-label-art

# 2. Verify secrets are set
npx supabase secrets list

# 3. If OPENAI_API_KEY is missing, set it
npx supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY_HERE
```

Then:
1. **Hard refresh browser** (`Cmd+Shift+R`)
2. Click bottle → **Generate Label Art**
3. Check Edge Function logs if it still fails

---

## 📋 Checklist

Before clicking "Generate Label Art" again:

- [ ] Edge Function is deployed (check Supabase dashboard)
- [ ] `generated-labels` storage bucket exists
- [ ] OpenAI API key is set as secret (`npx supabase secrets list`)
- [ ] OpenAI billing is enabled
- [ ] Browser has been hard refreshed (`Cmd+Shift+R`)
- [ ] You're logged in to the app
- [ ] You're clicking a bottle that belongs to you

---

## 🎯 Still Not Working?

If none of the above works:

1. **Check Edge Function logs** (most important!):
   https://supabase.com/dashboard/project/oktelrzzyllbwrmcfqgocx/functions/generate-label-art/logs

2. **Take a screenshot of the logs** and I can tell you exactly what's wrong.

3. **Check browser console** for the full error message.

---

**Start with the "Most Likely Fix" section above!** 🍷




