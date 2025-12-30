# 🌟 Vivino Rating & Link Feature

## ✨ What's New

Your wine cellar app now displays **Vivino community ratings** and links directly to wine pages on Vivino!

---

## 🎯 Features

### 1. Star Ratings ⭐
- Visual 5-star display (★★★★☆)
- Decimal precision (e.g., 4.2 stars)
- Half-star support for decimals
- Luxury wine-colored stars

### 2. Vivino Links 🔗
- Clickable "Vivino" badge on each bottle
- Opens full Vivino page (reviews, food pairings, price history)
- Opens in new tab (doesn't leave your app)

### 3. CSV Import Support 📊
- Automatically captures rating from Vivino exports
- Automatically captures Vivino URL
- Auto-maps columns (detects "rating", "score", "url", "link")

---

## 🚀 Setup (Required)

### Run the Database Migration

**Step 1**: Open Supabase SQL Editor
- Go to: https://supabase.com/dashboard
- Select your Wine Cellar project
- Click "SQL Editor" → "New Query"

**Step 2**: Run This SQL
```sql
-- Add Vivino rating and URL to wines table
ALTER TABLE public.wines
ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1) CHECK (rating >= 0 AND rating <= 5),
ADD COLUMN IF NOT EXISTS vivino_url TEXT;

-- Add index for rating (useful for sorting/filtering by rating)
CREATE INDEX IF NOT EXISTS wines_rating_idx ON public.wines(rating) WHERE rating IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.wines.rating IS 'Vivino community rating (0-5 stars)';
COMMENT ON COLUMN public.wines.vivino_url IS 'Link to wine page on Vivino.com';
```

**Step 3**: Verify
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'wines' AND column_name IN ('rating', 'vivino_url');
```

Should show:
```
rating      | numeric
vivino_url  | text
```

---

## 📥 How to Import Vivino Data

### Option 1: CSV Import (Recommended)

1. **Export from Vivino**:
   - Follow the guide in your app: "Import CSV" → "How to export from Vivino"
   - Vivino will email you a CSV file

2. **Import to Your App**:
   - Click "Import CSV"
   - Upload the Vivino CSV
   - The app will auto-detect:
     - ✅ Rating column
     - ✅ Vivino URL column
     - ✅ All other wine details
   - Click "Import"

3. **Result**:
   - All bottles imported with ratings
   - Ratings display automatically in cellar view

### Option 2: Manual Entry

When adding a bottle manually:
- The rating field isn't in the form yet
- But you can add it later via database or future form update

---

## 🎨 What It Looks Like

### In Your Cellar View:

```
┌─────────────────────────────────────────┐
│ Château Margaux 2015           Red Wine │
│ Château Margaux                         │
│ ★★★★⯪ 4.7  [Vivino]                    │
│                                         │
│ 📅 2015    ×2                          │
│ 📍 Margaux, Bordeaux                   │
│ 🍇 Cabernet Sauvignon, Merlot          │
└─────────────────────────────────────────┘
```

### Star Display Logic:
- **4.0 stars**: ★★★★☆
- **4.2 stars**: ★★★★⯪ (half star)
- **4.7 stars**: ★★★★⯪
- **5.0 stars**: ★★★★★

### Vivino Badge:
- Small pill-shaped button
- Wine-colored background
- Clickable → opens Vivino page
- Stops event propagation (won't trigger card click)

---

## 🔍 How CSV Auto-Mapping Works

The app automatically detects these column names:

### Rating Column:
- "rating"
- "score"
- "Rating"
- "Community Rating"
- Any column containing "rating" or "score"

### Vivino URL Column:
- "url"
- "link"
- "vivino"
- "Vivino URL"
- "Wine URL"
- Any column containing "url", "link", or "vivino"

### Example Vivino CSV:
```csv
Wine,Producer,Vintage,Type,Region,Country,Rating,URL
Château Margaux,Château Margaux,2015,Red,Bordeaux,France,4.7,https://vivino.com/wines/12345
```

**Auto-mapped**:
- Wine → Name ✅
- Producer → Producer ✅
- Rating → Rating ✅
- URL → Vivino URL ✅

---

## 💡 Use Cases

### 1. Decide What to Open Tonight
- See which bottles have highest ratings
- Click Vivino link to read reviews
- Check food pairing suggestions
- Make informed decision

### 2. Track Your Collection Value
- High-rated wines often appreciate
- Monitor rating trends over time
- Identify hidden gems in your cellar

### 3. Discover Similar Wines
- Click Vivino link
- See "Similar Wines" section
- Find new bottles to buy

### 4. Share with Friends
- Show off your high-rated collection
- Send Vivino links for recommendations
- Help friends choose wines

---

## 🎯 Future Enhancements (Ideas)

### Automatic Vivino Data Fetching
If Vivino provides an API in the future:
- Auto-fetch rating when adding bottle
- Update ratings periodically
- Show review count
- Display price trends

### Filtering & Sorting
- Filter: "Show only 4+ star wines"
- Sort: "Highest rated first"
- Search: "Red wines rated 4.5+"

### Rating Analytics
- Average rating of your collection
- Rating distribution chart
- "Your taste profile" based on ratings

### Community Features
- Compare your ratings vs Vivino community
- Track which high-rated wines you've tried
- Wishlist of highly-rated wines

---

## 🐛 Troubleshooting

### Ratings Not Showing?

**Check 1**: Did you run the migration?
```sql
SELECT rating, vivino_url FROM wines LIMIT 5;
```

If error "column does not exist" → Run migration SQL

**Check 2**: Does your CSV have ratings?
- Open CSV in Excel/Numbers
- Look for "Rating" or "Score" column
- Values should be like "4.2", "3.8", etc.

**Check 3**: Was column mapped correctly?
- During CSV import, check the mapping step
- Ensure "Rating" is mapped to a column
- Ensure "Vivino URL" is mapped (optional)

### Vivino Link Not Working?

**Check**: Is the URL valid?
- Should start with `https://www.vivino.com/`
- Example: `https://www.vivino.com/wines/12345678`

**Fix**: If URL is missing:
- Re-import from Vivino CSV
- Or manually add URL in database

### Stars Look Wrong?

**Check**: Rating value in database
```sql
SELECT wine_name, rating FROM wines WHERE rating IS NOT NULL;
```

- Should be between 0 and 5
- Decimal format: 4.2, 3.8, etc.
- If outside range (e.g., 42 instead of 4.2), fix in database

---

## 📊 Database Schema

### wines table:
```sql
rating       DECIMAL(2,1)  -- 0.0 to 5.0 (e.g., 4.2)
vivino_url   TEXT          -- https://www.vivino.com/wines/...
```

### Constraints:
- Rating must be between 0 and 5
- Nullable (not all wines have ratings)
- Indexed for fast filtering/sorting

---

## 🎉 Summary

### What You Get:
✅ Visual star ratings in cellar view
✅ Direct links to Vivino pages
✅ Automatic CSV import support
✅ Luxury-themed design
✅ Mobile-responsive

### What You Need to Do:
1. ⚠️ **Run the SQL migration** (one-time, 30 seconds)
2. ✅ Import Vivino CSV (or re-import existing data)
3. ✅ Enjoy ratings in your cellar!

### Next Steps:
- Export your Vivino cellar (see in-app guide)
- Import the CSV
- See your ratings appear automatically
- Click Vivino links to explore

---

**🍷 Enjoy your enhanced wine cellar with community ratings!**



