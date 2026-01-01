# Pre-Deployment QA Checklist

## Status: IN PROGRESS

---

## 1. Console & Runtime Errors

### ✅ Checked
- [x] All `.map()` calls have proper key props (not using index)
- [x] Textarea in HistoryPage is properly controlled (value + onChange)

### 🔍 To Check
- [ ] Run app and check console for errors on each page
- [ ] Check for React warnings (keys, controlled inputs, etc.)
- [ ] Check for network errors without proper handling
- [ ] Check for unhandled promise rejections
- [ ] Verify no sensitive data in console logs

---

## 2. Desktop UX

### To Test
- [ ] Cellar page - all buttons clickable, hover states work
- [ ] Bottle details modal - centered, scrollable
- [ ] Add bottle form - all fields work, validation clear
- [ ] Recommendation flow - form submission, results display
- [ ] History page - notes editing works
- [ ] Profile page - editing works
- [ ] Filters/sort - UI responds correctly
- [ ] Modals don't block interaction when closed

---

## 3. Mobile UX & PWA (CRITICAL)

### To Test (iPhone SE + Pro Max viewports)
- [ ] No double-tap required on any buttons
- [ ] No horizontal scrolling anywhere
- [ ] All buttons visible (not hidden behind header/footer)
- [ ] Modals fit screen and are scrollable
- [ ] Safe area issues (notch/home indicator)
- [ ] Tap targets >= 44px on all CTAs
- [ ] Filter pills scrollable horizontally
- [ ] Sort modal fits and works
- [ ] Notes textarea accessible and works
- [ ] Add bottle flow works end-to-end
- [ ] AI label extraction works on mobile
- [ ] Camera/photo picker works

---

## 4. Data Consistency & UI Sync

### To Test
- [ ] Add bottle → appears immediately in cellar
- [ ] Edit bottle → changes reflect immediately
- [ ] Update vintage → UI updates without refresh
- [ ] Generate AI label → image appears without refresh
- [ ] Generate sommelier notes → notes appear immediately
- [ ] Mark as opened → quantity updates, appears in history
- [ ] Add/edit history notes → persists and displays
- [ ] Delete bottle → removed from UI immediately
- [ ] CSV import → bottles appear after import
- [ ] Rating wine → rating persists

---

## 5. Error Handling & UX Polish

### To Check
- [ ] All error messages are user-friendly
- [ ] Loading states exist for:
  - [ ] AI label generation
  - [ ] Sommelier notes
  - [ ] Image uploads
  - [ ] CSV import
  - [ ] Form submissions
  - [ ] Bulk analysis
- [ ] No raw server error messages shown to users
- [ ] Failed operations show actionable error messages
- [ ] No jarring layout shifts or flickers
- [ ] Toasts are not too fast or too slow
- [ ] Success feedback is clear

---

## 6. PWA-Specific

### To Check
- [ ] App loads in PWA mode (no address bar)
- [ ] Offline behavior is graceful (not broken/blank)
- [ ] Service worker doesn't serve stale assets
- [ ] PWA icon/splash screen correct
- [ ] No PWA-specific console errors
- [ ] Camera access works in PWA
- [ ] Navigation works in PWA
- [ ] Bottom nav doesn't overlap with home indicator

---

## 7. Edge Cases

### To Check
- [ ] Empty cellar state
- [ ] No internet connection behavior
- [ ] Very long wine names don't break layout
- [ ] Special characters in wine names (é, ñ, etc.)
- [ ] Large images don't break UI
- [ ] Missing images show placeholder
- [ ] Logout and login again - state persists
- [ ] Multiple rapid clicks don't cause issues

---

## Issues Found

### Critical (Release Blockers)
_None yet_

### High Priority
_None yet_

### Medium Priority
_None yet_

### Low Priority / Nice to Have
_None yet_

---

## Files Changed
_Will be updated as fixes are made_

---

## Manual Verification Steps
_Will be documented after all fixes_

