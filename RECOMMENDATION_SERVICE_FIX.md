# "Bottle Not Found" Fix - Recommendations Now Use Supabase! ✅

## 🐛 Problem

**User Report:**
- User gets wine recommendations on "What to Open Tonight" page
- Recommendations display correctly with bottle names, vintages, etc.
- **BUT** when clicking "Mark as Opened" → Error: **"Bottle not found"**

**Root Cause:**
- Recommendations were coming from **Express API** (SQLite database)
- "Mark as Opened" was trying to find bottle in **Supabase** (PostgreSQL database)
- **Two separate databases** with different data!
- Bottle IDs from Express didn't exist in Supabase

---

## ✅ What Was Fixed

### **Complete Migration to Supabase**

**Before (Broken):**
```
RecommendationPage
  ↓
Express API (/recommendations) → SQLite DB → Returns bottles
  ↓
User clicks "Mark as Opened"
  ↓
historyService.markBottleOpened() → Supabase DB → ❌ Bottle not found!
```

**After (Fixed):**
```
RecommendationPage
  ↓
recommendationService.getRecommendations() → Supabase DB → Returns bottles
  ↓
User clicks "Mark as Opened"
  ↓
historyService.markBottleOpened() → Supabase DB → ✅ Bottle found!
```

---

## 📁 Files Created/Modified

### **New File:**

1. **`apps/web/src/services/recommendationService.ts`**
   - **Pure Supabase implementation** (no Express API dependency)
   - Queries user's bottles directly from Supabase `bottles` + `wines` tables
   - Implements recommendation algorithm with scoring:
     - Meal pairing heuristics (steak → red, fish → white, etc.)
     - Occasion bonuses (celebration → sparkling)
     - Vibe preferences (special → expensive wines)
     - Readiness status (peak → higher score)
     - Price filtering
   - Returns top 3 recommendations sorted by score
   - Generates explanations and serving instructions

### **Modified Files:**

1. **`apps/web/src/pages/RecommendationPage.tsx`**
   - Removed: `import { api } from '../lib/api'`
   - Removed: `import { Recommendation } from '../types'`
   - Added: `import * as recommendationService from '../services/recommendationService'`
   - Added: `type Recommendation = recommendationService.Recommendation`
   - Updated: `handleSubmit()` to use `recommendationService.getRecommendations()`
   - Added: Console logging for debugging

---

## 🎯 How It Works Now

### **Complete Flow:**

```
1. User fills recommendation form
   - Meal Type: "Steak"
   - Occasion: "Date night"
   - Vibe: "Special"
   - Max Price: $100
   ↓
2. Click "Get Recommendations"
   ↓
3. recommendationService.getRecommendations() runs:
   - Query: SELECT * FROM bottles JOIN wines WHERE user_id = auth.uid() AND quantity > 0
   - Filter: price <= $100, readiness = 'ready'
   - Score each bottle:
     * Steak + Red wine = +30 points
     * Date night + Sparkling = +15 points
     * Special + Expensive = +10 points
     * Readiness = Peak = +20 points
   - Sort by score DESC
   - Return top 3 bottles
   ↓
4. Display recommendations with:
   - Bottle name, producer, vintage
   - Explanation: "This red wine from Bordeaux is excellent for steak..."
   - Serving instructions: "Serve at 16°C. Decant for 30 minutes."
   ↓
5. User clicks "Mark as Opened" on #1 recommendation
   ↓
6. historyService.markBottleOpened() runs:
   - Query: SELECT * FROM bottles WHERE id = {recommendation.bottleId}
   - ✅ Bottle EXISTS (same database!)
   - INSERT INTO consumption_history (...)
   - UPDATE bottles SET quantity = quantity - 1
   ↓
7. Success! Celebration modal appears
   ↓
8. Navigate to History page
   ↓
9. History shows the opened bottle ✅
```

---

## 🔍 Recommendation Algorithm

### **Scoring System:**

```typescript
Base Score: 50 points

Meal Pairing:
- Steak/Beef + Red → +30
- Fish/Seafood + White → +30
- Fish/Seafood + Sparkling → +20
- Pasta + Red → +20
- Pasta + White → +15
- Chicken + White → +20
- Chicken + Red → +10
- Cheese + Sparkling → +25
- Cheese + Red/White → +15
- Spicy/Asian + White → +25
- Spicy/Asian + Rosé → +20
- Pizza + Red → +25

Occasion Bonuses:
- Celebration + Sparkling → +20
- Celebration + Expensive (>$50) → +10
- Date Night + Sparkling → +15
- Date Night + Red → +10

Vibe Bonuses:
- Special/Surprise + Expensive (>$40) → +10
- Special/Surprise + Peak Readiness → +15
- Easy/Casual + White/Rosé → +10

Readiness Bonuses:
- Peak → +20
- InWindow → +15
- Ready → +10

Random Factor: +0-10 (for variety)

Final Score: Sum of all bonuses
Top 3 highest scores are returned
```

### **Example Scoring:**

