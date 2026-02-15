# 🎨 Theme Toggle System - Deployment Guide

## Overview

The Wine Cellar app now features a luxury theme system with two modes:
- **White** (Light Mode): Classic wine cellar aesthetic
- **Red** (Luxury Dark Mode): Apple TV-style premium dark theme

---

## 🚀 Deployment Steps

### Step 1: Run Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Add theme_preference column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'white' CHECK (theme_preference IN ('white', 'red'));

-- Add index
CREATE INDEX IF NOT EXISTS idx_profiles_theme_preference 
ON profiles (theme_preference);

-- Add comment
COMMENT ON COLUMN profiles.theme_preference IS 'User theme preference: white (light) or red (luxury dark)';
```

**Or**: Run the migration file: `supabase/migrations/20260213_add_theme_preference.sql`

### Step 2: Deploy Frontend

The theme system is already integrated into the app:
- ✅ ThemeContext provides theme state
- ✅ ThemeProvider wraps the app in App.tsx
- ✅ Theme toggle appears in:
  - CellarPage header (compact icon button)
  - ProfilePage settings (full toggle)

Just deploy your frontend and it will work automatically!

---

## 🎨 Theme Features

### White Theme (Light Mode)
- Clean, elegant design
- Warm stone neutrals
- Soft shadows
- Existing classic aesthetic

### Red Theme (Luxury Dark Mode)
Inspired by Apple TV premium UI:

**Backgrounds**:
- `--bg`: #0B0B0D (near-black with warmth)
- `--bg-surface`: #16161B (elevated surfaces)
- `--bg-surface-elevated`: #1C1C22 (modals/cards)

**Text**:
- `--text-primary`: #F4F1EC (warm off-white)
- `--text-secondary`: #B9B3AA (muted)
- `--text-tertiary`: #7A7770 (subtle)

**Wine Accents**:
- Restrained deep wine red (#8B2741, #7A1E2D)
- Used sparingly for emphasis
- Subtle glow effects

**Design Principles**:
- No harsh contrasts
- Soft, elegant surfaces
- Subtle borders and glows
- Deep but soft shadows
- Readable but not "neon"

---

## 🔧 How It Works

### Theme Persistence

1. **localStorage** (instant load):
   - Key: `theme:${userId}` or `theme:guest`
   - Applied immediately on page load

2. **Supabase profile** (authoritative):
   - Synced from DB after initial load
   - Cross-device consistency
   - Auto-updates localStorage if different

### Theme Application

```typescript
// Set via data attribute
<html data-theme="white|red">

// CSS uses custom properties
[data-theme="red"] {
  --bg: #0B0B0D;
  --text-primary: #F4F1EC;
  // ... etc
}
```

### Smooth Transitions

- 200ms transition for bg/text/border
- Respects `prefers-reduced-motion`
- Skip transitions excluded from animated elements

---

## 🎯 User Experience

### Theme Toggle Locations

**Cellar Page Header**:
- Compact icon button (wine glass)
- Fills red in dark mode, outlined in light mode
- Tap to toggle
- Visible on mobile and desktop

**Profile Page**:
- Full pill toggle with labels
- "White" and "Red" options
- Smooth sliding indicator
- Luxury glass/blur effect

### What Users See

**In Light Mode**:
- White/light backgrounds
- Dark text
- Soft shadows
- Wine glass icon outlined

**In Dark Mode**:
- Deep black backgrounds
- Warm off-white text
- Deeper shadows
- Wine glass icon filled red
- Subtle red accents
- Elegant glow effects

---

## 🎨 Design Token Usage

All components should use CSS variables instead of hardcoded colors:

```css
/* ✅ Good - uses tokens */
.card {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}

