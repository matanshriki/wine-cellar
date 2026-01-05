# Light Luxury Design System

## 🎨 Overview

This document describes the **light luxury design system** inspired by Apple, Rolex, Porsche, and Airbnb. The design is clean, airy, classic, and premium—with subtle space texture for depth, NOT a dark sci-fi theme.

**Status:** Phase 1 complete - Dashboard and Add Bottle themed ✅  
**Scope:** Partial rollout (Dashboard + Add Bottle only, rest unchanged)

---

## Design Philosophy

### What Makes This "Light Luxury"

1. **Clean White Base** - Off-white/ivory background (warm, airy)
2. **Subtle Space Texture** - Barely visible star grain + gentle vignette
3. **Premium Typography** - Clear hierarchy, generous spacing
4. **Refined Shadows** - Soft, layered depth (no harsh blacks)
5. **Wine & Champagne Accents** - Restrained burgundy + gold highlights
6. **Fast Transitions** - 150-250ms, smooth and polished
7. **Touch-Optimized** - 44px min touch targets, proper spacing

### NOT Like

❌ **Dark Mode** - Background is light, not deep night  
❌ **Sci-Fi** - No glowing HUD, no futuristic effects  
❌ **Neon/Gaming** - No bright cyan/magenta/electric colors  
❌ **Heavy Gradients** - Minimal use, only for accent buttons  
❌ **Busy Textures** - Star grain is extremely subtle

---

## 🎨 Design Tokens

All tokens defined in `apps/web/src/styles/luxury-theme.css`

### Background Colors
```css
--bg-base: #fafaf8           /* Off-white, warm ivory */
--bg-surface: #ffffff        /* Pure white for cards */
--bg-surface-2: #f5f5f3      /* Subtle grey for raised surfaces */
--bg-overlay: rgba(0, 0, 0, 0.4)  /* Modal backdrop */
```

### Text Colors
```css
--text-primary: #1a1a1a      /* Almost black */
--text-secondary: #6b6b6b    /* Medium grey */
--text-tertiary: #9b9b9b     /* Light grey */
--text-muted: #c4c4c4        /* Very light grey */
--text-inverse: #ffffff      /* White (for dark backgrounds) */
```

### Border Colors
```css
--border-light: rgba(0, 0, 0, 0.06)   /* Subtle dividers */
--border-medium: rgba(0, 0, 0, 0.1)   /* Standard borders */
--border-strong: rgba(0, 0, 0, 0.15)  /* Emphasized borders */
--border-accent: rgba(114, 47, 55, 0.2)  /* Wine tint */
```

### Wine Accent (Primary)
```css
--wine-600: #8B3A47   /* Main wine color */
--wine-700: #722F37   /* Darker for gradients */
--wine-50: #faf5f6    /* Very light for backgrounds */
```

### Gold/Champagne Accent (Highlight)
```css
--gold-500: #d4af37   /* Pure gold */
--gold-300: #f4e4c1   /* Champagne (lighter) */
--gold-700: #8f7216   /* Darker for contrast */
```

### Shadows (Refined, Layered)
```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04)
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.03)
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)
--shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.06)
--shadow-xl: 0 16px 32px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.08)
```

### Focus States (Accessibility)
```css
--shadow-wine-focus: 0 0 0 4px rgba(164, 77, 90, 0.08)
--shadow-gold-focus: 0 0 0 4px rgba(212, 175, 55, 0.08)
```

### Border Radius
```css
--radius-sm: 0.5rem   /* 8px */
--radius-md: 0.75rem  /* 12px */
--radius-lg: 1rem     /* 16px */
--radius-xl: 1.25rem  /* 20px */
--radius-2xl: 1.5rem  /* 24px */
--radius-full: 9999px
```

### Spacing Scale
```css
--space-xs: 0.5rem   /* 8px */
--space-sm: 0.75rem  /* 12px */
--space-md: 1rem     /* 16px */
--space-lg: 1.5rem   /* 24px */
--space-xl: 2rem     /* 32px */
--space-2xl: 3rem    /* 48px */
--space-3xl: 4rem    /* 64px */
--space-4xl: 6rem    /* 96px */
```

