# Mobile AddBottleSheet Scan Handler Fix

## 🐛 Problem

**Symptom**: On mobile, tapping the camera FAB → "Scan Bottles" → Console error: `[AddBottleSheet] No scan handler provided!`

**Root Cause**: The mobile camera FAB opened a GLOBAL `AddBottleSheet` instance in `Layout.tsx` that was **missing the scan handler prop**, while the desktop flow used a LOCAL instance in `CellarPage.tsx` with the proper handler.

### Architecture Before Fix:

| Flow | Component Tree | Scan Handler |
|------|----------------|--------------|
| **Desktop** | "Add Bottle" button → CellarPage → AddBottleSheet → `onPhotoSelected={handleSmartScan}` | ✅ Present |
| **Mobile** | Camera FAB → Layout → AddBottleSheet → NO HANDLER | ❌ Missing |

---

## ✅ Solution

### 1. **Moved Smart Scan Logic to Context**
Created `handleSmartScan` in `AddBottleContext.tsx` so it's accessible globally:

```typescript
const handleSmartScan = useCallback(async (file: File) => {
  // Perform smart scan
  const result = await smartScanService.performSmartScan(file);
  
  // Dispatch event with results for pages to handle
  const event = new CustomEvent('smartScanComplete', { detail: result });
  window.dispatchEvent(event);
}, []);
```

**Why this works**:
- Context is available to ALL components (Layout + all pages)
- Smart scan logic is centralized (no duplication)
- Pages listen for `smartScanComplete` event and update their own state

### 2. **Wired Handler to Global AddBottleSheet**
Updated `Layout.tsx` to pass `onPhotoSelected` to the global AddBottleSheet:

```typescript
<AddBottleSheet
  isOpen={showAddSheet}
  onClose={closeAddBottleFlow}
  onPhotoSelected={async (file) => {
    await handleSmartScan(file);  // ← Fixed!
  }}
  onManualEntry={...}
  showWishlistOption={false}
/>
```

### 3. **Added Event Listener in CellarPage**
Updated `CellarPage.tsx` to listen for `smartScanComplete` events:

```typescript
const handleSmartScanComplete = (e: CustomEvent) => {
  const { mode, imageUrl, singleBottle, multipleBottles } = e.detail;
  
  if (mode === 'single') {
    setExtractedData({ imageUrl, data: singleBottle.extractedData });
    setShowForm(true);
  } else if (mode === 'multi') {
    setSmartScanResult(e.detail);
    setShowMultiBottleImport(true);
  }
};

window.addEventListener('smartScanComplete', handleSmartScanComplete);
```

### 4. **Added Safety Fallback**
Enhanced `AddBottleSheet.tsx` to show a luxury error toast if handler is missing:

```typescript
if (onPhotoSelected) {
  onPhotoSelected(file);
} else if (onSmartScan) {
  onSmartScan(file);
} else {
  // Safety fallback (should not happen in production)
  toast.error('Scan is temporarily unavailable', {
    description: 'Please try again or enter bottle details manually.',
    action: { label: 'Enter Manually', onClick: () => onManualEntry() },
  });
}
```

---

## 📊 Architecture After Fix

### Component Flow:

```
Mobile:
  Camera FAB (MobileFloatingFooter)
    ↓
  AddBottleContext.openAddBottleFlow()
    ↓
  Layout.tsx renders AddBottleSheet
    ↓
  User taps "Scan Bottles" → file selected
    ↓
  onPhotoSelected calls AddBottleContext.handleSmartScan(file)
    ↓
  Smart scan performs AI detection
    ↓
  Dispatches 'smartScanComplete' event
    ↓
  CellarPage listens and updates state
    ↓
  Shows single/multi bottle confirmation
```

### Desktop Flow (unchanged):

```
Desktop:
  "Add Bottle" button (CellarPage)
    ↓
  CellarPage renders local AddBottleSheet
    ↓
  User taps "Scan Bottles" → file selected
    ↓
  onPhotoSelected calls handleSmartScan(file) directly
    ↓
  Smart scan performs AI detection
    ↓
  Updates CellarPage state directly
    ↓
  Shows single/multi bottle confirmation
```

---

## ✅ Validation Checklist

- [x] Mobile: Tap camera FAB → AddBottleSheet → "Scan Bottles" works (no console error)
- [x] Mobile: Smart scan detects single bottle → routes to single confirmation
- [x] Mobile: Smart scan detects multiple bottles → routes to multi confirmation
- [x] Desktop: Existing behavior unchanged
- [x] "Enter manually" works on both flows
- [x] Safety fallback toast if handler missing
- [x] Build passes
- [x] No TypeScript errors

---

## 🚀 New Bundle

**Bundle**: `index--mFwCOZR.js`  
**Version**: `v2.1.0-smart-scan-unified`

---

## 🔮 Future Improvements

1. **Consider removing event system**: Since we're using context, we could pass state setters through context instead of events
2. **Service Worker update**: Ensure PWA users get the fix within 24 hours
3. **Analytics**: Track mobile vs desktop scan usage to see which flow is more popular

---

## 📝 Files Changed

- `apps/web/src/contexts/AddBottleContext.tsx` - Added `handleSmartScan` to context
- `apps/web/src/components/Layout.tsx` - Wired `onPhotoSelected` to global AddBottleSheet
- `apps/web/src/pages/CellarPage.tsx` - Added `smartScanComplete` event listener
- `apps/web/src/components/AddBottleSheet.tsx` - Enhanced safety fallback with luxury toast

---

## 🧪 Testing Instructions

### Mobile (iPhone/Android):
1. Open app on mobile device
2. Tap camera FAB (floating button)
3. Tap "Scan Bottles" button
4. Select bottle image from gallery
5. **Expected**: See "Identifying bottle(s)…" toast → routes to confirmation
6. **Expected**: NO console error

### Desktop:
1. Open app on desktop
2. Click "Add Bottle" button (top right)
3. Click "Scan Bottles" button
4. Select bottle image
5. **Expected**: Same behavior as mobile
6. **Expected**: NO regression

### Edge Cases:
- Cancel scan and retry → works
- Scan multiple times in a row → works
- No internet connection → shows error toast with retry
- Image upload fails → shows error toast, fallback to manual entry
