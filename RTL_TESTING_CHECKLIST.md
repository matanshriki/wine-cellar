# 🔄 RTL/LTR Testing Checklist

## Overview
This checklist ensures the Wine Cellar Brain application works correctly in both **LTR (English)** and **RTL (Hebrew)** layouts.

---

## 🎯 Quick Visual Test

### 1. Language Switch Test
- [ ] Open app in English (LTR)
- [ ] Click language switcher → Select Hebrew
- [ ] **Verify:** Layout immediately flips to RTL
- [ ] **Verify:** No page refresh required
- [ ] Switch back to English
- [ ] **Verify:** Layout flips back to LTR
- [ ] **Verify:** No broken layouts or misaligned elements

### 2. Initial Load Test
- [ ] Set browser to Hebrew
- [ ] Hard refresh app (Cmd/Ctrl + Shift + R)
- [ ] **Verify:** App loads in RTL from the start
- [ ] **Verify:** `<html dir="rtl" lang="he">` is set

---

## 📄 Page-by-Page Testing

### Login Page
**Test in both EN and HE:**
- [ ] Language switcher position (top-right in LTR, top-left in RTL)
- [ ] Title and subtitle centered
- [ ] Form labels aligned correctly (left in LTR, right in RTL)
- [ ] Input fields aligned correctly
- [ ] Buttons aligned correctly
- [ ] Link text ("Don't have an account?") aligned correctly

**RTL-Specific:**
- [ ] Hebrew text reads naturally right-to-left
- [ ] Input cursor starts from right side
- [ ] No horizontal scroll

---

### Cellar Page (Dashboard)

#### Header Section
**Test in both EN and HE:**
- [ ] Page title aligned correctly
- [ ] Bottle count text aligned under title
- [ ] "Import CSV" and "+ Add Bottle" buttons
  - [ ] Stack vertically on mobile
  - [ ] Side-by-side on desktop
  - [ ] Order preserved (Import first, then Add)
- [ ] No text truncation

#### Empty State
**Test in both EN and HE:**
- [ ] Title centered
- [ ] Subtitle centered
- [ ] Buttons centered
- [ ] Buttons full-width on mobile
- [ ] Buttons side-by-side on desktop

#### Bottle Cards Grid
**Test in both EN and HE:**
- [ ] Cards flow correctly (left-to-right in LTR, right-to-left in RTL)
- [ ] Card content aligned correctly
- [ ] Bottle name visible and not truncated
- [ ] Labels ("Vintage:", "Region:", etc.) aligned correctly
- [ ] Field values aligned correctly
- [ ] Badges (Red/White/etc.) positioned correctly
- [ ] "Edit" and "Delete" buttons aligned correctly
- [ ] "🔍 Analyze" button aligned correctly

**RTL-Specific:**
- [ ] Cards appear from right to left
- [ ] First card is on the right side
- [ ] No overlap between cards

---

### "What Should I Open Tonight?" Page

#### Form Step
**Test in both EN and HE:**
- [ ] Page title and subtitle aligned
- [ ] Form labels aligned correctly
- [ ] Dropdown options readable
- [ ] Checkbox labels aligned with checkboxes
  - [ ] Checkbox on correct side (left in LTR, right in RTL)
  - [ ] Label text aligned correctly
- [ ] Input placeholder text aligned
- [ ] "Get Recommendations" button centered/aligned

**RTL-Specific:**
- [ ] Dropdowns open from correct side
- [ ] Long Hebrew text doesn't overflow
- [ ] Checkboxes appear on right side

#### Results Step
**Test in both EN and HE:**
- [ ] "Back to form" button
  - [ ] Arrow icon flips correctly (← in LTR, → in RTL)
  - [ ] Text aligned with arrow
- [ ] Recommendation cards:
  - [ ] #1, #2, #3 badges positioned correctly
  - [ ] Bottle name visible
  - [ ] Score badge positioned correctly
  - [ ] "Why this bottle?" section aligned
  - [ ] "Serving Instructions" section aligned
  - [ ] "Mark as Opened" button aligned

**RTL-Specific:**
- [ ] Arrow points right (not left)
- [ ] Recommendation numbers read right-to-left
- [ ] Mixed English wine names in Hebrew text don't break layout

---

### History & Stats Page

#### Stats Cards
**Test in both EN and HE:**
- [ ] 4 stats cards flow correctly
- [ ] Card labels aligned correctly
- [ ] Large numbers aligned correctly
- [ ] Subtitle text ("bottles opened") aligned correctly
- [ ] Cards stack on mobile (1 column)
- [ ] Cards flow on desktop (4 columns)

**RTL-Specific:**
- [ ] Cards flow right-to-left on desktop
- [ ] First card (Total Opens) appears on right

#### Top Regions List
**Test in both EN and HE:**
- [ ] "Top Regions" title aligned
- [ ] Region names aligned (left in LTR, right in RTL)
- [ ] Count badges aligned (right in LTR, left in RTL)
- [ ] No overflow on long region names

