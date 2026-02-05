# Debugging Wine Profile Backfill 401/500 Errors

## Current Status
- Edge Function deployed successfully (booted at 17:26:39)
- But backfill is still failing with "Failed to generate profile"
- No execution logs visible in Supabase (which is suspicious)

## Most Likely Issues

### 1. Missing OPENAI_API_KEY Secret

**Check:**
1. Go to Supabase Dashboard → Project Settings → Edge Functions
2. Look for "Secrets" or "Environment Variables" section
3. Verify `OPENAI_API_KEY` is set

**If missing:**
```
# In Supabase Dashboard → Edge Functions → Secrets
# Add:
Name: OPENAI_API_KEY
Value: sk-... (your OpenAI API key)
```

**After adding, you MUST redeploy the function:**
- Go back to Edge Functions → generate-wine-profile
- Click "Deploy" (even without code changes)
- This reloads the environment variables

---

### 2. Function Code Not Fully Redeployed

The logs show "booted" but no execution logs. This might mean the old code is still running.

**Fix:**
1. Go to Supabase Dashboard → Edge Functions → generate-wine-profile
2. Click "Code" tab
3. Verify the code includes these lines near the top (around line 82-118):

```typescript
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
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    }
  )
}

console.log('[generate-wine-profile] ✅ User authenticated:', user.id)
```

**If the code doesn't match:**
- Copy the entire code from `supabase/functions/generate-wine-profile/index.ts` in your local repo
- Paste it into the Supabase Dashboard code editor
- Click "Deploy"

---

### 3. Test the Function Directly

Let's verify the function works by testing it directly in the Supabase Dashboard:

1. Go to Edge Functions → generate-wine-profile → "Test" tab
2. Use this test payload:

```json
{
  "name": "Test Wine",
  "producer": "Test Producer",
  "region": "Bordeaux",
  "country": "France",
  "grapes": ["Cabernet Sauvignon", "Merlot"],
  "color": "red",
  "vintage": 2015
}
```

3. Make sure to set the Authorization header:
   - Get your session token from the browser
   - Open browser console on your app page
   - Run: `(await supabase.auth.getSession()).data.session.access_token`
   - Copy the token
   - In the Test tab, add header: `Authorization: Bearer <your-token>`

4. Click "Send"

**Expected response:**
```json
{
  "success": true,
  "profile": {
    "body": 4,
    "tannin": 4,
    "acidity": 3,
    ...
  }
}
```

**If you get an error:**
- Check the error message
- Look for "OPENAI_API_KEY not configured" → Add the secret
- Look for "Invalid or expired token" → Try getting a fresh token
- Look for "OpenAI API error" → Check your OpenAI account has credits

---

### 4. Check OpenAI Account Status

The function calls OpenAI API. Make sure:
1. Your OpenAI account is active
2. You have API credits/billing enabled
3. The API key is valid and not expired

**Test OpenAI API key:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY"
```

If this returns an error, your OpenAI key is invalid.

---

## Next Steps

1. **First:** Check if `OPENAI_API_KEY` is set in Supabase secrets
2. **Second:** Verify the deployed code matches the local code
3. **Third:** Test the function directly in the dashboard
4. **Fourth:** Check OpenAI account status

Once you've done these checks, try the backfill again. If it still fails, share:
- The exact error message from the browser console (after the new logging deploys)
- Any ERROR logs from the Supabase function logs
- The response from the direct function test

---

## Quick Reference: Where to Find Things

**Supabase Dashboard:**
- Secrets: Project Settings → Edge Functions → Secrets
- Function Code: Edge Functions → generate-wine-profile → Code tab
- Function Logs: Edge Functions → generate-wine-profile → Logs tab
- Function Test: Edge Functions → generate-wine-profile → Test tab

**Your App:**
- Backfill UI: https://wine-cellar-brain.vercel.app/profile
- Browser Console: Right-click → Inspect → Console tab
