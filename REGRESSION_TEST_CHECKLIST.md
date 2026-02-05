# Regression Test Checklist - Plan an Evening Feature

## Pre-Test Setup

### 1. Apply Database Migration
```bash
# Local development
supabase db reset

# OR
psql $DATABASE_URL -f supabase/migrations/20260205_add_evening_plans.sql
```

### 2. Enable Feature Flag
```sql
-- For your test user
UPDATE profiles 
SET plan_evening_enabled = true 
WHERE id = 'YOUR_USER_ID';
```

### 3. Start Development Server
```bash
npm run dev
```

---

## 🎯 NEW FEATURE: Plan an Evening

### ✅ Phase 1: Starting an Evening

**Prerequisites**: Have at least 3-4 bottles in your cellar

- [ ] Navigate to Tonight's Selection page
- [ ] Verify "Plan an evening" button appears (gated by feature flag)
- [ ] Click "Plan an evening"
- [ ] Modal opens with occasion dropdown (Dinner party, Date night, etc.)
- [ ] Select an occasion
- [ ] Select group size (2, 4, 6, 8+)
- [ ] Click "Next" or "Generate lineup"
- [ ] AI generates 3-4 wine recommendations
- [ ] Each wine shows: image, name, producer, vintage, rating
- [ ] Wines are ordered by serving progression
- [ ] Click "Start the evening"
- [ ] Queue Player opens with first wine as "Now Pouring"

**Expected**: Smooth flow, no errors, lineup makes sense

---

### ✅ Phase 2: Queue Player Experience

#### Hero Card ("Now Pouring")
- [ ] Large wine image displayed prominently
- [ ] Wine name, producer, vintage visible
- [ ] Current rating stars shown (if available)
- [ ] Bottle count displayed
- [ ] Serving notes or recommendations shown

#### Navigation Controls
- [ ] "Previous" button disabled on first wine
- [ ] "Previous" button enabled after moving forward
- [ ] "Next" button moves to next wine
- [ ] "Next" button disabled on last wine
- [ ] Smooth animations between wines (Framer Motion)

#### Queue List
- [ ] Scrollable list below hero card
- [ ] All wines in order visible
- [ ] Current wine highlighted (different style/color)
- [ ] Wines below current are muted/dimmed
- [ ] Tap on any wine jumps to that position
- [ ] Smooth scroll and transitions

#### Progress Indicator
- [ ] "Wine X of Y" displayed
- [ ] Progress bar shows position (optional)
- [ ] Updates when navigating

#### Primary Actions
- [ ] "Open bottle" button visible and styled as primary CTA
- [ ] Clicking "Open bottle" shows success feedback
- [ ] Opened count increments (shows "Opened: 1", "Opened: 2", etc.)
- [ ] Can open multiple bottles of same wine
- [ ] "Wrap up evening" button always accessible

**Expected**: Feels like Spotify queue, intuitive navigation, luxury aesthetic

---

### ✅ Phase 3: Persistence & Resume

#### Test Persistence
1. Start an evening (Phase 1 + 2)
2. Navigate to second or third wine
3. Open at least one bottle
4. Close the app/tab completely
5. Reopen app and navigate to Tonight's Selection

- [ ] "Resume evening" button appears (instead of "Plan an evening")
- [ ] Click "Resume evening"
- [ ] Queue Player opens
- [ ] Same lineup displayed
- [ ] Resumes at correct wine position
- [ ] Opened bottle count persisted
- [ ] No data loss

#### Test Multiple Sessions
1. Complete above test
2. Click "Cancel evening" or "Wrap up evening"
3. Start a new evening
4. Verify only one active plan exists (old one cancelled)

**Expected**: Full state persistence, seamless resume

---

### ✅ Phase 4: Wrap-Up Flow

#### Open Wrap-Up Modal
- [ ] Click "Wrap up evening" button
- [ ] Modal opens with all queued wines listed
- [ ] Each wine shows: image, name, toggle, stepper, rating, notes

#### For Each Wine
- [ ] Toggle "Opened" checkbox
- [ ] If toggled, stepper activates for quantity
- [ ] Stepper allows 1 to N bottles (up to available quantity)
- [ ] Star rating (1-5 stars) optional
- [ ] Notes textarea accepts input
- [ ] Can leave rating/notes empty

#### Save to History
- [ ] Fill out data for at least 2 wines (one opened, one not)
- [ ] Click "Save to history"
- [ ] Success toast appears
- [ ] Modal closes
- [ ] Evening Summary screen appears

#### Verify Backend Changes
1. Navigate to History page
   - [ ] New entries for opened wines
   - [ ] Each entry has correct: date, rating, notes, quantity

2. Navigate to Cellar
   - [ ] Cellar quantities decremented by opened amounts
   - [ ] Unopened wines unchanged