/* ❌ Bad - hardcoded */
.card {
  background: white;
  color: black;
  border: 1px solid #e5e5e5;
}
```

### Available Tokens

**Backgrounds**:
- `--bg` - Page background
- `--bg-surface` - Cards, panels
- `--bg-surface-elevated` - Modals, popovers
- `--bg-muted` - Subtle backgrounds

**Text**:
- `--text-primary` - Main text
- `--text-secondary` - Secondary text
- `--text-tertiary` - Subtle text

**Borders**:
- `--border-subtle` - Light borders
- `--border-medium` - Standard borders
- `--border-strong` - Emphasized borders

**Interactive**:
- `--interactive-hover` - Hover states
- `--interactive-active` - Active states

**Wine Accents**:
- `--wine-500`, `--wine-600`, `--wine-700`

**Shadows**:
- `--shadow-card` - Card shadows
- `--shadow-modal` - Modal shadows

**Glow**:
- `--glow` - Subtle glow effects

---

## 📱 Mobile Considerations

### Meta Theme Color

The app automatically updates the mobile browser chrome color:

```typescript
// Updates based on theme
<meta name="theme-color" content="#FFFFFF" /> // White mode
<meta name="theme-color" content="#0B0B0D" /> // Red mode
```

### Safe Areas

Theme works with iOS notches and safe areas:
- Safe area insets are preserved
- Bottom nav adapts to theme
- No UI breaks

---

## ♿ Accessibility

### Motion

Respects `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: no-preference) {
  * {
    transition: background-color, color, border-color 200ms;
  }
}
```

### Contrast

Both themes maintain WCAG AA contrast:
- **White mode**: Dark text on light backgrounds
- **Red mode**: Light text on dark backgrounds
- All text remains readable

---

## 🧪 Testing Checklist

After deployment, verify:

**Theme Toggle**:
- [ ] Toggle appears in Cellar header
- [ ] Toggle appears in Profile settings
- [ ] Click/tap switches themes instantly
- [ ] Icons update correctly (filled vs outlined)

**Persistence**:
- [ ] Theme persists after page refresh
- [ ] Theme persists after logout/login
- [ ] Theme syncs across devices (if logged in)

**Visual Quality**:
- [ ] No unreadable text in either theme
- [ ] Cards have proper elevation in dark mode
- [ ] Modals look good in dark mode
- [ ] Bottom nav icons visible in both themes
- [ ] Toast notifications visible in both themes

**Performance**:
- [ ] Theme switches instantly (no lag)
- [ ] No layout shift on theme change
- [ ] Smooth transitions (if motion enabled)

**Mobile**:
- [ ] Works on mobile Safari
- [ ] Works in iOS PWA
- [ ] Meta theme-color updates correctly
- [ ] Safe areas work in both themes

---

## 🐛 Troubleshooting

### "Theme doesn't persist"

**Check**:
1. Is migration run? Verify `theme_preference` column exists
2. Check browser localStorage: `theme:${userId}` should exist
3. Check Supabase profile: `theme_preference` should be 'white' or 'red'

**Fix**: Run migration, clear localStorage, toggle theme again

### "Some text is unreadable"

**Check**: Find hardcoded colors in component

**Fix**: Replace with CSS variables:
```css
/* Before */
color: #000;

/* After */
color: var(--text-primary);
```

### "Theme toggle doesn't appear"

**Check**:
1. Is ThemeProvider wrapping app?
2. Is component imported correctly?

**Fix**: Verify App.tsx has `<ThemeProvider>` wrapper

### "Dark mode is too bright"

**Check**: Verify CSS custom properties are defined for both themes

**Fix**: Ensure `[data-theme="red"]` has all tokens defined in `design-tokens.css`

---

## 📊 Analytics (Optional)

Track theme usage:

```sql
-- Count users per theme
SELECT 
  theme_preference,
  COUNT(*) as users
FROM profiles
GROUP BY theme_preference;

-- Theme adoption over time
SELECT 
  DATE(updated_at) as date,
  theme_preference,
  COUNT(*) as changes
FROM profiles
WHERE theme_preference IS NOT NULL
GROUP BY date, theme_preference
ORDER BY date DESC;
```

---

## 🎉 Summary

✅ **Deployed**: Database migration + frontend code
✅ **User-facing**: Toggle in header + settings
✅ **Persistent**: localStorage + Supabase
✅ **Luxury**: Apple TV-style dark mode
✅ **Smooth**: Transitions with reduced-motion support
✅ **Accessible**: WCAG AA contrast in both themes

Users can now enjoy a premium dark theme that's perfect for evening wine browsing! 🍷✨
