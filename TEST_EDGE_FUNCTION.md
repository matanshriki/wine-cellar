# Test Edge Function Directly

## ✅ Quick Fix: Verify Your .env File

The 401 error is happening at Supabase's gateway level, which means either:
1. Your `VITE_SUPABASE_URL` is wrong
2. Your `VITE_SUPABASE_ANON_KEY` is wrong  
3. Your JWT token is invalid/expired

## 🔍 Check Your .env File

Open `apps/web/.env` and verify it has:

```bash
VITE_SUPABASE_URL=https://pktelrzyllbwrmcfgocx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrdGVscnp5bGxid3JtY2Znb2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0OTQxMzEsImV4cCI6MjA1MDA3MDEzMX0.YCLjL-8RjLEu0WBjzTcxTMrTQWkLLm7hq98rOYvY8aU
VITE_FEATURE_GENERATED_LABEL_ART=true
```

**IMPORTANT**: The anon key I see in your screenshot (line 3) looks truncated. Make sure you have the FULL key.

## 🧪 Test Edge Function Directly (Alternative Method)

If you want to test if the Edge Function itself is working, you can call it directly with curl, but you'll need your Service Role key for that (not recommended for testing).

## ✅ The Real Fix: Rebuild Frontend

After verifying your `.env` file:

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Rebuild with correct env vars
npm run build

# Commit and push
git add apps/web/.env
git commit -m "fix: verify env variables for AI label generation"
git push origin main
```

**Wait for Vercel to deploy (2-3 minutes), then test again.**

---

## 🎯 Most Likely Issue

Looking at line 3 of your `.env` file in the screenshot, I see:
```
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

This key looks **truncated**. The full anon key should be MUCH longer (about 200+ characters).

**Get the correct anon key:**
1. Go to: https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/settings/api
2. Copy the **"anon public"** key (the long one)
3. Paste it into `apps/web/.env` as `VITE_SUPABASE_ANON_KEY=...`
4. Rebuild and deploy

---

## 🔐 Security Note

**DO NOT** commit the `.env` file to git if it contains real keys! The `.env` file should be in `.gitignore`.


