# 🚀 Deploy Edge Function for AI Sommelier Notes

## The Issue

CORS error when clicking "Generate Sommelier Notes":
```
Access to fetch at 'https://pktelrzyllbwrmcfgocx.supabase.co/functions/v1/analyze-wine'
from origin 'https://wine-cellar-brain.vercel.app' has been blocked by CORS
```

**Cause**: The `analyze-wine` Edge Function is not deployed to production yet.

---

## Solution: Deploy the Edge Function

### **Method 1: Supabase CLI (Recommended)**

```bash
# 1. Install Supabase CLI (if not installed)
npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Link to your project
supabase link --project-ref pktelrzyllbwrmcfgocx

# 4. Deploy the Edge Function
cd /Users/matanshr/Desktop/Projects/Playground/wine
supabase functions deploy analyze-wine --no-verify-jwt

# 5. Set the OpenAI API key secret
supabase secrets set OPENAI_API_KEY=your-openai-api-key-here
```

---

### **Method 2: Supabase Dashboard (No CLI Required)**

#### **Step 1: Set OpenAI API Key**

1. Go to **Secrets/Vault**:
   https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/settings/vault

2. Click **"Add new secret"**

3. Enter:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (get it from https://platform.openai.com/api-keys)
   - Starts with `sk-...`

4. Click **"Save"**

#### **Step 2: Deploy Edge Function**

##### **Option A: Using Supabase CLI (from local files)**
```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
supabase functions deploy analyze-wine --no-verify-jwt
```

##### **Option B: Using Dashboard (manual copy/paste)**

1. Go to **Edge Functions**:
   https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/functions

2. Click **"Create a new function"**

3. Enter:
   - **Function name**: `analyze-wine`
   - **Copy the code** from: `/Users/matanshr/Desktop/Projects/Playground/wine/supabase/functions/analyze-wine/index.ts`

4. Click **"Deploy function"**

---

## Verification

After deploying, test the function:

### **1. In Supabase Dashboard**

1. Go to **Edge Functions**:
   https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/functions

2. Find `analyze-wine` in the list

3. Status should be: ✅ **"Deployed"**

### **2. In Your App**

1. Open https://wine-cellar-brain.vercel.app/

2. Go to **Cellar** page

3. Find any bottle

4. Click **"Generate Sommelier Notes"** button

5. Should work now:
   - ✅ No CORS error
   - ✅ Analysis appears after ~5-10 seconds
   - ✅ Sommelier notes displayed in the card

---

## What if I don't have an OpenAI API Key?

### **Option 1: Get a Free OpenAI Key**

1. Go to https://platform.openai.com/api-keys
2. Sign up / Log in
3. Click **"Create new secret key"**
4. Copy the key (starts with `sk-...`)
5. Add it to Supabase secrets as shown above

**Cost**: ~$0.01-0.05 per analysis (very cheap with `gpt-4o-mini`)

### **Option 2: Use Fallback (No AI)**

The app already has a **deterministic fallback** that works without AI:

If the Edge Function fails (no key, CORS error, etc.), it automatically uses:
- Rule-based analysis
- Region/grape/vintage heuristics
- Still provides sommelier notes (less personalized)

**The app will still work, just with less personalized notes!**

---

## Troubleshooting

### **Error: "OPENAI_API_KEY not configured"**

- You didn't set the secret in Step 1
- Go back and add `OPENAI_API_KEY` to Supabase Vault

### **Error: "Unauthorized"**

- User is not logged in
- Try logging out and back in

### **Error: "OpenAI API error: 401"**

- Your OpenAI API key is invalid
- Check the key at https://platform.openai.com/api-keys
- Make sure it starts with `sk-...`

### **Error: "OpenAI API error: 429"**

- You've exceeded OpenAI rate limits
- Either:
  - Wait a few minutes
  - Upgrade your OpenAI plan
  - Use the fallback (app will do this automatically)

### **Still getting CORS error after deployment**

1. Verify function is deployed:
   ```bash
   supabase functions list
   ```
   Should show `analyze-wine` with status "deployed"

2. Check Edge Function logs:
   https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/functions/analyze-wine/logs

3. Try redeploying:
   ```bash
   supabase functions deploy analyze-wine --no-verify-jwt
   ```

---

## Summary

**The Problem**: Edge Function not deployed to production  
**The Fix**: Deploy via CLI or Dashboard + Set OpenAI key  
**The Fallback**: App still works without AI (deterministic analysis)  

**Status after fix**: ✅ "Generate Sommelier Notes" works with AI  
**If no OpenAI key**: ✅ App still works with fallback analysis

---

## Quick Test After Deployment

```bash
# Test the Edge Function directly (replace YOUR_ANON_KEY)
curl -i --location --request POST \
  'https://pktelrzyllbwrmcfgocx.supabase.co/functions/v1/analyze-wine' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"bottle_id":"test","wine_data":{"wine_name":"Test Wine","color":"red"}}'
```

**Expected response**: JSON with analysis data  
**If you get CORS error**: Function is not deployed yet  
**If you get 401**: Check your auth header  
**If you get "OPENAI_API_KEY not configured"**: Add the secret in Vault  

🍷 **Once deployed, the AI sommelier notes will work perfectly!** ✨

