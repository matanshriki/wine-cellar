# Drink Window Modal Enhancements

**Date**: Jan 31, 2026  
**Status**: ✅ Deployed to Production  
**Commit**: `37f59d3`

---

## 🎯 Overview

Comprehensive enhancements to the Drink Window Timeline modal, transforming it from a static visualization into an actionable insights tool with momentum tracking and intelligent recommendations.

---

## ✨ New Features

### 1. **Actionable Buckets** - Click to Filter

**What**: Each bucket row (Hold, Peak Soon, Ready Now) is now fully clickable.

**Behavior**:
- Click any bucket → Navigate to cellar with that readiness filter applied
- Automatic sorting by rating (highest first)
- Visual affordances:
  - Subtle chevron icon on the right (low opacity, increases on hover)
  - Hover/tap state with slight background highlight
  - Press-down micro-interaction (scale 0.99)

**Technical**:
- Uses URL parameters: `?readiness=READY&sort=rating`
- CellarPage automatically applies filters on mount
- Clean URL after 100ms (improves UX)

---

### 2. **Momentum Deltas** - Track Changes Over Time

**What**: Shows how bucket counts have changed over the last ~30 days.

**Examples**:
- "Ready Now 27 (+2 this month)"
- "Hold 15 (-3 this month)"

**Behavior**:
- Deltas only shown if difference ≠ 0
- Positive deltas in green, negative in red (subtle tones)
- Snapshots saved daily to localStorage
- 90-day retention policy

**Technical**:
- `drinkWindowInsights.ts` module handles snapshot logic
- Daily snapshot: `{ date: 'YYYY-MM-DD', HOLD: 5, PEAK_SOON: 10, READY: 27 }`
- Compares current counts to snapshot from ~30 days ago
- LocalStorage key: `drinkWindowSnapshots`

---

### 3. **Tonight Signal** - Highlight Premium Ready Wines

**What**: Shows count of highly-rated wines that are ready to drink.

**Display**: 
```
✨ 12 wines are perfect for tonight
```

**Behavior**:
- Only shown if count > 0
- Clickable → Navigates to cellar with filters:
  - Readiness: READY
  - Rating: ≥ 4.2 (default threshold)
  - Sort: Rating (highest first)

**Logic**:
```typescript
tonightSignal = readyWines.filter(wine => wine.rating >= 4.2)
```

---

### 4. **Enhanced Bar Animations** - Smooth Fill on Open

**What**: Progress bars animate from 0% to their target percentage when modal opens.

**Behavior**:
- Smooth easing with staggered delays (0.1s per bar)
- Duration: 0.8s per bar
- Respects `prefers-reduced-motion` (instant/minimal fade)

**Technical**:
- Uses existing `framer-motion` animations
- `shouldReduceMotion()` utility for accessibility
- Same premium easing as rest of app: `[0.4, 0, 0.2, 1]`

---

## 📐 Design Philosophy

**Luxury & Understated**:
- No heavy button chrome - buckets look elegant, not "buttony"
- Chevron indicators subtle (40% opacity by default)
- Muted delta colors (no harsh red/green)
- Tonight Signal with sparkle icon (✨) but understated

**Consistent**:
- Reuses existing animation utilities
- Same colors, shadows, borders as rest of app
- Matches typography and spacing system

**Accessible**:
- Keyboard navigable (tab + enter)
- Focus rings on interactive elements
- ARIA labels for screen readers
- Reduced motion support

---

## 🔧 Technical Implementation

### New Files

1. **`apps/web/src/utils/drinkWindowInsights.ts`**
   - Helper module for bucket logic
   - Snapshot management (save, load, compare)
   - Tonight signal computation
   - Exports: `getBucketInsights()`, `computeTonightSignal()`, `saveSnapshot()`

### Modified Files

2. **`apps/web/src/components/DrinkWindowTimeline.tsx`**
   - Added clickable bucket rows with `onClick` handlers
   - Integrated momentum deltas display
   - Added Tonight Signal section
   - Bar animations triggered by `isVisible` state
   - Navigation using `useNavigate()` with URL params

3. **`apps/web/src/pages/CellarPage.tsx`**
   - Added `useLocation()` hook
   - New `useEffect` to handle URL parameters:
     - `readiness`: Maps to filter (READY → 'ready', etc.)
     - `rating`: Stores as search query (`rating:4.2`)
     - `sort`: Sets sortBy to 'rating'
   - Enhanced filter logic to support `readiness_label` field
   - Added rating filter logic before sorting

4. **Translation Files**
   - `apps/web/src/i18n/locales/en.json`:
     - `dashboard.drinkWindow.thisMonth`: "this month"
     - `dashboard.drinkWindow.tonightSignal`: "{{count}} wine is perfect..."
     - `dashboard.drinkWindow.tonightSignal_plural`: "{{count}} wines are perfect..."
   - `apps/web/src/i18n/locales/he.json`:
     - Hebrew translations for all new strings

