# Carousel Image Size Fix (LOCAL - NOT COMMITTED)

## Problem
Wine bottle images in the mobile carousel appeared too small with excessive white space, reducing the premium feel and user experience.

## Solution
Increased image size and optimized spacing for better visual balance.

---

## Changes Made

### Image Size
**Before**: `w-20 h-28` (80px × 112px)  
**After**: `w-36 h-48` (144px × 192px)  
**Increase**: +80% width, +71% height

### Card Padding
**Before**: `p-4` (16px all sides)  
**After**: `p-3` (12px all sides)  
**Change**: Reduced to accommodate larger image

### Spacing Adjustments
1. **Image margin**: `mb-3` → `mb-2` (tighter)
2. **Wine name margin**: `mb-2` → `mb-1.5` (tighter)
3. **Details spacing**: `space-y-2` → `space-y-1.5` (tighter)
4. **Details bottom**: `mb-3` → `mb-2` (tighter)
5. **Wine name padding**: `pe-10` → `pe-8` (less right padding)

### Card Height
**Before**: `min-height: 280px`  
**After**: `min-height: 320px`  
**Change**: +40px to accommodate larger image

### Visual Polish
1. **Image shadow**: `shadow-sm` → `shadow-md` (more depth)
2. **Badge position**: Adjusted for better placement
3. **Badge size**: `w-8 h-8` → `w-7 h-7` (slightly smaller to balance)

---

## Visual Impact

### Before
```
┌─────────────────────┐
│         [1]         │
│                     │
│      🍷 tiny        │
│                     │
│                     │
│    Wine Name        │
│    Details...       │
│    Region...        │
│    Rating...        │
│    [Badge]          │
└─────────────────────┘
    ↑ Too much white space
```

### After
```
┌─────────────────────┐
│        [1]          │
│                     │
│     🍷 LARGE        │
│     BOTTLE          │
│     IMAGE           │
│                     │
│   Wine Name         │
│   Details...        │
│   Region...         │
│   [Badge]           │
└─────────────────────┘
    ↑ Better balanced!
```

---

## Benefits

1. ✅ **More premium look** - Larger, more prominent wine images
2. ✅ **Better visual hierarchy** - Image is the focal point
3. ✅ **Improved UX** - Easier to see wine bottle details
4. ✅ **Balanced layout** - Reduced excessive white space
5. ✅ **Maintained touch targets** - Still easy to tap/swipe
6. ✅ **Consistent with luxury design** - More app-like, polished

---

## Technical Details

### File Changed
`apps/web/src/components/TonightsOrbit.tsx`

### Lines Modified
- Line 142: Card padding `p-4` → `p-3`
- Line 147: Badge position `top-3 end-3` → `top-2 end-2`
- Line 147: Badge size `w-8 h-8` → `w-7 h-7`
- Line 168: Image margin `mb-3` → `mb-2`
- Line 172: Image size `w-20 h-28` → `w-36 h-48`
- Line 175: Image shadow `shadow-sm` → `shadow-md`
- Line 206: Wine name margin `mb-2` → `mb-1.5`
- Line 206: Wine name padding `pe-10` → `pe-8`
- Line 217: Details spacing `space-y-2` → `space-y-1.5`
- Line 217: Details margin `mb-3` → `mb-2`
- Line 467: Card min-height `280px` → `320px`

---

## Testing Checklist

- [ ] **Image Size**: Wine bottle images appear larger and more prominent
- [ ] **Spacing**: Layout feels balanced (not cramped, not too spacious)
- [ ] **Touch Targets**: Cards still easy to tap and swipe
- [ ] **Text Readability**: Wine name and details still readable
- [ ] **Badge Position**: Number badge (1,2,3) positioned well
- [ ] **Scroll Behavior**: Carousel still scrolls smoothly
- [ ] **Peek Effect**: Still shows part of next card
- [ ] **RTL**: Works correctly in Hebrew
- [ ] **No Overflow**: No horizontal page scroll

---

## Desktop Unchanged
Desktop grid layout (≥ 768px) maintains original image size and spacing.

---

## How to Test

1. Start dev server: `npm run dev`
2. Open http://localhost:5173
3. Toggle device mode (mobile view)
4. Navigate to "My Cellar"
5. See "Tonight's Selection" carousel
6. Verify larger, more prominent wine images
7. Check that layout feels balanced

---

**Status**: ✅ **IMPLEMENTED LOCALLY - READY FOR TESTING**

**Priority**: High (Visual quality improvement)
