# Tonight's Selection Carousel - Luxury UX Fixes

## Fixed Issues

### 1. ✅ Double-Advance Bug
**Problem**: Carousel sometimes advanced 2 slides at once, especially after manual navigation.

**Root Causes**:
- Multiple `setInterval` timers running simultaneously (not cleared before creating new ones)
- Manual navigation didn't pause autoplay long enough (only 1s, while interval is 3s)
- Race condition: manual click + autoplay tick firing at same time
- React re-renders could create duplicate intervals

**Fixes Applied**:
- Always clear existing timer before creating new one (`clearInterval` at start of effect)
- Track manual interactions with timestamp ref (`lastManualInteractionRef`)
- 5-second cooldown after any manual navigation (arrow, dot, swipe)
- Use functional state updates: `setActiveIndex(prev => (prev + 1) % length)` to avoid stale closures
- Cancel pending unpause timers when manually navigating
- Add dev logging to track timer lifecycle

**Code Changes**:
```typescript
// Before: Timer could be created multiple times
useEffect(() => {
  timerRef.current = setInterval(...); // ❌ Old timer not cleared first
}, [deps]);

// After: Single source of truth
useEffect(() => {
  if (timerRef.current) clearInterval(timerRef.current); // ✅ Clear first
  
  // Check manual interaction cooldown
  if (Date.now() - lastManualInteractionRef.current < 5000) {
    return; // Wait for cooldown
  }
  
  timerRef.current = setInterval(() => {
    setActiveIndex(current => (current + 1) % length); // ✅ Functional update
  }, 3000);
  
  return () => clearInterval(timerRef.current);
}, [deps]);
```

### 2. ✅ Layout Shift / Jumping Images
**Problem**: Cards visibly resized when images loaded or changed, causing janky transitions.

**Root Causes**:
- No fixed aspect ratio on image containers
- `loading="lazy"` causing reflow when images load
- Different image sizes causing variable card heights
- No preloading of adjacent images

**Fixes Applied**:
- Set stable `aspect-ratio: 4/5` on image container (wine bottle portrait)
- Changed `loading="lazy"` to `loading="eager"` (above fold, need immediate load)
- Added `fetchpriority="high"` for active slide
- Explicit `object-fit: cover` and `object-position: center`
- Preload next/prev images on index change with `new Image()`
- Added `willChange: transform` for GPU acceleration

**Code Changes**:
```css
/* Image Container */
aspect-ratio: 4 / 5;  /* ✅ Stable dimensions */
overflow: hidden;
willChange: transform; /* ✅ Performance */

/* Image Element */
object-fit: cover;     /* ✅ Consistent sizing */
object-position: center;
loading: eager;        /* ✅ No lazy load delay */
```

### 3. ✅ Smooth Luxury Transitions
**Problem**: Animations felt harsh or inconsistent; not premium quality.

**Fixes Applied**:
- Fine-tuned spring physics: `stiffness: 260`, `damping: 35`, `mass: 0.8`
- Added cubic-bezier easing for non-spring properties: `[0.25, 0.1, 0.25, 1]` (ease-in-out-cubic)
- Separate transition timing for opacity, scale, filter (400ms each)
- Consistent 200ms for button hover/press interactions
- Respect `prefers-reduced-motion` throughout

**Code Changes**:
```typescript
transition={{
  type: 'spring',
  stiffness: 260,
  damping: 35,
  mass: 0.8,
  opacity: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  scale: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  filter: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
}}
```

### 4. ✅ Arrow Button Interactions
**Problem**: Arrows didn't feel responsive; no feedback on press; small hit area on mobile.

**Fixes Applied**:
- Converted to Framer Motion buttons for micro-interactions
- Added `whileHover`: subtle scale (1.05) + shadow lift
- Added `whileTap`: press-in scale (0.95)
- Increased hit area: `width: 48px`, `height: 48px`, `padding: 12px`
- Stop event propagation to prevent conflicts
- Consistent 200ms transition with luxury easing

### 5. ✅ Pagination Dot Improvements
**Problem**: Dots didn't enforce same pause logic as arrows; no press feedback.

**Fixes Applied**:
- Same 5-second cooldown as arrows when clicked
- Cancel pending unpause timers
- Added `whileTap` scale animation (0.9)
- Functional state update for index change
- Stop event propagation

### 6. ✅ Stable Container Height
**Problem**: Container used `minHeight` which could cause subtle shifts.

**Fixes Applied**:
- Changed `minHeight: 380px` to fixed `height: 480px`
- Increased track height from `320px` to `400px` for breathing room
- Ensures consistent vertical spacing for all content

## Testing Results

### Before Fixes
- ❌ Rapid arrow clicks: sometimes jumped 2 slides
- ❌ Click arrow during autoplay: could advance 3 slides (manual + 2 auto)
- ❌ Images loading: visible card resize/jump
- ❌ Different image sizes: inconsistent card heights
- ❌ Autoplay after manual: resumed too quickly (1s)

### After Fixes
- ✅ Rapid arrow clicks: exactly 1 slide per click
- ✅ Click arrow during autoplay: exactly 1 slide, then 5s pause
- ✅ Images loading: no visible reflow or jump
- ✅ All slides: consistent card height and smooth transitions
- ✅ Autoplay after manual: proper 5s cooldown

## Dev Logging (Development Only)

When running in dev mode, console shows:
```
[Carousel] Starting autoplay timer
[Carousel] Auto-advance tick
[Carousel] Auto-advancing: 0 → 1
[Carousel] Manual next clicked
[Carousel] Manual advance: 1 → 2
[Carousel] Manual cooldown ended, resuming
[Carousel] Preloading image for index 0
```

Logs are gated behind `import.meta.env.DEV` and won't appear in production.

## Performance Optimizations

1. **GPU Acceleration**: `willChange: transform` on image containers
2. **Image Preloading**: Adjacent images preloaded in background
3. **Eager Loading**: No lazy load for carousel (above fold)
4. **Functional Updates**: Avoid stale closures in state setters
5. **Timer Cleanup**: Strict cleanup on unmount/re-render

## Browser Compatibility

- ✅ `aspect-ratio` CSS (modern browsers, fallback not needed)
- ✅ `fetchpriority` attribute (hint only, graceful fallback)
- ✅ `willChange` (widely supported)
- ✅ Framer Motion animations (existing dependency)

## Files Modified

- `apps/web/src/components/TonightsOrbitCinematic.tsx` - All carousel logic

## Deployment

Build passed:
```bash
npm run build
✓ built in 1.59s
```

Ready to push to production!
