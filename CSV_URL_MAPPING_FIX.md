# ✅ CSV Import - Vivino URL & Image URL Mapping Fix

## 🎉 Status: Successfully Deployed

**Date:** December 30, 2025  
**Commit:** `b0960dc`  
**Deployed to:** Production (Vercel)

---

## 📋 Problem Solved

When importing CSV files (especially Vivino exports), the following columns needed better auto-detection and mapping:
1. **"Vivino URL"** (from CSV) → **"Link to Wine"** (in database as `vivino_url`)
2. **"Image URL"** (from CSV) → **"Wine Image"** (in database as `image_url`)

---

## ✅ What Was Fixed

### 1. **Enhanced Auto-Detection**

The CSV import now prioritizes exact matches for Vivino export columns:

**For Vivino URL / Link to Wine:**
- ✅ Exact match: `"Vivino URL"`, `"URL"`, `"Url"`, `"Link"`
- ✅ Partial match: Contains "vivino" + "url", "wine" + "url", "link" + "wine"
- ✅ Backward compatible with existing detection

**For Image URL:**
- ✅ Exact match: `"Image URL"`, `"Image"`, `"Picture URL"`, `"Photo URL"`
- ✅ Partial match: Contains "image" + "url", "wine" + "image", "label" + "image"
- ✅ Backward compatible with existing detection

### 2. **Improved UI Labels**

Made the mapping UI more descriptive:

**Before:**
- "Vivino URL (optional)"
- "Image URL (optional)"

**After:**
- **"Link to Wine / Vivino URL (optional)"** - Clearer purpose
- **"Wine Image URL (optional)"** - Specifies it's the wine's image

### 3. **Enhanced Debugging**

Added comprehensive logging to help verify data extraction:

```javascript
[CSV Import] Column indices: {
  vivinoUrlIdx: 12,
  imageUrlIdx: 13
}

[CSV Import] First row sample: {
  wineName: 'Château Margaux',
  rating: '4.5',
  quantity: '2',
  vivinoUrl: 'https://www.vivino.com/wines/...',
  imageUrl: 'https://images.vivino.com/...'
}

[CSV Import] URLs for "Château Margaux": {
  vivinoUrl: 'https://www.vivino.com/wines/...',
  imageUrl: 'https://images.vivino.com/...'
}
```

---

## 🗂️ Database Mapping

### CSV Columns → Database Fields

| CSV Column Name | Database Field | Purpose | Type |
|----------------|----------------|---------|------|
| "Vivino URL", "URL", "Link" | `vivino_url` | Link to wine page on Vivino | `text` (optional) |
| "Image URL", "Image" | `image_url` | URL of wine label/bottle image | `text` (optional) |

### Where Data is Stored

Both fields are stored in the `wines` table:

```sql
CREATE TABLE wines (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  wine_name text NOT NULL,
  producer text,
  -- ... other fields ...
  vivino_url text,    -- Link to wine on Vivino
  image_url text,     -- Wine label/bottle image URL
  -- ... other fields ...
);
```

---

## 🧪 Testing the Fix

### Test 1: Import Vivino CSV

1. **Export from Vivino:**
   - Go to Vivino → My Wines → Export to CSV
   - Download the CSV file

2. **Import into Wine App:**
   - Go to Cellar page
   - Click "Import CSV"
   - Upload your Vivino export
   - Verify auto-mapping shows:
     - ✅ "Url" → **Link to Wine / Vivino URL**
     - ✅ "Image" → **Wine Image URL**

3. **Complete Import:**
   - Review the mapping
   - Click "Import"
   - Check browser console for logs showing URLs extracted

4. **Verify in Database:**
   - Open a bottle's details
   - Check if Vivino link is available
   - Check if wine image is displayed

### Test 2: Custom CSV with URLs

Create a CSV with these columns:

```csv
name,producer,vintage,type,rating,quantity,vivino_url,image_url
Château Margaux,Château Margaux,2015,red,4.5,2,https://www.vivino.com/wines/123,https://images.example.com/wine.jpg
Dom Pérignon,Moët & Chandon,2012,sparkling,4.7,1,https://www.vivino.com/wines/456,https://images.example.com/champagne.jpg
```

**Expected Result:**
- ✅ `vivino_url` column auto-mapped to "Link to Wine / Vivino URL"
- ✅ `image_url` column auto-mapped to "Wine Image URL"
- ✅ Both URLs saved correctly in database

### Test 3: Console Verification

After importing, check browser console (F12) for logs:

```
[CSV Import] Column indices: {
  ratingIdx: 4,
  quantityIdx: 5,
  vivinoUrlIdx: 6,
  imageUrlIdx: 7
}

[CSV Import] First row sample: {
  wineName: 'Château Margaux',
  rating: '4.5',
  quantity: '2',
  vivinoUrl: 'https://www.vivino.com/wines/123',
  imageUrl: 'https://images.example.com/wine.jpg'
}

[CSV Import] URLs for "Château Margaux": {
  vivinoUrl: 'https://www.vivino.com/wines/123',
  imageUrl: 'https://images.example.com/wine.jpg'
}

✓ 2 bottles imported successfully
```

---

## 🎯 Use Cases

### Use Case 1: View Wine on Vivino