---

## 🎨 UI/UX Details

### Clickable Bucket Rows

**Visual States**:
- **Default**: Transparent background, subtle chevron (40% opacity)
- **Hover**: Light background (`rgba(0, 0, 0, 0.02)`), chevron more visible
- **Tap**: Scale 0.99, subtle press-down effect

**Layout**:
```
⏳ Hold              15  →
     (+2 this month)

⚡ Peak Soon         10  →
     (-1 this month)

✨ Ready Now         27  →
     (+2 this month)
```

### Tonight Signal

**Styling**:
- Bordered top: `1px solid var(--border-subtle)`
- Flex layout with sparkle icon
- Muted primary text color
- Chevron on right (40% opacity)
- Hover state: light background

**Position**: Below bucket list, above "Total analyzed" footer

---

## 📊 Snapshot Mechanism

### Storage Format
```typescript
interface Snapshot {
  date: string; // ISO date (YYYY-MM-DD)
  HOLD: number;
  PEAK_SOON: number;
  READY: number;
}
```

### Lifecycle
1. **Save**: On modal mount, if no snapshot today
2. **Compare**: Find snapshot closest to 30 days ago
3. **Calculate**: `currentCount - oldCount`
4. **Display**: Only if delta ≠ 0
5. **Cleanup**: Keep only last 90 days

### LocalStorage
- Key: `drinkWindowSnapshots`
- Value: Array of snapshots (JSON)
- Max size: ~2KB for 90 days of data

---

## 🧪 Testing Checklist

### Actionable Buckets
- [x] Click "Hold" → Navigate to cellar with Hold filter
- [x] Click "Peak Soon" → Navigate to cellar with Peak Soon filter
- [x] Click "Ready Now" → Navigate to cellar with Ready filter
- [x] Bottles correctly filtered on navigation
- [x] Sorting by rating works
- [x] Hover/tap states visible
- [x] Chevron icons appear

### Momentum Deltas
- [x] Deltas show after 30 days of snapshots
- [x] Positive deltas in green
- [x] Negative deltas in red
- [x] Deltas hidden if difference = 0
- [x] Snapshots saved once per day
- [x] Old snapshots cleaned up (90 day retention)

### Tonight Signal
- [x] Shows count of ready wines with rating ≥ 4.2
- [x] Click navigates with ready + rating filters
- [x] Hidden when count = 0
- [x] Sparkle icon visible
- [x] Hover state works

### Animations
- [x] Bars animate on modal open
- [x] Staggered delays per bar
- [x] Smooth easing
- [x] Respects reduced motion

### Mobile
- [x] Touch targets ≥ 44px
- [x] Tap states work
- [x] No horizontal scroll
- [x] Safe area respected

---

## 📱 User Flows

### Flow 1: Quick Filter by Readiness
1. User opens Cellar page
2. Sees "Drink Window" card
3. Clicks "Ready Now" row
4. **Result**: Cellar filtered to show only Ready wines, sorted by rating

### Flow 2: Find Tonight's Wine
1. User sees "✨ 12 wines are perfect for tonight"
2. Clicks tonight signal
3. **Result**: Cellar filtered to Ready wines with rating ≥ 4.2, sorted by rating
4. User picks highest rated wine

### Flow 3: Track Progress Over Time
1. User checks Drink Window weekly
2. Sees "Hold 15 (-3 this month)"
3. **Insight**: User is drinking their aging wines (good cellar management!)

---

## 🚀 Deployment

**Status**: ✅ Successfully deployed to production

**Commit**: `37f59d3`  
**Files Changed**: 5 files (+518, -97 lines)  
**Branch**: `main → origin/main`

**Vercel**: Automatic deployment triggered  
**Users**: Will see enhancements on next page load

---

## 🎯 Success Metrics

**Engagement**:
- % of users who click Drink Window buckets
- Navigation from Tonight Signal
- Time to filter → select wine (should decrease)

**Value**:
- Users understand cellar composition faster
- Momentum deltas help track collection health
- Tonight Signal reduces decision fatigue

---

## 🔮 Future Enhancements

**Potential**:
- [ ] Custom rating threshold (user setting)
- [ ] "Last month" vs "This month" toggle
- [ ] Export snapshot data
- [ ] Trend visualization (line chart)
- [ ] Smart alerts ("5 wines entering peak window this month!")

---

## ✅ Summary

Transformed Drink Window from static visualization → actionable insights tool:
- **Actionable**: Click to filter cellar instantly
- **Momentum**: Track changes over time
- **Tonight Signal**: Smart recommendations for high-rated ready wines
- **Animated**: Smooth, premium bar animations
- **Accessible**: Keyboard nav, reduced motion, ARIA labels

All while maintaining the luxury design and reusing the existing animation/style system. Zero new libraries added.

**Result**: Users can now act on their cellar insights in 1 click, track collection health over time, and get smart recommendations for tonight's wine.
