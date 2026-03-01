# 🖼️ Image Storage Fix - Permanent Solution

## Problem
Storing Supabase Storage **signed URLs** in the database causes images to **expire and break** after the signature expires (typically 1 hour to 7 days).

## Solution
Store **stable storage paths** instead of URLs, and generate URLs at runtime.

---

## 📋 Implementation Checklist

### 1. Database Migration ✅
Run this migration in Supabase SQL Editor:

**File:** `supabase/migrations/20260211_add_image_paths.sql`

```sql
-- Adds path columns to bottles and wines tables
-- Run this in Supabase SQL Editor
```

**What it does:**
- Adds `image_path` and `label_image_path` columns to `bottles` and `wines` tables
- Keeps old `*_url` columns for backward compatibility
- Adds indexes for efficient backfill queries

### 2. Code Changes ✅

#### A. Storage Utility Service
**New file:** `apps/web/src/services/storageImageService.ts`

**Key functions:**
- `getStorageImageUrl(bucket, path)` - Generates URLs at runtime with caching
- `extractPathFromSignedUrl(url)` - Extracts path from legacy URLs
- `isStorageUrl(url)` - Detects Supabase Storage URLs

**Caching:**
- In-memory cache with 50-minute TTL
- Prevents repeated URL generation
- Automatic expiry handling

#### B. Upload Flow Updated
**File:** `apps/web/src/services/labelScanService.ts`

**Before:**
```typescript
// ❌ BAD: Returns signed URL (expires!)
export async function uploadLabelImage(file: File): Promise<string> {
  // ... upload ...
  const { data } = await supabase.storage.createSignedUrl(path, 600);
  return data.signedUrl; // ❌ This expires!
}
```

**After:**
```typescript
// ✅ GOOD: Returns stable path
export async function uploadLabelImage(file: File): Promise<{
  path: string;
  bucket: string;
}> {
  // ... upload ...
  return { path: fileName, bucket: 'labels' }; // ✅ Stable!
}
```

#### C. Display Logic Updated
**File:** `apps/web/src/hooks/useWineDisplayImage.ts`

**New React hook:**
```typescript
const { imageUrl, isGenerated, isLoading } = useWineDisplayImage(wine);
```

**Priority:**
1. `wine.image_path` → generate URL from path
2. `wine.image_url` → if Supabase URL, extract path; otherwise use as-is (external)
3. `wine.label_image_path` → generate URL from path
4. `wine.label_image_url` → if Supabase URL, extract path; otherwise use as-is
5. `wine.generated_image_path` → generate URL from path
6. Placeholder

**Legacy support:**
- Backward compatible with `getWineDisplayImage()` function
- Automatically handles expired signed URLs by extracting paths

#### D. Bottle Creation Updated
**File:** `apps/web/src/services/bottleService.ts`

**CreateBottleInput interface:**
```typescript
{
  // NEW: Stable paths (preferred)
  image_path?: string | null;
  label_image_path?: string | null;
  // Legacy: URLs (for external images or backward compat)
  image_url?: string | null;
}
```

**Database insert:**
- Saves both path and URL (if provided)
- Path takes priority during display

---

## 🔄 Backfill Process

### Admin Tool
**Component:** `AdminImageBackfill` (in ProfilePage)

**Features:**
- Shows counts of images needing backfill
- One-click batch processing
- Progress bar with real-time updates
- Luxury UI matching app design

### Edge Function
**File:** `supabase/functions/backfill-image-paths/index.ts`

**Process:**
1. Query rows where `*_path IS NULL` and `*_url` contains `/storage/v1/object/`
2. Extract path from URL using regex
3. Save path to `*_path` column
4. Process 100 records per batch
5. Repeat until complete

**Safety:**
- Admin-only access
- Non-destructive (keeps old URLs)
- Resumable (processes remaining rows)
- Error tracking

### How to Run Backfill

1. **Deploy the Edge Function:**
   ```bash
   supabase functions deploy backfill-image-paths
   ```

2. **Open Profile Page as Admin:**
   - Navigate to `/profile`
   - Scroll to "Image Path Backfill" section
   - Click "Refresh Counts" to see how many images need backfilling

3. **Start Backfill:**
   - Click "Start Backfill"
   - Wait for completion (processes 100 at a time)
   - Check progress bar

4. **Verify:**
   - All images should still display correctly
   - New uploads will save paths automatically
   - Legacy URLs will work via path extraction

---

## 🎯 What Changes for Users

### Before
- Upload image → signed URL stored in DB
- Images work initially
- After URL expires → **broken images** ❌

### After
- Upload image → **path** stored in DB
- URL generated on demand from path
- Images **never expire** ✅

### No Breaking Changes
- Existing external URLs (Vivino, etc.) still work
- Legacy signed URLs automatically converted via path extraction
- Smooth migration with zero downtime

---

## 🧪 Testing Checklist

### New Uploads
- [ ] Upload a label image via camera
- [ ] Verify image appears immediately
- [ ] Check DB: `image_path` should have value like `userId/uuid.jpg`
- [ ] Refresh page → image still shows

### Legacy Images (with expired URLs)
- [ ] Run backfill tool
- [ ] Check DB: `*_path` columns populated
- [ ] Refresh app → images reappear ✨

### External Images (Vivino, etc.)
- [ ] Images from external URLs still work
- [ ] No path extraction attempted for non-Storage URLs

### AI Generated Images
- [ ] Already working (they used paths from day 1!)
- [ ] Continue to work as before

---

## 🔧 Technical Details

