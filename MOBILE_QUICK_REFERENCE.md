# 📱 Mobile Quick Reference Card

## Touch Target Guidelines

```
✅ CORRECT                    ❌ WRONG
┌─────────────┐              ┌───┐
│   Button    │  44x44px     │Btn│  30x30px
│   min size  │              └───┘
└─────────────┘
```

**Rule:** All interactive elements **minimum 44x44px**

## Responsive Breakpoints

```
Mobile    xs      sm      md      lg      xl
─────────────────────────────────────────────
<475px   475px   640px   768px   1024px  1280px
         └─┘     └──┘    └──┘    └───┘   └───┘
         Small   Large   Tablet  Laptop  Desktop
         Phone   Phone
```

## Layout Patterns

### Stacked → Row

```jsx
// Mobile: Vertical stack
// Desktop: Horizontal row
<div className="flex-col xs:flex-row gap-2">
```

### Full Width → Auto

```jsx
// Mobile: Full width button
// Desktop: Auto width
<button className="w-full xs:w-auto">
```

### 1 → 2 → 3 Columns

```jsx
// Mobile: 1 col, Tablet: 2 cols, Desktop: 3 cols
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
```

## Typography

```jsx
// Responsive heading
<h1 className="text-2xl sm:text-3xl lg:text-4xl">

// Responsive body
<p className="text-sm sm:text-base">
```

## Input Guidelines

```jsx
// Prevent iOS zoom + touch-friendly
<input 
  type="text"
  className="input"  // Has: font-size: 16px, min-height: 44px
/>
```

**Why 16px?** iOS zooms if input font < 16px

## RTL Support

```jsx
// Automatic mirroring
ml-4  → mr-4 (in RTL)
text-left → text-right (in RTL)

// Manual RTL handling
<div className="right-3 rtl:right-auto rtl:left-3">
```

## Common Classes

```css
/* Buttons */
.btn  → min-height: 44px, min-width: 44px

/* Inputs */
.input  → font-size: 16px, min-height: 44px

/* Cards */
.card  → p-4 sm:p-6 (responsive padding)
```

## Testing Commands

```bash
# Chrome DevTools
Ctrl+Shift+M  → Device toolbar
F12           → DevTools

# Test Sizes
320px  → Small phone
375px  → iPhone SE
390px  → iPhone 12/13/14
428px  → iPhone Pro Max
768px  → iPad
```

## Mobile Nav Pattern

```tsx
// Mobile: Stack below header
<div className="md:hidden">
  {navItems.map(item => <Link>{item}</Link>)}
</div>

// Desktop: Horizontal
<div className="hidden md:flex">
  {navItems.map(item => <Link>{item}</Link>)}
</div>
```

## Checklist

- [ ] All buttons 44x44px+
- [ ] Inputs font-size: 16px
- [ ] Responsive grid (1/2/3 cols)
- [ ] Stacked buttons on mobile
- [ ] Navigation responsive
- [ ] Typography scales
- [ ] RTL tested
- [ ] No horizontal scroll

## Quick Tips

✅ **DO:**
- Design mobile-first
- Test on real device
- Use semantic HTML
- 44px touch targets

❌ **DON'T:**
- Assume hover works
- Use tiny buttons
- Input font < 16px
- Ignore RTL on mobile

---

**Your app is mobile-ready! 📱🍷**

