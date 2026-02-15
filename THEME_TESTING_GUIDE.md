# Theme System Testing Guide

## 🚀 Quick Start

After Vercel deploys the latest changes:

1. Visit **`/theme-qa`** to see the comprehensive QA page
2. Toggle between White and Red themes using the button in the header
3. Go through the checklist on the QA page
4. Test key pages in both themes

---

## 🎯 Priority Tests

### 1. Theme QA Page (`/theme-qa`)

**What to check:**
- [ ] Body text is readable (not too dark in White, not too bright in Red)
- [ ] Headings stand out from body text
- [ ] All buttons are visible and clickable
- [ ] Form inputs have visible borders
- [ ] Chat bubbles are readable
- [ ] Cards have proper shadows
- [ ] Color swatches display correctly
- [ ] Interactive checklist works

**Expected Results:**
- **White mode**: Should look EXACTLY like the app did before theme toggle was added
- **Red mode**: Deep black backgrounds (#0B0B0D), warm off-white text, subtle wine accents

---

### 2. Main Pages

Test these pages in **both White and Red themes**:

#### A. Cellar Page (`/cellar`)
- [ ] Wine cards are readable
- [ ] Filters and search work
- [ ] "Tonight's Selection" section looks good
- [ ] Bottle images have proper contrast
- [ ] Status badges (Ready/Hold/Approaching) are visible

#### B. Agent/Chat (`/agent`)
- [ ] Chat bubbles are readable
- [ ] User messages (wine-600 background) have good contrast
- [ ] Assistant messages (stone-100 in White, darker in Red) are legible
- [ ] Input box is visible
- [ ] Send button works

#### C. Profile Page (`/profile`)
- [ ] Form inputs are visible
- [ ] Avatar upload area is clear
- [ ] Save button is clickable
- [ ] Admin tools (if admin) are accessible

#### D. Add Bottle Modal
- [ ] Modal background is visible
- [ ] Form inputs have borders
- [ ] Dropdown menus are readable
- [ ] Save/Cancel buttons work
- [ ] Validation messages are visible

#### E. Tonight Selection (`/recommendation`)
- [ ] Orbit animation (if enabled) doesn't conflict with theme
- [ ] Bottle cards are readable
- [ ] "Plan Evening" button works
- [ ] Wine details modal is legible

---

## 🔍 Detailed Checks

### Typography
- **White Mode:**
  - Body: `#2d2926` (stone-900) ← Should NOT be `#1a1816` (stone-950)
  - Headings: `#1a1816` (stone-950)
- **Red Mode:**
  - Body: `#E8E4DC` (warm off-white)
  - Headings: `#F4F1EC` (brighter off-white)

### Colors
- Wine accent: Should be deep burgundy, not bright red
- Backgrounds: Should transition smoothly when toggling
- Borders: Visible in both themes

### Interactions
- [ ] Hover states work on buttons
- [ ] Focus states show on form inputs
- [ ] Transitions are smooth (not laggy)
- [ ] Toggle button in header works
- [ ] Theme persists after page refresh

---

## 🐛 Known Issues to Watch For

### Potential Problems
1. **Text too dark/light**: If body text looks wrong, check computed style:
   ```js
   getComputedStyle(document.body).color
   ```
   - White: Should be `rgb(45, 41, 38)` (stone-900)
   - Red: Should be `rgb(232, 228, 220)` (#E8E4DC)

2. **Unwanted transitions**: If elements animate unexpectedly, check for global `*` transition rules

3. **Component-specific issues**: Some components might have hardcoded colors that don't adapt

---

## 🎨 Design Validation

### White Mode (Default)
**Goal**: Match pre-theme UI exactly

**Reference**: Compare against screenshots from before theme toggle was added

**Checklist**:
- Same font family and weights
- Same text colors (stone-900 for body, stone-950 for headings)
- Same button styles
- Same card shadows
- Same input borders

### Red Mode (Luxury Dark)
**Goal**: Apple TV-style premium dark theme

**Inspiration**: Apple TV app, Netflix dark mode, Rolex website

**Checklist**:
- Deep blacks (not pure black #000)
- Warm off-white text (not pure white #FFF)
- Subtle wine accents (not neon)
- Soft shadows and glows
- Premium, elegant feel

---

## 📱 Mobile Testing

Test on actual devices or DevTools device emulation:

1. **iOS Safari:**
   - Theme toggle works
   - Text is readable
   - Buttons are tappable (44px min height)
   - Modals don't overlap navigation

2. **Android Chrome:**
   - Same as iOS checks
   - Address bar color matches theme (meta theme-color)

3. **PWA Mode:**
   - Theme persists in standalone mode
   - Status bar color updates

---

## 🔧 Debug Tools

### Console Commands

Check theme in browser console:
```js
// Current theme
document.documentElement.getAttribute('data-theme')

// Body background
getComputedStyle(document.documentElement).getPropertyValue('--bg')

// Text color
getComputedStyle(document.documentElement).getPropertyValue('--text-primary')

// Force theme change
document.documentElement.setAttribute('data-theme', 'red')
```

### Browser DevTools

1. **Elements tab**: Inspect `<html data-theme="...">` attribute
2. **Computed styles**: Check CSS variable values
3. **Network tab**: Ensure no CSS 404 errors
4. **Console tab**: Check for theme-related errors

---

## ✅ Sign-Off Checklist

Before considering theme system complete:

- [ ] Visited `/theme-qa` in both themes
- [ ] Tested all main pages in both themes
- [ ] Verified White mode matches pre-theme UI
- [ ] Confirmed Red mode is premium and readable
- [ ] Checked mobile responsiveness
- [ ] Tested theme persistence (refresh page)
- [ ] Validated typography (body vs headings)
- [ ] Confirmed no performance issues (smooth transitions)
- [ ] Reviewed console for errors
- [ ] Tested with keyboard navigation
- [ ] Verified accessibility (contrast ratios)

---

## 🚨 Report Issues

If you find any problems:

1. **Screenshot**: Take a screenshot showing the issue
2. **Context**: Note which theme (White/Red) and which page
3. **Browser**: Specify browser and version
4. **Expected vs Actual**: Describe what should happen vs what does happen
5. **Console errors**: Include any relevant console output

---

## 📚 Reference Documents

- `THEME_REGRESSION_FIX.md` - Detailed fix documentation
- `THEME_TOGGLE_GUIDE.md` - Original implementation guide
- `apps/web/src/styles/design-tokens.css` - Theme token definitions
- `apps/web/src/components/ThemeQA.tsx` - QA component source

---

Happy testing! 🍷✨