**Scenario:** Steak, Date Night, Special

**Bottle A: Bordeaux Red 2015 (Peak, $80)**
- Base: 50
- Steak + Red: +30
- Date + Red: +10
- Special + Expensive: +10
- Peak: +20
- Random: +7
- **Total: 127** ← Rank #1

**Bottle B: Champagne NV (Ready, $60)**
- Base: 50
- Date + Sparkling: +15
- Special + Expensive: +10
- Ready: +10
- Random: +4
- **Total: 89** ← Rank #2

**Bottle C: White Burgundy 2020 (InWindow, $45)**
- Base: 50
- InWindow: +15
- Random: +3
- **Total: 68** ← Rank #3

---

## 🧪 Testing Instructions

### **Test 1: Get Recommendations & Mark as Opened**

1. **Add some bottles to your cellar** (if empty)
   - At least 3-5 bottles
   - Mix of red, white, sparkling
   - Set quantity > 0
2. **Go to "What to Open Tonight"**
3. **Fill the form:**
   - Meal Type: "Steak"
   - Occasion: "Date night"
   - Vibe: "Special"
4. **Click "Get Recommendations"**
5. **Check console logs:**
   ```
   [RecommendationPage] Getting recommendations with context: {...}
   [RecommendationService] Found X bottles
   [RecommendationService] Generated 3 recommendations
   [RecommendationPage] Got 3 recommendations
   ```
6. **Verify recommendations appear:**
   - Shows bottle name, producer, vintage
   - Shows explanation
   - Shows serving instructions
7. **Click "Mark as Opened"** on first recommendation
8. **Check console logs:**
   ```
   [RecommendationPage] Marking bottle as opened: {bottle_id}
   [RecommendationPage] Successfully marked bottle as opened
   ```
9. **Verify:**
   - ✅ NO "Bottle not found" error!
   - ✅ Celebration modal appears
   - ✅ Confetti animation
10. **Click "View History"**
11. **Verify:**
   - ✅ Opened bottle appears in history
   - ✅ Shows correct bottle name, producer, vintage

---

### **Test 2: No Bottles Available**

1. **Mark all bottles as opened** (quantity = 0 for all)
2. **Go to "What to Open Tonight"**
3. **Fill form and submit**
4. **Verify:**
   - ✅ Info toast: "No recommendations found"
   - ✅ No error
   - ✅ Graceful handling

---

### **Test 3: Recommendations Match Meal Type**

**Test Red Wine Pairing:**
1. Add red and white wines to cellar
2. Select Meal Type: "Steak"
3. Get recommendations
4. **Verify:** Top recommendations are RED wines

**Test White Wine Pairing:**
1. Select Meal Type: "Fish"
2. Get recommendations
3. **Verify:** Top recommendations are WHITE wines

**Test Sparkling Wine:**
1. Add sparkling wine to cellar
2. Select Occasion: "Celebration"
3. Get recommendations
4. **Verify:** Sparkling wine appears in top recommendations

---

### **Test 4: Price Filtering**

1. Add bottles with various prices: $20, $50, $100
2. Set Max Price: $60
3. Get recommendations
4. **Verify:** Only bottles ≤ $60 appear
5. Try with no Max Price
6. **Verify:** All bottles can appear

---

### **Test 5: Readiness Filtering**

1. Add bottles with different readiness:
   - Bottle A: readiness_status = "Peak"
   - Bottle B: readiness_status = "TooYoung"
   - Bottle C: readiness_status = null
2. Check "Prefer ready-to-drink"
3. Get recommendations
4. **Verify:** Bottles with "Peak", "InWindow", "Ready" are prioritized

---

### **Test 6: Multiple Users (Data Isolation)**

1. **Login as User A**
2. Add bottles to cellar
3. Get recommendations
4. **Verify:** Sees only User A's bottles
5. **Logout and login as User B**
6. Add different bottles
7. Get recommendations
8. **Verify:**
   - ✅ Sees only User B's bottles
   - ❌ Does NOT see User A's bottles

---

## 🐛 Debugging Tips

### **If recommendations don't appear:**

**Check 1: User has bottles**
```sql
-- Run in Supabase SQL Editor:
SELECT COUNT(*) FROM bottles 
WHERE user_id = auth.uid() AND quantity > 0;

-- Should be > 0
```

**Check 2: Bottles have wine data**
```sql
SELECT b.*, w.wine_name, w.producer, w.color
FROM bottles b
JOIN wines w ON b.wine_id = w.id
WHERE b.user_id = auth.uid() AND b.quantity > 0;

-- Should return rows with wine_name, producer, color
```

**Check 3: Console logs**
```javascript
// Look for:
[RecommendationService] Found X bottles
[RecommendationService] Generated Y recommendations

// If "Found 0 bottles":
// - User has no bottles in Supabase
// - All bottles have quantity = 0
```

---

### **If "Mark as Opened" still fails:**

