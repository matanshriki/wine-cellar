# 📱 iPhone Mobile Bug Bash Checklist

## Overview
Comprehensive mobile QA checklist for Wine Cellar Brain app, focusing on iPhone PWA experience.

**Testing Viewports:**
- iPhone SE (375×667)
- iPhone 14/15 (393×852)
- iPhone 14/15 Pro Max (430×932)

**Test in:**
- Chrome DevTools (touch simulation ON)
- Real iPhone Safari
- iPhone PWA (Add to Home Screen)

---

## 🔴 Critical Issues Found & Fixed

### 1. ❌ AI Label Generation Button - Returns Errors
**Status:** 🔍 INVESTIGATING

**Issue:**
- "Generate AI label" feature returns errors for users
- Not clear if it's a deployment issue, env var missing, or permissions

**Root Causes to Check:**
- [ ] Edge Function `generate-label-art` deployed to Supabase
- [ ] `OPENAI_API_KEY` secret set in Supabase
- [ ] User has `ai_label_art_enabled=true` in profiles table
- [ ] Global flag `VITE_FEATURE_GENERATED_LABEL_ART=true` set
- [ ] Storage bucket `wine-label-images` exists with proper RLS policies
- [ ] Button visibility logic in `WineDetailsModal.tsx` works correctly

**Files Involved:**
- `apps/web/src/services/labelArtService.ts` - Feature flag checks
- `apps/web/src/components/WineDetailsModal.tsx` - Button & error handling
- `supabase/functions/generate-label-art/index.ts` - Backend API

**Fix Applied:**
- Improved error messages to be more actionable (already done)
- Need to verify deployment status and configuration

---

### 2. ❌ Double-Tap Required on Some Buttons
**Status:** 🔍 INVESTIGATING

**Symptoms:**
- First tap does nothing
- Second tap works

**Common Causes:**
- [ ] Overlay elements blocking clicks (z-index issues)
- [ ] `pointer-events: none` on wrong elements
- [ ] Event propagation issues (stopPropagation missing/wrong)
- [ ] Focus/blur conflicts
- [ ] Framer Motion animations blocking interaction
- [ ] Backdrop close handlers interfering

**Areas to Check:**
- [ ] **Tonight's Orbit** bottles (`TonightsOrbit.tsx`)
- [ ] **Bottom Nav** links (`BottomNav.tsx`)
- [ ] **Cellar page** bottle cards (`BottleCard.tsx`)
- [ ] **Modal** action buttons (all modals)
- [ ] **Add bottle** FAB and sheet buttons

**Findings So Far:**
- ✅ `TonightsOrbit.tsx`: Proper `pointer-events: none` on overlay (line 256)
- ✅ `TonightsOrbit.tsx`: Proper `e.stopPropagation()` on button click (line 127)
- ✅ `AddBottleSheet.tsx`: Has workaround for backdrop propagation (lines 27-40)
- ⚠️ Need to check if this pattern is applied consistently everywhere

---

### 3. ❌ Scrolling Breaks / Content Clipped
**Status:** 🔍 INVESTIGATING

**Symptoms:**
- Can't scroll to bottom of modals
- Buttons hidden behind bottom nav
- Content cut off

**iOS-Specific Checks:**
- [ ] Using `100dvh` instead of `100vh` (Safari viewport bug)
- [ ] Safe area insets applied (`env(safe-area-inset-bottom)`)
- [ ] iOS momentum scrolling (`-webkit-overflow-scrolling: touch`)
- [ ] Nested scroll containers (only one should scroll)
- [ ] Modal `max-height` accounts for bottom nav on mobile

**Files with iOS Fixes Already Applied:**
- ✅ `apps/web/src/index.css` - Global iOS utilities
- ✅ `WineDetailsModal.tsx` - Recently fixed scrolling (max-height: calc(100dvh - 2rem))
- ✅ `BottomNav.tsx` - Safe area support
- ✅ Layout padding utilities (`.pb-bottom-nav`)