After importing, users can:
1. Open bottle details
2. Click the Vivino link (if provided in CSV)
3. View the wine on Vivino website

### Use Case 2: Display Wine Images

After importing, wine images are automatically displayed:
1. In the Cellar page (bottle cards)
2. In the Tonight's Selection
3. In the Bottle details modal
4. In Recommendations

**Priority:**
1. User-uploaded image (highest)
2. AI-generated label image
3. **CSV Image URL** (NEW!)
4. Default placeholder (lowest)

---

## 📊 Column Detection Examples

### Vivino Export Columns (Auto-Detected)

| CSV Header | Detected As | Database Field |
|-----------|-------------|----------------|
| "Url" | Link to Wine / Vivino URL | `vivino_url` |
| "Image" | Wine Image URL | `image_url` |
| "Wine" | Wine Name | `wine_name` |
| "Vintage" | Vintage | `vintage` |
| "Type" | Style/Color | `color` |
| "Average rating" | Rating | `rating` |

### Custom CSV Columns (Also Supported)

| CSV Header | Detected As | Database Field |
|-----------|-------------|----------------|
| "Vivino URL" | Link to Wine / Vivino URL | `vivino_url` |
| "Link" | Link to Wine / Vivino URL | `vivino_url` |
| "Wine Link" | Link to Wine / Vivino URL | `vivino_url` |
| "Image URL" | Wine Image URL | `image_url` |
| "Picture URL" | Wine Image URL | `image_url` |
| "Label Image" | Wine Image URL | `image_url` |

---

## 🔧 Technical Details

### Auto-Detection Logic

```javascript
// Priority 1: Exact matches (case-insensitive)
if (lower === 'vivino url' || lower === 'url' || lower === 'link') {
  autoMapping.vivinoUrlColumn = header;
}

if (lower === 'image url' || lower === 'image' || lower === 'picture url') {
  autoMapping.imageUrlColumn = header;
}

// Priority 2: Partial matches
if (lower.includes('vivino') && lower.includes('url')) {
  autoMapping.vivinoUrlColumn = header;
}

if (lower.includes('image') && lower.includes('url')) {
  autoMapping.imageUrlColumn = header;
}
```

### Data Flow

```
CSV File
  ↓
Auto-Detection (exact match → partial match)
  ↓
Column Mapping UI (user can override)
  ↓
Extract row[vivinoUrlIdx] → vivinoUrl
Extract row[imageUrlIdx] → imageUrl
  ↓
CreateBottleInput {
  vivino_url: vivinoUrl,
  image_url: imageUrl,
  ...other fields
}
  ↓
Database (wines table)
  ↓
UI Display (bottle cards, details, recommendations)
```

---

## ✅ Success Criteria

### Technical Success ✅
- [x] Build succeeds without errors
- [x] Auto-detection prioritizes exact matches
- [x] UI labels are descriptive
- [x] Console logs show URL extraction
- [x] Backward compatible with existing CSVs

### User Success (To Verify)
- [ ] Vivino CSV imports with URLs detected automatically
- [ ] Custom CSVs with URLs work correctly
- [ ] Wine images display from CSV Image URLs
- [ ] Vivino links work when clicked
- [ ] Console logs help debug import issues

---

## 🐛 Troubleshooting

### Problem: URLs Not Auto-Detected

**Symptoms:**
- "Link to Wine / Vivino URL" shows "Skip" after upload
- "Wine Image URL" shows "Skip" after upload

**Solution:**
1. Check your CSV column headers
2. Ensure they match one of:
   - For Vivino URL: "Url", "URL", "Vivino URL", "Link", "Wine Link"
   - For Image URL: "Image", "Image URL", "Picture URL", "Photo URL"
3. Manually select the correct column in the mapping step

### Problem: URLs Not Saved to Database

**Symptoms:**
- Console logs show URLs extracted
- But URLs don't appear in bottle details

**Solution:**
1. Check browser console for errors
2. Verify database fields exist:
   ```sql
   SELECT vivino_url, image_url FROM wines WHERE id = 'bottle-id';
   ```
3. Check RLS policies allow user to write these fields

### Problem: Images Not Displaying

**Symptoms:**
- `image_url` is saved in database
- But image doesn't show in UI

**Solution:**
1. Verify URL is valid (check in browser)
2. Check for CORS issues (some image hosts block hotlinking)
3. Ensure URL starts with `http://` or `https://`
4. Try opening the URL directly in a browser

---

## 📝 Files Changed

- `apps/web/src/components/CSVImport.tsx`:
  - Enhanced auto-detection logic for URL columns
  - Improved UI labels
  - Added debugging logs

---

## 🎉 Summary

The CSV import now:
- ✅ **Auto-detects** Vivino URL and Image URL columns
- ✅ **Maps** them to the correct database fields
- ✅ **Displays** clearer labels in the UI
- ✅ **Logs** extraction for debugging
- ✅ **Works** with Vivino exports and custom CSVs

**Database Mapping:**
- CSV "Vivino URL" → Database `vivino_url` (Link to Wine)
- CSV "Image URL" → Database `image_url` (Wine Image)

**Next Action:** Import a Vivino CSV and verify URLs are correctly extracted!

---

**Cheers! 🍷📊**