### Buckets Used
- `labels` - User-uploaded label photos (PUBLIC)
- `generated-labels` - AI-generated label art (PUBLIC)

### URL Generation Strategy
- **Public buckets:** Use `getPublicUrl()` (permanent, no expiry)
- **Private buckets:** Use `createSignedUrl()` with 1-hour expiry + caching

### Cache Strategy
- Cache TTL: 50 minutes (refresh before 60-min expiry)
- Cache key: `${bucket}:${path}`
- In-memory only (resets on page refresh - fine!)

### Path Format
```
labels/userId/uuid.jpg
generated-labels/userId/wine-id-style-hash.png
```

---

## 🚀 Deployment Steps

### 1. Run Database Migration
```sql
-- In Supabase SQL Editor:
-- Paste contents of supabase/migrations/20260211_add_image_paths.sql
```

### 2. Deploy Edge Function
```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
supabase functions deploy backfill-image-paths
```

### 3. Deploy App (Vercel)
```bash
git push origin feature/dark-mode-v2
# Or merge to main and push
```

### 4. Run Backfill (as Admin)
- Open `/profile` in production
- Run backfill tool
- Monitor progress
- Verify images reappear

### 5. Verify
- Test new uploads
- Check existing images still display
- Monitor Supabase Storage logs

---

## 📊 Monitoring

### Check Backfill Progress
```sql
-- Count remaining images needing backfill
SELECT 
  COUNT(*) FILTER (WHERE image_path IS NULL AND image_url LIKE '%/storage/v1/object/%') as bottles_image,
  COUNT(*) FILTER (WHERE label_image_path IS NULL AND label_image_url LIKE '%/storage/v1/object/%') as bottles_label
FROM bottles;

SELECT 
  COUNT(*) FILTER (WHERE image_path IS NULL AND image_url LIKE '%/storage/v1/object/%') as wines_image,
  COUNT(*) FILTER (WHERE label_image_path IS NULL AND label_image_url LIKE '%/storage/v1/object/%') as wines_label
FROM wines;
```

### Verify Path Extraction
```sql
-- Sample: Check that paths were extracted correctly
SELECT 
  id,
  image_url,
  image_path,
  label_image_url,
  label_image_path
FROM bottles
WHERE image_path IS NOT NULL OR label_image_path IS NOT NULL
LIMIT 10;
```

---

## 🎨 UI Enhancements

### Loading States
Images load asynchronously now. Components should:
- Show skeleton shimmer while loading
- Handle `isLoading` state from `useWineDisplayImage()` hook
- Graceful fallback to placeholder if load fails

### Error Handling
- 401/403 errors → auto-retry with fresh signed URL
- Network errors → show premium placeholder
- Invalid paths → show placeholder

---

## 💡 Best Practices

### For New Features
**Always use paths:**
```typescript
// ✅ GOOD: Save path
const { path, bucket } = await uploadLabelImage(file);
await saveToDatabase({ image_path: path });

// ❌ BAD: Don't save URLs
const url = await createSignedUrl(path, 3600);
await saveToDatabase({ image_url: url }); // Will expire!
```

### For Display
**Use the hook:**
```typescript
// ✅ GOOD: Generate URL at runtime
const { imageUrl, isLoading } = useWineDisplayImage(wine);

// ❌ BAD: Use stored URL directly
<img src={wine.image_url} /> // Might be expired!
```

---

## 🔐 Security

### RLS Policies
- Users can only access their own images
- Public buckets readable by all
- Admin can access all for backfill

### Path Validation
- Paths validated on upload
- No directory traversal possible
- UUID-based filenames prevent conflicts

---

## 📦 Files Modified

### New Files
- `apps/web/src/services/storageImageService.ts` - URL generation utility
- `apps/web/src/hooks/useWineDisplayImage.ts` - React hook for async image loading
- `apps/web/src/components/AdminImageBackfill.tsx` - Admin backfill UI
- `supabase/functions/backfill-image-paths/index.ts` - Backfill Edge Function
- `supabase/migrations/20260211_add_image_paths.sql` - Database migration

### Modified Files
- `apps/web/src/services/labelScanService.ts` - Returns paths
- `apps/web/src/services/bottleService.ts` - Saves paths
- `apps/web/src/services/labelArtService.ts` - Uses storage utility
- `apps/web/src/components/BottleForm.tsx` - Handles paths
- `apps/web/src/pages/CellarPage.tsx` - Passes paths through
- `apps/web/src/pages/WishlistPage.tsx` - Generates temp URLs for AI
- All scan services updated

---

## ✅ Success Criteria

- [ ] New uploads save paths to DB (not URLs)
- [ ] Images display correctly after upload
- [ ] Images don't break after refresh/time passes
- [ ] Backfill converts all legacy URLs to paths
- [ ] External URLs (Vivino, etc.) still work
- [ ] AI-generated images continue working
- [ ] No regressions in scan flows
- [ ] iOS PWA works correctly

---

## 🆘 Troubleshooting

### Images Not Showing
1. Check browser console for errors
2. Verify path column has value in DB
3. Check bucket name is correct ('labels', 'generated-labels')
4. Verify RLS policies allow access

### Backfill Stuck
1. Check Edge Function logs in Supabase Dashboard
2. Verify admin access
3. Check for malformed URLs in DB
4. Run query manually to identify problematic rows

### TypeScript Errors
1. Run `npm run build` to check for type issues
2. Update type definitions if needed
3. Ensure all optional fields marked with `?`

---

**Status:** ✅ IMPLEMENTED
**Ready for:** Local testing → Deploy → Backfill → Verify
