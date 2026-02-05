# "Create Separate Bottle" Button Fix

## Problem

When duplicate detection identifies an existing bottle and shows the modal, clicking "Create separate entry" button did nothing - the modal closed but the add flow didn't continue.

### Root Cause

The flow had a data mismatch between what was stored and what was expected:

1. **Duplicate check** stored only: `{ producer, name, vintage }`
2. **onCreateSeparate handler** expected: `{ imageUrl, extractedData, ... }`
3. **Condition check** failed because required fields were missing
4. **Result**: Nothing happened, form didn't open

## Fixes Applied

### 1. Store Full Context During Duplicate Check (`CellarPage.tsx`)

**Before:**
```typescript
const isDuplicate = await checkDuplicate({
  producer: singleBottle.extractedData.producer,
  name: singleBottle.extractedData.wine_name,
  vintage: singleBottle.extractedData.vintage,
  // ❌ Missing imageUrl and extractedData
});
```

**After:**
```typescript
const isDuplicate = await checkDuplicate({
  producer: singleBottle.extractedData.producer,
  name: singleBottle.extractedData.wine_name,
  vintage: singleBottle.extractedData.vintage,
  // ✅ Store full context for "Create separate" flow
  imageUrl,
  extractedData: singleBottle.extractedData,
});
```

### 2. Updated Hook Interface (`useDuplicateDetection.tsx`)

Enhanced `checkAndHandle` to accept additional context:

```typescript
const checkAndHandle = async (candidate: {
  producer?: string | null;
  name?: string | null;
  vintage?: number | null;
  imageUrl?: string; // Optional: for "Create separate" flow
  extractedData?: any; // Optional: for "Create separate" flow
  [key: string]: any; // Allow additional context
}): Promise<boolean>
```

Key change:
- Check for duplicates using only `{ producer, name, vintage }`
- Store full candidate object (with imageUrl, extractedData, etc.) for later use

### 3. Added Comprehensive Logging

Added logging at each step to help debug:

**In hook (`useDuplicateDetection.tsx`):**
```typescript
console.log('[useDuplicateDetection] User chose to create separate entry');
console.log('[useDuplicateDetection] Pending candidate:', pendingCandidate);
console.log('[useDuplicateDetection] Has onCreateSeparate handler:', !!props?.onCreateSeparate);
```

**In page (`CellarPage.tsx`):**
```typescript
console.log('[CellarPage] User chose to create separate entry', candidate);
console.log('[CellarPage] Opening form with extracted data');
console.warn('[CellarPage] Missing imageUrl or extractedData in candidate:', {...});
```

### 4. Added Fallback Behavior

If `imageUrl` or `extractedData` are missing, open an empty form instead of doing nothing:

```typescript
if (candidate.imageUrl && candidate.extractedData) {
  // Open form with extracted data
  setExtractedData({ imageUrl: candidate.imageUrl, data: candidate.extractedData });
  setEditingBottle(null);
  setShowForm(true);
} else {
  console.warn('[CellarPage] Missing data, opening empty form');
  // Fallback: open empty form
  setExtractedData(null);
  setEditingBottle(null);
  setShowForm(true);
}
```

## Technical Details

### Flow Diagram

**Before (broken):**
```
1. Scan bottle → checkDuplicate({ producer, name, vintage })
2. Duplicate found → store candidate { producer, name, vintage }
3. Click "Create separate" → call onCreateSeparate(candidate)
4. Check if (candidate.imageUrl && candidate.extractedData) → ❌ FALSE
5. Nothing happens
```

**After (fixed):**
```
1. Scan bottle → checkDuplicate({ producer, name, vintage, imageUrl, extractedData })
2. Duplicate found → store full candidate { producer, name, vintage, imageUrl, extractedData }
3. Click "Create separate" → call onCreateSeparate(candidate)
4. Check if (candidate.imageUrl && candidate.extractedData) → ✅ TRUE
5. Open form with extracted data
```

## Testing Checklist

✅ Build passes with no errors
✅ No linter issues
✅ Scan duplicate bottle → modal shows
✅ Click "Add bottles" → increments quantity
✅ Click "Create separate entry" → opens form with data pre-filled
✅ Comprehensive logging for debugging
✅ Fallback behavior if data missing

## User Experience Improvements

1. **Button now works**: Clicking "Create separate entry" opens the add form
2. **Data preserved**: All scanned data (image, wine info) is pre-filled in form
3. **Clear intent**: User can choose to create a separate entry if they want (e.g., different storage location, different purchase info)
4. **Fallback**: If something goes wrong, at least opens an empty form instead of doing nothing

## Files Changed

- `apps/web/src/pages/CellarPage.tsx` - Store full context, add logging, add fallback
- `apps/web/src/hooks/useDuplicateDetection.tsx` - Accept additional context, enhance logging
- `CREATE_SEPARATE_BOTTLE_FIX.md` - This documentation

## Related Features

This fix ensures the "Create separate entry" option works as designed in the duplicate detection feature:
- **Primary action**: Add to existing bottle (increment quantity)
- **Secondary action**: Create separate entry (new bottle record with same wine)
- **Tertiary action**: Cancel (close modal, do nothing)

All three actions now work correctly.
