# Mobile Scanning Loader Fix

## Problem

After selecting/capturing a photo on mobile/PWA, the UI immediately closed and returned to the main page without showing any scanning feedback. The "AI is reading your image…" loader was never visible, causing a poor user experience.

## Root Cause

1. On mobile, the camera FAB triggers a hidden file input (immediate camera)
2. When a file is selected, `handleCameraFileSelect()` calls `handleSmartScan(file)` directly
3. **BUT**: The `AddBottleSheet` was NOT open (`showAddSheet = false`)
4. Even though `handleSmartScan()` set `scanningState = 'scanning'`, the sheet wasn't mounted
5. **Result**: The wine-glass loader inside AddBottleSheet was never rendered

## Solution

### 1. Added `openAddBottleFlowForScanning()` to Context

New function in `AddBottleContext.tsx` that opens the sheet in preparation for scanning:

```typescript
const openAddBottleFlowForScanning = () => {
  // Open sheet in preparation for scanning
  // The scanning state will be set by handleSmartScan() immediately after
  console.log('[AddBottleContext] Opening sheet for incoming scan');
  setShowAddSheet(true);
  setScanningState('idle'); // Keep idle temporarily, handleSmartScan will set to scanning
  setScanningMessage('');
  setShowFallbackSheet(false);
};
```

### 2. Modified Mobile Camera Flow

Updated `handleCameraFileSelect()` in `Layout.tsx`:

```typescript
// File selected - proceed with smart scan
console.log('[Camera] File selected, starting smart scan:', file.name, file.type);

// CRITICAL FIX: Open AddBottleSheet so loader is visible
openAddBottleFlowForScanning();

// Minimal delay to ensure sheet is mounted, then begin scan
requestAnimationFrame(() => {
  handleSmartScan(file);
});
```

### 3. Fixed Fallback Sheet Flow

Updated `onChoosePhoto` handler for `CameraFallbackSheet`:

```typescript
onChoosePhoto={async (file) => {
  console.log('[CameraFallback] Photo selected from library, opening sheet and starting scan');
  closeFallbackSheet();
  
  // CRITICAL FIX: Open AddBottleSheet to show loader
  openAddBottleFlowForScanning();
  
  // Minimal delay to ensure sheet is mounted, then begin scan
  requestAnimationFrame(async () => {
    await handleSmartScan(file);
  });
}}
```

## New Flow

### Mobile/PWA Camera Capture

1. User taps camera FAB
2. Camera opens (hidden file input)
3. User takes/selects photo
4. **NEW**: `openAddBottleFlowForScanning()` opens AddBottleSheet
5. Sheet animation starts (slide up from bottom)
6. `requestAnimationFrame()` ensures sheet is mounted
7. `handleSmartScan()` is called, sets `scanningState = 'scanning'`
8. **Wine-glass loader is now visible** with "AI is reading your image…"
9. Scan completes → Results shown in same sheet
10. On error → Error shown in same sheet with retry options

### Fallback "Choose from Photos"

Same flow as above, but triggered from the fallback options sheet.

## Why requestAnimationFrame?

- Ensures the AddBottleSheet component is mounted before calling `handleSmartScan()`
- Minimal delay (~16ms) - just one frame
- Sheet animation (300ms) masks the brief idle→scanning transition
- User never sees a flash - they only see the smooth sheet opening with loader

## UI States in AddBottleSheet

The sheet now properly shows:

1. **idle**: Options (Scan bottles / Enter manually)
2. **scanning**: Wine-glass loader + "AI is reading your image…"
3. **complete**: Results (handled by pages via event)
4. **error**: Error message + Retry / Enter manually buttons

## Files Modified

- `apps/web/src/contexts/AddBottleContext.tsx`
  - Added `openAddBottleFlowForScanning()` function
  - Updated context interface and provider

- `apps/web/src/components/Layout.tsx`
  - Modified `handleCameraFileSelect()` to open sheet before scanning
  - Modified `CameraFallbackSheet` `onChoosePhoto` handler
  - Added `openAddBottleFlowForScanning` to context destructuring

## Testing Checklist

- [x] Build passes
- [x] No linter errors
- [ ] Mobile: Camera capture → Loader visible
- [ ] Mobile: Choose from photos → Loader visible
- [ ] Desktop: No regression (sheet already open)
- [ ] Loader shows "AI is reading your image…"
- [ ] Results appear in same sheet (no jump to main page)
- [ ] Error handling works (retry/manual entry)
- [ ] No console errors
- [ ] Sheet animation is smooth

## Expected Behavior After Fix

### Mobile/PWA

1. Tap camera FAB
2. Take/select photo
3. **See luxury bottom sheet slide up**
4. **See wine-glass loader immediately**
5. **Text: "AI is reading your image…"**
6. **Subtitle: "Identifying bottle(s) and vintage"**
7. Wait 2-5 seconds for recognition
8. Results appear in same sheet OR error with retry

### Desktop

No change - sheet is already open when selecting photo.

## Performance Impact

Minimal:
- `requestAnimationFrame()` adds ~16ms delay
- Sheet opening animation is 300ms (tween, ease)
- User perceives it as smooth, immediate feedback
- Much better UX than jumping back to main page

## Future Improvements

1. Consider showing a micro-loading state during `requestAnimationFrame()` delay
2. Add AbortController to cancel scan if user closes sheet mid-scan
3. Consider optimistic UI (show partial results as they stream)
4. Add analytics to track scan success rate and timing

## Related Issues

This fix addresses the core UX issue where mobile users lost all feedback during scanning. The implementation leverages existing components and state management without requiring new libraries or major refactors.
