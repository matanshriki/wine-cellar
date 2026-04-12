# ✅ PRODUCTION QA CHECKLIST - Value-First Onboarding

**Date**: Jan 10, 2026  
**Feature**: VALUE-FIRST ONBOARDING  
**Status**: Ready for QA

---

## 🎯 CRITICAL TESTS (MUST PASS)

### ✅ Test 1: New User Flow
**Priority**: 🔴 CRITICAL

**Steps:**
1. [ ] Open app in incognito/private window
2. [ ] Verify welcome modal appears with title "🍷 Welcome to Sommi"
3. [ ] Verify subtitle shows value proposition
4. [ ] Verify two buttons: "Show me what this app can do" and "Skip for now"
5. [ ] Click "Show me what this app can do"
6. [ ] Verify 8 demo bottles load
7. [ ] Verify demo banner shows at top: "🔍 You're viewing a demo cellar"
8. [ ] Verify recommendation card shows: "If this were your cellar..."
9. [ ] Verify recommendation suggests a wine with explanation
10. [ ] Click "Add just one bottle" button
11. [ ] Add a bottle (any bottle)
12. [ ] Verify demo exits immediately
13. [ ] Verify success modal shows: "Got it! I'm already smarter."
14. [ ] Verify only real bottle shows (no demo bottles)
15. [ ] Refresh page
16. [ ] Verify welcome modal does NOT appear again
17. [ ] Verify demo mode does NOT reappear
18. [ ] Verify only real bottle shows

**Expected Result**: ✅ Smooth onboarding flow from welcome → demo → first bottle → success

**Pass**: [ ]  
**Fail**: [ ] (If fail, describe issue: _________________)

---

### ✅ Test 2: Existing User Safety
**Priority**: 🔴 CRITICAL

**Steps:**
1. [ ] Log in as existing user (who already has bottles)
2. [ ] Verify NO welcome modal appears
3. [ ] Verify normal cellar loads immediately
4. [ ] Verify no demo mode banner
5. [ ] Verify all existing bottles show correctly
6. [ ] Verify no onboarding UI elements visible

**Expected Result**: ✅ Existing users see no onboarding

**Pass**: [ ]  
**Fail**: [ ] (If fail, describe issue: _________________)

---

## 📱 IMPORTANT TESTS (SHOULD PASS)

### ✅ Test 3: Skip Onboarding Flow
**Priority**: 🟡 IMPORTANT

**Steps:**
1. [ ] Open app in new incognito window
2. [ ] Verify welcome modal appears
3. [ ] Click "Skip for now"
4. [ ] Verify empty state shows
5. [ ] Verify text: "I can't recommend anything yet – I don't know what you like."
6. [ ] Verify CTA button: "Teach me with one bottle 🍷"
7. [ ] Click CTA button
8. [ ] Verify Add Bottle form opens
9. [ ] Add a bottle
10. [ ] Verify bottle appears in cellar

**Expected Result**: ✅ Skip leads to smart empty state with clear CTA

**Pass**: [ ]  
**Fail**: [ ] (If fail, describe issue: _________________)

---

### ✅ Test 4: Demo Exit via Banner
**Priority**: 🟡 IMPORTANT

**Steps:**
1. [ ] New user → Enter demo mode
2. [ ] Verify demo banner shows at top
3. [ ] Click "Exit Demo" button in banner
4. [ ] Verify demo exits to empty state
5. [ ] Verify smart empty state shows
6. [ ] Verify no demo bottles visible
7. [ ] Refresh page
8. [ ] Verify demo does NOT reappear
9. [ ] Verify empty state persists

**Expected Result**: ✅ Manual exit works correctly

**Pass**: [ ]  
**Fail**: [ ] (If fail, describe issue: _________________)

---

### ✅ Test 5: Demo + Wishlist Integration
**Priority**: 🟡 IMPORTANT

**Steps:**
1. [ ] New user → Enter demo mode
2. [ ] Scan or manually add a bottle to wishlist
3. [ ] Go to wishlist page
4. [ ] Move bottle from wishlist to cellar
5. [ ] Verify demo mode exits automatically
6. [ ] Verify demo bottles disappear
7. [ ] Verify only real bottle shows
8. [ ] Refresh page
9. [ ] Verify demo does NOT reappear

**Expected Result**: ✅ Demo exits when bottle added via wishlist

