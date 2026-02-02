# Scan Debug Guide - Finding the Issue

**Status**: Enhanced logging deployed (commit `f2b7c72`)  
**Purpose**: Diagnose why scan "disappears" after photo upload

---

## 🔍 How to Debug

### Step 1: Open Browser Console

**Chrome/Edge**:
1. Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
2. Click "Console" tab

**Safari**:
1. Enable Developer Menu: Safari → Preferences → Advanced → Show Develop menu
2. Develop → Show Web Inspector → Console tab

**Firefox**:
1. Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
2. Click "Console" tab

---

### Step 2: Try to Scan

1. Clear console (click trash icon)
2. Tap camera button
3. Tap "Scan Bottles"
4. Select/take photo
5. Watch the console

---

### Step 3: Look for Logging Patterns

## Expected Success Flow ✅

```javascript
// Start
[CellarPage] ========== SMART SCAN START ==========
[CellarPage] File: IMG_1234.jpg Size: 2456789 Type: image/jpeg
[CellarPage] Calling smartScanService.performSmartScan...

// Smart Scan Service
[smartScanService] ========== SMART SCAN START ==========
[smartScanService] File: IMG_1234.jpg 2456789 bytes image/jpeg
[smartScanService] Step 1: Uploading image...
[smartScanService] ✅ Image uploaded successfully: https://...
[smartScanService] Step 2: Calling edge function...
[smartScanService] Request params: { imageUrl: "...", mode: "multi-bottle" }
[smartScanService] Edge function response received
[smartScanService] Error: null
[smartScanService] Data: { success: true, bottles: [...] }
[smartScanService] Step 3: Analyzing response
[smartScanService] Response structure: { success: true, bottlesCount: 1, hasBottlesArray: true, bottlesIsArray: true }
[smartScanService] Detected 1 bottle(s)
[smartScanService] ✅ Single bottle detected

// Back to CellarPage
[CellarPage] ========== SMART SCAN COMPLETE ==========
[CellarPage] Mode: single
[CellarPage] Detected count: 1
[CellarPage] Confidence: 0.85
[CellarPage] Image URL: https://...
[CellarPage] Has single bottle data: true
[CellarPage] Has multiple bottles data: false
[CellarPage] ✅ Routing to SINGLE BOTTLE form
[CellarPage] Setting extracted data: {...}
[CellarPage] Opening bottle form...
[CellarPage] ========== SMART SCAN ROUTING COMPLETE ==========
[CellarPage] Setting isParsing to false
```

**If you see this**: Scan is working! Form should open.

---

## Common Failure Patterns

### Pattern 1: Smart Scan Never Called ❌

```javascript
// NOTHING in console after selecting photo
// or ONLY this:
[CellarPage] File selected
```

**Problem**: `onSmartScan` not being called  
**Possible causes**:
- AddBottleSheet not receiving `onSmartScan` prop
- `handleFileSelect` not calling it
- File input not triggering change event

---

### Pattern 2: Upload Fails ❌

```javascript
[smartScanService] ========== SMART SCAN START ==========
[smartScanService] Step 1: Uploading image...
[smartScanService] ❌ Error during AI processing: Upload failed: ...
[CellarPage] ========== SMART SCAN ERROR ==========
[CellarPage] Error message: Upload failed: ...
```

**Problem**: Image upload to Supabase failing  
**Possible causes**:
- Supabase storage bucket not accessible
- Storage policies blocking upload
- Network error
- File too large
- User not authenticated

---

### Pattern 3: Edge Function Error ❌

```javascript
[smartScanService] ✅ Image uploaded successfully: https://...
[smartScanService] Step 2: Calling edge function...
[smartScanService] Edge function response received
[smartScanService] Error: { message: "..." }
[smartScanService] ❌ Edge function error: ...
```

**Problem**: Edge function rejecting request  
**Possible causes**:
- Edge function not deployed
- Edge function crashed
- Authentication issues
- OpenAI API key missing/invalid
- Rate limiting

---

### Pattern 4: No Response Data ❌

```javascript
[smartScanService] Edge function response received
[smartScanService] Error: null
[smartScanService] Data: null
[smartScanService] ⚠️ No data returned from edge function
```

**Problem**: Edge function returned empty response  
**Possible causes**:
- Edge function logic error
- AI model error
- Image URL not accessible
- Timeout

---

### Pattern 5: Wrong Response Format ❌

```javascript
[smartScanService] Data: { producer: {...}, name: {...} }
[smartScanService] Response structure: { success: undefined, bottlesCount: 0, hasBottlesArray: false, bottlesIsArray: false }
[smartScanService] Detected 0 bottle(s)
[smartScanService] No bottles detected, defaulting to single mode
```

**Problem**: Edge function returning single bottle format instead of array  
**Possible causes**:
- Edge function not recognizing `mode: 'multi-bottle'`
- Edge function using wrong prompt
- Edge function code mismatch

---

### Pattern 6: Form Doesn't Open ❌

```javascript
[CellarPage] ========== SMART SCAN COMPLETE ==========
[CellarPage] ✅ Routing to SINGLE BOTTLE form
[CellarPage] Opening bottle form...
[CellarPage] ========== SMART SCAN ROUTING COMPLETE ==========
// BUT: Form doesn't appear on screen
```

**Problem**: Form state not updating UI  
**Possible causes**:
- React state update blocked
- Modal/form component error
- CSS hiding form
- Z-index issue

---

## What to Share

Once you've tried scanning and checked the console, share:

1. **Full console log** (copy all lines starting with `[CellarPage]` or `[smartScanService]`)
2. **What you see on screen** (does loader show? does it disappear? any error message?)
3. **Which step fails** (based on patterns above)

Example format:
```
Screen: Loader appears for 2 seconds, then disappears. No form opens.

Console:
[CellarPage] ========== SMART SCAN START ==========
[CellarPage] File: IMG_5678.jpg Size: 3456789 Type: image/jpeg
[smartScanService] ========== SMART SCAN START ==========
[smartScanService] Step 1: Uploading image...
[smartScanService] ❌ Error during AI processing: Upload failed: Bucket not found
...
```

---

## Quick Fixes

### If Upload Fails
**Check**: Supabase storage bucket exists and is accessible
**Fix**: Verify storage policies allow authenticated users to upload

### If Edge Function Fails
**Check**: Edge function is deployed and running
**Fix**: Redeploy edge function, check OpenAI API key

### If Response is Empty
**Check**: Edge function logs in Supabase dashboard
**Fix**: Check edge function code for errors

### If Form Doesn't Open
**Check**: Browser console for React errors
**Fix**: Check if `showForm` state is being set

---

## After Sharing Console Logs

I can:
1. Identify which step is failing
2. Determine root cause
3. Implement targeted fix
4. Deploy hotfix within minutes

**The enhanced logging will show exactly where the flow breaks!** 🔍✨
