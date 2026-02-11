# Drink Window Consistency Fix

## Problem Statement

Users reported inconsistent drink window classifications across vintages:
- **2020 vintage** marked "READY"
- **2018 vintage** marked "HOLD" (for the same wine)

This is illogical since older wines should generally be more mature/ready than younger ones.

## Root Causes Identified

1. **No vintage consistency validation** - System allowed older vintages to be less ready than younger ones
2. **AI inconsistency** - ChatGPT can give different classifications for similar wines without constraints
3. **Caching issues** - Old analyses computed when wine was younger (2-3 years old → HOLD) were never invalidated
4. **No explainability** - Users couldn't understand WHY a wine was classified a certain way
5. **Different code paths** - Deterministic fallback vs AI analysis used different logic

## Solution Implemented

### 1. **New Drink Window Service** (`drinkWindowService.ts`)

Centralized, deterministic, and explainable drink window computation.

**Key Features:**
- ✅ **Monotonic vintage behavior** - Older vintages never less ready than younger
- ✅ **Profile-based aging potential** - Uses wine_profile (body/tannin/oak) to estimate aging potential
- ✅ **Clear thresholds** - Explicit age thresholds for each wine type
- ✅ **Explainability** - Returns 3-5 clear reasons for each classification
- ✅ **Confidence scoring** - LOW/MEDIUM/HIGH based on data quality
- ✅ **Version tracking** - `DRINK_WINDOW_VERSION = 2` for cache invalidation

**Logic Flow:**
```typescript
// Red wine example with profile-based aging potential
if (age < youngThreshold) → HOLD
  - Low potential: < 2 years
  - Medium potential: < 3 years
  - High potential: < 5 years

if (age < primeEnd) → READY
  - Low potential: 2-8 years
  - Medium potential: 3-12 years  
  - High potential: 5-20 years

if (age > primeEnd) → READY (drink soon)
  - Confidence decreases with age
```

**Why This Works:**
- Same logic applied consistently to all wines
- Aging potential estimated from structure (tannin + body + oak)
- Clear, explainable reasons for each decision
- No more AI inconsistencies

### 2. **Vintage Consistency Validation**

Function: `validateVintageConsistency()`

**Checks for:**
- Older vintage = HOLD + Younger vintage = READY → ⚠️ **VIOLATION**

**Example Detection:**
```
⚠️ Vintage inversion detected:
  Wine: Château Example Bordeaux
  2018 (8y old): HOLD ← WRONG
  2020 (6y old): READY
  
  Suggestion: Older vintage should be at least as ready
```

### 3. **Updated AI Analysis Service**

**Changes:**
- ✅ Uses new `drinkWindowService` for deterministic fallback
- ✅ Adds `validateDrinkWindowConsistency()` function
- ✅ Consistent logic between AI and fallback paths
- ✅ Comprehensive logging for debugging

**Before:**
```typescript
// Inline logic with hardcoded thresholds
if (age < 3) readinessLabel = 'HOLD';
else if (age < 8) readinessLabel = 'READY';
// ... no explanations, no validation
```

**After:**
```typescript
// Uses centralized service with explainability
const drinkWindow = drinkWindowService.computeDrinkWindow(bottle, {
  language,
  includeDebug: true,
});
// Returns: status, reasons, confidence, window
```

### 4. **Explainability UI** (Already Existed!)

The `SommelierNotes` component already had a "Why?" expandable section.

**Shows:**
- ✅ 3-5 bullet points explaining the classification
- ✅ Confidence badge (LOW/MEDIUM/HIGH)
- ✅ Assumptions if confidence is low
- ✅ Analysis date for cache awareness

**Example Reasons for 2018 Bordeaux (8 years old):**
- ✓ "8 years old - entering drinking window"
- ✓ "Tannins have softened"
- ✓ "Fruit and structure in balance"
- ✓ "Estimated high aging potential"
- ✓ "From Bordeaux"
- ✓ "Grapes: Cabernet Sauvignon, Merlot"

### 5. **Dev Debug Tool** (`DrinkWindowDebugPanel.tsx`)

