# Mobile Camera FAB Redesign - Luxury Centered Design

**Date**: Jan 28, 2026  
**Status**: ✅ Fixed - Ready for local testing

---

## 🎯 Requirements

### 1. Camera FAB Opens Add Bottle Flow Immediately
**Problem**: Clicking the camera icon from non-Cellar pages navigated to Cellar, requiring a second tap.

**Solution**: 
- Created global `AddBottleContext` for state management
- Rendered `AddBottleSheet` in `Layout` (global component)
- Camera FAB now triggers Add Bottle flow immediately from ANY page

### 2. Luxury Centered Design
**Problem**: Camera FAB design didn't match the luxury aesthetic shown in reference image.

**Solution**:
- Redesigned FAB to be **centered in the footer** but **protruding above it**
- Inspired by reference image: circular FAB with white border, floating above footer
- Larger size (64px → 72px) for prominence
- Enhanced shadows, gradients, and animations
- Footer layout now has 2 items left + center FAB + 2 items right

---

## 📐 Visual Design (Matches Reference)

```
┌─────────────────────────┐
│                         │
│   Page Content          │
│                         │
└─────────────────────────┘
           ↑
     ┌──────────┐
     │          │
     │  Camera  │ ← Protruding above footer
     │   FAB    │   (wine gradient + white border)
     │          │
     └──────────┘
           ↓
┌─────────────────────────┐
│  ○    ○     ○    ○      │ ← Luxury footer pill
│ Left  Left  Right Right │   (translucent white + blur)
└─────────────────────────┘
```

### Design Elements:
- **Camera FAB**:
  - Size: 64px (16 units)
  - Position: `-top-8` (32px above footer)
  - Background: Wine gradient (var(--wine-500) → var(--wine-600))
  - Border: 4px solid white (rgba(255, 255, 255, 0.95))
  - Shadow: Enhanced multi-layer (8px + 4px blur)
  - Icon: Camera, 32px, white, stroke-width 2.5
  - Animations: Scale on tap, lift on hover, subtle shine effect

- **Footer Pill**:
  - Background: Translucent white (rgba(255, 255, 255, 0.9))
  - Backdrop blur: 16px
  - Shadow: Multi-layer with inset highlight
  - Border: 1px solid rgba(255, 255, 255, 0.8)
  - Height: 64px (16 units)
  - Layout: 2 items | CENTER SPACE | 2 items

---

## 🔧 Technical Implementation

### Architecture

#### 1. **AddBottleContext** (New)
Global state management for Add Bottle flow:

```tsx
// apps/web/src/contexts/AddBottleContext.tsx
- showAddSheet: boolean
- openAddBottleFlow(): void
- closeAddBottleFlow(): void
```

Wrapped in `App.tsx` at the root level (inside FeatureFlagsProvider).

#### 2. **Layout.tsx** (Modified)
- Imports `AddBottleContext` and `AddBottleSheet`
- Renders `AddBottleSheet` globally (accessible from all pages)
- Camera FAB click → `openAddBottleFlow()` immediately
- Add Bottle Sheet options dispatch custom events:
  - `openLabelCapture` → Camera/upload flow
  - `openManualForm` → Manual entry
  - `openMultiBottleImport` → Bulk import

#### 3. **CellarPage.tsx** (Modified)
- Listens for custom events from global Add Bottle Sheet:
  - `openLabelCapture` → `setShowCamera(true)`
  - `openManualForm` → `setShowForm(true)`
  - `openMultiBottleImport` → `setShowMultiImport(true)`

#### 4. **MobileFloatingFooter.tsx** (Redesigned)
- Camera FAB now **integrated into the footer container**
- Positioned with `absolute -top-8` (protruding above footer)
- Footer layout: 2 nav items + center spacer + 2 nav items
- Enhanced styling with larger shadows, white border, and luxury animations

---

## 📂 Files Modified

### New Files:
1. ✅ `apps/web/src/contexts/AddBottleContext.tsx` - Global state for Add Bottle flow

### Modified Files:
1. ✅ `apps/web/src/App.tsx` - Wrapped with `AddBottleProvider`
2. ✅ `apps/web/src/components/Layout.tsx` - Renders global `AddBottleSheet`
3. ✅ `apps/web/src/components/MobileFloatingFooter.tsx` - Redesigned with centered FAB
4. ✅ `apps/web/src/pages/CellarPage.tsx` - Listens for custom events

---

## 🎯 User Flow