### Typography Scale
```css
--text-xs: 0.75rem    /* 12px */
--text-sm: 0.875rem   /* 14px */
--text-base: 1rem     /* 16px */
--text-lg: 1.125rem   /* 18px */
--text-xl: 1.25rem    /* 20px */
--text-2xl: 1.5rem    /* 24px */
--text-3xl: 1.875rem  /* 30px */
--text-4xl: 2.25rem   /* 36px */
--text-5xl: 3rem      /* 48px */
```

### Font Weights
```css
--font-light: 300
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
```

### Transitions (Fast, Premium)
```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1)
```

---

## 🧩 UI Primitives

### Cards

**Basic Card:**
```html
<div class="luxury-card">
  <!-- content -->
</div>
```

**Card with Hover:**
```html
<div class="luxury-card luxury-card-hover">
  <!-- content -->
</div>
```

**Elevated Card:**
```html
<div class="luxury-card-elevated">
  <!-- content -->
</div>
```

### Buttons

**Primary (Wine Gradient):**
```html
<button class="btn-luxury-primary">
  Save
</button>
```

**Secondary (Light with Border):**
```html
<button class="btn-luxury-secondary">
  Cancel
</button>
```

**Ghost (Minimal):**
```html
<button class="btn-luxury-ghost">
  Close
</button>
```

### Inputs

**Standard Input:**
```html
<input 
  type="text"
  class="input-luxury w-full"
  placeholder="Enter wine name..."
/>
```

**With Focus State:**
- Automatically shows wine-tinted focus ring
- Border changes to `--border-accent`
- Shadow: `--shadow-wine-focus`

### Modals

**Modal Container:**
```html
<div class="modal-luxury">
  <!-- content -->
</div>
```

**Modal Backdrop:**
```html
<div style="background: var(--bg-overlay); backdrop-filter: var(--blur-medium);">
  <!-- modal -->
</div>
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
  Premium
</span>
```

**Neutral Badge:**
```html
<span class="badge-luxury badge-luxury-neutral">
  Aging
</span>
```

---

## 🌟 Subtle Space Texture

### Background Implementation

The background is **light ivory** with an **extremely subtle star grain** texture:

```css
.luxury-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--bg-base);
  z-index: -1;
  pointer-events: none;
}

.luxury-background::before {
  /* Subtle radial gradients create tiny "stars" */
  /* Opacity: 0.5, colors have alpha 0.01-0.02 */
}

.luxury-background::after {
  /* Gentle vignette (barely visible) */
  background: radial-gradient(ellipse, transparent 0%, rgba(0, 0, 0, 0.02) 100%);
}
```

**Result:** The texture adds depth without being noticeable. It's a premium detail that enhances the feel without distracting.

---

## 📱 Applied Components

### ✅ Fully Themed

#### **Dashboard (CellarPage)**
- Page title: `--font-bold`, `--text-primary`
- Import/Add buttons: `btn-luxury-secondary` / `btn-luxury-primary`
- Search input: `input-luxury` with focus ring
- Bottle cards: `luxury-card luxury-card-hover`
- Empty state: `luxury-card` with typography scale
- No results state: `luxury-card` with proper spacing

#### **Add Bottle Sheet (AddBottleSheet)**
- Container: `--bg-surface`, `--shadow-xl`
- Backdrop: `--bg-overlay` with blur
- Handle: `--border-medium`
- Primary button: Wine gradient
- Secondary button: Light with border
- Cancel button: `btn-luxury-ghost`

#### **Bottle Form (BottleForm)**
- Modal: `modal-luxury`
- All inputs: `input-luxury`
- Labels: `--text-primary` with proper weight
- Cancel button: `btn-luxury-secondary`
- Save button: `btn-luxury-primary`
- Footer: `--shadow-sm` with `--border-light`

