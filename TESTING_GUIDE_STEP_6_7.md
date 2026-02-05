# Wine Profile Feature - Testing Guide

## ✅ Step 6: Verify Backfill Results

Great! The backfill completed. Here's what to verify:

### Check Profile Coverage

1. **Go to Supabase Dashboard → SQL Editor**
2. **Run these queries** to verify:

```sql
-- Total wines vs wines with profiles
SELECT 
  COUNT(*) as total_wines,
  COUNT(wine_profile) as wines_with_profiles,
  COUNT(*) - COUNT(wine_profile) as wines_without_profiles
FROM wines;
```

**Expected result:**
- `total_wines`: 54 (or close to it)
- `wines_with_profiles`: 54 (all should have profiles now)
- `wines_without_profiles`: 0

### Understand the 54 vs 44 Discrepancy

```sql
-- Total bottles (sum of quantities) vs unique wines
SELECT 
  COUNT(*) as unique_wines,
  SUM(quantity) as total_bottles,
  COUNT(CASE WHEN quantity = 0 THEN 1 END) as wines_with_zero_bottles
FROM wines;
```

This should explain why:
- **54 unique wines** in the database (each needs its own profile)
- **44 total bottles** across those wines (the sum of all quantities)
- Some wines might have `quantity = 0` (opened/finished but record remains)

**This is normal and correct!** The backfill should process all wine records, not just wines with bottles in stock.

---

## ✅ Step 7: Test Food-Aware "Plan an Evening"

Now the fun part! Let's test the new food-aware planning feature.

### Test 1: Beef with Rich Sauce (Bold Wines)

1. **Go to**: https://wine-cellar-brain.vercel.app/cellar

2. **Click**: "Plan" button in Tonight's Selection card

3. **Configure the evening**:
   - **Occasion**: Friends
   - **Group size**: 4
   - **Food selections**:
     - Protein: **Beef**
     - Sauce: **Rich & savory**
     - Spice level: **Mild**
     - Smoke/char: **None**
   - **Preferences**:
     - Reds only: **ON** ✓
     - Rating >= 4.2: **ON** ✓
   - **Start time**: Now

4. **Click**: "Generate Lineup"

5. **Verify the results**:
   - ✅ Should show 4 wines (for 4 people)
   - ✅ Wines should be ordered from **light to powerful**
   - ✅ First wine should be lighter (lower power score)
   - ✅ Last wine should be boldest (higher power score)
   - ✅ Each wine should have a **pairing explanation** like:
     - "Bold pairing - stands up to hearty flavors"
     - "Powerful match - tannins cut through rich meat"
   - ✅ Higher body and tannin wines should be prioritized

6. **Check the console**:
   ```
   [PlanEvening] Generating lineup...
   [PlanEvening] Selected wines ordered by power...
   ```

---

### Test 2: Seafood with Light Sauce (Fresh Wines)

1. **Start a new plan**: Click "Plan" again

2. **Configure**:
   - Group size: **2**
   - Food selections:
     - Protein: **Fish**
     - Sauce: **Light**
     - Spice level: **Mild**
     - Smoke/char: **None**
   - Preferences:
     - Reds only: **OFF** ✗ (to allow whites)
     - Rating >= 4.2: **ON** ✓

3. **Generate Lineup**

4. **Verify**:
   - ✅ Should show 3 wines (for 2 people)
   - ✅ **White wines or lighter reds** should be prioritized
   - ✅ Wines with **higher acidity** should score higher
   - ✅ Lower power scores overall
   - ✅ Pairing explanations mention:
     - "Crisp and refreshing with seafood"
     - "Bright acidity complements..."

---

### Test 3: Spicy Vegetarian (Gentle Wines)

1. **Start a new plan**

2. **Configure**:
   - Group size: **3**
   - Food selections:
     - Protein: **Vegetarian**
     - Sauce: **Tomato-based**
     - Spice level: **Spicy**
     - Smoke/char: **None**
   - Preferences:
     - Reds only: **OFF** ✗
     - Rating >= 4.2: **ON** ✓

3. **Generate Lineup**

