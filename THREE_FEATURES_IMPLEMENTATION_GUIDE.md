# Three Features Implementation Guide

## Status: Foundation Complete, Integration Required

This guide provides complete implementation details for the 3 requested features. The foundational components are built and ready for integration.

---

## Feature 1: Duplicate Detection + Stepper Add ✅ (90% Complete)

### ✅ Completed Components

1. **Wine Identity Utility** (`apps/web/src/utils/wineIdentity.ts`)
   - `generateWineIdentityKey()` - Creates unique keys for wine matching
   - `areWinesDuplicate()` - Compares two wines
   - `findDuplicateWine()` - Searches for duplicates in a list
   - Handles normalization, abbreviations, vintage matching

2. **Duplicate Detection Service** (`apps/web/src/services/duplicateDetectionService.ts`)
   - `checkForDuplicate()` - Queries database for existing wines
   - `incrementBottleQuantity()` - Updates quantity safely
   - Returns full bottle info for modal display

3. **Duplicate Bottle Modal** (`apps/web/src/components/DuplicateBottleModal.tsx`)
   - Luxury design with wine mini-card
   - Stepper control (1-99 bottles)
   - Shows new total preview
   - Actions: Add bottles / Create separate / Cancel

4. **Integration Hook** (`apps/web/src/hooks/useDuplicateDetection.tsx`)
   - Easy-to-use `checkAndHandle()` method
   - Automatic modal management
   - Callback hooks for custom behavior

### 🔧 Integration Required

**In `CellarPage.tsx` (line ~167):**

```typescript
// Add at top
import { useDuplicateDetection } from '../hooks/useDuplicateDetection';

// Add in component
const { checkAndHandle, DuplicateModal } = useDuplicateDetection({
  onAddQuantity: async (bottleId, quantity) => {
    await loadBottles(true); // Refresh list
    toast.success(`Added ${quantity} ${quantity === 1 ? 'bottle' : 'bottles'}!`);
  },
  onCreateSeparate: (candidate) => {
    // User chose to create separate entry
    // Continue with normal add flow
  },
});

// Modify handleSmartScanComplete (line ~167)
const handleSmartScanComplete = async (e: CustomEvent) => {
  const { mode, imageUrl, singleBottle, multipleBottles, detectedCount } = e.detail;
  
  if (mode === 'single' && singleBottle?.extractedData) {
    // CHECK FOR DUPLICATE BEFORE SHOWING FORM
    const isDuplicate = await checkAndHandle(singleBottle.extractedData);
    if (isDuplicate) return; // Modal will handle it
    
    // No duplicate, proceed with normal flow
    setExtractedData({ imageUrl, data: singleBottle.extractedData });
    setEditingBottle(null);
    setShowForm(true);
  } else if (mode === 'multi') {
    // For multi-bottle, check each bottle individually
    // (See Multi-Bottle Integration below)
    setSmartScanResult({...});
    setShowMultiBottleImport(true);
  }
};

// Add modal to JSX (near other modals)
{DuplicateModal}
```

**For Manual Entry (BottleForm):**

Add duplicate check before save:

```typescript
const handleSave = async (data) => {
  // Check for duplicate
  const duplicate = await checkForDuplicate({
    producer: data.producer,
    name: data.name,
    vintage: data.vintage,
  });
  
  if (duplicate) {
    // Show duplicate modal (integrate hook in form)
    return;
  }
  
  // Continue with save
  await bottleService.addBottle(data);
};
```

**For Multi-Bottle:**

In `MultiBottleImport.tsx`, check each bottle:

```typescript
// Check all bottles for duplicates
const bottlesWithDuplicateCheck = await Promise.all(
  bottles.map(async (bottle) => {
    const duplicate = await checkForDuplicate(bottle);
    return { bottle, duplicate };
  })
);

// Show duplicate indicator in UI
// Allow stepper per item in confirmation list
```

---

## Feature 2: Smart Scanner (Receipt Detection) 📋 (Requires Implementation)

### Architecture

```
User taps Camera FAB
    ↓
Capture image
    ↓
SmartScanOrchestrator.classify(image)
    ↓
    ├─ "label" → existing label pipeline
    ├─ "receipt" → receipt pipeline (NEW)
    └─ "unknown" → show chooser
```

