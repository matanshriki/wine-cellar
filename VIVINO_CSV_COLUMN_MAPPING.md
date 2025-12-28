# Vivino CSV Column Auto-Mapping Fix

## Issues Fixed

### 1. ✅ "User cellar count" Not Detected
**Issue**: Vivino exports use "User cellar count" for quantity, which wasn't being detected.

**Fix**: Added detection for Vivino's quantity column names:
- ✅ "User cellar count" (Vivino standard)
- ✅ "Cellar count"
- ✅ "Quantity"
- ✅ "Qty"
- ✅ "Bottles"
- ✅ "Count"

All matching is **case-insensitive** and **whitespace-tolerant**.

### 2. ✅ Enhanced Rating Detection
**Issue**: Some Vivino rating columns might not be detected due to naming variations.

**Fix**: Improved detection logic to match any column containing:
- ✅ "rating" anywhere in name
- ✅ "score" anywhere in name
- ✅ "average" + "rating" (e.g., "Average rating")
- ✅ "avg" + "rating" (e.g., "Avg. rating")
- ✅ "vivino" + "rating" (e.g., "Vivino rating")
- ✅ "community" + "rating" (e.g., "Community rating")

### 3. ✅ Enhanced Debug Logging
Added comprehensive logging to help diagnose import issues:

```javascript
// At CSV parse:
[CSV Import] CSV Headers: ["Wine", "Producer", "Vintage", "Average rating", "User cellar count", ...]

// After auto-detection:
[CSV Import] Auto-detected columns: {
  name: "Wine",
  producer: "Producer",
  vintage: "Vintage",
  style: "Type",
  rating: "Average rating",  // ✅
  quantity: "User cellar count",  // ✅
  vivinoUrl: "Url",
  imageUrl: "Image"
}

// Warnings if columns missing:
⚠️ Rating column not detected! Check your CSV headers.
⚠️ Quantity column not detected! Will default to 1 per bottle.

// Column indices:
[CSV Import] Column indices: {
  ratingIdx: 3,
  quantityIdx: 4,
  vivinoUrlIdx: 7,
  imageUrlIdx: 8
}

// First row sample:
[CSV Import] First row sample: {
  wineName: "Château Margaux",
  rating: "4.6",
  quantity: "2",
  vivinoUrl: "https://vivino.com/..."
}

// During import:
[CSV Import] Parsed rating for "Château Margaux": 4.6
[CSV Import] Parsed rating for "Dom Pérignon": 4.5
[CSV Import] Parsed rating for "Sassicaia": 4.7
```

---

## Standard Vivino CSV Format

Vivino exports typically look like this:

```csv
Wine,Producer,Vintage,Type,Region,Country,Average rating,User cellar count,Url,Image
Château Margaux,Château Margaux,2015,Red,Bordeaux,France,4.6,2,https://vivino.com/...,https://images.vivino.com/...
Dom Pérignon,Moët & Chandon,2012,Sparkling,Champagne,France,4.5,1,https://vivino.com/...,https://images.vivino.com/...
Sassicaia,Tenuta San Guido,2017,Red,Tuscany,Italy,4.7,3,https://vivino.com/...,https://images.vivino.com/...
```

**Key Columns:**
- **Wine** → wine name
- **Producer** → winery/producer
- **Vintage** → year
- **Type** → Red/White/Sparkling/Rosé
- **Average rating** → Vivino community rating (0-5 scale)
- **User cellar count** → How many bottles you own
- **Url** → Vivino wine page link
- **Image** → Wine bottle image URL

---

## How to Verify the Fix

### Step 1: Open Browser Console

1. Open DevTools (F12)
2. Go to **Console** tab
3. Clear console (to see fresh logs)

### Step 2: Import Vivino CSV

1. Go to **Cellar** → **Import CSV**
2. Upload your Vivino CSV export
3. **Check console logs**

**Expected Output:**

```javascript
[CSV Import] CSV Headers: [
  "Wine",
  "Producer", 
  "Vintage",
  "Type",
  "Region",
  "Country",
  "Average rating",  // ✅ Present
  "User cellar count",  // ✅ Present
  "Url",
  "Image"
]

[CSV Import] Auto-detected columns: {
  name: "Wine",
  producer: "Producer",
  vintage: "Vintage",
  style: "Type",
  rating: "Average rating",  // ✅ Detected!
  quantity: "User cellar count",  // ✅ Detected!
  vivinoUrl: "Url",
  imageUrl: "Image"
}

[CSV Import] Column indices: {
  ratingIdx: 6,  // ✅ Not -1
  quantityIdx: 7,  // ✅ Not -1
  vivinoUrlIdx: 8,
  imageUrlIdx: 9
}

[CSV Import] First row sample: {
  wineName: "Château Margaux",
  rating: "4.6",  // ✅ Value present
  quantity: "2",  // ✅ Value present
  vivinoUrl: "https://vivino.com/wines/15063972"
}

[CSV Import] Parsed rating for "Château Margaux": 4.6
```

