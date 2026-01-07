# Dev-Only Features Testing Guide

**🚨 IMPORTANT: These features are LOCALHOST ONLY. They will not appear in production.**

This guide covers three prototype features implemented for UX testing:
1. Multi-Bottle Photo Import
2. Share Your Cellar (Community-Lite)
3. "When to Open" Filter & Badges

## Prerequisites

✅ **Environment Check:**
- Must run on `localhost` or `127.0.0.1`
- Features are automatically hidden in production
- Dev badge indicators show on all dev-only features

✅ **Setup:**
```bash
cd apps/web
npm install
npm run dev
```

Access the app at: `http://localhost:5173` (or your configured port)

---

## 🎯 Feature 1: Multi-Bottle Photo Import

### Goal
Upload ONE photo containing MULTIPLE bottles (5+). The app detects each bottle separately and lets you review/edit before adding to your cellar.

### Where to Find It
1. Navigate to **Cellar** page
2. Look for the **"📸 Multi-Photo (dev)"** button in the header
3. Button appears ONLY on localhost and has an amber/dev-styled background

### Testing Steps

#### Happy Path
1. **Click "📸 Multi-Photo (dev)"**
   - Modal opens with upload interface
   - Dev badge visible in header
   
2. **Upload a Photo**
   - Click "📁 Choose Photo"
   - Select any image (for testing, any photo works - mock data will be used)
   - **Expected:** "🔍 Analyzing Photo..." screen appears
   
3. **Review Detected Bottles**
   - **Expected:** 3 mock bottles appear with editable fields
   - Each bottle shows:
     - Producer, Wine Name, Vintage, Color
     - Confidence score (%)
     - "⚠️ Possible duplicate" warning if matches existing bottle
   - Auto-selected bottles: confidence ≥65% AND has required fields
   
4. **Edit Bottle Details**
   - Modify any text field (producer, name, vintage)
   - Change wine color via dropdown
   - **Expected:** Changes reflect immediately
   
5. **Select/Deselect Bottles**
   - Uncheck a bottle to exclude it
   - Check it again to include it
   - **Expected:** Selection count updates in footer button
   
6. **Save**
   - Click "Add X Bottles" button
   - **Expected:** Progress bar shows as bottles are added
   - Success toast: "🍷 Successfully added X bottles!"
   - Modal closes and cellar reloads with new bottles

#### Edge Cases

**Test: No Bottles in Photo**
- Expected: "Could not detect any bottles" error
- Modal returns to upload screen

**Test: Cancel During Review**
- Click "Cancel" button
- Expected: Modal closes without saving

**Test: Duplicate Detection**
- Add a bottle with same producer + name + vintage as existing
- Expected: Orange "⚠️ Possible duplicate" badge appears
- Can still add if desired

**Test: Select Zero Bottles**
- Uncheck all bottles
- Expected: "Add 0 Bottles" button is disabled
- Click shows warning: "Please select at least one bottle"

### Notes
- Currently uses **mock data** (3 sample bottles) since AI endpoint isn't deployed
- In production, would call `/api/extract-multi-bottles` edge function
- Mock data simulates real AI behavior with varying confidence scores

---

## 🎯 Feature 2: Share Your Cellar (Community-Lite)

### Goal
Generate a read-only shareable link to your cellar. Test community UX without building full social features yet.

### Where to Find It

#### A) Share Button (Cellar Page)
1. Navigate to **Cellar** page
2. Look for **"🔗 Share (dev)"** button in header
3. Appears ONLY on localhost, next to other action buttons

#### B) Community Discovery Page
1. Navigate to `/community` route manually:
   - Type in browser: `http://localhost:5173/community`
2. OR add a link in your navigation (optional)

### Testing Steps: Sharing Your Cellar

1. **Generate Share Link**
   - Click **"🔗 Share (dev)"** button
   - Modal opens with info about dev-only sharing
   - Shows stats: total bottles, wine count
   
2. **Create Link**
   - Click **"🔗 Generate Share Link"**
   - **Expected:** Link appears in a code box
   - Success toast: "✅ Share link generated!"
   
3. **Copy Link**
   - Click **"📋 Copy Link"**
   - **Expected:** Toast confirms "📋 Link copied to clipboard!"
   
4. **Preview Shared Cellar**
   - Click **"🔍 Preview"** button
   - **Expected:** Opens shared cellar view in new tab
   - Shows read-only view with:
     - Your name + cellar title
     - Stats cards (red/white/rosé/sparkling counts)
     - Top regions badges
     - List of bottles (no prices/personal notes)
   
5. **Test in Incognito**
   - Copy the share link
   - Open incognito/private browser window
   - Paste link and visit
   - **Expected:** Shared cellar loads without requiring login
   - Footer CTA: "Start Your Own Cellar" button

### Testing Steps: Community Discovery