### Required Components

#### 1. Extend AI Service (`supabase/functions/parse-label-image/index.ts`)

Add image type detection to the prompt:

```typescript
// Current prompt returns wine data
// NEW: Also return image_type

const prompt = `
You are a wine image classifier and data extractor.

STEP 1: Classify the image type:
- "label": Wine bottle label(s) visible
- "receipt": Invoice, receipt, or wine shop purchase document
- "unknown": Cannot determine

STEP 2: Extract data based on type...

Return JSON:
{
  "image_type": "label" | "receipt" | "unknown",
  "bottles": [...] // if label
  "receipt_items": [...] // if receipt
}
`;
```

#### 2. Create Receipt Service (`apps/web/src/services/receiptScanService.ts`)

```typescript
export interface ReceiptItem {
  producer?: string;
  name?: string;
  vintage?: number;
  quantity?: number;
  price?: number;
  confidence: 'low' | 'medium' | 'high';
}

export async function parseReceipt(imageUrl: string): Promise<ReceiptItem[]> {
  // Call edge function with receipt mode
  const { data } = await supabase.functions.invoke('parse-label-image', {
    body: { imageUrl, mode: 'receipt' },
  });
  
  return data.receipt_items || [];
}
```

#### 3. Create Receipt Review Modal (`apps/web/src/components/ReceiptReviewModal.tsx`)

```typescript
export function ReceiptReviewModal({
  isOpen,
  items, // ReceiptItem[]
  onConfirm, // (items: ReceiptItem[]) => void
}) {
  // UI:
  // - List of detected wines
  // - Editable fields per item
  // - Stepper for quantity
  // - Remove item button
  // - Primary: "Add to cellar"
  
  // On confirm:
  // - For each item, check duplicate (Feature 1)
  // - Either increment or create new
}
```

#### 4. Update Smart Scan Service (`apps/web/src/services/smartScanService.ts`)

Add routing logic:

```typescript
export async function performSmartScan(file: File) {
  const imageUrl = await uploadLabelImage(file);
  
  const { data } = await supabase.functions.invoke('parse-label-image', {
    body: { imageUrl, mode: 'smart' }, // Smart mode
  });
  
  const imageType = data.image_type || 'unknown';
  
  if (imageType === 'receipt') {
    return {
      type: 'receipt',
      items: data.receipt_items,
      imageUrl,
    };
  }
  
  // Existing label logic
  return { type: 'label', ... };
}
```

#### 5. Integration in AddBottleContext

Update `handleSmartScan`:

```typescript
const handleSmartScan = async (file: File) => {
  setScanningState('scanning');
  
  const result = await performSmartScan(file);
  
  if (result.type === 'receipt') {
    // Dispatch receipt event
    window.dispatchEvent(new CustomEvent('receiptScanComplete', {
      detail: { items: result.items, imageUrl: result.imageUrl },
    }));
  } else {
    // Existing label logic
    window.dispatchEvent(new CustomEvent('smartScanComplete', {...}));
  }
};
```

#### 6. Handle in CellarPage

```typescript
useEffect(() => {
  const handleReceiptScan = (e: CustomEvent) => {
    setReceiptItems(e.detail.items);
    setShowReceiptReview(true);
  };
  
  window.addEventListener('receiptScanComplete', handleReceiptScan);
  return () => window.removeEventListener('receiptScanComplete', handleReceiptScan);
}, []);
```

### Testing Checklist

- [ ] Receipt photo opens receipt review
- [ ] Label photo opens single/multi confirm
- [ ] Each receipt item checks for duplicates
- [ ] Quantity stepper works per item
- [ ] Works in iOS PWA

---

## Feature 3: Museum View 🖼️ (Requires Implementation)

### Components Required

#### 1. Museum View Modal (`apps/web/src/components/MuseumViewModal.tsx`)