**Need to Verify:**
- [ ] All modals use `max-h-mobile-modal` utility
- [ ] Forms in modals: submit buttons reachable when keyboard open
- [ ] Long lists: scroll works smoothly
- [ ] History page: charts don't break scrolling

---

### 4. ❌ Buttons Invisible / Unreachable
**Status:** 🔍 INVESTIGATING

**Check:**
- [ ] Buttons off-screen on small viewports (iPhone SE)
- [ ] Fixed footers covering buttons
- [ ] Safe area: buttons in gesture zones (bottom 34px on iPhone X+)
- [ ] Minimum tap target 44×44px (Apple guideline)
- [ ] Adequate spacing between buttons (8px minimum)

**Areas:**
- [ ] Modal action buttons (Mark as Opened, View in Vivino)
- [ ] Form submit buttons
- [ ] Bottom sheet actions
- [ ] FAB (floating action button) positioning

---

## 📋 Route-by-Route Testing

### 🍷 /cellar - Cellar Page

#### Visual Layout
- [ ] Header visible, not cut off
- [ ] Search bar accessible
- [ ] Filter chips visible and tappable
- [ ] Tonight's Orbit widget loads
- [ ] Bottle cards render correctly
- [ ] Bottom nav visible, not covering content
- [ ] Safe area respected (notch/home indicator)

#### Interactions
- [ ] Tap "Add Bottle" FAB → Sheet opens (single tap)
- [ ] Tap bottle in Tonight's Orbit → Details modal opens (single tap)
- [ ] Tap "Details" button on bottle card → Modal opens (single tap)
- [ ] Tap "Edit" button → Edit form opens (single tap)
- [ ] Tap "Delete" button → Confirmation works (single tap)
- [ ] Swipe gestures don't interfere with taps

#### Scrolling
- [ ] Page scrolls smoothly (momentum scrolling)
- [ ] Can reach bottom of cellar list
- [ ] Bottom nav doesn't cover last bottle
- [ ] Pull-to-refresh doesn't break layout (if enabled)
- [ ] Scroll position restored after navigation

#### Modals/Sheets
- [ ] Add Bottle sheet: all options visible and tappable
- [ ] Wine Details modal: scrolls to show all content (inc. "View in Vivino")
- [ ] Edit form: submit button reachable even with keyboard open
- [ ] CSV Import: multi-step flow works on mobile
- [ ] Label Capture: camera works, upload works

---

### 💡 /recommendation - Tonight's Recommendation

#### Visual Layout
- [ ] Page renders correctly
- [ ] Recommendations visible
- [ ] Bottom nav visible

#### Interactions
- [ ] Tap bottle → Opens details (single tap)
- [ ] "Mark as Opened" button works (single tap)
- [ ] Navigation works

#### Scrolling
- [ ] Page scrolls if content overflows
- [ ] No content clipped

---

### 📈 /history - History Page

#### Visual Layout
- [ ] Stats cards render
- [ ] Charts render correctly (no overflow)
- [ ] Timeline list visible
- [ ] Bottom nav visible

#### Interactions
- [ ] Tap on timeline item → Works (single tap)
- [ ] Charts interactive (if applicable)
- [ ] Filter/sort controls work (single tap)

#### Scrolling
- [ ] Page scrolls smoothly
- [ ] Charts don't break scroll
- [ ] Long timeline scrolls correctly
- [ ] Can reach bottom of page

---

### ⚙️ /settings - Settings Page

#### Visual Layout
- [ ] Settings sections visible
- [ ] User profile card renders
- [ ] Action buttons visible

#### Interactions
- [ ] Logout button works (single tap)
- [ ] Language switcher works (single tap)
- [ ] Theme toggle works (if applicable)

#### Forms
- [ ] Edit profile: all fields accessible
- [ ] Save button reachable with keyboard open
- [ ] Validation errors visible

---

## 🔧 Component-Specific Checks

