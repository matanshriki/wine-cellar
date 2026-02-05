# Wine Profile Integration Steps 4-7: Implementation Guide

## ✅ Step 4: Integrate Admin Tool (COMPLETED)

The admin backfill tool has been integrated into your Profile page:

**What was done:**
- Added `<AdminWineProfileBackfill />` component to `apps/web/src/pages/ProfilePage.tsx`
- The component appears right after the "Account Information" section

**What you'll see:**
- When logged in as an admin (your user has `is_admin = true`), you'll see a new section:
  - **"Admin: Wine Profile Backfill"**
  - Shows total wines / wines with profiles / wines without profiles
  - "Start Backfill" button to begin generating profiles
  - Progress bar and real-time status during processing
  - Can pause/resume the backfill process

---

## ✅ Step 5: Food-Aware Planning Patches (COMPLETED)

The "Plan an Evening" modal has been upgraded with food-aware wine selection:

**What was done:**
1. **Food Selection UI** - Added four new selection sections:
   - **Protein**: Beef, Lamb, Pork, Poultry, Seafood, Vegetarian
   - **Sauce**: Light, Tomato-based, Cream-based, Rich & savory
   - **Spice level**: Mild, Medium, Spicy
   - **Smoke/char**: None, Light smoke, Heavy char

2. **Food-Aware Scoring** - Wines are now scored based on:
   - **Readiness** (days ready × 15 points)
   - **Rating** (user_rating × 15 points)
   - **Food pairing compatibility** (calculated from wine profile + food selections, up to 40 points)
   - **Diversity bonus** (slight boost for variety)

3. **Power-Based Ordering** - Selected wines are automatically ordered from light to powerful:
   - Uses `wine_profile.power` score (0-10)
   - Ensures smooth progression through the evening
   - Avoids back-to-back high tannin + oak wines

4. **Pairing Explanations** - Each wine in the lineup shows a brief explanation of why it pairs well with the selected food

**What you'll see:**
- New food selection buttons in the "Plan an Evening" modal
- Wines automatically ordered by power level (light → powerful)
- Pairing explanations under each wine (e.g., "Bold tannins complement the richness of beef")

---

## ⏳ Step 6: Run Backfill (USER ACTION REQUIRED)

Now that the admin tool is integrated, you need to generate wine profiles for your existing wines.

**Instructions:**

1. **Navigate to Settings/Profile page**
   - You should see the new "Admin: Wine Profile Backfill" section

2. **Review the status**
   - Check how many wines are missing profiles
   - Example: "Total wines: 45 | With profiles: 0 | Without profiles: 45"

3. **Start the backfill**
   - Click the **"Start Backfill"** button
   - The system will process wines in batches (5 at a time by default)
   - You'll see real-time progress:
     - Progress bar
     - Status messages (e.g., "Processing wine 15 of 45...")
     - Success/error counts

4. **Monitor the process**
   - **Do not close the page** while backfill is running
   - The process is resumable - if you close the page, you can return and continue where you left off
   - Each wine takes ~2-3 seconds to process (OpenAI API call)

5. **Verify completion**
   - Once complete, the status should show:
     - "Total wines: 45 | With profiles: 45 | Without profiles: 0"
   - You'll see a success message

**Notes:**
- The backfill calls OpenAI for each wine without a profile
- If you have many wines (50+), it may take several minutes
- You can pause and resume anytime
- Any errors will be logged and skipped (check console for details)

---

## ⏳ Step 7: Test Food-Aware Planning (USER ACTION REQUIRED)

After running the backfill, test the new food-aware planning feature.

**Test Scenarios:**

### Test 1: Beef with Rich Sauce
1. Open "Plan an Evening"
2. Set:
   - Guests: 4
   - Protein: **Beef**
   - Sauce: **Rich & savory**
   - Spice: **Mild**
   - Smoke: **None**
3. Generate lineup
4. **Expected results:**
   - Wines with high tannin and body should be prioritized
   - Wines ordered from light to powerful
   - Pairing explanations mention tannins complementing beef

### Test 2: Seafood with Light Sauce
1. Open "Plan an Evening"
2. Set:
   - Guests: 2
   - Protein: **Seafood**
   - Sauce: **Light**
   - Spice: **Mild**
   - Smoke: **None**