4. **Verify**:
   - ✅ Should show 3-4 wines
   - ✅ Wines with **lower tannin** prioritized (won't amplify spice)
   - ✅ Wines with **good acidity** and **possible sweetness** ranked higher
   - ✅ Pairing explanations mention:
     - "Gentle structure won't amplify spice"
     - "Touch of sweetness tames the heat"

---

### Test 4: BBQ / Smoky (Oak & Body)

1. **Start a new plan**

2. **Configure**:
   - Group size: **6**
   - Food selections:
     - Protein: **Pork**
     - Sauce: **BBQ**
     - Spice level: **Medium**
     - Smoke/char: **Heavy char**
   - Preferences:
     - Reds only: **ON** ✓
     - Rating >= 4.2: **ON** ✓

3. **Generate Lineup**

4. **Verify**:
   - ✅ Should show 5-6 wines
   - ✅ Wines with **oak** and **body** prioritized
   - ✅ Pairing explanations mention:
     - "Oak echoes smoky flavors beautifully"
     - "Rich body matches bold smokiness"

---

### Test 5: Verify Power Progression

For any lineup generated:

1. **Look at the queue order** (1st → 2nd → 3rd → 4th)
2. **Observe the wines**:
   - First wine: Should be **lighter** (e.g., Pinot Noir, lighter regional styles)
   - Middle wines: **Medium body**
   - Last wine: Should be **boldest** (e.g., Amarone, Barolo, heavy Cabernet)

3. **Check the power scores** (if you add debug logging):
   - Power should gradually increase: e.g., 4 → 6 → 7 → 9

---

## 🔍 What to Look For

### Success Indicators

✅ **Food selection affects wine ranking**
- Changing food options produces different wine selections
- Appropriate wine styles are prioritized for each food type

✅ **Wines are ordered by power**
- Clear progression from light to powerful
- No jarring transitions (e.g., heavy wine → light wine → heavy wine)

✅ **Pairing explanations are relevant**
- Text matches the food and wine characteristics
- Different explanations for different food/wine combinations

✅ **No console errors**
- No "wine_profile is null" errors
- No scoring calculation errors

✅ **Heuristic fallback works**
- If any wines are missing profiles, the system still generates lineups
- Those wines get estimated profiles based on region/grapes/color

---

## 🐛 Potential Issues to Watch For

### Issue 1: All wines have same power score
**Symptom**: Lineup order seems random
**Cause**: Profiles might not be diverse enough
**Check**: Look at a few wine profiles in the database:
```sql
SELECT 
  wine_name,
  wine_profile->'power' as power,
  wine_profile->'body' as body,
  wine_profile->'tannin' as tannin
FROM wines
WHERE wine_profile IS NOT NULL
LIMIT 10;
```

### Issue 2: Food selection doesn't change results
**Symptom**: Same wines selected regardless of food
**Cause**: Scoring logic might not be applying food pairing bonuses
**Check**: Browser console should show scoring logs

### Issue 3: Pairing explanations are generic
**Symptom**: All wines show "Excellent choice for this moment"
**Cause**: Food profile not being passed correctly
**Fix**: Check that food selections are being captured in state

### Issue 4: Wines missing profiles
**Symptom**: Some wines show fallback behavior
**Check**: Run the backfill again for missing wines
```sql
-- Find wines without profiles
SELECT wine_name, producer, vintage
FROM wines
WHERE wine_profile IS NULL;
```

---

## 📊 Advanced Testing

### Test with Different Cellar Compositions

1. **If you have mostly reds**:
   - Try planning with "Reds only: OFF"
   - See if the system handles limited white wine options gracefully

2. **If you have limited bottles per wine**:
   - Try a large group (8+ people)
   - Verify the system selects enough unique wines

3. **Test edge cases**:
   - Group size = 1 (should select 2 wines)
   - Group size = 10 (should select 6 wines, the max)
   - All wines have low ratings (should still generate a lineup)

---

## 🎯 Success Criteria

After testing, you should be able to confirm:

- [x] **Backfill completed** - All 54 wines have profiles
- [ ] **Food selection UI works** - All food options selectable
- [ ] **Wine ranking is food-aware** - Different foods produce different selections
- [ ] **Power ordering works** - Wines progress from light to powerful
- [ ] **Pairing explanations appear** - Each wine shows relevant explanation
- [ ] **No regressions** - Existing features still work (scan, add, history, etc.)
- [ ] **Works on mobile** - Test on your phone/PWA

---

## 📝 Optional: Verify Wine Profiles in Database

Want to see what the AI generated? Check a few profiles:

```sql
-- View sample wine profiles
SELECT 
  wine_name,
  producer,
  vintage,
  wine_profile->'body' as body,
  wine_profile->'tannin' as tannin,
  wine_profile->'acidity' as acidity,
  wine_profile->'oak' as oak,
  wine_profile->'sweetness' as sweetness,
  wine_profile->'power' as power,
  wine_profile->'style_tags' as style_tags,
  wine_profile->'confidence' as confidence
FROM wines
WHERE wine_profile IS NOT NULL
ORDER BY (wine_profile->>'power')::int DESC
LIMIT 10;
```

This shows your most powerful wines and their profiles.

---

## 🎉 What's Next?

Once you've verified everything works:

1. **Test on mobile/PWA** - Ensure it works on your phone
2. **Try real evening planning** - Use it for an actual dinner
3. **Share feedback** - Note any improvements or issues
4. **Optional**: Add more wines to test backfill for new bottles

---

## 🚨 If Something's Wrong

If any tests fail:
1. Check browser console for errors
2. Check Supabase Edge Function logs
3. Verify all wines have profiles (run backfill again if needed)
4. Share the specific error message for troubleshooting

---

You're ready to test! Start with **Test 1 (Beef with Rich Sauce)** and let me know what you see! 🍷
