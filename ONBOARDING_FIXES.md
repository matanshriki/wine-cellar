# 🔧 Onboarding Fixes - Hebrew Translation & Demo Bottle Analysis

## Issues Fixed

### 1. ✅ Hebrew Translation Added
**Problem:** All onboarding text was hardcoded in English  
**Solution:** Added complete i18n support for Hebrew

#### Files Updated:
- `apps/web/src/i18n/locales/en.json` - Added `onboarding` section
- `apps/web/src/i18n/locales/he.json` - Added Hebrew translations
- `WelcomeModal.tsx` - Now uses `t('onboarding.welcome.*')`
- `DemoBanner.tsx` - Now uses `t('onboarding.demoBanner.*')`
- `DemoRecommendationCard.tsx` - Now uses `t('onboarding.demoRecommendation.*')`
- `FirstBottleSuccessModal.tsx` - Now uses `t('onboarding.firstBottle.*')`
- `CellarPage.tsx` - Empty state uses `t('onboarding.emptyState.*')`

#### New Translation Keys:
```json
"onboarding": {
  "welcome": {
    "title": "Welcome to Wine Cellar Brain",
    "subtitle": "Your personal AI sommelier...",
    "showDemo": "Show me what this app can do",
    "skip": "Skip for now",
    "devOnly": "DEV MODE ONLY..."
  },
  "demoBanner": {
    "message": "You're viewing a demo cellar...",
    "exitDemo": "Exit Demo"
  },
  "demoRecommendation": {
    "title": "If this were your cellar…",
    "readyNow": "✨ Perfect for tonight!...",
    "peakSoon": "⏰ Approaching its peak!...",
    "hold": "🎯 Worth the wait!...",
    "educationalNote": "💡 This app only recommends...",
    "ctaTitle": "Want recommendations like this...",
    "ctaButton": "Add just one bottle",
    "ctaHelper": "One bottle is enough...",
    "demoOnly": "(Demo mode - analysis not available)"
  },
  "firstBottle": {
    "title": "Got it! I'm already smarter.",
    "message": "With just one bottle...",
    "button": "Let's explore!",
    "closing": "Closing automatically..."
  },
  "emptyState": {
    "title": "I can't recommend anything yet...",
    "subtitle": "The more I know...",
    "cta": "Teach me with one bottle 🍷"
  }
}
```

### 2. ✅ Demo Bottle Analysis Disabled
**Problem:** Clicking "Generate Sommelier Notes" on demo bottles caused "bottle not found" error  
**Solution:** Disabled analysis button for demo bottles with clear messaging

#### Changes Made:
1. **BottleCard.tsx**
   - Added `isDemo?: boolean` prop
   - Disabled analyze button when `isDemo={true}`
   - Added tooltip: "(Demo mode - analysis not available)"
   - Visual feedback: grayed out, cursor not-allowed

2. **CellarPage.tsx**
   - Pass `isDemo={isDemoMode && isDemoModeAvailable()}` to BottleCard
   - Demo bottles now clearly non-analyzable

3. **DemoRecommendationCard.tsx**
   - Added note: "(Demo mode - analysis not available)"
   - Explains why analysis isn't available in demo

---

## Testing

### Test Hebrew Translation:
1. Open app on localhost
2. Run `window.resetOnboarding()` in console
3. Refresh page
4. Change language to Hebrew (עברית) in profile
5. Verify all onboarding text appears in Hebrew:
   - Welcome modal
   - Demo banner
   - Recommendation card
   - First bottle success modal
   - Empty state

### Test Demo Bottle Analysis:
1. Enter demo mode
2. Find a demo bottle
3. Click "Generate Sommelier Notes" button
4. Verify:
   - Button is disabled (grayed out)
   - Tooltip shows "(Demo mode - analysis not available)"
   - No error occurs
   - Cursor shows "not-allowed"

---

## What Changed

### Translation Files (2 files)
- `apps/web/src/i18n/locales/en.json` - Added onboarding section
- `apps/web/src/i18n/locales/he.json` - Added Hebrew translations

### Components (6 files)
- `WelcomeModal.tsx` - Uses i18n
- `DemoBanner.tsx` - Uses i18n
- `DemoRecommendationCard.tsx` - Uses i18n + demo note
- `FirstBottleSuccessModal.tsx` - Uses i18n
- `BottleCard.tsx` - Added `isDemo` prop, disabled analysis
- `CellarPage.tsx` - Passes `isDemo` prop, uses i18n for empty state

---

## Hebrew Translations Summary

All onboarding text now appears in Hebrew when language is set to עברית:

- **Welcome Modal:**
  - "ברוכים הבאים למוח מרתף היין"
  - "הראה לי מה האפליקציה יכולה לעשות"
  - "דלג לעכשיו"

- **Demo Banner:**
  - "אתה צופה במרתף הדגמה – החלף אותו בשלך בכל עת"
  - "צא מההדגמה"

- **Recommendation Card:**
  - "אם זה היה המרתף שלך…"
  - "הוסף בקבוק אחד בלבד"

- **First Bottle Success:**
  - "קלטתי! אני כבר יותר חכם."
  - "בוא נחקור!"

- **Empty State:**
  - "אני לא יכול להמליץ על כלום עדיין – אני לא יודע מה אתה אוהב."
  - "למד אותי עם בקבוק אחד 🍷"

---

## Summary

✅ **Hebrew translation complete** - All onboarding text now translatable  
✅ **Demo bottle analysis disabled** - No more "bottle not found" errors  
✅ **Clear user feedback** - Demo limitations explained  
✅ **Consistent UX** - Disabled state matches app patterns

**Ready for testing!** 🍷