#### Opening History
**Test in both EN and HE:**
- [ ] "Opening History" title aligned
- [ ] Event cards:
  - [ ] Left border (in LTR) / right border (in RTL)
  - [ ] Bottle name aligned
  - [ ] Date aligned (opposite side of name)
  - [ ] Badges flow correctly
  - [ ] Notes text aligned correctly

**RTL-Specific:**
- [ ] Border appears on right side
- [ ] Date appears on left side
- [ ] Hebrew notes read naturally

---

## 🧩 Component-Level Testing

### Navigation Bar
**Test in both EN and HE:**
- [ ] Logo and title positioned correctly (start of nav)
- [ ] Wine glass emoji visible
- [ ] Desktop nav links:
  - [ ] Flow correctly (Cellar, Tonight?, History)
  - [ ] Active state highlights correctly
  - [ ] No overlap
- [ ] Language switcher positioned correctly (end of nav)
- [ ] User email positioned correctly
- [ ] Logout button positioned correctly
- [ ] Logout icon flips in RTL

**Mobile:**
- [ ] Hamburger menu items stack correctly
- [ ] Touch targets adequate (44px+)
- [ ] Active state visible

**RTL-Specific:**
- [ ] Logo on right side
- [ ] Nav links flow right-to-left
- [ ] Language switcher on left side

---

### Bottle Form (Add/Edit Modal)
**Test in both EN and HE:**
- [ ] Modal title aligned
- [ ] Form labels aligned correctly
- [ ] Input fields aligned correctly
- [ ] Placeholder text aligned
- [ ] Dropdown options readable
- [ ] "Cancel" and "Save/Update" buttons:
  - [ ] Side-by-side layout
  - [ ] Correct order (Cancel first, Save second)
  - [ ] Touch-friendly on mobile

**RTL-Specific:**
- [ ] Hebrew text in inputs starts from right
- [ ] Cursor starts from right side
- [ ] Long Hebrew labels don't truncate

---

### CSV Import Modal

#### Upload Step
**Test in both EN and HE:**
- [ ] Modal title aligned
- [ ] Instructions text aligned
- [ ] Vivino info box:
  - [ ] Icon and title aligned
  - [ ] Description text aligned
  - [ ] Link aligned
- [ ] Download buttons aligned
- [ ] File input button aligned
- [ ] "Cancel" and "Next" buttons positioned correctly

**RTL-Specific:**
- [ ] File input flows RTL
- [ ] Download links read naturally

#### Mapping Step
**Test in both EN and HE:**
- [ ] Vivino detection banner (if present):
  - [ ] Icon positioned correctly
  - [ ] Text aligned correctly
- [ ] Instructions text aligned
- [ ] Column mapping dropdowns:
  - [ ] Labels aligned correctly
  - [ ] Dropdowns open from correct side
- [ ] Preview table:
  - [ ] Headers aligned
  - [ ] Data cells aligned
  - [ ] Table scrolls horizontally if needed
  - [ ] Scroll direction correct (right-to-left in RTL)
- [ ] "Back" and "Import" buttons positioned correctly

**RTL-Specific:**
- [ ] Table headers flow right-to-left
- [ ] First column appears on right
- [ ] Horizontal scroll starts from right edge

---

### Language Switcher Dropdown
**Test in both EN and HE:**
- [ ] Button shows current language (flag + code)
- [ ] Dropdown arrow rotates when open
- [ ] Dropdown opens from correct side (right in LTR, left in RTL)
- [ ] Language options:
  - [ ] Flag visible
  - [ ] Language name visible
  - [ ] Checkmark on active language (correct side)
  - [ ] Touch-friendly height (48px)

**RTL-Specific:**
- [ ] Dropdown appears on left side
- [ ] Hebrew language name (עברית) displays correctly
- [ ] Checkmark appears on left side (not right)

---

### Bottle Card Component
**Test in both EN and HE:**
- [ ] Bottle name and producer aligned
- [ ] Style badge (Red/White/etc.) positioned correctly
- [ ] Field labels ("Vintage:", "Region:", etc.) aligned
- [ ] Field values aligned
- [ ] Analysis section (if present):
  - [ ] "Readiness" label aligned
  - [ ] Status badge aligned
  - [ ] Explanation text aligned
  - [ ] Temperature and decant time icons positioned correctly
- [ ] "Edit" and "Delete" buttons:
  - [ ] Side-by-side layout
  - [ ] Correct sizing on mobile

**RTL-Specific:**
- [ ] Badge appears on right side (not left)
- [ ] Field values align to right
- [ ] Mixed English/Hebrew text doesn't break layout

---

## 🔢 Numeric Fields & Special Cases

### Prices & Numbers
**Test in both EN and HE:**
- [ ] Prices display as numbers (e.g., "50.00")
- [ ] Prices stay LTR even in RTL context
- [ ] Ratings (e.g., "95/100") display correctly
- [ ] Vintage years (e.g., "2015") display correctly
- [ ] Quantity numbers display correctly

