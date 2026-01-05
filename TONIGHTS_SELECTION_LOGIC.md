# Tonight's Selection - Logic & Algorithm

## 📋 Overview

**Tonight's Selection** is a smart recommendation widget that suggests the **top 3 bottles** from your cellar for tonight's drinking.

---

## 🎯 Selection Criteria (How It Works)

The algorithm scores each bottle based on multiple factors, then shows the **top 3 highest-scoring bottles**.

### 1. **Availability Filter** ✅ (NEW)
**Before scoring**, bottles are filtered to ensure they're actually in your cellar:
- ✅ Bottles with `quantity > 0` → Included
- ❌ Bottles with `quantity = 0` → **Excluded** (already opened/consumed)

### 2. **Readiness Status** (Primary Factor)
The most important factor - when the wine is best to drink:

| Status | Score | Meaning |
|--------|-------|---------|
| **READY** | +100 points | Wine is in its optimal drinking window |
| **PEAK_SOON** | +50 points | Wine approaching its optimal window |
| **HOLD** | +10 points | Wine needs more aging |
| **Unknown** | 0 points | Not analyzed yet |

### 3. **Quantity Bonus** (Secondary Factor)
Prioritizes bottles you have more of:
- **Formula**: `quantity × 5` (max +25 points)
- **Rationale**: More bottles = less worry about "saving it for a special occasion"

**Examples:**
- 1 bottle = +5 points
- 3 bottles = +15 points
- 5+ bottles = +25 points (capped)

### 4. **Variety Randomness** (Tertiary Factor)
Adds slight randomness for variety:
- **+0 to +10 random points** each time
- **Rationale**: Prevents the same 3 bottles from always appearing

---

## 📊 Scoring Example

Let's say you have these bottles:

| Bottle | Readiness | Quantity | Base Score | Quantity Bonus | Random | **Total** |
|--------|-----------|----------|------------|----------------|--------|-----------|
| **Bottle A** | READY | 2 | 100 | +10 | +7 | **117** ⭐ |
| **Bottle B** | PEAK_SOON | 5 | 50 | +25 | +3 | **78** |
| **Bottle C** | READY | 1 | 100 | +5 | +2 | **107** ⭐ |
| **Bottle D** | HOLD | 3 | 10 | +15 | +9 | **34** |
| **Bottle E** | PEAK_SOON | 2 | 50 | +10 | +8 | **68** ⭐ |
| **Bottle F** | READY | 0 | ❌ **Excluded** (quantity = 0) | - | - | - |

**Result**: Tonight's Selection shows **A, C, E** (top 3 scores)

---

## 🔄 When Does It Update?

The selection recalculates:
1. **When you open/reload the Cellar page**
2. **When you filter bottles** (by color, readiness, etc.)
3. **When you search** for bottles

---

## 🎨 What It Shows

For each of the top 3 bottles, you see:
- 🍷 **Wine name** and **producer**
- 📅 **Vintage**
- 🏷️ **Color badge** (Red, White, Rosé, Sparkling)
- 📍 **Region**
- 🎯 **Readiness status** with color-coded badge:
  - 🟢 Green = Ready / Peak
  - 🟡 Yellow = Peak Soon / Approaching
  - 🔵 Blue = Hold / Too Young
  - ⚪ Gray = Unknown
- 💰 **Purchase price** (if recorded)
- 📦 **Quantity** in your cellar

---

## 🔧 Recent Fix (Dec 29, 2025)

### Problem
Bottles that were already opened (quantity = 0) were still appearing in Tonight's Selection.

### Solution
Added a filter at the beginning of the scoring algorithm:
```typescript
const availableBottles = bottles.filter(bottle => bottle.quantity > 0);
```

Now **only bottles you actually have** in your cellar are considered.

---

## 🚀 Future Enhancements (Ideas)

Potential improvements to the algorithm:
1. **User preferences**: Learn from your history (wines you rate highly)
2. **Seasonal recommendations**: Lighter wines in summer, fuller in winter
3. **Food pairing**: Suggest wines based on your meal plans
4. **Age tracking**: Prioritize bottles approaching their peak drinking window
5. **Price consciousness**: Balance expensive vs. everyday bottles
6. **Occasion awareness**: Weekend vs. weeknight suggestions

---

## 🧪 Testing the Feature

To verify it works correctly:

1. **Add bottles to your cellar** with different readiness statuses
2. **Check Tonight's Selection** - should show top 3
3. **Mark one as opened** (quantity → 0)
4. **Refresh the page** - that bottle should **disappear** from Tonight's Selection ✅
5. **Filter by "Ready to Drink"** - Tonight's Selection adjusts accordingly

---

## 📝 Related Code Files

- **Component**: `apps/web/src/components/TonightsOrbit.tsx`
- **Parent Page**: `apps/web/src/pages/CellarPage.tsx`
- **Bottle Service**: `apps/web/src/services/bottleService.ts`

---

## ❓ FAQ

**Q: Why are the same 3 bottles always shown?**  
A: If those are your highest-scoring bottles, they'll appear consistently. Add more bottles or mark them as analyzed to improve variety.

**Q: Why don't I see any Tonight's Selection?**  
A: You need at least 1 bottle with `quantity > 0`. If all bottles are opened, nothing will show.

**Q: Can I customize the recommendations?**  
A: Not yet! But we can add user preferences in a future update.

**Q: Why is a "HOLD" bottle recommended?**  
A: If you don't have any "READY" or "PEAK_SOON" bottles, the algorithm will show "HOLD" bottles as the next best option.

---

**Last Updated**: December 29, 2025  
**Status**: ✅ Deployed to Production