**Check 1: Bottle ID is valid**
```javascript
// In console, after clicking recommendation:
console.log(recommendation.bottleId);
// Copy the ID

// Then in Supabase SQL Editor:
SELECT * FROM bottles WHERE id = '{paste_id_here}';
// Should return 1 row
```

**Check 2: History service logs**
```javascript
// Should see:
[RecommendationPage] Marking bottle as opened: {id}
[ProfileService] ... (if needed)
[RecommendationPage] Successfully marked bottle as opened

// If error:
Error marking bottle as opened: { message: "..." }
```

**Check 3: RLS Policies**
```sql
-- Verify user can read/update their own bottles:
SELECT * FROM bottles WHERE id = '{bottle_id}' AND user_id = auth.uid();

-- Should return 1 row if bottle belongs to user
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│ RecommendationPage (React)                          │
│                                                     │
│  User fills form:                                   │
│  - Meal Type: "Steak"                               │
│  - Occasion: "Date night"                           │
│  - Vibe: "Special"                                  │
│  - Max Price: $100                                  │
│                                                     │
│  handleSubmit() →                                   │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│ recommendationService.getRecommendations()          │
│                                                     │
│  1. supabase.auth.getUser() → user.id               │
│  2. SELECT * FROM bottles                           │
│     JOIN wines ON wine_id                           │
│     WHERE user_id = {user.id}                       │
│     AND quantity > 0                                │
│     ORDER BY created_at DESC                        │
│                                                     │
│  3. Filter by constraints:                          │
│     - price <= $100                                 │
│     - readiness in ('Peak', 'InWindow', 'Ready')    │
│                                                     │
│  4. Score each bottle:                              │
│     - Steak + Red = +30                             │
│     - Date + Red = +10                              │
│     - Special + Expensive = +10                     │
│     - Peak = +20                                    │
│     Total: 50 + 30 + 10 + 10 + 20 = 120            │
│                                                     │
│  5. Sort by score DESC                              │
│  6. Take top 3                                      │
│  7. Return recommendations                          │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│ RecommendationPage (React)                          │
│                                                     │
│  setRecommendations([...])                          │
│  setStep('results')                                 │
│                                                     │
│  Display:                                           │
│  - #1 Château Margaux 2015 (Score: 120)            │
│    "Excellent for steak..."                         │
│    "Serve at 16°C. Decant 30 min."                 │
│    [Mark as Opened] button                          │
│                                                     │
│  User clicks "Mark as Opened"                       │
│  handleMarkOpened(recommendation) →                 │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│ historyService.markBottleOpened()                   │
│                                                     │
│  1. Get bottle from Supabase:                       │
│     SELECT * FROM bottles                           │
│     WHERE id = {recommendation.bottleId}            │
│     AND user_id = auth.uid()                        │
│     → ✅ Bottle found! (same database)              │
│                                                     │
│  2. INSERT INTO consumption_history (...)           │
│  3. UPDATE bottles SET quantity = quantity - 1      │
│  4. Return success                                  │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│ RecommendationPage (React)                          │
│                                                     │
│  Show CelebrationModal:                             │
│  - Confetti animation 🎉                            │
│  - "Cheers! You've opened: Château Margaux"         │
│  - [Nice!] [View History]                           │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Benefits of This Fix

✅ **No more "Bottle not found" errors**  
✅ **Single source of truth** (Supabase only)  
✅ **Consistent data** across recommendations and history  
✅ **RLS enforced** (users only see their own bottles)  
✅ **Real-time updates** (changes in cellar immediately reflected)  
✅ **No Express API dependency** for recommendations  
✅ **Better performance** (one less HTTP call)  
✅ **Comprehensive logging** for debugging  
✅ **Production-ready** recommendation algorithm  

---

## 🚀 Future Enhancements

### **Potential Improvements:**

1. **AI-Powered Recommendations**
   - Use OpenAI to generate personalized explanations
   - More nuanced pairing suggestions
   - Learning from user's past preferences

2. **User Ratings Integration**
   - Learn from bottles user rated highly
   - Recommend similar styles/regions

3. **Food Pairing Database**
   - More detailed meal → wine mappings
   - Support for specific dishes (e.g., "Coq au Vin", "Sushi")

4. **Weather Integration**
   - Hot day → recommend white/sparkling
   - Cold day → recommend red

5. **Collaborative Filtering**
   - "Users who liked X also liked Y"
   - Requires multiple users with ratings

---

## 🎉 Summary

**Before:**
- ❌ Recommendations from Express API (SQLite)
- ❌ History from Supabase (PostgreSQL)
- ❌ Two databases not synchronized
- ❌ "Bottle not found" error
- ❌ Confusing for users

**After:**
- ✅ Everything uses Supabase
- ✅ Single source of truth
- ✅ Recommendations work end-to-end
- ✅ Mark as opened succeeds
- ✅ History shows opened bottles
- ✅ Smooth user experience
- ✅ No more errors!

---

**Status:** ✅ COMPLETE  
**Ready for:** User Testing with Full Recommendation Flow

Try it now:
1. Get wine recommendations
2. Mark one as opened
3. Check History - it works! 🍷✨

