# Wishlist Feature - Testing Guide (DEV ONLY)

**Status**: ✅ Implementation Complete  
**Environment**: Development/Localhost ONLY  
**Date**: January 9, 2026

---

## 🎯 Feature Overview

The **Wishlist** feature allows users to save wines they want to buy later. This is particularly useful when:
- Trying a wine at a restaurant and wanting to remember it
- Seeing a wine you'd like to purchase but don't own yet
- Building a shopping list of wines to acquire

**CRITICAL**: This feature is **DEV-ONLY** and will not work in production. It uses localStorage for storage (no backend changes).

---

## 🔧 What Was Implemented

### 1. **Core Service** (`wishlistService.ts`)
- localStorage-based storage (key: `wcb_wishlist_dev`)
- Functions: `loadWishlist()`, `saveWishlist()`, `addWishlistItem()`, `updateWishlistItem()`, `removeWishlistItem()`, `searchWishlist()`
- Guarded by `isDevEnvironment()` checks

### 2. **Components**
- **WishlistForm**: Review/edit form for adding wines to wishlist
  - Shows extracted AI data with edit capability
  - Additional fields: restaurant name, personal note
  - Confidence indicator for low-quality AI extractions
  
- **WishlistPage**: Main wishlist view
  - Card-based list of wishlist items
  - Search/filter functionality
  - "Move to Cellar" and "Remove" actions
  - Empty state with helpful messaging
  - Shows "Added X days ago" timestamps

### 3. **Integration Points**
- **App.tsx**: Added `/wishlist` route (private, dev-only)
- **Layout.tsx**: Added "Wishlist (dev)" nav item (desktop navigation)
- **AddBottleSheet.tsx**: Added "Add to Wishlist" photo upload option (amber/gold styling)
- **CellarPage.tsx**: Added wishlist flow handler with AI extraction

### 4. **Translations**
- Added `nav.wishlist`, `wishlist.*`, and `cellar.addBottle.addToWishlist*` keys to `en.json`
- All user-facing text is i18n-ready

---

## ✅ Testing Checklist

### **Environment Verification**
- [ ] Confirm you're running on localhost (check browser URL bar)
- [ ] Verify "Wishlist (dev)" appears in desktop navigation
- [ ] Verify "Add to Wishlist" option appears in Add Bottle sheet (amber/gold button with "DEV" badge)

### **Add to Wishlist Flow (Photo-Based)**
1. **Take/Upload Photo**
   - [ ] Navigate to Cellar page
   - [ ] Click "Add Bottle" floating button
   - [ ] Click "Add to Wishlist" option (amber button)
   - [ ] Select a wine label photo (or take new photo)
   - [ ] Wait for AI processing (wine glass animation)
   - [ ] Verify WishlistForm opens with pre-filled data

2. **Review & Edit**
   - [ ] Check that producer and wine name are pre-filled
   - [ ] If confidence is low, verify warning banner appears
   - [ ] Edit any fields as needed (vintage, region, grapes, etc.)
   - [ ] Add restaurant name (e.g., "La Trattoria")
   - [ ] Add personal note (e.g., "Amazing with steak")
   - [ ] Click "Add to Wishlist" button

3. **Validation**
   - [ ] Try saving with empty producer → Should show error toast
   - [ ] Try saving with empty wine name → Should show error toast
   - [ ] Save with valid data → Should show success toast

### **Wishlist Page**
4. **Navigate to Wishlist**
   - [ ] Click "Wishlist (dev)" in desktop navigation
   - [ ] Or directly visit `/wishlist` in browser
   - [ ] Verify page loads without errors

5. **View Wishlist Items**
   - [ ] Verify added item appears in list
   - [ ] Check that wine details are displayed correctly:
     - Producer + Wine Name + Vintage
     - Region/grapes (if provided)
     - Restaurant name (if provided)
     - Personal note (if provided)
     - Label image thumbnail (if available)
     - "Added X days ago" timestamp
   
6. **Search/Filter**
   - [ ] Type producer name in search → Verify item appears
   - [ ] Type wine name in search → Verify item appears
   - [ ] Type restaurant name in search → Verify item appears
   - [ ] Clear search → Verify all items return

### **Move to Cellar**
7. **Move Item to Cellar**
   - [ ] Click "Move to Cellar" on a wishlist item
   - [ ] Confirm the dialog
   - [ ] Wait for processing
   - [ ] Verify success toast appears
   - [ ] Verify item is removed from wishlist
   - [ ] Navigate to Cellar page
   - [ ] Verify bottle now appears in cellar with tag `["wishlist"]`
   - [ ] Check that image and notes were preserved

8. **Move Failure Handling**
   - [ ] Try moving an item with invalid data (if possible)
   - [ ] Verify error toast appears
   - [ ] Verify item remains in wishlist

### **Remove from Wishlist**
9. **Remove Item**
   - [ ] Click "Remove" on a wishlist item
   - [ ] Confirm the dialog
   - [ ] Verify item is removed immediately
   - [ ] Verify success toast appears

### **Edge Cases**
10. **Empty State**
    - [ ] Remove all wishlist items
    - [ ] Verify empty state appears with:
      - Bookmark icon
      - "No wines in your wishlist yet" message
      - "Add Your First Wine" button
    - [ ] Click button → Should navigate to cellar

11. **Persistence**
    - [ ] Add a few wishlist items
    - [ ] Refresh the page
    - [ ] Verify all items are still there (localStorage persistence)
    - [ ] Close tab and reopen → Items should persist