**Pass**: [ ]  
**Fail**: [ ] (If fail, describe issue: _________________)

---

## 📱 MOBILE & RESPONSIVE TESTS

### ✅ Test 6: Mobile Responsiveness
**Priority**: 🟡 IMPORTANT

**Test on actual mobile device or Chrome DevTools mobile view:**

**Steps:**
1. [ ] Open app on mobile (or mobile view)
2. [ ] Verify welcome modal fits screen
3. [ ] Verify text is readable (not too small)
4. [ ] Verify buttons are tap-friendly (min 44px height)
5. [ ] Enter demo mode
6. [ ] Verify demo bottles display correctly
7. [ ] Verify recommendation card is readable
8. [ ] Verify all CTAs are easily tappable
9. [ ] Test on iOS Safari (if possible)
10. [ ] Test on Android Chrome (if possible)

**Expected Result**: ✅ Full mobile compatibility

**Pass**: [ ]  
**Fail**: [ ] (If fail, describe issue: _________________)

---

## 🌍 INTERNATIONALIZATION TESTS

### ✅ Test 7: Hebrew Translation (RTL)
**Priority**: 🟢 NICE TO HAVE

**Steps:**
1. [ ] Open app in incognito
2. [ ] Enter demo mode
3. [ ] Go to profile settings
4. [ ] Switch language to Hebrew (עברית)
5. [ ] Verify welcome modal text is in Hebrew
6. [ ] Verify demo banner is in Hebrew
7. [ ] Verify recommendation card is in Hebrew
8. [ ] Verify RTL layout works correctly
9. [ ] Verify all buttons show Hebrew text
10. [ ] Switch back to English
11. [ ] Verify everything translates back

**Expected Result**: ✅ Full Hebrew support with RTL

**Pass**: [ ]  
**Fail**: [ ] (If fail, describe issue: _________________)

---

## 🔧 SUPPORT & DEBUGGING TESTS

### ✅ Test 8: Support Reset Function
**Priority**: 🟢 NICE TO HAVE

**Steps:**
1. [ ] Complete onboarding (so it won't show again)
2. [ ] Open browser console
3. [ ] Run: `window.resetOnboarding()`
4. [ ] Verify console message: "State reset - refresh to see onboarding"
5. [ ] Refresh page
6. [ ] Verify onboarding appears again
7. [ ] Verify demo mode works

**Expected Result**: ✅ Reset function works for support

**Pass**: [ ]  
**Fail**: [ ] (If fail, describe issue: _________________)

---

## 📊 SUMMARY

### Test Results:

| Test | Priority | Status | Notes |
|------|----------|--------|-------|
| 1. New User Flow | 🔴 CRITICAL | [ ] | |
| 2. Existing User Safety | 🔴 CRITICAL | [ ] | |
| 3. Skip Onboarding | 🟡 IMPORTANT | [ ] | |
| 4. Demo Exit Banner | 🟡 IMPORTANT | [ ] | |
| 5. Demo + Wishlist | 🟡 IMPORTANT | [ ] | |
| 6. Mobile Responsive | 🟡 IMPORTANT | [ ] | |
| 7. Hebrew Translation | 🟢 NICE TO HAVE | [ ] | |
| 8. Support Reset | 🟢 NICE TO HAVE | [ ] | |

### Overall Status:

- [ ] ✅ **ALL CRITICAL TESTS PASSED** (Tests 1-2)
- [ ] ✅ **ALL IMPORTANT TESTS PASSED** (Tests 3-6)
- [ ] ✅ **READY FOR PRODUCTION**

---

## 🚨 BLOCKERS

If any CRITICAL test fails, **DO NOT DEPLOY** until fixed.

**Blocker Issues:**
1. _____________________
2. _____________________
3. _____________________

---

## ✅ SIGN-OFF

**QA Tester**: _____________________  
**Date**: _____________________  
**Status**: [ ] APPROVED  [ ] REJECTED  
**Notes**: _____________________

---

## 📞 SUPPORT

**If you find issues:**
1. Document the exact steps to reproduce
2. Take screenshots
3. Check browser console for errors
4. Note the browser and OS version

**Need help?**
- See: `ONBOARDING_PRODUCTION_DEPLOYMENT.md`
- Run: `window.resetOnboarding()` to reset state
- Check: localStorage keys for debugging

---

🍷 **Good luck with QA!**