1. **Visit Community Page**
   - Go to `http://localhost:5173/community`
   - **Expected:** Shows 3 mock shared cellars
   - Dev badge visible in header
   
2. **Explore Mock Cellars**
   - Each card shows:
     - User name (Alexandre B., Sarah M., Thomas K.)
     - Bottle/wine counts
     - Wine type distribution (🍷🥂🌸✨)
     - Top regions
   
3. **View a Cellar**
   - Click **"👀 View Cellar"** on any card
   - **Expected:** Navigates to shared cellar view
   - Shows full read-only cellar for that user
   
4. **Navigate Back**
   - Click browser back OR "Go to My Cellar" button
   - **Expected:** Returns to community page

### Edge Cases

**Test: Expired Link**
- Links expire after 7 days (simulated)
- Expected: "Invalid or expired share link" error page

**Test: Corrupted Link**
- Manually modify the `?data=` parameter in URL
- Expected: "Shared cellar not found" error page

**Test: Empty Cellar Share**
- Try to share when cellar has 0 bottles
- Expected: Still generates link, but shows "0 bottles"

**Test: Production Access**
- Deploy to production (NOT recommended yet)
- Expected: Share button hidden, `/share` and `/community` routes redirect to cellar

### Notes
- **No backend changes** - share data encoded in URL
- **7-day expiration** built into link
- **No sensitive data** shared (prices, purchase info excluded)
- Shared view is **fully read-only**

---

## 🎯 Feature 3: "When to Open" Filter & Badges

### Goal
Help answer "What's ready to drink now?" and "What should I keep aging?" using drink window readiness data.

### Where to Find It

1. Navigate to **Cellar** page
2. Look at **filter pills** below search bar
3. New filters:
   - **"✓ Ready"** - In drink window now
   - **"⏳ Hold"** - Too young, needs aging
   - **"🍷 Past Peak"** - Past optimal window, drink soon

4. Also visible on **bottle cards**:
   - Each card shows a readiness badge in top-right corner
   - Colors indicate status (green/amber/orange)

### Testing Steps: Filters

#### Setup: Get Analyzed Bottles
First, you need bottles with readiness data:
1. Add some bottles to your cellar
2. Click **"🧙‍♂️ AI Sommelier"** button on each bottle
3. Wait for AI analysis to complete
4. Readiness badges will appear on analyzed bottles

#### Test Filter: "✓ Ready"
1. Click **"✓ Ready"** filter pill
   - Filter activates (burgundy background)
   - Tonight's Selection and Drink Window widgets hide
   - Bottle list shows ONLY ready-to-drink wines
   
2. **Expected Bottles:**
   - Status = "InWindow" or "Peak"
   - Badge shows: "✓ Ready" (green background)
   
3. Click filter again to deactivate

#### Test Filter: "⏳ Hold"
1. Click **"⏳ Hold"** filter pill
   - Filter activates
   - Shows bottles that need more aging
   
2. **Expected Bottles:**
   - Status = "TooYoung" or "Approaching"
   - Badge shows: "⏳ Hold" (amber background)

#### Test Filter: "🍷 Past Peak"
1. Click **"🍷 Past Peak"** filter pill
   - Filter activates
   - Shows bottles past optimal window
   
2. **Expected Bottles:**
   - Status = "PastPeak"
   - Badge shows: "🍷 Drink Soon" (orange background)

#### Test Multiple Readiness Filters
1. Select both "✓ Ready" AND "⏳ Hold"
   - **Expected:** Shows bottles from EITHER category (OR logic)
   - Count updates in header
   
2. Add "🍷 Past Peak" too
   - **Expected:** Shows all three categories combined

#### Test Readiness + Color Filters
1. Select "✓ Ready" + "Red" wine filters
   - **Expected:** Shows ONLY ready red wines
   - Uses AND logic between categories
   
2. Add "White" wine filter
   - **Expected:** Shows ready reds OR ready whites

### Testing Steps: Badges

#### Verify Badge Display
1. Look at bottles in cellar grid
2. Find an analyzed bottle (has AI sommelier notes)
3. **Expected:** Small badge in top-right corner below wine style
4. Badge shows:
   - "✓ Ready" (green) - InWindow or Peak
   - "⏳ Hold" (amber) - TooYoung or Approaching
   - "🍷 Drink Soon" (orange) - PastPeak

#### Verify Badge Absence
1. Find unanalyzed bottle (no AI notes)
2. **Expected:** No readiness badge shown
3. Only wine style badge visible

### Testing Steps: Sorting (Already Exists)

The readiness-based sort already exists in the app:

1. Click current sort button (shows icon + label)
2. Select **"✨ Readiness (Ready First)"**
3. **Expected:** Bottles reorder:
   - Ready wines first
   - Past Peak second
   - Unknown third
   - Hold wines last
4. Smooth scroll to bottle list

### Edge Cases

**Test: No Analyzed Bottles**
- Fresh cellar with no AI analysis
- Expected: Filters work but return empty results
- Badges don't appear on any bottles