#### **Bottle Card (BottleCard)**
- Container: `luxury-card luxury-card-hover`
- Wine name: `--text-primary`
- Details: `--text-secondary`
- Hover effect: lifts 2px with `--shadow-md`

#### **Global Layout (Layout)**
- Background: `luxury-background` component
- Top nav: `--bg-surface` with `--shadow-sm`
- Logo: `--wine-700` color
- Nav pills: Wine gradient when active, `--bg-surface-2` when inactive

### ❌ NOT Themed (Unchanged)
- History page
- Recommendation ("Tonight?") page
- Stats page
- Settings page
- Profile page
- Login page
- Other modals/dialogs

---

## 🎯 Where to Tweak Tokens

### Make Background Darker/Lighter

**Current:**
```css
--bg-base: #fafaf8;
```

**Darker (more ivory):**
```css
--bg-base: #f5f5f3;
```

**Lighter (closer to pure white):**
```css
--bg-base: #fcfcfb;
```

### Adjust Star Grain Visibility

**Current (very subtle):**
```css
radial-gradient(1px 1px at 20% 30%, rgba(114, 47, 55, 0.02), transparent)
```

**More visible:**
```css
radial-gradient(1px 1px at 20% 30%, rgba(114, 47, 55, 0.04), transparent)
```

**Less visible:**
```css
radial-gradient(1px 1px at 20% 30%, rgba(114, 47, 55, 0.01), transparent)
```

### Change Wine Accent Color

**Current:**
```css
--wine-600: #8B3A47;
--wine-700: #722F37;
```

**Brighter (more red):**
```css
--wine-600: #9d4451;
--wine-700: #8B3A47;
```

**Deeper (more burgundy):**
```css
--wine-600: #6b2c35;
--wine-700: #5a242c;
```

### Adjust Shadows (Subtle vs. Strong)

**Current (refined, Apple-like):**
```css
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
```

**Stronger (more depth):**
```css
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.06);
```

**Lighter (flatter):**
```css
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02);
```

### Text Contrast

**Current:**
```css
--text-primary: #1a1a1a;
--text-secondary: #6b6b6b;
```

**Higher contrast (darker text):**
```css
--text-primary: #000000;
--text-secondary: #4a4a4a;
```

**Lower contrast (softer text):**
```css
--text-primary: #2a2a2a;
--text-secondary: #8b8b8b;
```

---

## 🧪 Testing Checklist

### Desktop
- [ ] Dashboard loads with light background
- [ ] Subtle star texture visible (very faint)
- [ ] Cards have soft shadows
- [ ] Buttons have wine gradient (primary)
- [ ] Hover states work smoothly
- [ ] Search input has gold focus ring
- [ ] Typography feels premium (clear hierarchy)

### Mobile (iOS Safari/Chrome)
- [ ] Bottom nav doesn't overlap content
- [ ] Safe areas respected on notched iPhones
- [ ] All buttons 44px min-height
- [ ] Touch targets large enough
- [ ] Form scrolls, buttons always visible
- [ ] No zoom on input focus
- [ ] Transitions smooth (not janky)

### RTL (Hebrew)
- [ ] Switch to Hebrew in settings
- [ ] Text aligns right
- [ ] Buttons/cards layout correctly
- [ ] Form fields align right
- [ ] No broken spacing or overflow

### Accessibility
- [ ] Focus rings visible and clear
- [ ] Text contrast meets WCAG AA
- [ ] Interactive elements have clear hover/active states
- [ ] Keyboard navigation works

### Performance
- [ ] Page loads in <2s
- [ ] Transitions smooth at 60fps
- [ ] No layout shift
- [ ] Scrolling is fluid

---

## 📦 Files Changed

### New Files
- `apps/web/src/styles/luxury-theme.css` - Light luxury design system
- `LIGHT_LUXURY_THEME.md` - This documentation

