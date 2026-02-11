# Deploy Edge Function via Supabase Dashboard

## Step-by-Step Guide: Deploy `analyze-cellar` Edge Function

### Prerequisites
- ✅ Supabase account with access to your project
- ✅ Project has OpenAI API key configured in Vault

---

## Method 1: Deploy via Supabase Dashboard (Recommended for Quick Updates)

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Sign in to your account
3. Select your **Wine Cellar** project

### Step 2: Navigate to Edge Functions
1. In the left sidebar, click **"Edge Functions"**
2. You should see a list of existing functions including:
   - `analyze-cellar`
   - `analyze-wine`
   - `extract-wine-label`
   - etc.

### Step 3: Open the `analyze-cellar` Function
1. Click on **`analyze-cellar`** in the list
2. You'll see the function details page with:
   - Current code
   - Deployments history
   - Logs
   - Settings

### Step 4: Update the Function Code
1. Click the **"Details"** tab
2. Click **"Edit function"** button (top right)
3. You'll see a code editor with the current function code

### Step 5: Copy the New Code
1. Open your local file: `supabase/functions/analyze-cellar/index.ts`
2. Copy the ENTIRE file contents (Ctrl+A, Ctrl+C)
3. Go back to the Supabase dashboard editor
4. **Select all** the old code (Ctrl+A)
5. **Paste** the new code (Ctrl+V)

### Step 6: Verify the Changes
Look for these key changes in the code:

```typescript
// NEW: Pagination parameters
interface AnalysisRequest {
  mode: 'missing_only' | 'stale_only' | 'all';
  limit?: number;
  pageSize?: number;  // ← NEW
  offset?: number;     // ← NEW
}
```

```typescript
// NEW: Pagination in the query
.range(offset, offset + pageSize - 1); // ← Look for this line
```

### Step 7: Save and Deploy
1. Click **"Save"** or **"Deploy"** button (usually top-right)
2. Wait for the deployment to complete (usually 10-30 seconds)
3. You should see a success message: ✅ "Function deployed successfully"

### Step 8: Verify Deployment
1. Click on the **"Deployments"** tab
2. You should see a new deployment at the top with:
   - Status: **"Active"** ✅
   - Timestamp: Current time
   - Version: New version number

---

## Method 2: Deploy via Supabase CLI (Alternative)

If you prefer using the command line:

### Step 1: Install Supabase CLI
```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows
scoop install supabase
```

### Step 2: Login to Supabase
```bash
supabase login
```
- This will open a browser window
- Authorize the CLI

### Step 3: Link to Your Project
```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
supabase link --project-ref YOUR_PROJECT_REF
```

To find your project ref:
1. Go to Supabase Dashboard
2. Project Settings → General → Reference ID

### Step 4: Deploy the Function
```bash
supabase functions deploy analyze-cellar
```

Wait for:
```
Deploying function analyze-cellar...
✓ Function deployed successfully
```

---

## Verification After Deployment

### Test the Function

#### Option 1: Test via Dashboard
1. Go to **Edge Functions** → **`analyze-cellar`**
2. Click **"Invoke"** tab
3. Enter test payload:
```json
{
  "mode": "missing_only",
  "limit": 10,
  "pageSize": 50,
  "offset": 0
}
```
4. Click **"Invoke function"**
5. Check the response - should include pagination working

#### Option 2: Test from Your App
1. Open your wine app
2. Go to the Cellar page
3. Click **"🧙‍♂️ Analyze Cellar"** button
4. Watch for:
   - Progress updates (should show "Processed X / Y wines")
   - Cancel button works
   - No crashes even with many wines

#### Option 3: Check Logs
1. Go to **Edge Functions** → **`analyze-cellar`**
2. Click **"Logs"** tab
3. Look for recent invocations
4. Check for errors or pagination logs:
```
[Analyze Cellar] PageSize: 50, Offset: 0
[Analyze Cellar] Fetched bottles: 50 from offset 0
```

---

## Common Issues & Solutions