**Test: All Bottles Unknown Status**
- Bottles without drink window data
- Expected: Filters return no results
- No badges shown

**Test: Clear Filters**
- Apply multiple readiness filters
- Click "Clear Filters" link
- Expected: All filters reset, full cellar visible

**Test: Combined with Search**
- Search for "Bordeaux"
- Apply "✓ Ready" filter
- Expected: Shows ONLY ready Bordeaux wines

### Notes
- Requires **AI analysis** to be run first
- Readiness calculated from drink window data
- Sorting by readiness already existed (not new)
- Badges are **visual only** (no interaction)

---

## 🚀 Quick Test Checklist

Use this checklist for rapid validation:

### Feature 1: Multi-Bottle Import
- [ ] Button visible on localhost
- [ ] Dev badge shown
- [ ] Upload triggers analysis
- [ ] 3 mock bottles appear
- [ ] Fields are editable
- [ ] Selection toggles work
- [ ] Save adds bottles to cellar
- [ ] Duplicate detection works

### Feature 2: Share Cellar
- [ ] Share button visible on localhost
- [ ] Link generation works
- [ ] Copy to clipboard works
- [ ] Preview opens shared view
- [ ] Shared view is read-only
- [ ] Community page shows 3 mock cellars
- [ ] View cellar navigation works
- [ ] Incognito access works (no login required)

### Feature 3: When to Open
- [ ] Filter pills appear (Ready, Hold, Past Peak)
- [ ] Badges show on analyzed bottles
- [ ] Ready filter shows only InWindow/Peak
- [ ] Hold filter shows only TooYoung/Approaching
- [ ] Past Peak filter shows PastPeak
- [ ] Multiple filters use OR logic
- [ ] Sorting by readiness works
- [ ] Unanalyzed bottles have no badge

---

## 🐛 Common Issues & Fixes

### Issue: Dev buttons don't appear
**Cause:** Not running on localhost
**Fix:** Check URL is `localhost` or `127.0.0.1`, not production domain

### Issue: Multi-bottle shows error
**Cause:** Edge function not deployed (expected)
**Fix:** This is normal - uses mock data instead

### Issue: Share link doesn't work
**Cause:** Link too long or corrupted
**Fix:** Regenerate link with fewer bottles (URL encoding has limits)

### Issue: No readiness badges
**Cause:** Bottles not analyzed yet
**Fix:** Click "🧙‍♂️ AI Sommelier" on bottles first

### Issue: Community page redirects
**Cause:** Accessed from production
**Fix:** Only works on localhost

---

## 📊 What Gets Logged

All features log to browser console:

```javascript
// Multi-bottle import
[multiBottleService] Starting multi-bottle scan
[multiBottleService] Detected bottles: 3
[MultiBottleImport] Starting scan of: photo.jpg

// Share cellar
[shareService] Generated share link: { bottleCount: 15, ... }
[SharedCellarPage] Loading shared cellar...

// Readiness filters
[CellarPage] 🔍 Filter clicked: ready
[CellarPage] New activeFilters: ['ready']
```

Open DevTools Console (F12) to monitor feature behavior.

---

## 💡 Next Steps: Production Roadmap

**Before production deployment:**

1. **Multi-Bottle Import**
   - Deploy AI edge function `/api/extract-multi-bottles`
   - Test with real OpenAI GPT-4 Vision API
   - Add real photo validation
   - Remove mock data fallback

2. **Share Cellar**
   - Implement proper backend sharing (database table)
   - Add share analytics
   - Support private/public toggle
   - Add social preview cards (OpenGraph)

3. **When to Open**
   - Already production-ready (uses existing data)
   - Consider adding filter presets
   - Add drink window recommendations

**Do NOT deploy these features to production yet:**
- Multi-bottle uses mock data
- Share uses URL encoding (not scalable)
- All features have dev guards in place

---

## 📝 Feedback & Iteration

After testing, consider:

### UX Questions
- Is multi-bottle review flow intuitive?
- Are share links easy to copy/share?
- Do readiness badges help decision-making?
- Are filter combinations clear?

### Performance Questions
- Does multi-bottle upload feel fast?
- Are shared cellars quick to load?
- Do filters update smoothly?

### Feature Gaps
- Need better duplicate handling?
- Want more granular readiness states?
- Should share links have passwords?
- Need notification when wines become ready?

---

## 🎉 Summary

You now have **3 working prototypes** to test:

1. **📸 Multi-Bottle Import** - Test batch photo scanning UX
2. **🔗 Share Cellar** - Test community/social features
3. **🍷 When to Open** - Test readiness-based filtering

All features are:
- ✅ Localhost only
- ✅ Safe to test
- ✅ Reversible
- ✅ No database changes
- ✅ Clearly marked as DEV

**Ready to test!** 🚀

Open `http://localhost:5173` and start exploring.