### Modified Files
- `apps/web/src/index.css` - Import luxury-theme.css
- `apps/web/src/components/Layout.tsx` - Light background, luxury nav
- `apps/web/src/pages/CellarPage.tsx` - Luxury buttons, cards, inputs
- `apps/web/src/components/BottleCard.tsx` - Luxury card styling
- `apps/web/src/components/AddBottleSheet.tsx` - Light modal, luxury buttons
- `apps/web/src/components/BottleForm.tsx` - Luxury inputs, modal, buttons

### Deleted Files
- `apps/web/src/styles/space-luxury-theme.css` - Dark space theme (replaced)
- `apps/web/src/components/TonightsOrbit.tsx` - Dark theme widget (removed)
- `apps/web/src/components/DrinkWindowTimeline.tsx` - Dark theme widget (removed)

---

## 🔄 Next Steps

To apply theme to other pages:

1. **Replace button classes:**
   - `btn btn-primary` → `btn-luxury-primary`
   - `btn btn-secondary` → `btn-luxury-secondary`
   - For minimal buttons → `btn-luxury-ghost`

2. **Replace card classes:**
   - `card` → `luxury-card`
   - For hoverable cards → `luxury-card luxury-card-hover`

3. **Replace input classes:**
   - `input` → `input-luxury w-full`

4. **Update text colors:**
   - `text-gray-900` → `style={{ color: 'var(--text-primary)' }}`
   - `text-gray-600` → `style={{ color: 'var(--text-secondary)' }}`

5. **Update modal styling:**
   - Use `modal-luxury` class
   - Backdrop: `style={{ background: 'var(--bg-overlay)', backdropFilter: 'var(--blur-medium)' }}`

---

## 🎨 Design Inspiration Summary

### Apple.com
- **Clarity:** Clean layouts, generous white space
- **Typography:** Bold headlines, clear hierarchy
- **Spacing:** Consistent rhythm, breathing room
- **Motion:** Fast, purposeful transitions

### Rolex.com
- **Luxury Mood:** Premium feel without being flashy
- **Weighty CTAs:** Buttons feel important, tactile
- **Rich but Restrained:** Elegance over decoration

### Porsche.com
- **Premium Product Storytelling:** Each element has purpose
- **Crisp Layout:** Sharp, precise alignment
- **Confident Motion:** Smooth, assured animations

### Airbnb.com
- **Friendly Warmth:** Approachable yet refined
- **Clean Cards:** Clear information hierarchy
- **Smooth Scrolling:** Fluid, natural feel
- **Great Usability:** Touch-optimized, accessible

---

## ✅ Build Output

```
✓ 576 modules transformed.
dist/index.html                   0.47 kB
dist/assets/index-PJOB1DQr.css   49.06 kB │ gzip:   9.87 kB
dist/assets/index-gfmEUmfC.js   714.69 kB │ gzip: 210.53 kB
✓ built in 1.14s
```

**No errors, ready to deploy!**

---

## 💡 Design Notes

### Why Light Background?

The user requested a **light luxury theme** inspired by premium brands like Apple and Rolex. These brands use light backgrounds because:
- Higher perceived quality (clean, refined)
- Better readability in most lighting conditions
- More accessible (easier on the eyes for extended use)
- Timeless and classic (not trendy)

The subtle space texture adds depth without making it dark or sci-fi.

### Why Minimal Gradients?

Gradients are used sparingly (only on primary buttons) to avoid a "Web 2.0" or overly decorative feel. The focus is on:
- Clean surfaces
- Soft shadows for depth
- Typography for hierarchy
- Subtle accents for emphasis

This creates a **confident, premium aesthetic** that doesn't try too hard.

### Why Fast Transitions?

Apple, Porsche, and Airbnb all use fast transitions (150-250ms) because they feel:
- Responsive (immediate feedback)
- Polished (not laggy)
- Purposeful (not showy)

Slow transitions can feel sluggish on mobile.

---

**Last Updated:** Dec 27, 2025  
**Version:** 1.0  
**Theme:** Light Luxury (inspired by Apple/Rolex/Porsche/Airbnb)




