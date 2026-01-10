# 🔧 Demo Mode Auto-Exit Fix

**Date**: Jan 10, 2026  
**Issue**: Demo mode persists even after user adds real bottles to cellar  
**Status**: ✅ Fixed

---

## 🐛 Problem

When a user:
1. Entered demo mode
2. Added a bottle to their wishlist
3. Then moved that bottle to their cellar

**Expected Behavior**: Demo mode should automatically exit once the user has at least one real bottle.

**Actual Behavior**: Demo mode stayed active, showing demo bottles alongside real bottles.

**Why This Happened**:
- Demo mode was only exiting when adding a bottle through the "Add Bottle" form
- Adding bottles via wishlist → cellar didn't trigger demo mode exit
- No automatic check to see if user has real bottles when bottles are loaded

---

## ✅ Solution

Added an automatic check that runs whenever the `bottles` state changes:

```typescript
// Onboarding v1 – value first: Auto-exit demo mode when user has real bottles
useEffect(() => {
  // Only run in dev mode
  if (!isDemoModeAvailable()) return;
  
  // If demo mode is active AND user has at least one real bottle, exit demo mode
  if (isDemoMode && bottles.length > 0) {
    console.log('[CellarPage] User has real bottles, auto-exiting demo mode');
    onboardingUtils.deactivateDemoMode();
    setIsDemoMode(false);
  }
}, [bottles, isDemoMode]);
```

**How It Works**:
1. Watches the `bottles` and `isDemoMode` state
2. If demo mode is active AND user has at least 1 bottle
3. Automatically exits demo mode
4. User sees only their real bottles

---

## 🧪 Testing

### Test 1: Add Bottle from Wishlist
1. Run `window.resetOnboarding()` in console
2. Refresh page, enter demo mode
3. Scan/add a bottle to wishlist
4. Move bottle from wishlist to cellar
5. **Result**: Demo mode exits automatically ✅
6. User sees only their real bottle ✅

### Test 2: Add Bottle Directly
1. Reset onboarding, enter demo mode
2. Click "Add just one bottle" CTA
3. Add a bottle directly to cellar
4. **Result**: Demo mode exits ✅
5. First bottle success modal shows ✅

### Test 3: CSV Import
1. Reset onboarding, enter demo mode
2. Import bottles via CSV
3. **Result**: Demo mode exits automatically ✅

### Test 4: Exit Demo Button Still Works
1. Enter demo mode
2. Click "Exit Demo" banner button
3. **Result**: Exits to empty state ✅

---

## 📋 Files Changed

- `apps/web/src/pages/CellarPage.tsx`
  - Added `useEffect` to auto-exit demo mode when user has real bottles
  - Watches `bottles` and `isDemoMode` state
  - Calls `deactivateDemoMode()` and updates state

---

## 🎯 Result

- ✅ Demo mode exits automatically when user has ≥1 bottle
- ✅ Works for all bottle addition methods (direct add, wishlist, CSV import)
- ✅ No duplicate bottles showing (demo + real)
- ✅ Clean user experience

---

## 🔄 All Exit Paths

Demo mode now exits in these scenarios:

1. **User clicks "Exit Demo"** banner button
2. **User adds first bottle** via Add Bottle form → Shows success modal
3. **User has bottles loaded** from any source → Auto-exits immediately
4. **User imports CSV** with bottles → Auto-exits
5. **User moves wishlist to cellar** → Auto-exits

---

## 📝 Technical Details

**Why `useEffect` with `[bottles, isDemoMode]` dependencies?**
- Runs whenever bottles array changes (new bottle added, imported, etc.)
- Runs whenever demo mode state changes
- Ensures demo mode exits regardless of how bottles were added
- Clean, reactive approach using React hooks

**Dev-only check**:
```typescript
if (!isDemoModeAvailable()) return;
```
Ensures this logic only runs in development/localhost, never in production.

---

## 🚀 Next Steps

None required - fix is complete and handles all bottle addition scenarios!

**Test it**:
```bash
# In browser console
window.resetOnboarding()
# Refresh, enter demo mode
# Add a bottle any way you like (wishlist, direct, CSV)
# Demo mode exits automatically! ✅
```

---

✨ **Demo mode now intelligently exits as soon as you have real bottles!**