### Step 3: Check the Mapping UI

In the CSV import mapping step, you should see:
- **Rating** dropdown → Auto-selected to "Average rating" ✅
- **Quantity** dropdown → Auto-selected to "User cellar count" ✅

### Step 4: Verify in Database

After import, run this SQL in Supabase:

```sql
SELECT 
  wine_name,
  rating,
  vivino_url,
  image_url
FROM wines
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**:
- `rating` column should have values like 4.6, 4.5, etc. (NOT NULL) ✅

Check bottles quantity:

```sql
SELECT 
  w.wine_name,
  b.quantity
FROM bottles b
JOIN wines w ON b.wine_id = w.id
WHERE b.user_id = auth.uid()
ORDER BY b.created_at DESC
LIMIT 10;
```

**Expected**:
- `quantity` should match your "User cellar count" (NOT default to 1) ✅

---

## Troubleshooting

### Issue: Rating Still NULL in Database

**Check Console Logs:**

1. **If you see:**
   ```javascript
   ⚠️ Rating column not detected! Check your CSV headers.
   ```
   **Solution**: Your CSV doesn't have a rating column, or it's named differently. Check your CSV file.

2. **If you see:**
   ```javascript
   [CSV Import] Auto-detected columns: { rating: undefined }
   ```
   **Solution**: Column name doesn't match our patterns. Open an issue with your CSV header names.

3. **If you see:**
   ```javascript
   [CSV Import] First row sample: { rating: "" }
   ```
   **Solution**: Your CSV has a rating column, but the values are empty.

4. **If you see:**
   ```javascript
   [CSV Import] Parsed rating for "Wine": 4.6
   ```
   **But database shows NULL**:
   - Check if database migration was run (see `RATING_TROUBLESHOOTING.md`)
   - Check if `rating` column exists in `wines` table

### Issue: Quantity Defaults to 1

**Check Console Logs:**

1. **If you see:**
   ```javascript
   ⚠️ Quantity column not detected! Will default to 1 per bottle.
   ```
   **Solution**: Your CSV doesn't have "User cellar count" or similar column.

2. **If you see:**
   ```javascript
   [CSV Import] Auto-detected columns: { quantity: undefined }
   ```
   **Solution**: Column name doesn't match our patterns. Manually map it in the UI.

3. **If you see:**
   ```javascript
   [CSV Import] First row sample: { quantity: "N/A" }
   ```
   **Solution**: Quantity column not mapped. Check auto-detection.

---

## Known Vivino Column Names

Based on Vivino exports (may vary by region/language):

| Data | Common Column Names |
|------|---------------------|
| **Name** | Wine, Name, Wine name |
| **Producer** | Producer, Winery, Maker |
| **Vintage** | Vintage, Year |
| **Type/Color** | Type, Style, Color, Wine type |
| **Rating** | Average rating, Avg. rating, Rating, Community rating, Vivino rating |
| **Quantity** | User cellar count, Cellar count, Quantity, Count, Bottles |
| **URL** | Url, Link, Vivino, Wine link |
| **Image** | Image, Photo, Picture, Thumbnail |

---

## Testing Checklist

After re-importing your Vivino CSV:

- [ ] Console shows "Average rating" detected
- [ ] Console shows "User cellar count" detected
- [ ] Console logs first row with rating and quantity values
- [ ] Database `wines.rating` is NOT NULL
- [ ] Database `bottles.quantity` matches your cellar count (not 1)
- [ ] UI shows ratings: ★★★★⯪ 4.6
- [ ] UI shows correct quantities in cellar list
- [ ] No console errors during import

---

## What Changed

**File**: `apps/web/src/components/CSVImport.tsx`

1. **Line 167-174**: Enhanced quantity detection (added "cellar count", "user cellar count")
2. **Line 155-162**: Enhanced rating detection (more flexible pattern matching)
3. **Line 168-185**: Comprehensive debug logging
4. **Line 254-273**: Added column indices and first row sample logging

All changes are **backward compatible**.

---

## Next Steps

1. **Hard refresh** browser (Cmd+Shift+R or Ctrl+Shift+R)
2. **Re-import** your Vivino CSV
3. **Check console** for debug logs
4. **Verify in database** that rating and quantity are populated
5. **Check UI** for ratings and correct quantities

If ratings are still NULL after this fix, **share the console logs** so I can see what's happening!

