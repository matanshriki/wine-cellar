# Deploy Edge Function - URGENT FIX

## The Problem
The `parse-label-image` edge function has been updated but not deployed to Supabase.
This is causing both single-bottle and multi-bottle uploads to fail with "Invalid JWT" errors.

## Solution: Deploy via Supabase Dashboard

### Step 1: Go to Supabase Dashboard
1. Visit: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions
2. Find the `parse-label-image` function

### Step 2: Deploy the Function
You have 2 options:

#### Option A: Re-deploy from Dashboard (Easiest)
1. Click on the `parse-label-image` function
2. Click "Deploy" button
3. It will redeploy the latest version from your connected GitHub repo

#### Option B: Manual Deploy via CLI
If you have Supabase CLI installed:

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
supabase functions deploy parse-label-image --project-ref YOUR_PROJECT_REF
```

### Step 3: Verify
After deployment:
1. Wait 1-2 minutes for the function to be live
2. Try uploading a single bottle - it should work
3. Try uploading multiple bottles - it should work

## Why This Happened
- Vercel only deploys the React web app
- Supabase Edge Functions are separate and need manual deployment
- When we updated the edge function code, it needed to be deployed to Supabase separately

## Quick Fix if Dashboard Deploy Doesn't Work
If the dashboard deploy fails, the edge function might be in a bad state. In that case:

1. Go to Supabase Dashboard > Edge Functions
2. Delete the `parse-label-image` function
3. Recreate it by uploading the function code from:
   `supabase/functions/parse-label-image/index.ts`

## Test After Deploy
```bash
# Test the function directly
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/parse-label-image' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"imageUrl":"test.jpg"}'
```

Expected response: Should not get "Invalid JWT" error anymore