12. **Low Confidence AI Extraction**
    - [ ] Upload a blurry or unclear label photo
    - [ ] Verify warning banner appears: "Some fields may be unclear - please review"
    - [ ] Manually correct the fields
    - [ ] Save successfully

### **Production Safety**
13. **Production Environment Check**
    - [ ] Deploy to production (or simulate by changing hostname)
    - [ ] Verify "Wishlist (dev)" does NOT appear in navigation
    - [ ] Try to visit `/wishlist` directly → Should redirect to cellar
    - [ ] Verify "Add to Wishlist" option does NOT appear in Add Bottle sheet
    - [ ] Confirm no console errors related to wishlist

---

## 🐛 Known Limitations & Constraints

1. **DEV-ONLY**: Feature is completely disabled in production
2. **No Backend**: Data stored in localStorage only (per-browser, not synced)
3. **No Edit Function**: Can't edit wishlist items after creation (must remove and re-add)
4. **No Duplicate Detection**: Same wine can be added multiple times
5. **No Image Re-upload**: Once added, can't change the label image
6. **No Export**: Can't export wishlist to CSV or share with others
7. **localStorage Limits**: Browser storage ~5-10MB max (should handle 100+ items easily)

---

## 🔍 Troubleshooting

### Issue: "Wishlist (dev)" doesn't appear in navigation
**Solution**: 
- Check that `window.location.hostname === 'localhost'`
- Check browser console for `[DEV]` logs
- Try `127.0.0.1` instead of `localhost`

### Issue: "Add to Wishlist" button not showing
**Solution**:
- Verify `isDevEnvironment()` returns true
- Check that you're on localhost
- Check console for errors in `AddBottleSheet.tsx`

### Issue: Items not persisting after refresh
**Solution**:
- Check browser localStorage is enabled
- Open DevTools → Application → Local Storage → Check for `wcb_wishlist_dev` key
- Try clearing localStorage and re-adding items
- Check for quota errors in console

### Issue: AI extraction not working
**Solution**:
- This is expected (placeholder until Edge Function is deployed)
- The form will open with empty fields - fill them manually
- Check `labelScanService.ts` line 188 for the placeholder return

### Issue: Can't move to cellar - "Failed to create wine entry"
**Solution**:
- Ensure you're logged in to Supabase
- Check that producer + wine name are not empty
- Check browser console for detailed error messages
- Verify Supabase connection is working (try adding a regular bottle)

---

## 📝 Implementation Details

### File Changes
- **New Files**:
  - `apps/web/src/services/wishlistService.ts`
  - `apps/web/src/components/WishlistForm.tsx`
  - `apps/web/src/pages/WishlistPage.tsx`

- **Modified Files**:
  - `apps/web/src/App.tsx` (added route)
  - `apps/web/src/components/Layout.tsx` (added nav item)
  - `apps/web/src/components/AddBottleSheet.tsx` (added wishlist option)
  - `apps/web/src/pages/CellarPage.tsx` (integrated wishlist flow)
  - `apps/web/src/i18n/locales/en.json` (added translations)

### Code Markers
All new code is marked with:
```typescript
// Wishlist feature (dev only)
```

This makes it easy to find and remove when ready.

### Storage Format
```json
{
  "wcb_wishlist_dev": [
    {
      "id": "uuid-here",
      "createdAt": "2026-01-09T12:00:00.000Z",
      "producer": "Château Margaux",
      "wineName": "Grand Vin",
      "vintage": 2015,
      "region": "Bordeaux",
      "country": "France",
      "grapes": "Cabernet Sauvignon, Merlot",
      "color": "red",
      "imageUrl": "https://...",
      "restaurantName": "Le Grand Restaurant",
      "note": "Incredible wine - must buy!",
      "vivinoUrl": null,
      "source": "wishlist-photo",
      "confidence": { "overall": "high", ... }
    }
  ]
}
```

---

## 🚀 Next Steps (Optional Enhancements)

If you decide to promote this feature to production:

1. **Backend Integration**
   - Create `wishlist_items` table in Supabase
   - Add RLS policies (users can only access their own wishlist)
   - Migrate `wishlistService.ts` to use Supabase instead of localStorage

2. **Enhanced Features**
   - Edit functionality for wishlist items
   - Duplicate detection (warn if wine already in wishlist/cellar)
   - Share wishlist with friends
   - Export to CSV
   - Vivino integration (auto-populate from Vivino URL)
   - Price tracking (monitor wine prices over time)

3. **UX Improvements**
   - Add to wishlist directly from bottle cards (if not owned)
   - Bulk move to cellar (select multiple items)
   - Sorting options (by date added, producer, vintage)
   - Filtering by color/region
   - "Already in cellar" indicator

---

## 🎉 Success Criteria

The feature is working correctly if:
- ✅ You can add wines to wishlist via photo upload
- ✅ AI extracts wine data and pre-fills the form
- ✅ You can edit fields and add restaurant/note
- ✅ Items persist across page refreshes
- ✅ Search works for producer/wine/restaurant
- ✅ "Move to Cellar" creates a bottle and removes from wishlist
- ✅ "Remove" deletes item from wishlist
- ✅ Feature is completely hidden in production
- ✅ No errors in browser console

---

## 📞 Support

If you encounter issues not covered in this guide:

1. Check browser console for error messages
2. Check localStorage contents (DevTools → Application → Local Storage)
3. Verify you're on localhost (hostname check)
4. Check that Supabase connection is working
5. Try clearing localStorage and starting fresh

**Happy Testing! 🍷**

