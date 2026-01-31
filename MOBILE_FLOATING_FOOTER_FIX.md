# Mobile Floating Footer - Bug Fix

**Date**: Jan 28, 2026  
**Status**: ✅ Fixed - Ready for local testing

---

## 🐛 Issues Fixed

### 1. Camera FAB Hidden by Footer
**Problem**: The Camera FAB was overlapping with the footer navigation items, making it appear hidden or partially covered.

**Solution**: 
- Increased FAB positioning from `bottom: 56px` to `bottom: 72px`
- Adjusted spacer height from `88px` to `96px`
- FAB now floats clearly above the footer with proper spacing

### 2. Camera FAB Only on Cellar Page
**Problem**: The Camera FAB and floating footer only appeared on `/cellar` page. Users on other pages (Wishlist, History, etc.) couldn't quickly add bottles.

**Solution**:
- Moved `MobileFloatingFooter` from `CellarPage.tsx` to `Layout.tsx` (global component)
- Now appears on ALL pages: Cellar, Tonight's Selection, History, Wishlist
- Camera FAB behavior:
  - **On Cellar page**: Opens Add Bottle sheet directly (via custom event)
  - **On other pages**: Navigates to Cellar page (user can then tap again to add)

---

## 📝 Files Modified

### 1. **MobileFloatingFooter.tsx**
- ✅ Increased FAB `bottom` from `56px` → `72px`
- ✅ Increased spacer height from `88px` → `96px`

### 2. **Layout.tsx**
- ✅ Added import for `MobileFloatingFooter`
- ✅ Replaced `BottomNav` with `MobileFloatingFooter` globally
- ✅ Camera FAB logic:
  - If on `/cellar`: Dispatch `openAddBottle` custom event
  - If on other pages: Navigate to `/cellar`

### 3. **CellarPage.tsx**
- ✅ Removed local `MobileFloatingFooter` rendering (now in Layout)
- ✅ Removed `MobileFloatingFooter` import
- ✅ Added `useEffect` to listen for `openAddBottle` custom event
- ✅ Event handler opens Add Bottle sheet when triggered

---

## 🎯 Expected Behavior (After Testing)

### Mobile (≤768px):
1. **All pages show**:
   - Floating translucent footer with 4 nav buttons
   - Wine gradient Camera FAB centered above footer
   - Proper spacing - no overlap

2. **Camera FAB interaction**:
   - **On Cellar page**: Tap → Opens Add Bottle sheet immediately
   - **On Wishlist/History/Tonight**: Tap → Navigates to Cellar

3. **Navigation**:
   - All 4 footer buttons work correctly
   - Active page indicator shows current location
   - Smooth animations (respects reduced motion)

### Desktop (>768px):
- **Unchanged**: Traditional Add Bottle button in Cellar header
- No floating footer (desktop has full header navigation)

---

## 🧪 Testing Checklist

### Mobile Viewport (≤768px):
- [ ] Open app on mobile or dev tools mobile view
- [ ] Navigate to **Cellar page**:
  - [ ] Floating footer visible with 4 nav buttons
  - [ ] Camera FAB visible above footer (not covered)
  - [ ] Tap Camera FAB → Add Bottle sheet opens
- [ ] Navigate to **Wishlist page**:
  - [ ] Floating footer still visible
  - [ ] Camera FAB still visible
  - [ ] Tap Camera FAB → Navigates to Cellar
- [ ] Navigate to **History page**:
  - [ ] Floating footer still visible
  - [ ] Camera FAB still visible
- [ ] Navigate to **Tonight's Selection page**:
  - [ ] Floating footer still visible
  - [ ] Camera FAB still visible
- [ ] Scroll to bottom on any page:
  - [ ] Content not covered by footer
  - [ ] Proper spacing maintained

### Desktop (>768px):
- [ ] Footer and FAB hidden
- [ ] Normal Add Bottle button in header works

---

## 🚀 Implementation Details

### Camera FAB Positioning
```tsx
// FAB container
bottom: '72px'  // 72px above viewport bottom (leaves room for 64px footer + 8px visual gap)

// Spacer (prevents content overlap)
height: 'calc(96px + env(safe-area-inset-bottom))'
// 96px = 64px footer + 28px FAB radius + 4px breathing room
```

### Event Communication Pattern
```tsx
// Layout.tsx (global Camera FAB click)
if (location.pathname === '/cellar') {
  const event = new CustomEvent('openAddBottle');
  window.dispatchEvent(event);
} else {
  window.location.href = '/cellar';
}

// CellarPage.tsx (listen for event)
useEffect(() => {
  const handleOpenAddBottle = () => setShowAddSheet(true);
  window.addEventListener('openAddBottle', handleOpenAddBottle);
  return () => window.removeEventListener('openAddBottle', handleOpenAddBottle);
}, []);
```

---

## 📐 Visual Hierarchy (Mobile)

```
┌─────────────────────────┐
│                         │
│   Page Content          │
│   (Cellar/Wishlist/etc) │
│                         │
│                         │
└─────────────────────────┘
           ↑ 96px spacer
     ┌──────────┐
     │  Camera  │ ← Floating FAB (72px above bottom)
     │   FAB    │
     └──────────┘
           ↓ 8px visual gap
┌─────────────────────────┐
│  ○   ○   ○   ○          │ ← Floating Footer (64px height)
│ Nav buttons             │
└─────────────────────────┘
         ↓ Safe area
```

---

## ⚠️ Notes

- **Custom Event**: Used for cross-component communication (Layout → CellarPage) without prop drilling or context overhead
- **Navigation on non-Cellar pages**: Chose simple navigation over complex state management for first tap (better UX for now)
- **Safe Area Support**: Footer respects iOS notches via `env(safe-area-inset-bottom)`
- **Animation**: Uses existing `framer-motion` with `shouldReduceMotion` check for accessibility

---

## 🎨 Design Consistency

All styling matches the app's luxury design system:
- Wine gradient on FAB: `linear-gradient(135deg, var(--wine-500), var(--wine-600))`
- Translucent footer: `rgba(255, 255, 255, 0.85)` with backdrop blur
- Smooth shadows and borders
- RTL/LTR support maintained

---

## ✅ Status

**NOT committed or deployed yet** - waiting for local testing confirmation.

Ready to test on `localhost` - all changes are local only.
