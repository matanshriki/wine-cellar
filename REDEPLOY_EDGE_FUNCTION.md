# Redeploy Edge Function (Auth Fix)

## Issue
The `generate-wine-profile` Edge Function was returning 401 (Unauthorized) errors because it wasn't properly validating the JWT token.

## What Was Fixed
- Added proper JWT validation using `supabase.auth.getUser(token)`
- Created authenticated Supabase client at the start
- Reused the same client for database operations
- Return proper 401 error responses instead of throwing errors

## How to Redeploy via Supabase Dashboard

### Option 1: Via Dashboard UI (Easiest)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your `wine-cellar` project

2. **Open Edge Functions**
   - Click "Edge Functions" in the left sidebar
   - Find `generate-wine-profile` in the list

3. **Update the function code**
   - Click on `generate-wine-profile`
   - Click "Edit Function" or "Deploy" button
   - Copy the ENTIRE contents of: `supabase/functions/generate-wine-profile/index.ts`
   - Paste it into the code editor
   - Click "Deploy" or "Save & Deploy"

4. **Verify deployment**
   - Go to the "Logs" tab
   - You should see a new deployment log with "booted" status

### Option 2: Via Supabase CLI (Recommended if you have it)

If you have Supabase CLI installed and linked:

```bash
# From your project root
supabase functions deploy generate-wine-profile
```

**Note:** This requires:
- Supabase CLI installed (`npm install -g supabase`)
- Project linked (`supabase link --project-ref YOUR_PROJECT_REF`)

### Option 3: Manual File Upload

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions
2. Click "New Function" or select existing `generate-wine-profile`
3. Upload the file: `supabase/functions/generate-wine-profile/index.ts`
4. Click "Deploy"

---

## After Redeployment

### Test the function

1. Go back to your app: `https://wine-cellar-brain.vercel.app/profile`
2. Scroll to "Admin: Wine Profile Backfill"
3. Click "Start Backfill" again
4. This time you should see:
   - ✅ Successful profile generation
   - No more 401 errors
   - Progress incrementing: "Processed: 1", "Processed: 2", etc.

### Check the logs

1. In Supabase Dashboard → Edge Functions → `generate-wine-profile` → Logs
2. You should see:
   ```
   [generate-wine-profile] ✅ User authenticated: <user-id>
   [generate-wine-profile] Generating profile for: <wine-name>
   [generate-wine-profile] ✅ AI profile generated
   [generate-wine-profile] Persisting profile to DB for wine: <wine-id>
   [generate-wine-profile] ✅ Profile saved successfully
   ```

---

## What Changed in the Code

### Before (Broken)
```typescript
// Verify authentication
const authHeader = req.headers.get('Authorization')
if (!authHeader) {
  throw new Error('Missing authorization header')
}
// ❌ Never actually validated the token!

// Parse request body
const input: WineProfileInput = await req.json()
```

### After (Fixed)
```typescript
// Verify authentication
const authHeader = req.headers.get('Authorization')
if (!authHeader) {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
  )
}

// Create authenticated Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Verify the JWT token
const token = authHeader.replace('Bearer ', '')
const { data: { user }, error: authError } = await supabase.auth.getUser(token)

if (authError || !user) {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
  )
}

console.log('[generate-wine-profile] ✅ User authenticated:', user.id)
```

---

## Troubleshooting

### Still getting 401 after redeployment?

1. **Check if deployment succeeded**
   - Go to Edge Functions → Logs
   - Look for "booted" status

2. **Verify environment secrets are set**
   - Go to Project Settings → Edge Functions → Secrets
   - Confirm these exist:
     - `OPENAI_API_KEY`
     - `SUPABASE_URL` (usually auto-set)
     - `SUPABASE_SERVICE_ROLE_KEY` (usually auto-set)

3. **Clear browser cache and retry**
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   - Or open in incognito window

4. **Check if you're still logged in**
   - Sign out and sign back in
   - Verify your session is active

### Getting different errors?

- Share the error message from the browser console
- Check Edge Function logs in Supabase Dashboard
- Verify the exact status code (401, 500, etc.)

---

## Summary

**Fixed:** Edge Function now properly validates JWT tokens before processing requests.

**Next Step:** Redeploy the function using one of the methods above, then retry the backfill.
