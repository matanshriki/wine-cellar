# 🍷 Value-First Onboarding - Quick Start Guide

## 🚀 TL;DR - Start Testing in 30 Seconds

1. Open your browser console
2. Run: `window.resetOnboarding()`
3. Refresh the page (F5)
4. See the magic! ✨

---

## ✅ What You'll See

### First Visit Flow (The Magic ✨)

1. **Welcome Modal Appears**
   - 🍷 Wine emoji
   - "Welcome to Wine Cellar Brain"
   - Two buttons: "Show me what this app can do" or "Skip"

2. **Click "Show me what this app can do"**
   - Demo banner appears: "🔍 You're viewing a demo cellar"
   - 8 realistic wine bottles appear instantly
   - Recommendation card: "If this were your cellar..."
   - All features work: filters, search, Tonight's Orbit

3. **Click "Add just one bottle"**
   - Sheet opens: "Teach me your taste"
   - Helper text: "The more I know, the better I get."

4. **Add Your First Bottle**
   - Success modal: "Got it! I'm already smarter."
   - Demo disappears
   - Your real cellar starts

---

## 🧪 Quick Tests

### Test 1: Happy Path (2 minutes)
```bash
# Console:
window.resetOnboarding()
# Refresh page
```
1. Click "Show me what this app can do"
2. Browse the demo cellar (try filters, search)
3. Click "Add just one bottle"
4. Add a bottle (manual entry is fastest)
5. See success modal
6. Verify demo is gone

### Test 2: Skip Flow (30 seconds)
```bash
# Console:
window.resetOnboarding()
# Refresh page
```
1. Click "Skip for now"
2. See improved empty state
3. Note the CTA: "Teach me with one bottle 🍷"

### Test 3: Exit Demo (1 minute)
```bash
# Console:
window.resetOnboarding()
# Refresh page
```
1. Enter demo mode
2. Click "Exit Demo" in banner
3. Verify you're back to empty state

---

## 🔍 Quick Debug

### Check What State You're In
```javascript
// Console:
localStorage.getItem('wcb_onboarding_seen')        // null = new user
localStorage.getItem('wcb_demo_mode_active')       // "true" = in demo
localStorage.getItem('wcb_first_bottle_added')     // "true" = has bottles
```

### Reset Everything
```javascript
window.resetOnboarding()  // Then refresh
```

---

## 📋 Files Changed Summary

### New Files (6)
- `WelcomeModal.tsx` - First greeting
- `DemoBanner.tsx` - "You're viewing demo" banner
- `DemoRecommendationCard.tsx` - Instant recommendation
- `FirstBottleSuccessModal.tsx` - Celebration
- `data/demoCellar.ts` - 8 demo bottles
- `utils/onboarding.ts` - State management

### Modified Files (3)
- `CellarPage.tsx` - Orchestrates onboarding
- `AddBottleSheet.tsx` - New copy
- `i18n/locales/en.json` - Updated strings

---

## 🚨 Important Notes

### DEV ONLY
- Only works on `localhost`
- Disabled in production automatically
- Safe to merge - won't affect prod

### Demo Bottles
- 8 realistic wines (Bordeaux, NZ, Italy, etc.)
- Mix of red/white/rosé
- Various readiness states (Ready/Hold/Peak Soon)
- NEVER saved to database

### State Management
- localStorage tracks onboarding progress
- Demo mode persists across page refresh
- Exits when first real bottle added

---

## 🎯 Success Criteria

You'll know it's working when:
- [x] Welcome modal appears on first visit
- [x] Demo cellar shows 8 bottles instantly
- [x] Recommendation card explains the value
- [x] "Add just one bottle" opens improved sheet
- [x] Success modal celebrates first bottle
- [x] Demo disappears after first bottle added
- [x] Empty state has better copy when skipped

---

## 📖 Full Documentation

See `ONBOARDING_VALUE_FIRST.md` for:
- Complete user flows
- Full test checklist
- Implementation details
- Future enhancements
- Production deployment notes

---

## 🆘 Troubleshooting

**Welcome modal not appearing?**
- Check you're on localhost
- Run `window.resetOnboarding()`
- Refresh page

**Demo bottles not showing?**
- Check console for errors
- Look for: `[CellarPage] Using demo bottles: 8`

**Success modal not showing?**
- Ensure you're adding first bottle (not editing)
- Check: `localStorage.getItem('wcb_first_bottle_added')` is null

**Demo won't exit?**
- Run: `localStorage.removeItem('wcb_demo_mode_active')`
- Refresh page

---

## ✨ Pro Tips

1. **Fast Reset**: Bookmark this JavaScript:
   ```javascript
   javascript:localStorage.removeItem('wcb_onboarding_seen');localStorage.removeItem('wcb_demo_mode_active');localStorage.removeItem('wcb_first_bottle_added');location.reload();
   ```

2. **Watch Console**: Leave DevTools open to see debug logs

3. **Test Mobile**: Use DevTools responsive mode (Cmd+Shift+M)

4. **Demo Features**: Try all filters, search, Tonight's Orbit with demo bottles

---

**Happy Testing!** 🍷

Any issues? Check the full docs in `ONBOARDING_VALUE_FIRST.md`

