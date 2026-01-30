# How to Debug Agent Multi-Bottle Errors

I've added comprehensive logging to help us debug the 500 error. Here's exactly where to find the logs:

## Step 1: Access Vercel Function Logs

1. Go to **[Vercel Dashboard](https://vercel.com/dashboard)**
2. Click on your **wine-cellar** project
3. Click **"Functions"** in the left sidebar (or top tabs)
4. Look for `/api/agent/recommend` in the functions list
5. Click on it to see recent invocations

## Step 2: Trigger the Error

1. Wait 2-3 minutes for the latest deployment to complete
2. Hard refresh your app: `Cmd + Shift + R`
3. Go to the agent chat
4. Send: **"What are the top 5 wines in my cellar?"**
5. Wait for the error

## Step 3: Check the Logs

Go back to Vercel → Functions → `/api/agent/recommend` and look for the most recent log entry.

### What to Look For:

The logs will show clear sections marked with `======`:

```
[Sommelier] ====== NEW REQUEST ======
[Sommelier] User abc12345 - Sending 42 bottles to OpenAI
[Sommelier] User message: "What are the top 5 wines in my cellar?"
[Sommelier] Sample bottle: { id: '...', producer: '...', ... }

[Sommelier] ====== OpenAI RAW RESPONSE ======
{ full JSON response here }
[Sommelier] ====== END RAW RESPONSE ======

[Sommelier] ✓ JSON parse successful
[Sommelier] Parsed structure:
  - type: bottle_list
  - message: YES
  - bottles: YES (5)
  - recommendation: NO
  - followUpQuestion: NO

[Sommelier] ====== MULTI-BOTTLE PATH ======
[Sommelier] Detected multi-bottle response with 5 bottles
[Sommelier] First bottle: {...}

[Sommelier] ⚠️ VALIDATION FAILED: Invalid bottleIds in list: 2
[Sommelier] Invalid bottles: ['abc123', 'def456']

OR

[Sommelier] ✓ All bottles valid, setting recommendation
[Sommelier] Recommendation set: true

[Sommelier] ====== FINAL CHECK ======
[Sommelier] Recommendation exists: true
[Sommelier] Recommendation type: bottle_list

[Sommelier] ✓ Request completed successfully | user: abc12345... | duration: 3542ms
[Sommelier] ====== RETURNING RESPONSE ======
```

### OR if there's an error:

```
[Sommelier] ====== PARSE ERROR ======
[Sommelier] Parse error: Unexpected token ...
[Sommelier] Stack: ...

OR

[Sommelier] ❌ ERROR: Failed to generate recommendation after all attempts
```

## Step 4: Share the Logs

Once you find the log entry, please share:

1. **The entire log output** for that request (copy/paste from Vercel)
2. **Specifically** the sections:
   - `====== OpenAI RAW RESPONSE ======` (the full JSON)
   - `Parsed structure:` (what fields exist)
   - Which path it took (MULTI-BOTTLE, SINGLE-BOTTLE, or MESSAGE/QUESTION)
   - Any `⚠️` warnings or `❌` errors

## Alternative: Check Vercel Deployment Logs

If Functions logs don't show up:

1. Go to **Deployments** tab in Vercel
2. Click on the most recent deployment
3. Click **"Functions"** tab
4. Look for runtime logs

## What I'm Looking For:

The logs will tell us:
- ✓ Is OpenAI returning the correct format?
- ✓ Is it including the `bottles` array?
- ✓ Are the bottle IDs valid?
- ✓ Is the JSON malformed?
- ✓ Is validation failing?
- ✓ Is recommendation being set correctly?

With this information, I can pinpoint exactly what's going wrong and fix it!

## Quick Reference: Log Sections

| Section | What It Means |
|---------|---------------|
| `====== NEW REQUEST ======` | Request started, shows user message |
| `====== OpenAI RAW RESPONSE ======` | **MOST IMPORTANT**: Shows exact OpenAI response |
| `✓ JSON parse successful` | JSON is valid |
| `====== MULTI-BOTTLE PATH ======` | Detected multi-bottle response |
| `⚠️ VALIDATION FAILED` | Some bottle IDs don't exist in cellar |
| `✓ All bottles valid` | Validation passed |
| `====== FINAL CHECK ======` | About to return response |
| `✓ Request completed successfully` | Success! |
| `❌ ERROR` | Something failed |

---

Once you get the logs, share them with me and I'll know exactly what to fix! 🔍
