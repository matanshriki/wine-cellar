# iOS Debug - Next Steps

**Commit**: `72e40f0`  
**Status**: Extensive logging deployed  
**Issue**: `onSmartScan` not being called on iOS/PWA

---

## 🔍 What to Check (After Deploy)

### Step 1: Force Refresh PWA

**If using PWA (installed on home screen)**:
1. Close the PWA completely (swipe up to close)
2. Wait 10 seconds
3. Reopen PWA
4. Or: Delete PWA and reinstall from Safari

**If using Safari**:
1. Open Safari
2. Navigate to app
3. Hold refresh button → "Empty Cache and Hard Reload"
4. Or: Settings → Safari → Clear History and Website Data

---

### Step 2: Open Console

**Option A - On Mac (if iPhone connected)**:
1. Connect iPhone to Mac via cable
2. On Mac: Safari → Develop → [Your iPhone] → [Wine Cellar]
3. Console tab will show iOS logs

**Option B - On iPhone (if jailbroken/developer)**:
- Not recommended for most users

**Option C - Share screenshot**:
- Take screenshot of console after trying to scan
- Share here

---

### Step 3: Try Scanning Again

1. Clear console (if visible on Mac)
2. Tap camera button
3. Tap "Scan Bottles"
4. Select photo

---

### Step 4: What You Should See

**Expected Logs (If Working)**:
```
[CellarPage] Rendering AddBottleSheet, handleSmartScan is: function DEFINED
[AddBottleSheet] Component rendered with props: { hasOnSmartScan: true, hasOnPhotoSelected: true, onSmartScanType: "function", isOpen: true }
[AddBottleSheet] File selected: image.jpg 3635285 bytes image/jpeg
[AddBottleSheet] Calling onSmartScan...
[CellarPage] ========== SMART SCAN START ==========
[CellarPage] handleSmartScan called successfully!
[compressImage] Starting compression: image.jpg
```

**Current Logs (Not Working)**:
```
[AddBottleSheet] File selected: "image.jpg" - 3635285 - "bytes" - "image/jpeg"
⚠️ [AddBottleSheet] No scan handler provided!
[AddBottleSheet] Resetting file input
```

---

## 🎯 Diagnosis

### Scenario A: `hasOnSmartScan: false`

**Means**: `onSmartScan` prop not being passed to AddBottleSheet

**Cause**: Old JavaScript bundle cached by PWA/browser

**Fix**: 
1. Force refresh (see Step 1)
2. Clear PWA cache
3. Reinstall PWA

---

### Scenario B: `hasOnSmartScan: true` but still shows "No scan handler provided"

**Means**: Logic issue in `handleFileSelect`

**Cause**: Condition checking `if (onSmartScan)` is failing even though prop exists

**Fix**: I'll need to adjust the condition (might be checking wrong thing)

---

### Scenario C: `handleSmartScan is: undefined`

**Means**: Function not defined in CellarPage

**Cause**: Serious bundling issue or code error

**Fix**: I'll need to investigate build process

---

## 🔧 Manual Workaround (Temporary)

If scanning still doesn't work after clearing cache:

**Desktop Alternative**:
- Use desktop browser (which works)
- Upload photos there

**iPhone Safari (not PWA)**:
- Try using Safari browser instead of PWA
- Safari might have different caching behavior

---

## 📊 What I Need From You

After trying the above:

**Share**:
1. Did you clear PWA cache / reinstall?
2. Are you using PWA or Safari?
3. Console screenshot (if using Mac remote debugging)
4. Or: Tell me which scenario matches the logs you see

---

## ⚡ Quick Fix Commands (If Caching Issue)

**On iPhone**:
```
Settings → Safari → Advanced → Website Data → Find "winecellar.com" → Delete
```

**Or**:
```
Settings → General → iPhone Storage → Find PWA → Delete App → Reinstall
```

---

**Try these steps and let me know what console logs you see!** This will tell us if it's a caching issue or a code issue. 🔍📱
