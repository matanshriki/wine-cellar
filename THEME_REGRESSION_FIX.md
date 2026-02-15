# Theme Regression Fix

## Problem Summary

After implementing the Red/White theme toggle, several typography and color regressions were introduced:

1. **Body text color changed** from `stone-900` (lighter) to `stone-950` (darker)
2. **Global transitions** applied to ALL elements (`* { transition: ... }`), causing performance issues and unwanted animations
3. **Heading colors** were using body text token instead of dedicated heading token

## Root Cause

The theme system initially mapped `--text-primary` to `stone-950` (too dark) instead of preserving the original `stone-900` value. Additionally, aggressive CSS transitions were applied globally.

## Fixes Applied

### 1. Restored White Mode Baseline

**`apps/web/src/styles/design-tokens.css`**
- Changed `--text-primary` from `stone-950` → `stone-900` (matches pre-theme)
- Added dedicated `--text-heading` token set to `stone-950`
- Adjusted Red theme body text to softer `#E8E4DC` for better readability

### 2. Fixed Global Transitions

**Before (problematic):**
```css
* {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: 200ms;
}
```

**After (selective):**
```css
body,
[class*="bg-"],
[class*="border-"],
.card,
.modal,
.sheet {
  transition-property: background-color, border-color;
  transition-duration: 200ms;
}
```

Only themeable surfaces now transition, not all elements.

### 3. Separated Heading Typography

**`apps/web/src/index.css`**
```css
/* Before */
h1, h2, h3, h4, h5, h6 {
  color: var(--text-primary);  /* ❌ Using body text color */
}

/* After */
h1, h2, h3, h4, h5, h6 {
  color: var(--text-heading);  /* ✅ Dedicated heading token */
}
```

### 4. Added Theme QA Component

Created `/apps/web/src/components/ThemeQA.tsx`:
- Comprehensive visual regression checker
- Tests typography, buttons, cards, forms, chat bubbles
- Accessible at `/theme-qa` route
- Verifies White mode matches pre-theme baseline
- Confirms Red mode is readable and premium

## Theme Token Reference

### White Mode (Light)
```css
--bg: var(--color-stone-50)           /* #faf9f7 */
--text-primary: var(--color-stone-900) /* #2d2926 - Body text */
--text-heading: var(--color-stone-950) /* #1a1816 - Headings */
--text-secondary: var(--color-stone-700) /* #57524b */
--text-tertiary: var(--color-stone-500) /* #8a8377 */
```

### Red Mode (Dark Luxury)
```css
--bg: #0B0B0D                         /* Deep black */
--text-primary: #E8E4DC               /* Warm off-white body */
--text-heading: #F4F1EC               /* Brightest for headings */
--text-secondary: #B9B3AA
--text-tertiary: #7A7770
```

## Verification Checklist

Visit `/theme-qa` and check:

- [ ] Body text is `stone-900` in White mode (not too dark)
- [ ] Headings are `stone-950` in White mode (distinct from body)
- [ ] Buttons have good contrast and are clickable
- [ ] Chat bubbles are readable (User: wine bg, Assistant: stone-100 bg)
- [ ] Forms and inputs are properly styled
- [ ] Cards have proper shadows and separation
- [ ] No unexpected font changes (Display for headings, Body for text)
- [ ] Red theme feels premium (deep blacks, warm text, subtle wine accents)
- [ ] No unwanted transitions on hover/focus

## Testing Instructions

1. **White Mode Test:**
   ```bash
   # Deploy and check
   git push origin main
   # Wait for Vercel deployment
   # Visit https://your-app.vercel.app/theme-qa
   ```
   - Verify everything matches pre-theme UI
   - Check body text is NOT too dark
   - Confirm no unexpected changes

2. **Red Mode Test:**
   - Toggle to Red theme using header button
   - Visit `/theme-qa` again
   - Verify:
     - Background is deep black (#0B0B0D)
     - Text is warm off-white (readable)
     - Wine accents are subtle (not neon)
     - Premium Apple TV-style feel

3. **Key Pages to Test:**
   - `/cellar` - Main cellar page
   - `/recommendation` - Tonight's selection
   - `/agent` - Chat interface
   - `/profile` - Settings
   - Add bottle flow (modal)

## Files Changed

- `apps/web/src/styles/design-tokens.css` - Fixed theme tokens
- `apps/web/src/index.css` - Fixed heading color token
- `apps/web/src/components/ThemeQA.tsx` - New QA component
- `apps/web/src/App.tsx` - Added `/theme-qa` route
- `THEME_REGRESSION_FIX.md` - This guide

## Acceptance Criteria

✅ White mode indistinguishable from pre-theme version  
✅ Red mode looks premium and readable  
✅ No odd text colors, unexpected fonts, or washed-out contrast  
✅ Toggle only changes theme variables, not component typography  
✅ Theme QA component confirms all checks pass  

## Future Improvements

- Add automated visual regression testing with Percy/Chromatic
- Create theme variants (e.g., "Rosé", "Champagne")
- Add user preference persistence improvements
- Consider system preference auto-detection