**Features:**
- 🔧 Groups wines by producer + name
- 📊 Shows all vintages with their status
- ⚠️ Highlights vintage inconsistencies
- 🔄 Recompute button for specific wines
- 🔍 Validate entire cellar button
- 📅 Shows age, window, and confidence for each

**Access:**
- DEV environments only (`isDevEnvironment()`)
- Floating 🔧 button in bottom-right corner

**Workflow:**
1. Click 🔧 button
2. Click "🔍 Validate Consistency"
3. See list of wines with issues (if any)
4. Click "🔄 Recompute" on specific wine
5. Re-validate to confirm fix

### 6. **Comprehensive Logging**

Added detailed logging at every step:

```typescript
[DrinkWindow] Computing: {
  wine_name: "Château Example",
  producer: "Example Estate",
  vintage: 2018,
  age: 8,
  color: "red",
  currentYear: 2026
}

[DrinkWindow] Result: {
  readiness: "READY",
  confidence: "HIGH",
  reasons: [...]
}

[DrinkWindow] Vintage inversion detected: {
  wine: "Château Example",
  older: 2018,
  olderStatus: "HOLD",
  younger: 2020,
  youngerStatus: "READY"
}
```

## Testing & Validation

### Test Cases

#### ✅ Same Wine, Different Vintages
```
Wine: Example Red Bordeaux
- 2015 (11y): READY (HIGH) - "At peak maturity"
- 2018 (8y): READY (HIGH) - "Entering drinking window"  
- 2020 (6y): READY (MEDIUM) - "Developing nicely"
- 2022 (4y): HOLD (MEDIUM) - "Still young, hold 1-2 years"

✓ Monotonic: older vintages are at least as ready
✓ Consistent: all use same aging potential estimate
✓ Explainable: clear reasons for each
```

#### ✅ Light vs Heavy Reds
```
Beaujolais Nouveau (light, low tannin):
- 2y old: READY (drink within 2 years)
- 5y old: READY (drink soon, may be fading)

Barolo (heavy, high tannin, high oak):
- 2y old: HOLD (needs 3+ years)
- 8y old: READY (entering prime)
- 15y old: READY (at peak)
```

#### ✅ Validation Detection
```
Before Fix:
  2018: HOLD (cached from when it was 2y old)
  2020: READY (freshly analyzed)
  
After Running validateDrinkWindowConsistency():
  ⚠️ Issue detected: "2018 is HOLD but 2020 is READY"
  
After Recompute:
  2018: READY (8y old, correct)
  2020: READY (6y old, correct)
  ✓ Consistent!
```

### Manual Testing Steps

1. **Find affected wines:**
   ```
   1. Open dev panel (🔧 button)
   2. Click "Validate Consistency"
   3. Look for red-highlighted wines
   ```

2. **Inspect details:**
   ```
   - Check each vintage's age, status, confidence
   - Verify reasons make sense
   - Compare older vs younger vintages
   ```

3. **Fix inconsistencies:**
   ```
   1. Click "Recompute" on affected wine
   2. Wait for analysis to complete
   3. Re-validate to confirm fix
   ```

4. **Verify in UI:**
   ```
   - Open bottle card
   - Expand "Why?" section
   - Confirm reasons are logical
   - Check confidence badge
   ```

## Edge Cases Handled

### Invalid/Missing Vintage
```typescript
if (!vintage || vintage < 1900 || vintage > currentYear + 1) {
  return fallbackResult({
    readiness: 'READY',
    confidence: 'LOW',
    reasons: ['Invalid vintage', 'Defaulting to Ready', 'Manual verification recommended']
  });
}
```

### Missing Wine Profile
```typescript
// Falls back to medium aging potential
const agingPotential = profile 
  ? estimateAgingPotential(profile)
  : 'medium';
```

### Very Old Wines (15+ years)
```typescript
// Confidence decreases with age
if (age >= matureThreshold) {
  return {
    readiness: 'READY',
    confidence: 'LOW',
    reasons: ['Very mature', 'Drink promptly', 'Quality depends on storage'],
    assumptions: 'Uncertain without recent tasting notes'
  };
}
```

### White vs Red Logic
```typescript
// Different thresholds per wine type
if (wineType === 'white') {
  // Shorter aging window (0-5 years typically)
} else if (wineType === 'red') {
  // Longer aging window (2-20+ years based on profile)
}
```

