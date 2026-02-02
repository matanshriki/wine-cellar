# Smart Scan Feature - Unified Single/Multi Bottle Detection

**Status**: ✅ Implemented  
**Date**: Feb 2, 2026  
**Feature**: Automatic single vs. multiple bottle detection with one unified scan option

---

## 🎯 What Changed

### Before (Separate Options)
```
Camera Button → Opens popup with 3 options:
├─ 1. Scan a single bottle
├─ 2. Enter manually
└─ 3. Scan multiple bottles (Beta)
```

### After (Smart Scan)
```
Camera Button → Opens popup with 2 options:
├─ 1. Scan Bottles (Smart - auto-detects single or multiple)
└─ 2. Enter manually
```

---

## 🧠 How Smart Scan Works

### User Flow

**Step 1**: User taps "Scan Bottles"
- Opens camera/photo library
- User takes or selects photo

**Step 2**: AI analyzes photo
- Shows loader: "Identifying bottle(s)…"
- Calls unified edge function with `mode: 'smart'`
- AI detects number of bottles in image

**Step 3**: Automatic routing based on detection

**If 1 bottle detected**:
```
✅ Single bottle mode
→ Shows single bottle confirmation form
→ User reviews and saves one bottle
```

**If 2+ bottles detected**:
```
✅ Multiple bottles mode  
→ Shows multi-bottle carousel/list
→ User reviews, selects, and saves multiple bottles
```

**If 0 bottles or error**:
```
⚠️ Fallback to single mode
→ Shows empty form
→ User enters details manually
```

---

## 🎨 UI Changes

### Add Bottle Sheet (Popup)

**Before**:
```
┌───────────────────────────────┐
│  Add Bottle                   │
├───────────────────────────────┤
│ 📷 Scan a single bottle       │
│ ✏️  Enter Manually             │
│ 🎬 Scan multiple bottles BETA │
└───────────────────────────────┘
```

**After**:
```
┌───────────────────────────────┐
│  Add Bottle                   │
├───────────────────────────────┤
│ 📷✨ Scan Bottles              │
│     AI detects single or      │
│     multiple automatically    │
│                               │
│ ✏️  Enter Manually             │
└───────────────────────────────┘
```

**Visual improvements**:
- Added AI sparkle icon (⭐) to camera button
- Clearer description text
- Removed confusing multiple options
- One-tap experience

---

## 🔧 Technical Implementation

### New Service: smartScanService.ts

**File**: `apps/web/src/services/smartScanService.ts`

**Key Functions**:

#### 1. `performSmartScan(file: File)`
Main orchestrator function:
- Uploads image
- Calls AI with `mode: 'smart'`
- Analyzes response
- Returns normalized result

**Returns**:
```typescript
{
  mode: 'single' | 'multi' | 'unknown',
  imageUrl: string,
  singleBottle?: { extractedData: ExtractedWineData },
  multipleBottles?: { bottles: ExtractedBottleData[] },
  detectedCount: number,
  confidence: number
}
```

#### 2. Detection Logic
```typescript
if (detectedCount === 0) → mode = 'single' (empty data)
if (detectedCount === 1) → mode = 'single' (extracted data)
if (detectedCount >= 2) → mode = 'multi' (bottle list)
```

#### 3. Fallback Handling
- API error → fallback to single mode
- No bottles detected → single mode with empty data
- Low confidence → single mode with partial data

---

### Updated Components

#### AddBottleSheet.tsx
**Changes**:
- Added `onSmartScan` prop (new unified handler)
- Updated button text: "Scan Bottles" (was "Take or Upload Photo")
- Added AI sparkle icon indicator
- Removed separate multi-bottle button
- Updated `handleFileSelect` to use smart scan if available

#### CellarPage.tsx
**Changes**:
- Added `smartScanResult` state
- Added `handleSmartScan()` function
- Automatic routing based on scan mode:
  - Single → opens `BottleForm`
  - Multi → opens `MultiBottleImport`