```typescript
interface MuseumViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottle: {
    id: string;
    name: string;
    producer?: string;
    vintage?: number;
    style: string;
    rating?: number;
    region?: string;
    grapes?: string;
    label_image_url?: string;
    readinessStatus?: string;
  };
  // Optional: for gallery mode
  bottles?: typeof bottle[];
  initialIndex?: number;
}

export function MuseumViewModal({ isOpen, onClose, bottle }: MuseumViewModalProps) {
  // Full-screen overlay
  // Hero image (large, centered)
  // Minimal info overlay:
  //   - Name, producer, vintage
  //   - Rating (if available)
  //   - 2-3 chips: readiness, region, grape
  // Close X button
  // Tap outside to close
  // Keyboard: Esc closes
  // Micro-interactions: fade/scale-in, subtle parallax
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200]"
          style={{
            background: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(20px)',
          }}
          onClick={onClose}
        >
          {/* Hero Image */}
          <motion.img
            src={bottle.label_image_url}
            alt={bottle.name}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute inset-0 m-auto max-h-[70vh] max-w-[90vw] object-contain"
          />
          
          {/* Info Overlay (bottom) */}
          <div className="absolute bottom-0 left-0 right-0 p-8 safe-area-inset-bottom">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <h2 className="text-3xl font-bold text-white mb-2">
                {bottle.name}
              </h2>
              {bottle.producer && (
                <p className="text-xl text-gray-300 mb-4">{bottle.producer}</p>
              )}
              
              <div className="flex justify-center gap-2 flex-wrap">
                {bottle.vintage && (
                  <span className="px-3 py-1 rounded-full bg-white/20 text-white text-sm">
                    {bottle.vintage}
                  </span>
                )}
                {bottle.readinessStatus && (
                  <span className="px-3 py-1 rounded-full bg-green-500/30 text-green-100 text-sm">
                    Ready Now
                  </span>
                )}
                {bottle.region && (
                  <span className="px-3 py-1 rounded-full bg-white/10 text-gray-200 text-sm">
                    {bottle.region}
                  </span>
                )}
              </div>
            </motion.div>
          </div>
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/20 flex items-center justify-center"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

#### 2. Integration in Bottle Cards

In `BottleCard.tsx`:

```typescript
const [showMuseumView, setShowMuseumView] = useState(false);

// Add click handler to image
<img
  src={bottle.wine.label_image_url}
  onClick={(e) => {
    e.stopPropagation();
    setShowMuseumView(true);
  }}
  className="cursor-pointer"
/>

// Add modal
{showMuseumView && (
  <MuseumViewModal
    isOpen={showMuseumView}
    onClose={() => setShowMuseumView(false)}
    bottle={bottle}
  />
)}
```

#### 3. Add to WineDetailsModal

Add "View in Museum Mode" button

#### 4. Keyboard & Accessibility

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  
  if (isOpen) {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
  }
  
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.body.style.overflow = '';
  };
}, [isOpen, onClose]);
```

### Testing Checklist

- [ ] Click bottle image opens museum view
- [ ] Full-screen with hero image
- [ ] Info overlay readable
- [ ] Close with X button
- [ ] Close with tap outside
- [ ] Close with Esc key
- [ ] Works on mobile PWA
- [ ] Respects prefers-reduced-motion

---

## Implementation Priority

1. **Feature 1** (2-3 hours): Complete integration in CellarPage and BottleForm
2. **Feature 3** (1-2 hours): Create MuseumViewModal and integrate
3. **Feature 2** (3-4 hours): Extend AI service, create receipt pipeline

## Quick Start: Feature 1

The duplicate detection is 90% complete. To finish:

1. Open `apps/web/src/pages/CellarPage.tsx`
2. Import the hook: `import { useDuplicateDetection } from '../hooks/useDuplicateDetection';`
3. Add hook call: `const { checkAndHandle, DuplicateModal } = useDuplicateDetection({...});`
4. Add `await checkAndHandle(candidate)` before showing form
5. Add `{DuplicateModal}` to JSX
6. Test with existing wine

## Files Created (Ready to Use)

✅ `apps/web/src/utils/wineIdentity.ts` - Wine matching logic
✅ `apps/web/src/services/duplicateDetectionService.ts` - Database operations
✅ `apps/web/src/components/DuplicateBottleModal.tsx` - UI component
✅ `apps/web/src/hooks/useDuplicateDetection.tsx` - Integration hook

## Next Steps

1. Integrate Feature 1 (use guide above)
2. Build and test
3. Create museum view modal
4. Extend AI service for receipts
5. Create receipt review modal
6. Full integration testing

All components follow the luxury design system and reuse existing patterns.
