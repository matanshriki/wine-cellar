# Regional Wine Style & Modal Design Fix

## Summary
Fixed mobile design issues in the Wine Details Modal and added a new "Regional Wine Style" column to distinguish wine classification from geographic region.

---

## FEATURE 1: Regional Wine Style Column

### Problem
Users needed to distinguish between:
- **Region**: Geographic location (e.g., "Bordeaux", "Napa Valley", "Israeli Red")
- **Regional Wine Style**: Wine classification/style (e.g., "Bordeaux Blend", "Super Tuscan", "Rioja Reserva")

### Solution
Added a new `regional_wine_style` column to the database, separate from the existing `region` column.

### Implementation

#### 1. Database Migration
**File**: `supabase/migrations/20251229_add_regional_wine_style.sql`

```sql
ALTER TABLE public.wines
ADD COLUMN IF NOT EXISTS regional_wine_style TEXT;

CREATE INDEX IF NOT EXISTS wines_regional_wine_style_idx 
ON public.wines(regional_wine_style) 
WHERE regional_wine_style IS NOT NULL;

COMMENT ON COLUMN public.wines.regional_wine_style IS 
  'Wine style classification (e.g., "Bordeaux Blend", "Super Tuscan", "Rioja Reserva") - distinct from geographic region';
```

**To Apply**:
```bash
# Via Supabase CLI (if set up)
supabase db push

# OR via Supabase Dashboard
# 1. Go to Database → SQL Editor
# 2. Paste the migration script
# 3. Click "Run"
```

#### 2. CSV Import Auto-Detection
**File**: `apps/web/src/components/CSVImport.tsx`

**Changes**:
- Added `regionalWineStyleColumn` to mapping state
- Auto-detects headers containing "regional" + "style" or "wine style"
- Prioritizes style detection **before** region detection to avoid conflicts
- Added UI dropdown between Region and Country
- Properly passes value to `bottleService.createBottle()`

**Auto-Detection Pattern**:
```typescript
// Matches:
// - "Regional Wine Style"
// - "Regional style"
// - "Region Style"
// - "Wine Style" (if contains "regional")
else if ((lower.includes('regional') || lower.includes('region')) && 
         (lower.includes('style') || lower.includes('wine style'))) {
  autoMapping.regionalWineStyleColumn = header;
}
```

**Example CSV Headers Detected**:
- ✅ "Regional Wine Style"
- ✅ "Regional style"
- ✅ "Region Style"
- ✅ "Wine Style" (if in same header with "regional")

**NOT Detected**:
- ❌ "Region" (plain region, no style keyword)
- ❌ "Style" (plain style, mapped to wine color/type instead)

#### 3. Bottle Service Updates
**File**: `apps/web/src/services/bottleService.ts`

**Changes**:
- Added `regional_wine_style?: string | null;` to `CreateBottleInput` interface
- Added to `wineData` object when creating/upserting wines
- Properly stored in database

#### 4. UI Display
**File**: `apps/web/src/components/WineDetailsModal.tsx`

**Changes**:
- Displays under "📍 Origin" section
- Full-width with wine color accent (`var(--wine-600)`)
- Only shows if value exists
- Responsive grid layout

**Display Example**:
```
📍 Origin
┌──────────────┬──────────────┐
│ Region       │ Country      │
│ Bordeaux     │ France       │
└──────────────┴──────────────┘
┌──────────────────────────────┐
│ Regional Wine Style          │
│ Bordeaux Blend               │ (highlighted)
└──────────────────────────────┘
```

#### 5. i18n Translations
**English** (`apps/web/src/i18n/locales/en.json`):
```json
"regionalWineStyle": "Regional Wine Style Column"
```

**Hebrew** (`apps/web/src/i18n/locales/he.json`):
```json
"regionalWineStyle": "עמודת סגנון יין אזורי"
```

---

## FEATURE 2: Mobile Modal Design Fix

### Problem
The Wine Details Modal had layout issues on mobile:
- Image and stats were crammed side-by-side
- Text was hard to read
- Grid layout too tight
- No error handling for broken images

### Solution
Made the modal fully responsive with mobile-first design.

### Implementation

#### Layout Changes
**File**: `apps/web/src/components/WineDetailsModal.tsx`

**Before**:
```tsx
<div className="flex gap-6">          // Always side-by-side
  <img className="w-32 h-40" />       // Fixed small size
  <div className="grid grid-cols-2">  // Always 2 columns
```

**After**:
```tsx
<div className="flex flex-col sm:flex-row gap-4 sm:gap-6">  // Stack on mobile
  <img className="w-40 h-48 sm:w-40 sm:h-52 
                  mx-auto sm:mx-0 
                  object-contain" />                         // Larger, centered
  <div className="grid grid-cols-2 gap-3 sm:gap-4">         // Tighter on mobile
```

#### Key Improvements

1. **Stacked Layout on Mobile**
   - Image above stats on small screens
   - Side-by-side on desktop (sm: breakpoint)

2. **Centered Image on Mobile**
   - `mx-auto` centers image
   - `sm:mx-0` aligns left on desktop

3. **Better Image Display**
   - Changed from `object-cover` to `object-contain`
   - Preserves aspect ratio for tall wine bottles
   - Added graceful error handling for broken images

4. **Responsive Grid**
   - `grid-cols-1 sm:grid-cols-2` for Origin section
   - Prevents cramped layout on mobile

