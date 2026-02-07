# RTL Fixes Summary

## Issues Fixed

### 1. Tonight's Selection Carousel Arrows (RTL)

**Problem:**
- In Hebrew mode (RTL), the carousel arrows were not swapping positions
- Previous arrow stayed on the left, Next arrow stayed on the right
- This is confusing in RTL where reading/navigation is right-to-left

**Solution:**
- Added Tailwind RTL-aware positioning classes:
  - Previous arrow: `ltr:left-0 rtl:right-0` (left in LTR, right in RTL)
  - Next arrow: `ltr:right-0 rtl:left-0` (right in LTR, left in RTL)
- Icons already had `flip-rtl` class to flip arrow direction
- Now both position AND direction swap correctly in Hebrew

**Result:**
- ✅ In English (LTR): ← Previous on left, Next → on right
- ✅ In Hebrew (RTL): → Next on left, Previous ← on right

---

### 2. Wishlist Remove Button Translation

**Problem:**
- The "Remove" button in wishlist page was not translated to Hebrew
- Code was calling `t('common.remove')` but translation was missing

**Solution:**
- Added `"remove": "הסר"` to the `common` section in `he.json`
- Translation now exists and matches the usage in code

**Result:**
- ✅ Remove button displays as "הסר" in Hebrew mode

---

## Files Modified

1. **`apps/web/src/components/TonightsOrbitCinematic.tsx`**
   - Line 683: Added `ltr:left-0 rtl:right-0` to previous arrow button
   - Line 716: Added `ltr:right-0 rtl:left-0` to next arrow button

2. **`apps/web/src/i18n/locales/he.json`**
   - Added `"remove": "הסר"` to `common` section (line 693)

---

## Testing

To verify the fixes work correctly:

1. **Carousel Arrows Test:**
   - Open the app in English → arrows should be: ← (left) and → (right)
   - Switch to Hebrew → arrows should swap to: → (left) and ← (right)
   - Click arrows → should navigate correctly in both languages

2. **Wishlist Remove Button Test:**
   - Switch to Hebrew
   - Go to Wishlist page
   - Hover over a wine item
   - The remove button should display "הסר" (not "Remove")

---

## Build Status

✅ Build passes successfully:
```
✓ built in 1.63s
```

All changes committed to `main` branch.
