# Dark Luxury Space Design System

## 🌌 Overview

Premium dark design inspired by Apple, Rolex, Porsche, and Airbnb principles - with subtle space depth.

**NOT sci-fi, NOT gaming, NOT neon** - refined luxury with cosmic elegance.

**Status:** Phase 1 complete - Dashboard and Add Bottle themed ✅  
**Innovation Features:** Tonight's Orbit + Drink Window Timeline widgets ✅

---

## Design Philosophy

### Luxury + Space + Wine

1. **Deep Night Base** - Rich dark background (#0a0a0f), warm and refined
2. **Subtle Star Texture** - Gentle star-grain animation (NOT flashy)
3. **Glass Surfaces** - Refined blur + thin borders (NOT aggressive glow)
4. **Wine & Champagne** - Burgundy primary + gold highlight (restrained)
5. **Premium Typography** - Clear hierarchy, generous white space
6. **Fast Transitions** - 150-250ms, Apple-like responsiveness
7. **Smooth Motion** - Gentle entrance animations, confident feel

### Inspired By

- **Apple.com:** Clarity, spacing, premium calm
- **Rolex.com:** Luxury mood, weighty CTAs
- **Porsche.com:** Crisp layout, confident motion
- **Airbnb.com:** Clean cards, smooth scrolling, great usability

---

## 🎨 Design Tokens

All tokens in `apps/web/src/styles/luxury-theme.css`

### Background Colors
```css
--bg-base: #0a0a0f           /* Deep night base */
--bg-surface: rgba(255, 255, 255, 0.04)  /* Subtle glass */
--bg-surface-elevated: rgba(255, 255, 255, 0.06)  /* Raised surfaces */
--bg-overlay: rgba(0, 0, 0, 0.75)  /* Modal backdrop */
```

### Text Colors (High Contrast)
```css
--text-primary: rgba(255, 255, 255, 0.95)   /* Almost white */
--text-secondary: rgba(255, 255, 255, 0.7)  /* Medium */
--text-tertiary: rgba(255, 255, 255, 0.5)   /* Light */
--text-muted: rgba(255, 255, 255, 0.35)     /* Very light */
```

### Border Colors
```css
--border-subtle: rgba(255, 255, 255, 0.08)
--border-medium: rgba(255, 255, 255, 0.12)
--border-strong: rgba(255, 255, 255, 0.18)
--border-accent: rgba(212, 175, 55, 0.3)  /* Gold tint */
```

### Wine Accent (Primary)
```css
--wine-500: #a44d5a  /* Main wine */
--wine-600: #8B3A47  /* Darker for gradients */
--wine-400: #c47889  /* Lighter */
```

### Gold/Champagne (Highlight)
```css
--gold-500: #d4af37  /* Pure gold */
--gold-400: #e8d098  /* Champagne (lighter) */
--gold-600: #b8941e  /* Darker */
```

### Shadows (Refined)
```css
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3)
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4)
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5)
--shadow-xl: 0 16px 40px rgba(0, 0, 0, 0.6)
```

### Glows (Subtle)
```css
--glow-wine: 0 0 20px rgba(164, 77, 90, 0.15)
--glow-gold: 0 0 20px rgba(212, 175, 55, 0.15)
```

### Blur (Glass Effect)
```css
--blur-glass: blur(16px)
--blur-heavy: blur(32px)
```

---

## 🧩 UI Primitives

### Cards

**Glass Card:**
```html
<div class="luxury-card">
  <!-- content -->
</div>
```

**Glass Card with Hover:**
```html
<div class="luxury-card luxury-card-hover">
  <!-- content -->
</div>
```

### Buttons

**Primary (Wine Gradient):**
```html
<button class="btn-luxury-primary">
  Add Bottle
</button>
```

**Secondary (Glass):**
```html
<button class="btn-luxury-secondary">
  Import CSV
</button>
```

**Ghost (Minimal):**
```html
<button class="btn-luxury-ghost">
  Cancel
</button>
```

### Inputs

**Glass Input:**
```html
<input 
  type="text"
  class="input-luxury w-full"
  placeholder="Search..."
/>
```

**Focus State:**
- Gold-tinted ring: `box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.15)`
- Border: `--border-accent`

### Modals

**Modal Container:**
```html
<div class="modal-luxury">
  <!-- content -->
</div>
```

**Modal Backdrop:**
```css
background: var(--bg-overlay);
backdrop-filter: var(--blur-heavy);
```

### Badges

**Wine Badge:**
```html
<span class="badge-luxury badge-luxury-wine">
  Ready Now
</span>
```

**Gold Badge:**
```html
<span class="badge-luxury badge-luxury-gold">
  Peak Soon
</span>
```

---

## ⭐ Starfield Background

### Implementation

The background is a **deep night** with **subtle animated stars**:

```css
.luxury-background::before {
  /* 7 layers of radial gradients creating tiny stars */
  /* Colors: white + wine + gold (very low opacity) */
  /* Sizes: 0.5px-1px for subtlety */
  animation: stars-drift 120s linear infinite;
  opacity: 0.6;
}

.luxury-background::after {
  /* Gentle vignette */
  background: radial-gradient(ellipse, transparent 0%, rgba(0, 0, 0, 0.4) 100%);
}
```

**Animation:**
- Stars drift slowly (120s loop)
- Translation: 50px over 2 minutes
- Respects `prefers-reduced-motion`

**Result:** Subtle cosmic depth without being distracting or sci-fi.

---

## 🚀 Innovation Features

### 1. Tonight's Orbit Widget

**Location:** Dashboard (when no search/filters active)  
**Component:** `apps/web/src/components/TonightsOrbit.tsx`

**What it shows:**
- Top 3 bottles in circular/orbital layout
- Central champagne focal point
- Subtle dotted lines connecting to center
- Smooth staggered entrance animation

**Interaction:**
- Click bottle to interact (currently logs to console)
- Hover: card scales 105%
- Touch-optimized (44px min-height)

**Visual Style:**
- NOT sci-fi (no rotating orbits, no HUD)
- Inspired by luxury watch complications
- Elegant, minimal, premium

### 2. Drink Window Timeline

**Location:** Dashboard (when no search/filters active)  
**Component:** `apps/web/src/components/DrinkWindowTimeline.tsx`

**What it shows:**
- Bottles grouped by readiness: HOLD / PEAK_SOON / READY
- Animated progress bars
- Icon + label + count for each stage
- Total analyzed count at bottom

**Visual Style:**
- Wine-tinted gradients for bars
- Gold-tinted for "Ready Now"
- Smooth fill animations (800ms)
- Clean, analytics-inspired

**Categories:**
- ⏳ **Hold** - Too young, cellar longer
- ⚡ **Peak Soon** - Approaching optimal window
- ✨ **Ready Now** - Drink tonight!

---

## 📱 Applied Components

### ✅ Fully Themed

#### **Dashboard (CellarPage)**
- Page title: Bold, primary text
- Action buttons: Wine gradient + glass
- Search input: Glass with gold focus ring
- Bottle cards: Glass with hover lift
- Tonight's Orbit widget ⭐
- Drink Window Timeline widget ⭐
- Empty/no results states: Glass cards

#### **Add Bottle Sheet (AddBottleSheet)**
- Container: Glass modal with blur
- Backdrop: Dark overlay with heavy blur
- Primary button: Wine gradient with glow
- Secondary button: Glass with border
- Cancel: Ghost button

#### **Bottle Form (BottleForm)**
- Modal: Glass with heavy blur
- All inputs: Glass with gold focus
- Labels: Primary text
- Cancel: Glass button
- Save: Wine gradient button

#### **Bottle Card (BottleCard)**
- Container: Glass with hover effect
- Wine name: Primary text
- Details: Secondary text
- Hover: Lifts 2px, shadow increases

#### **Global Layout (Layout)**
- Background: Animated starfield
- Top nav: Glass with blur
- Logo: Wine color
- Nav pills: Wine gradient (active) / glass (inactive)

### ❌ NOT Themed (Unchanged)
- History page
- Recommendation ("Tonight?") page
- Stats page
- Settings page
- Profile page
- Login page

---

## 🎯 Customization Guide

### Make Background Darker/Lighter

**Current:**
```css
--bg-base: #0a0a0f;
```

**Lighter (more visible):**
```css
--bg-base: #12121a;
```

**Darker (deeper night):**
```css
--bg-base: #050508;
```

### Adjust Star Visibility

**Current (subtle):**
```css
radial-gradient(1px 1px at 20% 30%, rgba(255, 255, 255, 0.12), transparent)
```

**More visible:**
```css
radial-gradient(1px 1px at 20% 30%, rgba(255, 255, 255, 0.20), transparent)
```

**Less visible:**
```css
radial-gradient(1px 1px at 20% 30%, rgba(255, 255, 255, 0.08), transparent)
```

### Change Wine Accent

**Current:**
```css
--wine-500: #a44d5a;
--wine-600: #8B3A47;
```

**Brighter red:**
```css
--wine-500: #c45a6a;
--wine-600: #a44d5a;
```

**Deeper burgundy:**
```css
--wine-500: #8B3A47;
--wine-600: #722F37;
```

### Adjust Glass Opacity

**Current (subtle):**
```css
--bg-surface: rgba(255, 255, 255, 0.04);
```

**More visible:**
```css
--bg-surface: rgba(255, 255, 255, 0.08);
```

**Less visible:**
```css
--bg-surface: rgba(255, 255, 255, 0.02);
```

### Disable Star Animation

```css
@media (prefers-reduced-motion: reduce) {
  .luxury-background::before {
    animation: none;
  }
}
```

Or manually set:
```css
.luxury-background::before {
  animation: none;
}
```

---

## 🧪 Testing Checklist

### Desktop
- [ ] Deep dark background visible
- [ ] Subtle stars drift slowly (NOT sci-fi)
- [ ] Cards have glass effect with blur
- [ ] Buttons have wine gradient (primary)
- [ ] Hover states smooth and refined
- [ ] Search input has gold focus ring
- [ ] Tonight's Orbit widget shows 3 bottles
- [ ] Drink Window shows progress bars

### Mobile (iOS Safari/Chrome)
- [ ] Bottom nav doesn't overlap content
- [ ] Safe areas respected on notched iPhones
- [ ] All buttons 44px min-height
- [ ] Touch targets large enough
- [ ] Form scrolls, buttons always visible
- [ ] No zoom on input focus
- [ ] Starfield doesn't cause lag
- [ ] Widgets layout correctly on small screens

### RTL (Hebrew)
- [ ] Switch to Hebrew in settings
- [ ] Text aligns right correctly
- [ ] Glass effects work in RTL
- [ ] Tonight's Orbit positions correctly
- [ ] Drink Window bars fill right-to-left
- [ ] Form fields align right

### Performance
- [ ] Page loads in <2s
- [ ] Animations smooth at 60fps
- [ ] No jank on scroll
- [ ] Star animation can be disabled

### Accessibility
- [ ] Text contrast meets WCAG AA (white on dark)
- [ ] Focus rings visible and clear
- [ ] Interactive elements have hover/active states
- [ ] Keyboard navigation works

---

## 📦 Files Changed

### New Files
- `apps/web/src/styles/luxury-theme.css` - Dark luxury design system
- `apps/web/src/components/TonightsOrbit.tsx` - Orbital widget
- `apps/web/src/components/DrinkWindowTimeline.tsx` - Timeline widget
- `DARK_LUXURY_THEME.md` - This documentation

### Modified Files
- `apps/web/src/index.css` - Import luxury-theme.css
- `apps/web/src/components/Layout.tsx` - Dark starfield background
- `apps/web/src/pages/CellarPage.tsx` - Glass buttons, widgets
- `apps/web/src/components/BottleCard.tsx` - Glass styling
- `apps/web/src/components/AddBottleSheet.tsx` - Dark modal
- `apps/web/src/components/BottleForm.tsx` - Glass inputs

---

## 🔄 Next Steps

To apply theme to other pages:

1. **Replace button classes:**
   - `btn-primary` → `btn-luxury-primary`
   - `btn-secondary` → `btn-luxury-secondary`
   - Minimal buttons → `btn-luxury-ghost`

2. **Replace card classes:**
   - `card` → `luxury-card`
   - Hoverable cards → `luxury-card luxury-card-hover`

3. **Replace input classes:**
   - `input` → `input-luxury w-full`

4. **Update text colors:**
   - Use `style={{ color: 'var(--text-primary)' }}`
   - Secondary text: `var(--text-secondary)`

5. **Update modals:**
   - Use `modal-luxury` class
   - Backdrop: `style={{ background: 'var(--bg-overlay)', backdropFilter: 'var(--blur-heavy)' }}`

---

## ✅ Build Output

```
✓ 578 modules transformed.
dist/assets/index-BClDddBd.css   50.40 kB │ gzip:  10.06 kB
dist/assets/index-CG9E2wPK.js   719.90 kB │ gzip: 211.75 kB
✓ built in 1.12s
```

**No errors, production-ready!**

---

## 💡 Design Notes

### Why Dark Background?

Premium brands use dark themes for:
- Luxury mood (sophisticated, exclusive)
- Focus on content (cards/text pop against dark)
- Reduced eye strain in evening (wine apps used at night)
- Modern, premium aesthetic

The subtle space texture adds depth without being sci-fi.

### Why Minimal Animations?

Inspired by Apple/Porsche:
- Fast transitions (150-250ms) feel responsive
- Gentle entrance animations (NOT flashy)
- Smooth, purposeful motion
- No heavy parallax or spinning effects

### Why Glass Surfaces?

Glass morphism creates:
- Premium depth (layers, hierarchy)
- Tactile feel (blur + shadow)
- Modern aesthetic (NOT flat design)
- Restrained elegance (NOT aggressive glow)

---

**Last Updated:** Dec 27, 2025  
**Version:** 2.0  
**Theme:** Dark Luxury Space (inspired by Apple/Rolex/Porsche/Airbnb)