### Issue 1: "Function not found"
**Solution:** Make sure you're in the correct project and the function name is spelled exactly as `analyze-cellar` (with hyphen, not underscore).

### Issue 2: "Unauthorized"
**Solution:** 
1. Go to Project Settings → API
2. Copy the **service_role** key
3. Go to Edge Functions → analyze-cellar → Settings
4. Verify environment variables are set

### Issue 3: "OpenAI API error"
**Solution:**
1. Go to Project Settings → Vault
2. Check if `OPENAI_API_KEY` secret exists
3. If missing, add it:
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key (starts with `sk-...`)

### Issue 4: Deployment fails with "Invalid TypeScript"
**Solution:**
1. Check for syntax errors in your local file
2. Make sure you copied the ENTIRE file
3. Check that all imports are present at the top
4. Try deploying via CLI instead (Method 2)

### Issue 5: Old code still running after deployment
**Solution:**
1. Wait 1-2 minutes for propagation
2. Hard refresh your app (Ctrl+Shift+R or Cmd+Shift+R)
3. Check the "Deployments" tab to confirm the new version is Active
4. Check Edge Function logs to see which version is executing

---

## Environment Variables Checklist

Make sure these are set in your project:

### In Supabase Vault (Project Settings → Vault):
- ✅ `OPENAI_API_KEY` - Your OpenAI API key

### In Edge Function Settings:
- ✅ `SUPABASE_URL` - Auto-set by Supabase
- ✅ `SUPABASE_ANON_KEY` - Auto-set by Supabase
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase

You can verify these in:
**Edge Functions → analyze-cellar → Settings → Environment Variables**

---

## Expected Behavior After Deployment

### ✅ Small Cellar (< 50 wines)
- Completes in one batch
- Progress shows "Processed 32 / 32 wines"
- Success toast appears

### ✅ Medium Cellar (50-200 wines)
- Multiple batches (2-4)
- Progress updates smoothly
- "Processed 50 / 147 wines"
- "Processed 100 / 147 wines"
- Success after all batches

### ✅ Large Cellar (200+ wines)
- Many batches (4-20+)
- Smooth progress updates
- Cancel button works anytime
- No crashes or white screens
- "Large cellars take a bit longer..." message appears

---

## Rollback (If Something Goes Wrong)

### Via Dashboard:
1. Go to **Edge Functions → analyze-cellar → Deployments**
2. Find the previous working version
3. Click the **"..."** menu next to it
4. Click **"Redeploy"**

### Via CLI:
```bash
# List recent deployments
supabase functions list-versions analyze-cellar

# Redeploy a specific version
supabase functions deploy analyze-cellar --version <version-id>
```

---

## Quick Reference

### Files Modified:
- ✅ `supabase/functions/analyze-cellar/index.ts` - Added pagination support

### Key Changes:
- Added `pageSize` and `offset` parameters to request
- Modified database query to use `.range()` for pagination
- Added stable ordering with `.order('created_at')`
- Default page size: 50 wines per batch

### Testing Checklist:
- [ ] Function deploys without errors
- [ ] Logs show pagination working
- [ ] Small cellar analysis completes
- [ ] Large cellar shows progress
- [ ] Cancel button works
- [ ] No crashes or white screens

---

## Need Help?

### Check Logs:
```
Edge Functions → analyze-cellar → Logs
```

### Monitor in Real-Time:
```bash
# If using CLI
supabase functions logs analyze-cellar --tail
```

### Test Locally First:
```bash
# Serve function locally
supabase functions serve analyze-cellar

# Test with curl
curl -X POST http://localhost:54321/functions/v1/analyze-cellar \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"missing_only","limit":10,"pageSize":50,"offset":0}'
```

---

## Success! 🎉

Once deployed, your Edge Function will:
- ✅ Support pagination (never crash on large cellars)
- ✅ Process wines in batches of 50
- ✅ Work with the new client-side batch processor
- ✅ Enable progress tracking in the UI

Your "Analyze Cellar" feature is now production-ready for cellars of any size!
