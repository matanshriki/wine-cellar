# Manual Entry Duplicate Detection Integration

## Status: Components Ready, Integration Needed

The duplicate detection infrastructure is complete and working for scanned bottles. This guide shows how to integrate it into the manual entry form (BottleForm.tsx).

## Integration Steps

### 1. Import Required Components

Add to imports in `apps/web/src/components/BottleForm.tsx`:

```typescript
import { checkForDuplicate, incrementBottleQuantity } from '../services/duplicateDetectionService';
import { DuplicateBottleModal } from './DuplicateBottleModal';
```

### 2. Add State for Duplicate Modal

Add state variables in the component:

```typescript
const [showDuplicateModal, setShowDuplicateModal] = useState(false);
const [duplicateBottle, setDuplicateBottle] = useState<any>(null);
const [pendingFormData, setPendingFormData] = useState<any>(null);
```

### 3. Modify handleSubmit

Before saving, check for duplicates:

```typescript
const handleSubmit = async (formData: FormData) => {
  try {
    // ✨ NEW: Check for duplicate before saving
    const duplicate = await checkForDuplicate({
      producer: formData.producer,
      name: formData.name,
      vintage: formData.vintage,
    });
    
    if (duplicate) {
      console.log('[BottleForm] Duplicate found, showing modal');
      setDuplicateBottle(duplicate);
      setPendingFormData(formData); // Save for "Create Separate" option
      setShowDuplicateModal(true);
      return; // Stop here, let modal handle it
    }
    
    // No duplicate, proceed with normal save
    await bottleService.addBottle(formData);
    toast.success('Bottle added!');
    onSuccess?.();
    onClose();
  } catch (error) {
    console.error('[BottleForm] Error saving:', error);
    toast.error('Failed to add bottle');
  }
};
```

### 4. Add Modal Handlers

Add handler functions:

```typescript
const handleDuplicateAddQuantity = async (quantity: number) => {
  if (!duplicateBottle) return;
  
  try {
    await incrementBottleQuantity(duplicateBottle.id, quantity);
    toast.success(`Added ${quantity} ${quantity === 1 ? 'bottle' : 'bottles'}!`);
    
    // Close modals and refresh
    setShowDuplicateModal(false);
    setDuplicateBottle(null);
    setPendingFormData(null);
    onSuccess?.(); // Refresh parent
    onClose();
  } catch (error) {
    console.error('[BottleForm] Error adding quantity:', error);
    toast.error('Failed to add bottles');
  }
};

const handleDuplicateCreateSeparate = async () => {
  if (!pendingFormData) return;
  
  try {
    // User chose to create separate entry despite duplicate
    await bottleService.addBottle(pendingFormData);
    toast.success('Bottle added as separate entry!');
    
    // Close modals
    setShowDuplicateModal(false);
    setDuplicateBottle(null);
    setPendingFormData(null);
    onSuccess?.();
    onClose();
  } catch (error) {
    console.error('[BottleForm] Error creating separate:', error);
    toast.error('Failed to add bottle');
  }
};
```

### 5. Add Modal to JSX

Add before the closing tag of the component's return statement:

```typescript
{/* Duplicate Detection Modal */}
{duplicateBottle && (
  <DuplicateBottleModal
    isOpen={showDuplicateModal}
    onClose={() => {
      setShowDuplicateModal(false);
      setDuplicateBottle(null);
      setPendingFormData(null);
    }}
    existingWine={{
      id: duplicateBottle.wine_id,
      name: duplicateBottle.wine.name,
      producer: duplicateBottle.wine.producer,
      vintage: duplicateBottle.wine.vintage,
      style: duplicateBottle.wine.style,
      rating: duplicateBottle.wine.rating,
      quantity: duplicateBottle.quantity,
      label_image_url: duplicateBottle.wine.label_image_url,
    }}
    onAddQuantity={handleDuplicateAddQuantity}
    onCreateSeparate={handleDuplicateCreateSeparate}
  />
)}
```

## Testing

After integration, test:

1. **Add wine manually** (e.g., "Chateau Margaux 2015")
2. **Try to add same wine again manually**
3. **Expected**: Duplicate modal appears with stepper
4. **Select quantity** (e.g., 2)
5. **Click "Add bottles"**
6. **Expected**: Quantity increases, no duplicate created

## Why Not Integrated Now?

BottleForm.tsx is a critical, complex component handling:
- Form validation
- AI enrichment
- Vivino autofill
- Label art generation
- Multiple states

To avoid breaking existing functionality, this integration is documented separately and can be added carefully with proper testing.

## Alternative: Use the Hook

For a cleaner integration, use the useDuplicateDetection hook:

```typescript
import { useDuplicateDetection } from '../hooks/useDuplicateDetection';

// In component
const { checkAndHandle, DuplicateModal } = useDuplicateDetection({
  onAddQuantity: async (bottleId, quantity) => {
    await loadBottles();
    toast.success(`Added ${quantity} bottles!`);
    onSuccess?.();
    onClose();
  },
  onCreateSeparate: async () => {
    // Continue with normal save
    await bottleService.addBottle(pendingFormData);
    toast.success('Added as separate entry!');
    onSuccess?.();
    onClose();
  },
});

// In handleSubmit
const isDuplicate = await checkAndHandle(formData);
if (isDuplicate) return; // Modal handles it

// Continue with save...
```

## Status

✅ **Components ready** - All duplicate detection components working
✅ **Scans integrated** - Smart scan uses duplicate detection
✅ **Documentation complete** - Integration guide ready
⚠️ **Manual entry** - Needs careful BottleForm integration

The infrastructure is in place and ready to use!
