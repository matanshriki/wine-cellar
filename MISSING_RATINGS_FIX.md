# Fix Missing Ratings

## Issue
Some bottles don't show Vivino ratings in the cellar page.

## Root Cause
The `rating` and `vivino_url` columns were added to the database recently, but:
1. The migration may not have been run yet
2. Existing wines in the database don't have ratings
3. New CSV imports with ratings will work, but old data won't have them

## Solution

### Step 1: Run the Database Migration
1. Open Supabase Dashboard → SQL Editor
2. Run this migration (if not already done):

```sql
-- Add rating and vivino_url columns to wines table
ALTER TABLE public.wines
ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1) CHECK (rating >= 0 AND rating <= 5),
ADD COLUMN IF NOT EXISTS vivino_url TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS wines_rating_idx ON public.wines(rating) WHERE rating IS NOT NULL;
```

3. Click "Run" to execute

### Step 2: Re-import Your Vivino CSV
To populate ratings for existing wines:
1. Export your latest Vivino data (see VivinoExportGuide in the app)
2. Go to Cellar → Import CSV
3. Map columns including:
   - Rating (Vivino rating column)
   - Vivino URL (optional)
   - Image URL (optional)
4. Import the CSV

### Step 3: Verify
1. Hard refresh the app (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. Check the Cellar page → ratings should now appear
3. Check Tonight's Selection → ratings should appear
4. Check Tonight's Recommendations → ratings should appear

## Expected Behavior
- Bottles WITH ratings: Show star rating (★★★★⯪ 4.2) and Vivino badge
- Bottles WITHOUT ratings: No rating section shown (clean, not broken)

## Note
If a wine doesn't have a rating in Vivino, that's OK! The app handles it gracefully and just doesn't show the rating section.


