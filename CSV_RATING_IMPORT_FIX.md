# CSV Rating Import - Bug Fix

## Bugs Fixed

### 1. ✅ Duplicate `image_url` Property
**Issue**: The `image_url` was being set twice in the bottle input object, with the second assignment overwriting it with `null`.
```typescript
// Before (BUG):
{
  image_url: imageUrl,    // Line 274: Correct value
  // ... other fields
  image_url: null,        // Line 284: OVERWRITES with null!
}

// After (FIXED):
{
  image_url: imageUrl,    // Only set once with correct value
  // ... other fields
  // Removed duplicate
}
```

### 2. ✅ Enhanced Rating Column Detection
**Issue**: "Average rating" column from Vivino CSV might not be reliably detected.

**Fix**: Added explicit detection for common Vivino rating column names:
```typescript
// Now detects:
- "rating" (contains)
- "score" (contains)
- "Average rating" (exact)
- "Avg rating" (exact)
- "Vivino rating" (exact)
```

All matching is **case-insensitive** and **whitespace-tolerant**.

### 3. ✅ European Decimal Format Support
**Issue**: Some regions use comma as decimal separator (e.g., "4,2" instead of "4.2").

**Fix**: Rating parser now handles both formats:
```typescript
// Before:
parseFloat("4,2") → NaN ❌

// After:
"4,2".replace(',', '.') → "4.2" → 4.2 ✅
```

### 4. ✅ Better Error Handling
**Issue**: Out-of-range ratings were silently ignored without feedback.

**Fix**: Added logging for debugging:
- Logs first 3 parsed ratings to console
- Warns when ratings are out of 0-5 range
- Logs auto-detected columns

---

## How to Verify the Fix

### Step 1: Check Your Vivino CSV Format

Open your Vivino CSV and check the column headers. They should include something like:

```csv
Wine,Producer,Vintage,Type,Region,Country,Average rating,Url,Image
Château Margaux,Château Margaux,2015,Red,Bordeaux,France,4.6,https://...,https://...
```

**Common Vivino Column Names:**
- **Rating**: "Average rating", "Rating", "Avg rating", "Vivino rating"
- **URL**: "Url", "Link", "Vivino"
- **Image**: "Image", "Photo", "Picture"

### Step 2: Import with Console Open

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Go to your app → **Cellar** → **Import CSV**
4. Upload your Vivino CSV

**What to look for:**

```javascript
// You should see:
[CSV Import] Auto-detected columns: {
  name: "Wine",
  producer: "Producer",
  rating: "Average rating",  // ✅ This should be detected!
  vivinoUrl: "Url",
  imageUrl: "Image"
}

// Then during import:
[CSV Import] Parsed rating for "Château Margaux": 4.6
[CSV Import] Parsed rating for "Dom Pérignon": 4.5
[CSV Import] Parsed rating for "Sassicaia": 4.7
```

### Step 3: Verify in UI

After import:
1. Go to **Cellar** page
2. Check if ratings appear: ★★★★⯪ 4.6
3. Go to **Dashboard** → **Tonight's Selection**
4. Ratings should appear there too

### Step 4: Verify in Database

Run this SQL in Supabase:

```sql
SELECT 
  wine_name,
  producer,
  rating,
  vivino_url,
  image_url
FROM wines
WHERE user_id = auth.uid()
AND rating IS NOT NULL
ORDER BY rating DESC
LIMIT 10;
```

**Expected**: You should see your imported wines with ratings populated.

---

## Common Issues & Solutions

### Issue: Ratings still NULL in database

**Possible causes:**

1. **Rating column not mapped during import**
   - Check console logs: Does it say `rating: "Average rating"` or `rating: undefined`?
   - If undefined → Your CSV column name is different, manually map it in the UI

2. **Rating values are empty in CSV**
   - Check your CSV: Do the rating cells have values?
   - Vivino exports sometimes have empty ratings for wines you haven't rated

3. **Database migration not run**
   - Run the migration SQL from `RATING_TROUBLESHOOTING.md`

### Issue: Console shows "Rating X is out of range"

**Cause**: Your CSV might be using a different rating scale (e.g., 0-100 instead of 0-5).

**Solution**: 
- Check your CSV data
- If it's Vivino data, it should be 0-5 scale
- If it's custom data, you may need to normalize it manually

### Issue: Decimal parsing errors

**Example**: Rating "4,2" appears as NULL instead of 4.2

**Solution**: This should now be fixed! The parser converts "4,2" → "4.2" automatically.

---

## Expected CSV Format (Vivino Export)

```csv
Wine,Producer,Vintage,Type,Region,Country,Average rating,Url,Image
Château Margaux,Château Margaux,2015,Red,Bordeaux,France,4.6,https://vivino.com/...,https://images.vivino.com/...
Dom Pérignon,Moët & Chandon,2012,Sparkling,Champagne,France,4.5,https://vivino.com/...,https://images.vivino.com/...
Sassicaia,Tenuta San Guido,2017,Red,Tuscany,Italy,4.7,https://vivino.com/...,https://images.vivino.com/...
```

---

## Testing Checklist

- [ ] CSV import detects "Average rating" column automatically
- [ ] Ratings are parsed correctly (both "4.2" and "4,2" formats)
- [ ] Ratings appear in Cellar list with stars
- [ ] Ratings appear in Tonight's Selection widget
- [ ] Ratings persist in database (check via SQL)
- [ ] Console shows parsed ratings for first 3 wines
- [ ] No TypeScript or runtime errors
- [ ] Wine images import correctly (no longer overwritten with null)

---

## Code Changes Summary

**File**: `apps/web/src/components/CSVImport.tsx`

1. **Line 155-161**: Enhanced rating column detection
2. **Line 247-264**: Improved rating parsing with comma support
3. **Line 168-176**: Added debug logging
4. **Line 283**: Removed duplicate `image_url` property

All changes are **backward compatible** - existing imports will continue to work.