**Expected Behavior:**
- [ ] All numeric values remain left-to-right
- [ ] No mixed directionality issues
- [ ] Decimal separators correct

### Dates
**Test in both EN and HE:**
- [ ] Dates format according to language:
  - [ ] English: "Jan 15, 2024"
  - [ ] Hebrew: "15 בינו׳ 2024"
- [ ] Date alignment correct
- [ ] No truncation

### Wine Names (Mixed Content)
**Test in both EN and HE:**
- [ ] English wine names display correctly in Hebrew context
- [ ] Example: "Château Margaux" stays LTR in RTL paragraph
- [ ] No weird spacing or line breaks
- [ ] Comma/period placement correct

---

## ⚠️ Common RTL Issues to Check

### Spacing Issues
- [ ] No extra space on wrong side of elements
- [ ] Gaps between elements consistent
- [ ] Margins/paddings mirror correctly

### Alignment Issues
- [ ] Text doesn't stick to wrong side
- [ ] Icons don't appear on wrong side of text
- [ ] Badges don't overlap with text

### Overflow Issues
- [ ] No horizontal scrollbars (unless intentional, like tables)
- [ ] Long Hebrew text wraps correctly
- [ ] Cards don't break layout

### Icon Direction Issues
- [ ] Arrow icons flip correctly
- [ ] Chevron icons flip correctly
- [ ] "Back" arrows point correct direction
- [ ] Logout icon flips correctly

### Border Issues
- [ ] Left borders become right borders in RTL
- [ ] Border colors consistent
- [ ] Border widths consistent

---

## 🖥️ Browser Testing

Test in multiple browsers for RTL support:
- [ ] Chrome/Edge (Chromium)
- [ ] Safari
- [ ] Firefox

---

## 📱 Mobile Device Testing

Test on actual devices:
- [ ] iPhone (iOS Safari)
- [ ] Android phone (Chrome)

**Mobile-Specific Checks:**
- [ ] Touch targets adequate (44px+)
- [ ] Text readable without zooming
- [ ] Inputs don't trigger iOS zoom (font-size: 16px)
- [ ] Scrolling smooth
- [ ] No layout shifts when switching languages
- [ ] Keyboard appears correctly in RTL

---

## ✅ Automated Checks

### HTML Validation
```bash
# Check that dir and lang attributes are set correctly
# Should show: <html dir="rtl" lang="he"> or <html dir="ltr" lang="en">
```

### Console Errors
- [ ] No console errors when switching languages
- [ ] No warnings about direction
- [ ] No layout shift warnings

### Performance
- [ ] Language switch is instant (< 100ms)
- [ ] No visible flicker when switching
- [ ] No re-render issues

---

## 🐛 Known Issues to Watch For

1. **Mixed Content**: Wine names in English within Hebrew text
   - Expected: Should stay LTR within RTL context
   - Check: No weird spacing

2. **Tables**: CSV preview tables
   - Expected: Headers and cells flow right-to-left in RTL
   - Check: Horizontal scroll starts from right

3. **Modals**: Forms and import dialogs
   - Expected: Content mirrors, but stays centered
   - Check: No off-screen content

4. **Dropdowns**: Language switcher, form selects
   - Expected: Opens from correct side
   - Check: No overlap with edge of screen

---

## 📋 Sign-Off Checklist

Before marking RTL implementation as complete:

- [ ] All pages tested in both LTR and RTL
- [ ] All components tested in both directions
- [ ] No console errors
- [ ] No layout breaks
- [ ] No text truncation
- [ ] All icons flip correctly
- [ ] All numeric fields stay LTR
- [ ] Mobile experience smooth
- [ ] Tested on actual devices
- [ ] Tested with real Hebrew-speaking user (ideal)

---

## 🎯 Quick Smoke Test (5 minutes)

For quick verification after changes:

1. **Switch to Hebrew**
   - Layout flips to RTL immediately
   - Navigation on right side
   - Language switcher on left side

2. **Navigate to each page**
   - Cellar page looks mirrored
   - Recommendation page looks mirrored
   - History page looks mirrored

3. **Open a modal**
   - Bottle form or CSV import
   - Content aligns correctly
   - Buttons in correct order

4. **Switch back to English**
   - Everything reverts smoothly
   - No layout issues

**If all above pass → RTL is working! ✅**

---

## 📝 Reporting Issues

When reporting RTL issues, include:
1. **Language:** EN or HE
2. **Page:** Which page/component
3. **Description:** What's wrong
4. **Screenshot:** Visual proof
5. **Expected:** What should happen
6. **Actual:** What actually happens
7. **Browser:** Chrome/Safari/Firefox
8. **Device:** Desktop/Mobile

**Example:**
```
Language: Hebrew (HE)
Page: Cellar Dashboard
Description: "Edit" button overlaps with bottle name
Screenshot: [attached]
Expected: Button should be on the left side
Actual: Button is on the right side, overlapping text
Browser: Chrome 120
Device: Desktop (1920x1080)
```

---

**This checklist ensures comprehensive RTL testing for a production-grade multilingual application!** 🌍🍷

