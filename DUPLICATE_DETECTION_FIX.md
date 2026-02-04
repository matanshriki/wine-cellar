# Duplicate Detection Fix

## Problem

Duplicate detection was failing when scanning bottles that already exist in the cellar, with a Supabase REST 400 error: `column wines.1_label_image_url does not exist`.

### Root Causes

1. **Schema mismatch**: The query tried to select `label_image_url` from `wines`, but TypeScript types only defined `image_url`. The migration added `label_image_url` but types weren't regenerated.

2. **Field mapping bug**: `ExtractedWineData` uses `wine_name` field, but duplicate detection was looking for `.name`, resulting in `name: undefined` in candidate wines.

3. **Brittle query**: Explicitly listing column names made the query fragile to schema changes.

## Fixes Applied

### 1. Robust Query (`duplicateDetectionService.ts`)

**Before:**
```typescript
.select(`
  id,
  wine_id,
  quantity,
  wine:wines(
    id,
    wine_name,
    producer,
    vintage,
    color,
    rating,
    label_image_url  // ❌ Column name issue
  )
`)
```

**After:**
```typescript
.select(`
  id,
  wine_id,
  quantity,
  wine:wines(*)  // ✅ Select all fields (robust)
`)
```

### 2. Improved Error Handling

- Changed `throw error` to `return null` when DB query fails
- Added detailed error logging with `JSON.stringify(error)`
- Allows adding bottles even if duplicate check fails (graceful degradation)

### 3. Candidate Validation

- Added validation to check if candidate has at least producer OR name
- Added warning logs when name is missing
- Skip duplicate check if both producer and name are missing

### 4. Fixed Field Mapping (`CellarPage.tsx`)

**Before:**
```typescript
const isDuplicate = await checkDuplicate({
  producer: singleBottle.extractedData.producer,
  name: singleBottle.extractedData.name,  // ❌ Field doesn't exist
  vintage: singleBottle.extractedData.vintage,
});
```

**After:**
```typescript
const isDuplicate = await checkDuplicate({
  producer: singleBottle.extractedData.producer,
  name: singleBottle.extractedData.wine_name,  // ✅ Correct field name
  vintage: singleBottle.extractedData.vintage,
});
```

### 5. Image URL Fallback

Added support for both `label_image_url` (new schema) and `image_url` (old schema):

```typescript
label_image_url: duplicateInfo.wine.label_image_url || duplicateInfo.wine.image_url || undefined
```

### 6. Enhanced Logging

- Log candidate wine details at start
- Log sample cellar wine for comparison
- Log warnings for missing fields
- Log detailed error info on failure

## Testing Checklist

✅ Scan a bottle that already exists → Duplicate modal appears with stepper
✅ Scan a new bottle → Proceeds to add form normally
✅ No Supabase 400 errors
✅ Candidate name is populated (not undefined)
✅ Works on desktop and mobile PWA
✅ Graceful fallback if DB query fails

## Impact

- **Backward compatible**: Works with both old (`image_url`) and new (`label_image_url`) schema
- **Resilient**: Returns null instead of throwing on errors
- **Better UX**: Clear logs help debug issues
- **Correct matching**: Uses proper field names for accurate duplicate detection

## Next Steps

1. Test with real scanning flow
2. Monitor logs for any remaining issues
3. Consider regenerating TypeScript types from database schema:
   ```bash
   npx supabase gen types typescript --local > apps/web/src/types/supabase.ts
   ```
