# Plan Evening - Hebrew Translation Implementation

## Overview
Added complete Hebrew translations for the entire "Plan an evening" feature flow, ensuring Hebrew-speaking users have a fully localized luxury experience.

## Translation Coverage

### 1. Main Buttons & Titles
- ✅ "Plan an evening" → תכנן ערב
- ✅ "Resume evening" → חזור לערב  
- ✅ "Your Evening" → הערב שלך
- ✅ "Wrap up the evening" → סיים את הערב

### 2. Input Step (Step 1)
**Page Title & Subtitle:**
- ✅ "Create your perfect wine lineup" → צור את רצף היינות המושלם שלך

**Form Labels:**
- ✅ "Occasion" → אירוע
- ✅ "Group size" → גודל קבוצה
- ✅ "Preferences" → העדפות
- ✅ "Reds only" → אדומים בלבד
- ✅ "Rating ≥ 4.2" → דירוג ≥ 4.2
- ✅ "What are you eating? (optional)" → מה אתם אוכלים? (אופציונלי)

**Occasion Options:**
- ✅ Friends → חברים
- ✅ BBQ → ברביקיו
- ✅ Pizza night → ערב פיצה
- ✅ Date night → דייט
- ✅ Celebration → חגיגה

**Food Selection:**
- ✅ "Protein" → חלבון
  - Beef → בשר בקר
  - Lamb → כבש
  - Chicken → עוף
  - Fish → דג
  - Veggie → צמחוני
  - No food → ללא אוכל

- ✅ "Sauce" → רוטב
  - Tomato → עגבניות
  - BBQ → ברביקיו
  - Creamy → שמנת
  - No sauce → ללא רוטב

- ✅ "Spice" → חריפות (with 🌶️ emoji levels)
- ✅ "Smoke" → עישון (with 💨 emoji levels)

**Start Time:**
- ✅ "Start time" → זמן התחלה
  - Now → עכשיו
  - In 1 hour → בעוד שעה
  - In 2 hours → בעוד שעתיים

**Action Button:**
- ✅ "Generate lineup ✨" → צור רצף ✨

### 3. Lineup Step (Step 2)
**Page Title:**
- ✅ "Review and customize your selection" → סקור והתאם את הבחירה שלך

**Labels:**
- ✅ "wines selected" → יינות נבחרו
- ✅ "Serving order optimized" → סדר הגשה אופטימלי

**Actions:**
- ✅ "Swap" → החלף יין
- ✅ "Back" → חזור
- ✅ "Start evening" → התחל ערב

**Swap Modal:**
- ✅ "Swap wine" → החלף יין
- ✅ "Choose an alternative for" → בחר אלטרנטיבה עבור
- ✅ "No alternative wines available" → אין יינות אלטרנטיביים זמינים

### 4. Queue Player (Live Evening)
**Header:**
- ✅ "Your Evening" → הערב שלך
- ✅ "of" → מתוך (for "1 of 3")

**Now Playing:**
- ✅ "Now Pouring" → נוגס עכשיו

**Serving Notes:**
- ✅ "Serving notes:" → הערות הגשה:
- ✅ "Open now and let breathe for 10-15 minutes" → פתח עכשיו ותן לנשום 10-15 דקות
- ✅ "Serve at room temperature (16-18°C)" → הגש בטמפרטורת החדר (16-18°C)
- ✅ "Consider decanting for 30 minutes" → שקול דיקנטציה למשך 30 דקות

**Queue Section:**
- ✅ "Queue" → תור

**Navigation:**
- ✅ "Previous" → קודם
- ✅ "Next" → הבא
- ✅ "Wrap up evening 🎉" → סיים ערב 🎉

### 5. Wrap Up Modal (Completion)
**Header:**
- ✅ "Wrap up the evening" → סיים את הערב
- ✅ "Mark which wines you opened and rate them" → תעד את החוויה שלך

**Form Labels:**
- ✅ "Bottles opened" → נפתחו (כמות)
- ✅ "Your rating (optional)" → דירוג (אופציונלי)

**Actions:**
- ✅ "Save to history" → שמור להיסטוריה
- ✅ "Not now" → ביטול

**Toast Messages:**
- ✅ Success: "Saved! X wines added to history" → "הערב נשמר בהיסטוריה! 🍷"
- ✅ Error: "Failed to save to history" → "שגיאה בשמירת הערב"

## Technical Implementation

### Files Modified

1. **`apps/web/src/i18n/locales/he.json`**
   - Added new `planEvening` section with complete translations
   - Structured hierarchically: input, lineup, queue, wrapUp, swap
   - 50+ translation keys added

2. **`apps/web/src/components/PlanEveningModal.tsx`**
   - Replaced all hardcoded English strings with `t()` calls
   - Added `useTranslation()` to all sub-components (InputStep, LineupStep, SwapPickerModal)
   - Maintained luxury design and functionality

3. **`apps/web/src/components/EveningQueuePlayer.tsx`**
   - Replaced all hardcoded English strings with `t()` calls
   - Added `useTranslation()` to WrapUpModal
   - Updated toast messages to use translations

4. **`apps/web/src/components/TonightsOrbitCinematic.tsx`**
   - Updated "Plan an evening" and "Resume evening" buttons

## Translation Quality

All translations:
- ✅ Use proper Hebrew grammar and syntax
- ✅ Maintain luxury tone and feel
- ✅ Preserve emojis for visual consistency
- ✅ Follow RTL (right-to-left) conventions
- ✅ Use culturally appropriate terminology

## Testing Checklist

Test with Hebrew language selected (`🇮🇱 עברית`):

- [ ] Tonight's Selection: "Plan" and "Resume" buttons in Hebrew
- [ ] Plan Evening Modal: Title, subtitle, all form labels in Hebrew
- [ ] Occasion chips: All 5 options in Hebrew
- [ ] Group size: Numbers display correctly (2-4, 5-8, 9+)
- [ ] Preferences: Checkboxes labeled in Hebrew
- [ ] Food selection: All proteins, sauces in Hebrew
- [ ] Spice/Smoke: Labels in Hebrew (emoji levels unchanged)
- [ ] Start time: All 3 options in Hebrew
- [ ] Generate button: Hebrew text with ✨ emoji
- [ ] Lineup step: All labels, buttons in Hebrew
- [ ] Swap modal: Title and empty state in Hebrew
- [ ] Queue player: All sections (title, now pouring, serving notes, queue) in Hebrew
- [ ] Navigation: Previous/Next/Wrap up buttons in Hebrew
- [ ] Wrap Up modal: Title, subtitle, form labels in Hebrew
- [ ] Toast messages: Success/error in Hebrew

## How to Test

1. Open the app
2. Click language switcher (top right)
3. Select `🇮🇱 עברית`
4. Navigate to "Tonight's Selection" → click "תכנן ערב" (Plan)
5. Go through full flow and verify all text is in Hebrew

## Notes

- All translations use existing common translations where appropriate (e.g., `common.cancel`)
- Food emoji levels (🌶️, 💨) remain language-agnostic
- Numbers and technical terms (4.2, 16-18°C) remain as-is
- Luxury feel preserved with proper Hebrew phrasing

## Deployment

Build passed successfully:
```bash
npm run build
✓ built in 1.63s
```

Ready for production! 🍷
