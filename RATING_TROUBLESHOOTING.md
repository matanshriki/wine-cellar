# Vivino Rating Troubleshooting Guide

## Why Ratings Aren't Showing

There are 3 possible reasons:

### 1. Database Migration Not Run ❌
**Check**: Open Supabase Dashboard → Database → Tables → wines → Check if `rating` and `vivino_url` columns exist

**Fix**: Run this SQL in Supabase SQL Editor:
```sql
-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'wines' 
AND column_name IN ('rating', 'vivino_url', 'image_url');

-- If they don't exist, run this:
ALTER TABLE public.wines
ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1) CHECK (rating >= 0 AND rating <= 5),
ADD COLUMN IF NOT EXISTS vivino_url TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE INDEX IF NOT EXISTS wines_rating_idx ON public.wines(rating) WHERE rating IS NOT NULL;
```

### 2. CSV Import Didn't Map Rating Column ❌
When you imported the CSV, you need to explicitly map the rating column.

**Check Your CSV**:
- Open your Vivino CSV file
- Look for a column with ratings (e.g., "Rating", "Score", "Vivino Rating")
- The values should be numbers like 4.2, 3.8, etc.

**Re-Import with Proper Mapping**:
1. Go to Cellar → Import CSV
2. Upload your Vivino CSV
3. **In the mapping step**, make sure you select:
   - **Rating column** → the column with your Vivino ratings
   - **Vivino URL column** → the column with Vivino wine page URLs (optional)
   - **Image URL column** → the column with wine bottle images (optional)
4. Complete the import

### 3. Old Wines Don't Have Ratings ❌
If you already have wines in your database from before the rating feature was added, they won't have ratings.

**Fix**: Re-import your Vivino CSV with the rating column mapped. The app will UPDATE existing wines with the new rating data.

---

## Quick Diagnostic SQL

Run this in Supabase SQL Editor to see what's in your database:

```sql
-- Check if rating column exists and has data
SELECT 
  wine_name,
  producer,
  rating,
  vivino_url,
  image_url
FROM wines
WHERE user_id = auth.uid()
LIMIT 10;
```

**What to look for**:
- If you see an error → migration not run (go to Fix #1)
- If `rating` column shows NULL for all wines → CSV import didn't map correctly (go to Fix #2)
- If some wines have ratings and others don't → partial data (go to Fix #3)

---

## Expected CSV Format

Your Vivino CSV should look like this:

```csv
Wine,Producer,Vintage,Type,Region,Country,Rating,Url,Image
Château Margaux,Château Margaux,2015,Red,Bordeaux,France,4.6,https://vivino.com/...,https://images.vivino.com/...
Dom Pérignon,Moët & Chandon,2012,Sparkling,Champagne,France,4.5,https://vivino.com/...,https://images.vivino.com/...
```

The column names can be different, but you need:
- **Rating**: A number between 0-5
- **Url** or **Link**: Vivino wine page URL (optional)
- **Image**: Wine bottle image URL (optional)

---

## Test It

After fixing:
1. **Hard refresh** your browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. Go to Cellar page
3. Check if ratings appear: ★★★★⯪ 4.2

---

## Still Not Working?

1. Open browser console (F12)
2. Go to Network tab
3. Refresh the Cellar page
4. Look for the `/bottles` API call
5. Check the response → look for `wine.rating` field
6. If `rating` is null → data issue
7. If `rating` has a value but doesn't show → UI issue (let me know!)