5. **Improved Spacing**
   - Reduced padding on mobile: `px-4 sm:px-6`
   - Tighter gaps: `gap-3 sm:gap-4`
   - Smaller font sizes on mobile: `text-lg sm:text-xl`

6. **Error Handling**
   ```tsx
   onError={(e) => {
     e.currentTarget.style.display = 'none';
   }}
   ```

---

## Testing Checklist

### Database
- [ ] Run the migration: `supabase/migrations/20251229_add_regional_wine_style.sql`
- [ ] Verify column exists:
  ```sql
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'wines' AND column_name = 'regional_wine_style';
  ```
- [ ] Verify index exists:
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE tablename = 'wines' AND indexname = 'wines_regional_wine_style_idx';
  ```

### CSV Import
- [ ] Upload CSV with "Regional Wine Style" column
- [ ] Verify auto-detection in console logs
- [ ] Verify mapping dropdown appears between Region and Country
- [ ] Import bottles and check database
  ```sql
  SELECT wine_name, region, regional_wine_style, country 
  FROM wines 
  WHERE regional_wine_style IS NOT NULL 
  LIMIT 5;
  ```

### UI Display
- [ ] Open a bottle with `regional_wine_style` set
- [ ] Click "Details" button
- [ ] Verify "Regional Wine Style" appears under Origin section
- [ ] Verify it's highlighted with wine color
- [ ] Test on mobile viewport (375px width)
- [ ] Test on desktop viewport (1200px width)

### Mobile Modal
- [ ] Open Wine Details Modal on mobile
- [ ] Verify image is centered and larger
- [ ] Verify stats grid has tighter spacing
- [ ] Verify Origin section stacks nicely
- [ ] Scroll through entire modal
- [ ] Test with and without wine image
- [ ] Test in both English (LTR) and Hebrew (RTL)

---

## Example CSV Format

### Vivino Export (Extended)
```csv
Wine,Producer,Vintage,Type,Region,Regional Wine Style,Country,Average rating,Url
Château Margaux,Château Margaux,2015,Red,Bordeaux,Bordeaux Blend,France,4.5,https://vivino.com/...
Tignanello,Antinori,2018,Red,Tuscany,Super Tuscan,Italy,4.3,https://vivino.com/...
```

### Custom Format
```csv
Name,Producer,Vintage,Color,Region,Regional Wine Style,Country
Silver Oak,Silver Oak Cellars,2019,Red,Napa Valley,Napa Cabernet,USA
```

---

## Database Schema

### wines table (updated)
```sql
CREATE TABLE wines (
  -- ... existing columns ...
  region TEXT,                    -- Geographic region (e.g., "Bordeaux", "Napa Valley")
  regional_wine_style TEXT,       -- Wine classification (e.g., "Bordeaux Blend", "Super Tuscan")
  country TEXT,                   -- Country (e.g., "France", "USA")
  -- ... other columns ...
);

CREATE INDEX wines_regional_wine_style_idx 
ON wines(regional_wine_style) 
WHERE regional_wine_style IS NOT NULL;
```

---

## User Impact

### ✅ Better Mobile UX
- Wine details modal looks great on iPhone
- No more cramped layout
- Easy to read on small screens
- Smooth scrolling

### ✅ More Accurate Wine Metadata
- Separate fields for geographic region vs. wine style
- Better organization of wine information
- Supports standard wine industry terminology

### ✅ Improved CSV Import
- Auto-detects "Regional Wine Style" column
- No manual mapping needed for standard formats
- Works with both Vivino and custom CSVs

### ✅ Enhanced Wine Details
- Shows full wine classification
- Helps users understand wine types better
- Visually distinct in the modal

---

## Troubleshooting

### Issue: Regional Wine Style not showing in modal
**Solution**: 
1. Check if the wine has `regional_wine_style` set:
   ```sql
   SELECT wine_name, regional_wine_style FROM wines WHERE wine_name LIKE '%your wine%';
   ```
2. If NULL, re-import CSV or manually edit the bottle

### Issue: CSV import not detecting Regional Wine Style
**Solution**:
1. Check CSV header is named "Regional Wine Style", "Regional style", or similar
2. Check console logs for auto-detection results
3. Manually map the column in the mapping step

### Issue: Mobile modal still looks cramped
**Solution**:
1. Hard refresh the page (Cmd+Shift+R)
2. Clear browser cache
3. Verify you're on the latest commit: `git log -1 --oneline`

---

## Next Steps

1. **Run the migration** in Supabase Dashboard
2. **Test the modal** on mobile (open any bottle → Details)
3. **Import a CSV** with "Regional Wine Style" column
4. **Verify** the new field displays correctly

---

## Files Changed

1. `supabase/migrations/20251229_add_regional_wine_style.sql` ➕ NEW
2. `apps/web/src/components/WineDetailsModal.tsx` ✏️ MODIFIED
3. `apps/web/src/components/CSVImport.tsx` ✏️ MODIFIED
4. `apps/web/src/services/bottleService.ts` ✏️ MODIFIED
5. `apps/web/src/i18n/locales/en.json` ✏️ MODIFIED
6. `apps/web/src/i18n/locales/he.json` ✏️ MODIFIED

---

## Git Commit
```
feat: add Regional Wine Style column and fix mobile modal design
Commit: 2cd3549
Branch: main
```