### Bottom Navigation (`BottomNav.tsx`)
- [ ] ✅ Fixed to bottom on mobile only (`md:hidden`)
- [ ] ✅ Safe area inset applied (`env(safe-area-inset-bottom)`)
- [ ] ✅ Smooth scroll to top on navigation (recently added)
- [ ] Active state indicator works
- [ ] Icons + labels visible
- [ ] Tap targets ≥44px
- [ ] No double-tap required
- [ ] RTL support works (Hebrew)

### Wine Details Modal (`WineDetailsModal.tsx`)
- [ ] ✅ Scrolling fixed (calc(100dvh - 2rem))
- [ ] ✅ Flexbox layout: header + scrollable content + footer
- [ ] "View in Vivino" button reachable (recently fixed)
- [ ] "Mark as Opened" button visible and tappable
- [ ] AI Label generation button appears (if enabled)
- [ ] AI Label generation shows proper errors
- [ ] Close button works (single tap)
- [ ] Click outside to close works
- [ ] ESC key closes modal

### Add Bottle Sheet (`AddBottleSheet.tsx`)
- [ ] ✅ Backdrop propagation fix (100ms delay before allowing close)
- [ ] Slides up from bottom smoothly
- [ ] "Scan Label" button works (single tap)
- [ ] "Manual Entry" button works (single tap)
- [ ] Safe area respected
- [ ] No double-tap required

### Celebration Modal (`CelebrationModal.tsx`)
- [ ] ✅ Scroll lock applied/removed correctly
- [ ] Confetti animation works (or skipped if `prefers-reduced-motion`)
- [ ] "View History" button works (single tap)
- [ ] "Close" button works (single tap)
- [ ] Modal doesn't break page scroll after closing

### Bottle Card (`BottleCard.tsx`)
- [ ] All buttons visible on iPhone SE
- [ ] "Details" button: single tap
- [ ] "Edit" button: single tap
- [ ] "Delete" button: single tap
- [ ] "Mark Opened" button (if shown): single tap
- [ ] Touch feedback visible (active states)
- [ ] Min tap target 44px

### Tonight's Orbit (`TonightsOrbit.tsx`)
- [ ] ✅ Bottles clickable (single tap)
- [ ] Hover overlay doesn't block clicks (`pointer-events: none`)
- [ ] ✅ Event propagation handled correctly
- [ ] Grid responsive (1 col mobile, 3 cols desktop)
- [ ] Images load or fail gracefully

---

## 🐛 Known Issues (Not Blocking)

### Minor Issues
- [ ] None yet

### Future Improvements
- [ ] Add haptic feedback on button press (if PWA supports)
- [ ] Add pull-to-refresh on cellar page
- [ ] Optimize chart rendering for mobile

---

## ✅ Final Verification Steps

Before deployment:
1. [ ] No TypeScript errors (`npm run lint`)
2. [ ] No console errors in browser
3. [ ] Build succeeds (`npm run build`)
4. [ ] Test on real iPhone (Safari)
5. [ ] Test as installed PWA (Add to Home Screen)
6. [ ] Test in both portrait and landscape
7. [ ] Test in Hebrew (RTL) mode
8. [ ] Test with VoiceOver (accessibility)

---

## 📝 Test Results

### Test Session 1: [Date]
**Tester:** [Name]
**Device:** [iPhone model]
**iOS Version:** [Version]

#### Issues Found:
1. [Issue description]
   - **Severity:** Critical / High / Medium / Low
   - **Steps to Reproduce:**
   - **Expected:**
   - **Actual:**
   - **Fix:**

#### Passed:
- [Feature that worked correctly]

---

## 🚀 Deployment Checklist

- [ ] All critical issues fixed
- [ ] All high-priority issues fixed
- [ ] Medium/low issues documented for future
- [ ] Changes tested locally
- [ ] Changes tested on staging (if applicable)
- [ ] Git commit with clear message
- [ ] Pushed to `main` branch
- [ ] Vercel deployment triggered
- [ ] Deployment verified (check URL)
- [ ] Final smoke test on production URL
- [ ] Monitor for errors (Sentry/logs)

---

**Last Updated:** [Auto-filled during testing]