3. Check database (optional)
   ```sql
   SELECT * FROM evening_plans WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1;
   SELECT * FROM consumption_history ORDER BY created_at DESC LIMIT 5;
   ```
   - [ ] Plan status = 'completed'
   - [ ] `completed_at` timestamp set
   - [ ] `total_bottles_opened` correct
   - [ ] `average_rating` calculated
   - [ ] History records created with correct `wine_id`, `bottle_id`, `opened_count`, `user_rating`, `tasting_notes`

**Expected**: All opened bottles recorded, quantities updated, no duplicates

---

### ✅ Phase 5: Evening Summary
- [ ] Summary screen shows after saving to history
- [ ] Displays: "You opened X bottles"
- [ ] Shows top-rated wine (if any ratings given)
- [ ] Lists all opened wines with ratings
- [ ] "View in history" button navigates to History page
- [ ] "Plan another evening" button starts new flow

**Expected**: Clear summary, useful stats, easy navigation

---

## 🧪 REGRESSION: Scan & Add Flows

### ✅ Scan Wine Label Flow

#### Camera/Upload
- [ ] Navigate to Cellar page
- [ ] Click scan/camera FAB button
- [ ] Camera opens (mobile) or file picker (desktop)
- [ ] Take photo or upload image of wine label
- [ ] AI processes image

#### Label Extraction
- [ ] Loading indicator appears ("Analyzing label...")
- [ ] Results appear with extracted data:
  - Wine name
  - Producer
  - Vintage
  - Region/Country
  - Grape varieties
  - Color (red/white/rose/sparkling)
- [ ] Image shows in preview
- [ ] Can edit any field

#### Duplicate Detection
- [ ] If wine already in cellar, duplicate modal appears
- [ ] Shows existing bottle(s) and new scan side-by-side
- [ ] Options: "Add to existing" or "Create separate entry"
- [ ] Selecting "Add to existing" increments quantity
- [ ] Selecting "Create separate entry" creates new bottle

#### Save to Cellar
- [ ] Click "Add to cellar"
- [ ] Success toast appears
- [ ] New bottle appears in cellar list
- [ ] Quantity correct (1 or incremented)
- [ ] All metadata saved

**Expected**: Smooth scan, accurate extraction, no crashes

---

### ✅ Manual Add Bottle Flow

#### Open Form
- [ ] Navigate to Cellar page
- [ ] Click "Add bottle" button (or + FAB)
- [ ] Form modal opens

#### Fill Form
- [ ] Enter wine name (required)
- [ ] Enter producer (required)
- [ ] Enter vintage (optional)
- [ ] Select color: red/white/rose/sparkling (required)
- [ ] Enter region, country (optional)
- [ ] Enter grape varieties (optional)
- [ ] Set quantity (default: 1)
- [ ] Add purchase info: date, price, location (optional)
- [ ] Add storage location (optional)
- [ ] Add personal notes (optional)

#### Duplicate Detection
- [ ] If similar wine exists, duplicate modal appears
- [ ] Same options as scan flow
- [ ] Can merge or create new

#### Save
- [ ] Click "Save" or "Add to cellar"
- [ ] Validation runs (required fields)
- [ ] Success toast appears
- [ ] New bottle in cellar list
- [ ] Form resets if adding multiple

**Expected**: Easy data entry, validation works, duplicates detected

---

### ✅ Manual Add from Wishlist

#### Prerequisites
- [ ] Have at least one item in Wishlist

#### Flow
- [ ] Navigate to Wishlist page
- [ ] Find a wine
- [ ] Click "Add to cellar" or similar action
- [ ] Quantity modal appears
- [ ] Set quantity to add
- [ ] Optional: purchase info
- [ ] Click "Add to cellar"
- [ ] Wine moves from Wishlist to Cellar
- [ ] Quantity set correctly
- [ ] Wishlist item removed

**Expected**: Seamless move from Wishlist to Cellar

---

## 📱 REGRESSION: Mobile & PWA

### ✅ Mobile Responsiveness
Test on actual mobile device (iOS/Android) or browser DevTools (320px, 375px, 414px widths)

#### Plan an Evening (Mobile)
- [ ] Modal is full-screen or appropriately sized
- [ ] Inputs are touch-friendly (min 44px tap targets)
- [ ] Queue Player uses full viewport
- [ ] Hero card scaled appropriately
- [ ] Queue list scrollable with finger
- [ ] Navigation buttons large enough
- [ ] Wrap-up modal scrollable
- [ ] No horizontal scroll
- [ ] Text readable at default zoom

#### Scan Flow (Mobile)
- [ ] Camera opens in native mode
- [ ] Photo capture works
- [ ] Preview shows full image
- [ ] Form inputs usable with touch keyboard
- [ ] No FAB overlap with content

#### General Mobile
- [ ] Bottom navigation accessible
- [ ] Modals don't overflow
- [ ] Toast notifications visible
- [ ] Animations smooth (60fps)

**Expected**: Native-like mobile experience

---

### ✅ PWA Mode
1. Install app as PWA (Add to Home Screen)
2. Open PWA
3. Run all above tests in PWA mode

