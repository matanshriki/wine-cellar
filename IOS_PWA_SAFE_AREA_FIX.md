# iOS PWA Safe Area & Footer Overlap Fix

## Problem
On iPhone PWA (standalone mode), buttons and interactive controls were not clickable because they were covered by the floating footer/camera FAB or extended under the bottom safe area (home indicator).

**Affected Screens:**
- "Plan an evening" modal - lower controls obstructed
- "Your Evening" queue modal - bottom actions partially hidden
- All modals on iPhone PWA

## Solution Implemented

### 1. Global Safe Area CSS Variables
Added CSS variables at root level for consistent safe area support:

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}
```

**File:** `apps/web/src/styles/design-tokens.css`

### 2. Smart Footer Hiding (Modal Open Detection)
Footer automatically hides when any modal is open to prevent overlap.

**Implementation:**
- Added modal state detection using MutationObserver
- Checks for `[role="dialog"][aria-modal="true"]` elements
- Footer smoothly fades out when modal opens
- Footer returns when modal closes

**File:** `apps/web/src/components/MobileFloatingFooter.tsx`

**Key changes:**
```tsx
const [isModalOpen, setIsModalOpen] = React.useState(false);

React.useEffect(() => {
  const checkModalState = () => {
    const hasOpenModal = document.querySelector('[role="dialog"][aria-modal="true"]');
    setIsModalOpen(!!hasOpenModal);
  };

  const observer = new MutationObserver(checkModalState);
  observer.observe(document.body, { 
    childList: true, 
    subtree: true, 
    attributes: true, 
    attributeFilter: ['role', 'aria-modal'] 
  });

  return () => observer.disconnect();
}, []);

// Hide footer when modal is open
<AnimatePresence>
  {!isModalOpen && (
    <motion.div ... />
  )}
</AnimatePresence>
```

### 3. Modal Layout Improvements
All modals updated with:
- Proper safe area padding in backdrop
- `role="dialog"` and `aria-modal="true"` attributes
- `aria-labelledby` pointing to modal title
- Flexbox layout with:
  - Fixed header (`flex-shrink-0`)
  - Scrollable content (`flex-1 overflow-y-auto touch-scroll`)
  - Fixed footer (`flex-shrink-0`)
- Dynamic viewport height: `calc(100dvh - max(2rem, var(--safe-top)) - max(2rem, var(--safe-bottom)))`

**Files Updated:**

#### Plan an Evening Modal
`apps/web/src/components/PlanEveningModal.tsx`
- Main modal container
- Swap picker modal

#### Evening Queue Player
`apps/web/src/components/EveningQueuePlayer.tsx`
- Queue player modal
- Wrap-up modal

#### Add Bottle Sheet
`apps/web/src/components/AddBottleSheet.tsx`
- Bottom sheet now respects safe area
- Added `role="dialog"` for footer detection

### 4. Modal Structure Template

All modals now follow this consistent structure:

```tsx
<AnimatePresence mode="wait">
  {isOpen && (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'var(--bg-overlay)',
        backdropFilter: 'var(--blur-medium)',
        WebkitBackdropFilter: 'var(--blur-medium)',
        paddingTop: 'max(1rem, var(--safe-top))',
        paddingBottom: 'max(1rem, var(--safe-bottom))',
        paddingLeft: 'max(1rem, var(--safe-left))',
        paddingRight: 'max(1rem, var(--safe-right))',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-id"
    >
      <motion.div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)',
          maxHeight: 'calc(100dvh - max(2rem, var(--safe-top)) - max(2rem, var(--safe-bottom)))',
        }}
      >
        {/* Header - fixed */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <h2 id="modal-title-id">...</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto touch-scroll">
          {/* Content here */}
        </div>

        {/* Footer - fixed (optional) */}
        <div className="flex-shrink-0 px-6 pb-6 pt-4 border-t">
          {/* Actions here */}
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

## Accessibility Improvements

All modals now include proper ARIA attributes:
- `role="dialog"` - identifies the modal
- `aria-modal="true"` - indicates modal behavior
- `aria-labelledby` - links to modal title for screen readers

## Testing

### Manual Testing Checklist
- [x] iPhone PWA standalone: Buttons in modals are clickable
- [x] iPhone Safari: No regressions
- [x] Android Chrome: No regressions
- [x] Desktop: No regressions
- [x] Footer hides when modal opens
- [x] Footer returns when modal closes
- [x] All modal buttons are accessible
- [x] Scrolling works in long modals
- [x] Safe area respected in all orientations

### Test on Real Device
1. Open app as PWA on iPhone (Add to Home Screen)
2. Tap "Plan an evening"
3. Verify footer disappears
4. Scroll to bottom of modal
5. Verify all buttons are clickable (no obstruction)
6. Close modal
7. Verify footer reappears
8. Repeat for "Your Evening" and other modals

## Browser Support
- iOS 11.0+ (safe-area-inset)
- Android 5.0+
- Desktop browsers (gracefully degrades)

## Performance
- MutationObserver used for efficient DOM monitoring
- Minimal re-renders (state only changes on modal open/close)
- Smooth animations maintained

## Future Improvements
- Consider context API for global modal state (more scalable)
- Add keyboard navigation (Esc to close, Tab trapping)
- Add focus management (auto-focus first interactive element)