- Passes `onSmartScan={handleSmartScan}` to `AddBottleSheet`

#### MultiBottleImport.tsx
**Changes**:
- Added `preScannedData` prop (optional)
- Added `useEffect` to process pre-scanned data
- Skip upload step if data already provided
- Directly show review step with detected bottles

---

## 🎯 User Experience Improvements

### Simpler Decision
**Before**: User must decide upfront:
- "Will I scan one bottle or multiple?"
- "What if I'm not sure?"

**After**: User just taps once:
- "Scan Bottles" → AI figures it out

### Fewer Taps
**Before**:
```
Tap Camera → Choose "Single" or "Multi" → Take photo → Review
(3 taps)
```

**After**:
```
Tap Camera → "Scan Bottles" → Take photo → Review
(2 taps - auto-routes)
```

### Better Error Handling
- If AI uncertain → defaults to single mode
- User can still manually enter if scan fails
- No dead ends or confusing states

---

## 🔍 Detection Scenarios

### Scenario 1: Clear Single Bottle
**Input**: Photo of one wine bottle, label visible

**AI Response**:
```json
{
  "success": true,
  "bottles": [
    { "producer": "Château", "name": "Margaux", ... }
  ]
}
```

**Result**: 
- `mode: 'single'`
- Routes to single bottle form
- User reviews and saves

---

### Scenario 2: Multiple Bottles
**Input**: Photo of wine rack with 4 bottles

**AI Response**:
```json
{
  "success": true,
  "bottles": [
    { "producer": "Château A", ... },
    { "producer": "Domaine B", ... },
    { "producer": "Bodega C", ... },
    { "producer": "Winery D", ... }
  ]
}
```

**Result**:
- `mode: 'multi'`
- Routes to multi-bottle import
- Shows carousel with 4 detected bottles
- User selects which ones to save

---

### Scenario 3: Unclear/Blurry Photo
**Input**: Blurry photo, AI can't read label

**AI Response**:
```json
{
  "success": true,
  "bottles": []
}
```

**Result**:
- `mode: 'single'`
- Routes to empty form
- Toast: "Please verify the details"
- User enters manually

---

### Scenario 4: Edge Case - Multi Scan Returns 1
**Input**: Photo flagged as multi, but only 1 detected

**Result**:
- Still routes to single mode
- No confusion for user
- Saves one bottle normally

---

## 📱 Mobile UX Flow

### Complete Flow Example

1. User opens Cellar page
2. Taps floating camera button (bottom-right FAB)
3. Bottom sheet slides up with options:
   - **"Scan Bottles"** (primary - wine gradient)
   - "Enter Manually" (secondary - gray)
4. User taps "Scan Bottles"
5. Camera opens (or photo library on Android)
6. User takes/selects photo
7. Elegant loader appears: "Identifying bottle(s)…"
8. AI processes (2-5 seconds)
9. **Automatic routing**:
   - **Single detected**: Form with extracted data
   - **Multiple detected**: Carousel with all bottles
10. User reviews, adjusts if needed, and saves

**Total taps**: 3-4 (was 4-5 before)

---

## 🎨 Visual Design

### Smart Scan Button

**Icon**: Camera 📷 with AI sparkle ✨

**Text**: 
- English: "Scan Bottles"
- Hebrew: "סרוק בקבוקים"

**Description**:
- English: "AI detects single or multiple bottles automatically"
- Hebrew: "הבינה המלאכותית מזהה בקבוק בודד או מספר בקבוקים אוטומטית"

**Style**:
- Wine gradient background
- White text
- Prominent primary position
- Subtle AI indicator (star icon overlay)

---

## 🛠️ Backend Integration

### Edge Function

**Endpoint**: `parse-label-image`

**Mode Parameter**:
```typescript
mode: 'smart'  // New mode - returns flexible bottle array
```

