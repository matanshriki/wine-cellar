# Debug Edge Function - Step by Step

## Issue: Getting 500 Error with [object Object]

This usually means the function is crashing or the test payload is incorrect.

---

## Step 1: Use Correct Test Payload

**In the Supabase Test panel, replace the Request Body with:**

```json
{
  "name": "Chateau Margaux",
  "producer": "Chateau Margaux",
  "region": "Bordeaux",
  "country": "France",
  "grapes": ["Cabernet Sauvignon", "Merlot"],
  "color": "red",
  "vintage": 2015
}
```

**Important:** Make sure to include:
- ✅ `"name"` - REQUIRED
- ✅ `"color"` - REQUIRED ("red", "white", "rose", or "sparkling")
- Everything else is optional

Click **Invoke** or **Run**

---

## Step 2: Check Function Logs

1. In Supabase Dashboard, stay on the **Edge Functions** page
2. Click on `generate-wine-profile`
3. Go to **Logs** tab
4. Look for recent invocations

**What to look for:**
- ❌ `OPENAI_API_KEY not configured` → Missing API key
- ❌ `Missing authorization header` → Need to add header
- ❌ `OpenAI API error: 401` → Invalid OpenAI key
- ❌ `Missing required fields` → Incomplete test payload
- ✅ `[generate-wine-profile] ✅ AI profile generated` → Success!

---

## Step 3: Verify OpenAI API Key

**Check if secret is set:**
1. **Edge Functions** → **Configuration** → **Secrets**
2. Look for `OPENAI_API_KEY`
3. Should be listed (value hidden)

**If missing:**
1. Click **Add Secret**
2. Name: `OPENAI_API_KEY`
3. Value: `sk-...your-key...`
4. Save

**Test your OpenAI key separately:**
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_OPENAI_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say hello"}],
    "max_tokens": 10
  }'
```

Should return: `{"choices":[{"message":{"content":"Hello..."}}]}`

---

## Step 4: Add Authorization Header (If Testing Manually)

If testing via the Supabase test interface:

1. Go to **Headers** section
2. Click **Add Header**
3. Add:
   - **Key**: `Authorization`
   - **Value**: `Bearer YOUR_ANON_KEY`

**Get your ANON_KEY:**
- Supabase Dashboard → **Settings** → **API** → Copy the `anon` `public` key

---

## Step 5: Check Function Code Deployed Correctly

1. Go to **Edge Functions** → Click `generate-wine-profile`
2. Look for **Code** or **Editor** tab
3. Verify the code is there (should be ~275 lines)
4. Check for:
   - ✅ `import { serve }` at top
   - ✅ `computePower` function exists
   - ✅ `serve(async (req) => {` at bottom
   - ✅ OpenAI fetch with JSON schema

**If code looks wrong:**
1. Click **Edit**
2. Re-paste the entire content from `supabase/functions/generate-wine-profile/index.ts`
3. **Save** and **Deploy** again

---

## Common Issues & Fixes

### Issue 1: "OPENAI_API_KEY not configured"

**Fix:**
```bash
# Via CLI:
supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY

# Or via Dashboard:
Edge Functions → Configuration → Secrets → Add Secret
```

---

### Issue 2: Missing "name" field in test

**Your current test payload:**
```json
{
  "grapes": ["Cabernet Sauvignon", "Merlot"],
  "color": "red",
  "vintage": 2015
}
```

**Should be:**
```json
{
  "name": "Chateau Margaux",  ← ADD THIS (required!)
  "grapes": ["Cabernet Sauvignon", "Merlot"],
  "color": "red",
  "vintage": 2015
}
```

---

### Issue 3: Invalid OpenAI Key

**Check key format:**
- Should start with `sk-`
- Should be ~51 characters long
- Get a fresh one from: https://platform.openai.com/api-keys

**Test key directly:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_KEY"
```

Should list available models.

---

### Issue 4: Function Timeout

If the function is timing out:
1. Check **Logs** tab for timeout errors
2. OpenAI call might be slow
3. Try simpler test payload first (just name and color)

---

## Step-by-Step Debugging

### Test 1: Minimal Payload
```json
{
  "name": "Test Wine",
  "color": "red"
}
```

**Expected:** Should work and return a profile (low confidence)

---

### Test 2: With Producer/Region
```json
{
  "name": "Chateau Margaux",
  "producer": "Chateau Margaux",
  "region": "Bordeaux",
  "color": "red"
}
```

**Expected:** Should work with better confidence

---

### Test 3: Full Payload
```json
{
  "name": "Chateau Margaux",
  "producer": "Chateau Margaux",
  "region": "Bordeaux",
  "country": "France",
  "grapes": ["Cabernet Sauvignon", "Merlot", "Cabernet Franc"],
  "color": "red",
  "vintage": 2015,
  "regional_wine_style": "Bordeaux Blend",
  "vivino_fields": {
    "rating": 4.5,
    "abv": 13.5
  }
}
```

**Expected:** Should return high confidence profile

---

## Check Function Response Structure

**Success response should look like:**
```json
{
  "success": true,
  "profile": {
    "body": 5,
    "tannin": 4,
    "acidity": 4,
    "oak": 4,
    "sweetness": 0,
    "alcohol_est": 13.5,
    "power": 9,
    "style_tags": [
      "full-bodied",
      "structured",
      "elegant",
      "age-worthy",
      "complex"
    ],
    "confidence": "high",
    "source": "ai",
    "updated_at": "2026-02-05T15:00:00.000Z"
  }
}
```

**Error response should look like:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Missing required fields: name, color"
  }
}
```

---

## What [object Object] Means

When you see `[object Object]` in the response, it means:
- The function returned a JavaScript object
- But the UI tried to display it as a string
- Usually indicates an error object wasn't properly stringified

**To see the actual error:**
1. Go to **Logs** tab (most important!)
2. Look at the actual console.log outputs
3. You'll see the real error message there

---

## Quick Checklist

Before testing again, verify:

- [ ] Function code is deployed (check Code tab)
- [ ] `OPENAI_API_KEY` secret is set (check Configuration → Secrets)
- [ ] Test payload includes `"name"` field
- [ ] Test payload includes `"color"` field (must be: "red", "white", "rose", or "sparkling")
- [ ] JSON is valid (no trailing commas, proper quotes)

---

## If Still Not Working

**Send me the Logs output:**
1. Go to **Logs** tab in the function
2. Look at the most recent invocation
3. Copy the error message
4. That will tell us exactly what's wrong

**Common log errors:**

**"OPENAI_API_KEY not configured"**
→ Secret not set correctly

**"OpenAI API error: 401"**
→ Invalid OpenAI API key

**"Missing authorization header"**
→ Need to add Authorization header with your anon key

**"Missing required fields: name, color"**
→ Test payload incomplete

---

## Try This Test Payload Now

**Replace your Request Body with:**

```json
{
  "name": "Chateau Margaux",
  "producer": "Chateau Margaux",
  "region": "Bordeaux",
  "country": "France",
  "grapes": ["Cabernet Sauvignon", "Merlot"],
  "color": "red",
  "vintage": 2015
}
```

**Add Authorization header:**
- Key: `Authorization`
- Value: `Bearer YOUR_ANON_KEY` (get from Settings → API)

**Click Run/Invoke**

Then check:
1. **Response** - Should show profile JSON
2. **Logs** - Should show success messages

Let me know what the **Logs** tab shows!
