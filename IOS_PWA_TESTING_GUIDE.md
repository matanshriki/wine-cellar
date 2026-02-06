# Testing Guide: iOS PWA Safe Area Fix

## Quick Test (On Real iPhone)

### Setup
1. Wait for Vercel deployment to complete
2. Open Safari on iPhone
3. Navigate to your app
4. Tap Share button → "Add to Home Screen"
5. Open the PWA from home screen (standalone mode)

### Test Scenarios

#### ✅ Test 1: Plan an Evening Modal
1. Tap "Plan an evening" button
2. **Expected**: Footer/FAB should disappear immediately
3. Fill in occasion, group size, food selections
4. Scroll to bottom of modal
5. **Expected**: "Generate lineup" button is fully visible and clickable
6. Tap "Generate lineup"
7. Review lineup, scroll to bottom
8. **Expected**: "Start evening" button is fully visible and clickable
9. Close modal with X
10. **Expected**: Footer/FAB reappears smoothly

#### ✅ Test 2: Evening Queue Player
1. Start an evening from Plan an Evening
2. **Expected**: Footer/FAB hidden while queue is open
3. Scroll through the queue list
4. **Expected**: All wines visible, no content hidden
5. Tap "Complete evening"
6. **Expected**: Wrap-up modal opens with footer still hidden
7. Scroll to bottom of wrap-up modal
8. **Expected**: "Save to history" button fully visible and clickable
9. Close wrap-up modal
10. **Expected**: Footer returns

#### ✅ Test 3: Add Bottle Sheet
1. Tap camera FAB
2. **Expected**: Bottom sheet slides up from bottom
3. **Expected**: Bottom sheet respects home indicator area (iPhone X+)
4. **Expected**: All buttons accessible
5. Cancel and verify footer is still visible (sheet is not a full modal)

#### ✅ Test 4: Orientation Change
1. Open any modal
2. Rotate device to landscape
3. **Expected**: Modal adjusts, content still fully accessible
4. Rotate back to portrait
5. **Expected**: Modal adjusts correctly

#### ✅ Test 5: All Modals Checklist
Test each modal and verify:
- [ ] Footer hides when modal opens
- [ ] All buttons at bottom are clickable
- [ ] Content scrolls without jumping
- [ ] Close button works
- [ ] Footer returns when modal closes

**Modals to test:**
- Plan an evening (input step)
- Plan an evening (lineup step)
- Swap wine picker
- Your Evening queue
- Wrap-up evening
- Add bottle sheet
- Drink window modal (if applicable)
- Any other modals in the app

## Expected Behavior Summary

### Before Fix ❌
- Footer/FAB overlaps modal content
- Bottom buttons not clickable
- Content extends under home indicator
- Poor UX on iPhone PWA

### After Fix ✅
- Footer automatically hides when modal opens
- All buttons fully accessible and clickable
- Content respects safe area (home indicator)
- Smooth transitions
- Luxury design maintained

## Visual Verification

### What to Look For:
1. **Footer behavior**: Should smoothly fade out when modal opens
2. **Modal sizing**: Should not extend under home indicator
3. **Button accessibility**: All CTAs should be above safe area
4. **Scrolling**: Smooth iOS-style momentum scrolling in modals
5. **Spacing**: Proper padding around modal content

## Troubleshooting

### Issue: Footer doesn't hide
- Check if modal has `role="dialog"` attribute (inspect in dev tools)
- Refresh PWA completely

### Issue: Bottom buttons still not clickable
- Check if safe area is being detected (may need device restart)
- Verify you're testing in standalone PWA mode, not Safari

### Issue: Layout looks broken
- Try closing and reopening the modal
- Force refresh the PWA (close completely and reopen)

## Reporting Issues

If you find any issues, please note:
1. Device model and iOS version
2. Which modal has the issue
3. Screenshot if possible
4. Steps to reproduce