**Expected Response**:
```typescript
{
  success: boolean,
  bottles: Array<{
    producer: { value: string, confidence: 'high' | 'medium' | 'low' },
    name: { value: string, confidence: 'high' | 'medium' | 'low' },
    vintage: { value: number, confidence: 'high' | 'medium' | 'low' },
    region: { value: string, confidence: 'high' | 'medium' | 'low' },
    style: { value: 'red' | 'white' | 'rose' | 'sparkling', confidence: 'high' | 'medium' | 'low' },
    grapes: { value: string, confidence: 'high' | 'medium' | 'low' },
    country: { value: string, confidence: 'high' | 'medium' | 'low' }
  }>
}
```

**Array Length Determines Mode**:
- 0 bottles → Single mode (empty)
- 1 bottle → Single mode (with data)
- 2+ bottles → Multi mode (bottle list)

---

## ✅ Testing Checklist

### Functional Tests

**Single Bottle**:
- [ ] Take photo of one bottle
- [ ] AI detects as single
- [ ] Routes to single bottle form
- [ ] Extracted data appears
- [ ] Can review and save

**Multiple Bottles**:
- [ ] Take photo of 2-5 bottles
- [ ] AI detects as multiple
- [ ] Routes to multi-bottle import
- [ ] Shows carousel of detected bottles
- [ ] Can select/deselect each
- [ ] Can save selected bottles

**Manual Entry**:
- [ ] "Enter Manually" still works
- [ ] Opens empty form
- [ ] No scanning involved

**Error Handling**:
- [ ] Blurry photo → fallback to single
- [ ] Network error → fallback to single
- [ ] No permissions → shows error toast

### Visual Tests

- [ ] AI sparkle icon visible on scan button
- [ ] Loader shows during processing
- [ ] Toast messages clear and helpful
- [ ] Smooth transitions between screens
- [ ] No layout jumps

### Edge Cases

- [ ] Photo with 0 bottles → single mode (empty)
- [ ] Photo with 1 bottle labeled as multi → single mode
- [ ] Photo with wine-related content but no labels → empty form
- [ ] Very large image → compressed and processed
- [ ] Portrait vs landscape orientation

---

## 🚀 Benefits

### For Users
1. **Simpler**: One scan option instead of two
2. **Faster**: One less decision to make
3. **Smarter**: AI decides for you
4. **Flexible**: Works for any number of bottles
5. **Forgiving**: Falls back gracefully on errors

### For Development
1. **Unified**: One scan pipeline to maintain
2. **Flexible**: Easy to add more detection logic later
3. **Testable**: Clear mode detection rules
4. **Reusable**: Existing components unchanged

---

## 📊 Migration Notes

### Backward Compatibility

**Kept for legacy support**:
- `onPhotoSelected` prop in AddBottleSheet
- `onUploadPhoto` prop in AddBottleSheet  
- `onMultiBottleImport` prop in AddBottleSheet

**Deprecated**:
- `showMultiBottleOption` flag (always false now)
- Separate "Scan multiple bottles" button

**New**:
- `onSmartScan` prop (primary path)
- Smart detection in `smartScanService`

---

## 🎉 Summary

**What Was Built**:
- ✅ New `smartScanService.ts` with unified detection
- ✅ Updated `AddBottleSheet.tsx` with single "Scan Bottles" option
- ✅ Updated `CellarPage.tsx` with smart routing logic
- ✅ Enhanced `MultiBottleImport.tsx` to accept pre-scanned data
- ✅ Added translations (English + Hebrew)
- ✅ Automatic mode detection based on AI response
- ✅ Fallback to single mode on errors
- ✅ Build passes, no linter errors

**User Impact**:
- Simpler UX (2 options instead of 3)
- Faster workflow (fewer decisions)
- Smarter detection (AI handles complexity)
- Same confirmation flows (no disruption)

**Technical Quality**:
- Reuses existing infrastructure
- No new libraries
- Clean separation of concerns
- Comprehensive error handling

---

**Ready to test and deploy!** 🍷✨