3. Generate lineup
4. **Expected results:**
   - Lighter wines with higher acidity should be prioritized
   - Lower power scores overall
   - Pairing explanations mention acidity and delicate flavors

### Test 3: Spicy Vegetarian
1. Open "Plan an Evening"
2. Set:
   - Guests: 3
   - Protein: **Vegetarian**
   - Sauce: **Tomato-based**
   - Spice: **Spicy**
   - Smoke: **None**
3. Generate lineup
4. **Expected results:**
   - Wines with lower tannin and good acidity should be prioritized
   - Off-dry or fruity wines may score higher
   - Pairing explanations mention spice compatibility

### Test 4: Check Power Progression
For any lineup:
1. Note the first wine's characteristics (should be lighter)
2. Note the last wine's characteristics (should be bolder)
3. Verify smooth progression through the lineup

### Test 5: Verify Heuristic Fallback
If you have wines without profiles (or want to test fallback):
1. The system should still generate lineups
2. Wines without AI profiles will use heuristic estimates based on:
   - Color (red vs white)
   - Alcohol % (if available)
   - Region (if available)
3. These estimates are less accurate but functional

---

## Verification Checklist

After completing steps 6-7, verify:

- [ ] **Admin tool appears** in Profile page (for admin users only)
- [ ] **Backfill completes** successfully for all wines
- [ ] **Food selection UI** appears in "Plan an Evening" modal
- [ ] **Wines are ordered** by power (light to powerful) in lineup
- [ ] **Pairing explanations** appear under each wine in lineup
- [ ] **Different food selections** produce different wine rankings
- [ ] **No console errors** during planning or backfill
- [ ] **OpenAI is NOT called** during plan generation (only during backfill)

---

## Troubleshooting

### Admin tool doesn't appear
- Check that your user has `is_admin = true` in the `profiles` table
- SQL: `UPDATE profiles SET is_admin = true WHERE id = 'YOUR_USER_ID';`

### Backfill fails with 500 error
- Check Edge Function logs: `supabase functions logs generate-wine-profile --tail`
- Verify OpenAI API key is set: `supabase secrets list`
- Check if you have API quota/credits remaining

### Wines not ordered by power
- Verify wines have `wine_profile` populated in database
- Check console for any errors during lineup generation
- Fallback heuristics may produce less accurate ordering

### Food selection doesn't affect ranking
- Check that wines have profiles (run backfill)
- Verify `wineProfileService.calculateFoodPairingScore` is being called
- Check console for scoring logs (if debugging is enabled)

### No pairing explanations visible
- Ensure wines have `wine_profile` populated
- Check that `wineProfileService.getPairingExplanation` is returning text
- Verify the explanation div has enough space to render

---

## Next Steps

Once you've completed and verified steps 6-7:

1. **Test the complete flow** end-to-end:
   - Scan/add a new wine
   - Run backfill to generate its profile
   - Create an evening plan with food selections
   - Open bottles during the evening
   - Complete the evening with ratings

2. **Optional: Scheduled backfill**
   - Consider running backfill periodically for new wines
   - Could be automated with a cron job or webhook

3. **Optional: Profile regeneration**
   - If OpenAI models improve, you can regenerate profiles
   - Just delete `wine_profile` for specific wines and re-run backfill

4. **Monitor OpenAI usage**
   - Each profile generation costs ~1-2 cents
   - 100 wines ≈ $1-2 in OpenAI credits
   - Only called during backfill, not during planning

---

## Summary of Changes

**Files Modified:**
- `apps/web/src/pages/ProfilePage.tsx` - Added admin backfill tool
- `apps/web/src/components/PlanEveningModal.tsx` - Added food selection UI, food-aware scoring, power-based ordering, and pairing explanations

**New Features:**
- Admin tool for bulk wine profile generation
- Food selection (protein, sauce, spice, smoke) in evening planning
- Food-aware wine scoring and ranking
- Power-based wine ordering (light to powerful progression)
- Pairing explanations for each wine

**Database:**
- Wine profiles stored in `wines.wine_profile` (JSONB)
- Backfill jobs tracked in `profile_backfill_jobs` table

**Edge Function:**
- `generate-wine-profile` - Generates structured wine profiles via OpenAI

---

You're all set! Go ahead with **Step 6** (run the backfill) and then **Step 7** (test the food-aware planning). Let me know if you encounter any issues! 🍷
