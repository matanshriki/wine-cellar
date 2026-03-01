# Dark Mode V2 - Implementation Plan

## 🎯 Goal
Re-implement dark/light theme toggle with **thorough local testing** before production.

---

## 📋 Lessons Learned from V1

### What Went Wrong:
1. ✗ Font rendering changed unexpectedly
2. ✗ Spinner color regression (black instead of red)
3. ✗ Button text color issues (variable naming mismatch)
4. ✗ No proper testing before production deploy
5. ✗ CSS import order issues
6. ✗ Global transitions affecting all elements

### V2 Improvements:
1. ✅ Work on feature branch (`feature/dark-mode-v2`)
2. ✅ Test locally before any git push
3. ✅ Document all color token changes
4. ✅ Create visual regression checklist
5. ✅ Use consistent variable naming
6. ✅ Selective transitions (not global)

---

## 🛠️ Local Development Setup

### 1. Start Local Dev Server

```bash
# Navigate to web app
cd apps/web

# Install dependencies (if needed)
npm install

# Start development server
npm run dev

# App will be available at: http://localhost:5173
```

### 2. Environment Variables

Make sure you have `.env` in `apps/web/`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
# ... other vars
```

### 3. Test Locally

- **DO NOT** push to main until fully tested
- Test on multiple browsers (Chrome, Safari, Firefox)
- Test on mobile (responsive mode + real device)
- Check all key pages before committing

---

## 🎨 Implementation Strategy

### Phase 1: Setup (Safe Foundation)
1. Create theme context with proper TypeScript types
2. Add theme toggle UI component
3. Create theme provider (wrap App)
4. Test: Toggle should work but not change colors yet

### Phase 2: Color Tokens (Careful Mapping)
1. Define CSS variables for both themes
2. Map EXACT pre-theme colors to "light" theme
3. Create luxury dark colors for "dark" theme
4. **Critical**: Verify variable names match usage

### Phase 3: Apply Tokens (Selective Updates)
1. Update only themeable components
2. Keep specific colors (status badges, etc.) unchanged
3. Use selective transitions (not global `*`)
4. Test after each major component

### Phase 4: Polish & Fix
1. Fix any regressions immediately
2. Verify spinner colors
3. Check button text contrast
4. Ensure font rendering unchanged

### Phase 5: Database (Optional)
1. Add `theme_preference` column (last step)
2. Test persistence
3. This is optional for V2 - can skip initially

---

## 🔍 Testing Checklist

### Before Committing:
- [ ] Toggle switch works smoothly
- [ ] Light theme looks EXACTLY like current production
- [ ] Dark theme has good contrast (readable text)
- [ ] Spinner is red wine color (not black)
- [ ] "Mark as Opened" buttons have white text
- [ ] Font rendering is crisp (not blurry)
- [ ] No unexpected global animations
- [ ] Navigation works in both themes
- [ ] Modals/sheets render correctly
- [ ] Chat bubbles are readable
- [ ] Forms and inputs visible
- [ ] Tonight's Selection cards look good
- [ ] Mobile: Header toggle visible
- [ ] Mobile: Bottom nav readable

### Pages to Test:
1. `/cellar` - Main cellar view
2. `/recommendation` - Tonight's selection
3. `/agent` - Chat interface
4. `/profile` - Settings page
5. Add bottle modal
6. Wine details modal
7. Plan evening modal

### Browsers to Test:
- [ ] Chrome/Edge (desktop)
- [ ] Safari (desktop)
- [ ] Firefox (desktop)
- [ ] Chrome (mobile/responsive)
- [ ] Safari (iOS - real device if possible)

---

## 📝 Implementation Notes

### Key Files to Create/Modify:

**New Files:**
- `apps/web/src/contexts/ThemeContext.tsx`
- `apps/web/src/components/ThemeToggle.tsx`
- `supabase/migrations/YYYYMMDD_add_theme_preference.sql` (optional)

**Modified Files:**
- `apps/web/src/App.tsx` (add ThemeProvider)
- `apps/web/src/styles/design-tokens.css` (add theme variables)
- `apps/web/src/index.css` (ensure no hardcoded colors in body)
- `apps/web/src/components/Layout.tsx` (add toggle button)
- `apps/web/src/pages/ProfilePage.tsx` (add theme preference UI)

### Variable Naming Convention:

**Use consistent names (no 'd' suffix):**
```css
--text-inverse  /* ✅ Correct */
--text-inverted /* ✗ Wrong - causes mismatch */
```

**Theme-specific variables:**
```css
/* Light Theme */
--bg: #faf9f7
--text-primary: #2d2926  /* MUST match current production */
--text-heading: #1a1816

/* Dark Theme */
--bg: #0B0B0D
--text-primary: #E8E4DC
--text-heading: #F4F1EC
```

---

## 🚀 Deployment Strategy

### When Ready for Production:

1. **Final local test** (all checklist items ✅)
2. **Create PR** (optional, for review)
3. **Merge to main** (this triggers Vercel deploy)
4. **Monitor Vercel deploy logs**
5. **Test production immediately** after deploy
6. **Have rollback ready** (git revert if needed)

### Rollback Plan:

If something goes wrong in production:
```bash
# Quick rollback
git revert HEAD --no-commit
git commit -m "Rollback: Revert dark mode V2"
git push origin main
```

---

## 💡 Pro Tips

1. **Test the toggle frequently** - Switch back and forth 10+ times
2. **Use browser DevTools** - Inspect computed CSS variables
3. **Check console for errors** - Fix any warnings immediately
4. **Take screenshots** - Before/after for comparison
5. **Test with real data** - Add some test bottles if needed
6. **Use incognito mode** - Test without localStorage cache
7. **Test slow network** - Ensure theme loads properly
8. **Mobile first** - Most users are mobile

---

## 📚 Reference

**Previous Implementation (for reference only):**
- Commit range: `001a1fc..dc2390b` (reverted)
- Can review these commits to see what was done before
- DO NOT copy blindly - learn from mistakes

**Color Palette:**

Light Theme (Current Production):
- Background: `#faf9f7` (stone-50)
- Text: `#2d2926` (stone-900)
- Heading: `#1a1816` (stone-950)
- Wine: `#c14463` (wine-500)

Dark Theme (Luxury):
- Background: `#0B0B0D` (deep black)
- Text: `#E8E4DC` (warm off-white)
- Heading: `#F4F1EC` (bright off-white)
- Wine: `#8B2741` (deep wine)

---

## ✅ Success Criteria

**V2 is ready for production when:**

1. ✅ All testing checklist items pass
2. ✅ Light theme matches current production exactly
3. ✅ Dark theme feels premium (no neon colors)
4. ✅ No regressions found after 2+ days of local testing
5. ✅ You personally feel confident it's ready
6. ✅ All console errors fixed
7. ✅ Mobile tested on real device

**Don't rush it!** Better to spend 1-2 days testing locally than to revert again.

---

## 🆘 Need Help?

If stuck or unsure:
1. Test more locally
2. Check browser console for clues
3. Compare with production side-by-side
4. Ask before pushing to production
5. When in doubt, don't deploy yet

---

Good luck! Take your time and test thoroughly. 🍷✨