## Deployment Notes

### Files Changed
1. ✅ **NEW:** `apps/web/src/services/drinkWindowService.ts` (600 lines)
2. ✅ **UPDATED:** `apps/web/src/services/aiAnalysisService.ts`
3. ✅ **NEW:** `apps/web/src/components/DrinkWindowDebugPanel.tsx`
4. ✅ **UPDATED:** `apps/web/src/pages/CellarPage.tsx` (added debug panel)

### No Breaking Changes
- ✅ Existing analyses continue to work
- ✅ Same database schema
- ✅ Same API interface
- ✅ Backward compatible

### Recommended Actions Post-Deployment

1. **Run consistency validation:**
   ```
   Open dev panel → Validate Consistency
   ```

2. **Fix identified issues:**
   ```
   For each wine with issues → Click Recompute
   ```

3. **Optional: Bulk recompute stale analyses:**
   ```typescript
   // In admin panel or script
   await analyzeCellarInBatches('all', { limit: 1000 });
   ```

4. **Monitor logs:**
   ```
   Search for: "[DrinkWindow] Vintage inversion detected"
   ```

## Future Enhancements

### Already Supported (in code)
- ✅ Wine profile-based aging potential
- ✅ Multilingual reasons (English + Hebrew)
- ✅ Version tracking for cache invalidation
- ✅ Debug info in results

### Nice to Have
- 🔮 Auto-fix inconsistencies (currently manual)
- 🔮 Batch validation API endpoint
- 🔮 Admin dashboard for monitoring
- 🔮 Historical analysis tracking (before/after recompute)
- 🔮 Regional aging curves (Bordeaux vs Burgundy vs Barolo)
- 🔮 Producer-specific adjustments (First Growth gets longer window)

## Performance Impact

- ✅ No additional database queries
- ✅ Computation is O(1) per wine
- ✅ Validation is O(n) but done on-demand
- ✅ Debug panel only loads in DEV

## Commit Message

```
Fix drink window consistency across vintages + add explainability

Problem: 2018 marked HOLD while 2020 marked READY for same wine (illogical)

Root causes:
- No vintage consistency validation
- AI inconsistency without constraints  
- Stale cached results from when wine was younger
- Different logic paths (AI vs fallback)

Solution:
- New drinkWindowService with deterministic, explainable logic
- Profile-based aging potential estimation (tannin + body + oak)
- Vintage consistency validation (older ≥ younger readiness)
- Clear reasons (3-5 bullets) for every classification
- Confidence scoring (LOW/MEDIUM/HIGH)
- Dev debug tool to identify and fix issues

Benefits:
- Monotonic vintage behavior (older never less ready than younger)
- Explainable to users (shows "why")
- Debuggable by devs (validation + recompute tools)
- Consistent across all analysis paths

Files:
- NEW: drinkWindowService.ts (deterministic logic)
- NEW: DrinkWindowDebugPanel.tsx (dev tool)
- UPDATED: aiAnalysisService.ts (uses new service)
- UPDATED: CellarPage.tsx (adds debug panel)
```

## Acceptance Criteria

✅ **For the reported 2018/2020 case:**
- 2018 (older) should NOT be HOLD if 2020 (younger) is READY
- After recompute, both should have consistent, logical status
- Reasons should explain the classification

✅ **For all wines:**
- Older vintages ≥ younger vintages in readiness
- Every classification has 3-5 clear reasons
- Confidence badge shows data quality
- Dev tool can detect and fix issues

✅ **No regressions:**
- Tonight's Selection still works
- Plan an Evening still works  
- Cellar filtering still works
- Existing analyses still display

## Support & Debugging

### User Reports Issue
1. Open dev panel (if in DEV env)
2. Validate consistency
3. Check if wine is flagged
4. Recompute affected wines
5. Provide before/after screenshots

### Check Logs
```bash
# Look for inversions
grep "Vintage inversion detected" logs

# Check computation details
grep "\[DrinkWindow\] Computing:" logs
grep "\[DrinkWindow\] Result:" logs
```

### Manual Recompute
```typescript
// In browser console (DEV)
import { generateAIAnalysis } from './services/aiAnalysisService';
await generateAIAnalysis(bottle);
```