### Scenario 1: User on Cellar Page
1. Tap Camera FAB
2. Add Bottle Sheet opens immediately
3. User selects:
   - **"Upload Photo"** → Camera/Label Capture opens
   - **"Manual Entry"** → Manual form opens
   - **"Scan Multiple"** → Multi-bottle import opens (if visible on Cellar)

### Scenario 2: User on History/Wishlist/Tonight Page
1. Tap Camera FAB
2. Add Bottle Sheet opens immediately
3. User selects option
4. CellarPage listens for event and opens appropriate modal/flow

### Scenario 3: User on any page (global behavior)
- Camera FAB always visible at bottom
- Always triggers Add Bottle flow immediately
- No navigation required

---

## 🎨 Design Specifications

### Camera FAB:
```tsx
// Size & Position
width: 64px (w-16)
height: 64px (h-16)
position: absolute
top: -32px (-top-8)
left: 50%
transform: translateX(-50%)

// Styling
background: linear-gradient(135deg, var(--wine-500), var(--wine-600))
border: 4px solid rgba(255, 255, 255, 0.95)
shadow: 0 8px 32px rgba(164, 76, 104, 0.5), 0 4px 16px rgba(0, 0, 0, 0.2)

// Icon
camera-icon: 32px (w-8 h-8)
stroke: white
stroke-width: 2.5

// Animations
whileTap: scale(0.92)
whileHover: scale(1.05), translateY(-3px)
```

### Footer Pill:
```tsx
// Container
background: rgba(255, 255, 255, 0.9)
backdrop-filter: blur(16px)
border: 1px solid rgba(255, 255, 255, 0.8)
shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 2px rgba(255, 255, 255, 1)
border-radius: 9999px (rounded-full)
height: 64px (h-16)
padding: 8px (px-2)

// Layout
flex items-center
2 nav items (flex-1) | CENTER SPACER (flex-1) | 2 nav items (flex-1)
```

---

## 🧪 Testing Checklist

### Camera FAB Behavior:
- [ ] **On Cellar page**: Tap Camera FAB → Add Bottle Sheet opens
- [ ] **On History page**: Tap Camera FAB → Add Bottle Sheet opens
- [ ] **On Wishlist page**: Tap Camera FAB → Add Bottle Sheet opens
- [ ] **On Tonight page**: Tap Camera FAB → Add Bottle Sheet opens
- [ ] Select "Upload Photo" → Camera/Label Capture opens (on any page)
- [ ] Select "Manual Entry" → Manual form opens (on any page)

### Visual Design:
- [ ] Camera FAB is **centered** in footer
- [ ] Camera FAB **protrudes above** footer
- [ ] White border visible around FAB
- [ ] Wine gradient visible on FAB
- [ ] Footer has 2 items left, center space, 2 items right
- [ ] Footer is translucent with blur effect
- [ ] Active page indicator shows correctly

### Mobile Behavior:
- [ ] Viewport ≤768px shows floating footer + FAB
- [ ] Viewport >768px hides footer + FAB (desktop layout)
- [ ] Safe area respected on notched devices
- [ ] Scroll to bottom - content not covered by footer
- [ ] Animations smooth and luxury feel

### Interactions:
- [ ] Tap FAB - scale down animation
- [ ] Release FAB - spring back animation
- [ ] Hover FAB (if applicable) - lift animation
- [ ] Tap nav buttons - navigate correctly
- [ ] Active page indicator animates smoothly

---

## ⚠️ Notes

- **Global State**: `AddBottleContext` manages the sheet state globally, accessible from any page
- **Custom Events**: Communication between `Layout` (global) and `CellarPage` (specific) uses custom events to avoid prop drilling
- **Multi-bottle Option**: Hidden in global sheet (`showMultiBottleOption={false}`), only visible when triggered from Cellar page directly
- **Accessibility**: Camera FAB has proper `aria-label`, keyboard focus, and reduced motion support

---

## 🚀 Implementation Summary

1. **Created**: `AddBottleContext` for global Add Bottle state management
2. **Modified**: `App.tsx` to wrap with `AddBottleProvider`
3. **Modified**: `Layout.tsx` to render global `AddBottleSheet` and connect Camera FAB
4. **Modified**: `CellarPage.tsx` to listen for custom events from global sheet
5. **Redesigned**: `MobileFloatingFooter.tsx` with centered, protruding Camera FAB matching reference image

---

## ✅ Status

**NOT committed or deployed yet** - waiting for local testing confirmation.

Ready to test on `localhost` - all changes are local only.
