# Fix: Set Environment Variables in Vercel

## 🎯 **The Real Issue**

You're testing on **production** (your deployed app), but the environment variables might not be set in **Vercel**!

The `.env` file is LOCAL only - it doesn't get deployed to Vercel for security reasons.

## ✅ **Set Environment Variables in Vercel**

### **Method 1: Vercel Dashboard (Easiest)**

1. Go to: [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your **wine-cellar** project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

```
VITE_SUPABASE_URL=https://pktelrzyllbwrmcfgocx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrdGVscnp5bGxid3JtY2Znb2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0OTQxMzEsImV4cCI6MjA1MDA3MDEzMX0.YCLjL-8RjLEu0WBjzTcxTMrTQWkLLm7hq98rOYvY8aU
VITE_FEATURE_GENERATED_LABEL_ART=true
```

5. For each variable:
   - Set **Environment**: `Production`, `Preview`, and `Development`  
   - Click **Save**

6. **Redeploy** your app:
   - Go to **Deployments** tab
   - Click the **...** menu on the latest deployment
   - Click **Redeploy**

### **Method 2: Vercel CLI**

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Set environment variables
vercel env add VITE_SUPABASE_URL production
# When prompted, paste: https://pktelrzyllbwrmcfgocx.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production  
# When prompted, paste your anon key

vercel env add VITE_FEATURE_GENERATED_LABEL_ART production
# When prompted, paste: true

# Redeploy
vercel --prod
```

---

## 🧪 **Test Locally First**

To verify the fix works, test on **localhost**:

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Make sure your local .env has the correct values
cat apps/web/.env

# Run locally
npm run dev

# Open http://localhost:5173
# Try generating AI label
```

If it works locally but not in production, it's definitely the Vercel environment variables.

---

## 📋 **Get Your Anon Key**

If you don't have the full anon key:

1. Go to: [https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/settings/api](https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/settings/api)
2. Find **"anon public"** key
3. Click to reveal and copy the FULL key (very long)
4. Use that in Vercel environment variables

---

## ⚠️ **Important**

After setting environment variables in Vercel:
1. **You MUST redeploy** for them to take effect
2. **Wait 2-3 minutes** for the deployment to complete
3. **Hard refresh** your app (Cmd+Shift+R or Ctrl+Shift+R)

---

**This is almost certainly the issue!** Your local `.env` has the correct values, but Vercel doesn't. 🎯


