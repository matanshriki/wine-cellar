# 🚀 Deploy Edge Function - Fix Label Extraction

## ✅ Good News: Storage is Working!

The image upload worked! The new error is:
```
Access to fetch at '.../functions/v1/extract-wine-label' 
has been blocked by CORS policy
```

This means the Edge Function (AI label extraction) isn't deployed or configured properly.

---

## 🎯 Two Options to Fix

### Option A: Deploy the Edge Function (Recommended)
Deploy the AI extraction service so it actually works.

### Option B: Skip AI Extraction (Quick Fix)
Use manual entry only (no automatic label scanning).

---

## 🚀 Option A: Deploy Edge Function (15 Minutes)

### Prerequisites
- Supabase CLI installed
- OpenAI API key

### Step 1: Install Supabase CLI

**Mac/Linux**:
```bash
brew install supabase/tap/supabase
```

**Windows**:
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Or using npm**:
```bash
npm install -g supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser for authentication.

### Step 3: Link Your Project

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
supabase link --project-ref pktelrzyllbwrmcfgocx
```

### Step 4: Set OpenAI API Key

```bash
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Don't have an OpenAI API key?**
1. Go to: https://platform.openai.com/api-keys
2. Create a new key
3. Copy it and use in command above

### Step 5: Deploy the Edge Function

```bash
supabase functions deploy extract-wine-label
```

This will deploy the AI extraction service.

### Step 6: Test It

1. Go back to your app
2. Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
3. Try uploading a wine label photo
4. ✅ Should work now!

---

## 🔧 Option B: Skip AI Extraction (5 Minutes)

If you don't want to set up AI extraction right now, you can disable it temporarily:

### Modify the Code

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">/Users/matanshr/Desktop/Projects/Playground/wine/apps/web/src/services/labelScanService.ts