- [ ] Plan evening works offline (with cached data)
- [ ] Scan works if camera available
- [ ] Syncs when back online
- [ ] No visual regressions
- [ ] Smooth animations

**Expected**: Feature parity with web version

---

## 🎨 REGRESSION: UI/UX Polish

### ✅ Design System Consistency
- [ ] All new components use existing color palette
- [ ] Typography matches (font-family, sizes, weights)
- [ ] Spacing consistent with rest of app
- [ ] Button styles match existing patterns
- [ ] Icons from same icon set
- [ ] Animations use Framer Motion (consistent library)

### ✅ Accessibility
- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Focus indicators visible
- [ ] Color contrast passes WCAG AA (use browser DevTools)
- [ ] Screen reader labels present (aria-label)
- [ ] Motion respects `prefers-reduced-motion`

### ✅ Error States
- [ ] Network errors show toast with message
- [ ] Form validation errors clear and specific
- [ ] Empty states have helpful text/icons
- [ ] Loading states don't flash too quickly
- [ ] No uncaught exceptions in console

**Expected**: Luxury aesthetic maintained, accessible, polished

---

## 🚀 REGRESSION: Performance

### ✅ Load Times
- [ ] Initial page load < 2 seconds
- [ ] Route transitions smooth
- [ ] Large images lazy-load
- [ ] No layout shift (CLS)

### ✅ Database Queries
- [ ] No N+1 queries in console
- [ ] Supabase calls batched where possible
- [ ] Pagination works for large datasets

### ✅ Memory
- [ ] No memory leaks (check DevTools Memory profiler)
- [ ] Modals properly unmount on close

**Expected**: Fast, responsive, no performance regressions

---

## ⚠️ Edge Cases

### ✅ Plan an Evening Edge Cases
- [ ] Empty cellar → "Plan an evening" disabled or shows message
- [ ] Only 1 bottle → Lineup has 1 wine
- [ ] Network disconnects mid-evening → State persists, resumes when online
- [ ] Complete evening with 0 bottles opened → Plan marked completed, no history
- [ ] Multiple users: Each sees only their own plans
- [ ] Cancel evening → Can start new one immediately

### ✅ Scan Edge Cases
- [ ] Poor quality image → Extraction fails gracefully, allows manual edit
- [ ] Unknown wine → All fields editable
- [ ] Duplicate of duplicate → Detects original
- [ ] Scan same wine twice in row → Duplicate detection works

### ✅ General Edge Cases
- [ ] Logout during active evening → Resume not visible after login
- [ ] Feature flag OFF → "Plan an evening" hidden, no errors
- [ ] Browser back button during flows → Handles gracefully
- [ ] Multiple tabs open → State syncs (or handles conflicts)

**Expected**: No crashes, clear messaging, data integrity maintained

---

## 📋 Sign-Off Checklist

After completing all tests above:

- [ ] No console errors during any flow
- [ ] No TypeScript errors blocking build
- [ ] All new features working as expected
- [ ] No regressions in existing features
- [ ] Mobile experience smooth
- [ ] PWA works correctly
- [ ] Database migrations applied successfully
- [ ] Ready for production deployment

---

## 🐛 Bug Reporting Template

If you find issues, document:

```
**Test**: [Phase 2: Queue Player - Navigation]
**Steps**:
1. Started evening with 4 wines
2. Clicked "Next" to move to wine 2
3. Clicked "Previous" to return to wine 1

**Expected**: Should return to first wine
**Actual**: Stuck on wine 2, "Previous" button not working
**Browser**: Chrome 120, macOS
**Console Errors**: [paste any errors]
**Screenshots**: [attach if relevant]
```

---

## ✅ Success Criteria

The feature is ready for production when:

1. ✅ All "Plan an Evening" flows work end-to-end
2. ✅ Persistence works across sessions
3. ✅ Wrap-up correctly updates cellar and history
4. ✅ No regressions in scan/add flows
5. ✅ Mobile and PWA work smoothly
6. ✅ No critical bugs or console errors
7. ✅ Design system consistency maintained
8. ✅ Performance acceptable

---

## Next Steps After Testing

1. **If tests pass**: Merge to main, deploy to production
2. **If issues found**: Create GitHub issues, assign priority, fix
3. **Documentation**: Update user-facing docs with new feature
4. **Analytics**: Set up tracking for feature usage
5. **Rollout**: Consider gradual rollout (enable flag for % of users)

---

## Additional Test Scenarios (Optional)

### Power User Scenarios
- [ ] Plan evening with 10+ wines
- [ ] Open 5+ bottles of same wine
- [ ] Complete 3 evenings in one day
- [ ] Resume evening from 2 days ago

### International/RTL
- [ ] Switch language to Hebrew (RTL)
- [ ] Verify Plan evening UI direction correct
- [ ] All text translates properly

### Data Integrity
- [ ] Export history as CSV, verify evening entries present
- [ ] Manually edit plan in database, reload app, verify UI updates

---

**Happy Testing! 🍷**
