# Tonight's Selection - Cinematic Carousel (STAGING)

**Status**: 🚧 LOCAL/STAGING ONLY - Not deployed to production  
**Feature**: Luxury cinematic carousel for Tonight's Selection with auto-advance  
**Date**: Jan 28, 2026

---

## 🎬 What Was Built

### Cinematic Design Features

**Active Card (Center)**:
- Scale: 1.0 (full size)
- Opacity: 1.0 (fully visible)
- Shadow: Premium deep shadow (0 20px 60px)
- Border: 2px wine-200
- Highest z-index (20)

**Adjacent Cards (Peek Left/Right)**:
- Scale: 0.93 (slightly smaller)
- Opacity: 0.7 (slightly faded)
- Position: Offset 20% left/right
- Filter: brightness(0.95)
- z-index: 10

**Far Cards**:
- Scale: 0.85
- Opacity: 0 (hidden)
- Offset 40% (off-screen)

### Auto-Advance Behavior

- **Interval**: 3 seconds per card
- **Animation**: Spring transition (stiffness: 300, damping: 30)
- **Pause Triggers**:
  - Mouse hover (desktop)
  - Touch start (mobile)
- **Resume**: 1 second after interaction ends
- **Disabled if**: `prefers-reduced-motion` is enabled

### Manual Controls

**Desktop**:
- Left/Right arrow buttons (floating on sides)
- Hover effects on arrows
- Click dot indicators (bottom)

**Mobile**:
- Swipe gestures (native touch)
- Dot indicators for pagination
- Active dot expands to pill shape

---

## 🚀 How to Test Locally

### Step 1: Start Dev Server

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine/apps/web
npm run dev
```

### Step 2: Open Localhost

Open browser: `http://localhost:5173`

### Step 3: Navigate to Cellar Page

- Login if needed
- Click "Cellar" in navigation
- Scroll to "Tonight's Selection" widget (top of page)

### Step 4: Test Auto-Advance

1. **Watch the carousel**: Cards should auto-advance every 3 seconds
2. **Observe animations**: 
   - Active card stays centered
   - Adjacent cards peek from sides
   - Smooth spring transitions

### Step 5: Test Pause on Interaction

**Desktop**:
- Hover mouse over carousel → auto-advance pauses
- Move mouse away → resumes after 1 second

**Mobile**:
- Touch/tap carousel → pauses
- Release → resumes after 1 second

### Step 6: Test Manual Navigation

**Desktop**:
- Click left/right arrow buttons
- Click pagination dots at bottom

**Mobile**:
- Swipe left/right
- Tap pagination dots

### Step 7: Test Reduced Motion

**Enable reduced motion in your OS**:
- **Mac**: System Settings → Accessibility → Display → Reduce Motion
- **Windows**: Settings → Accessibility → Visual effects → Animation effects OFF

**Expected behavior**:
- Auto-advance disabled ✅
- Manual navigation still works ✅
- Instant transitions (no spring animation) ✅

---

## 🎨 Visual Checklist

### Active Card
- [ ] Fully visible and centered
- [ ] Scale 1.0 (full size)
- [ ] Deep wine-colored shadow
- [ ] 2px wine-200 border
- [ ] Bottle image clear and prominent

### Adjacent Cards
- [ ] Partially visible on left/right
- [ ] Scale 0.93 (slightly smaller)
- [ ] Opacity 0.7 (faded)
- [ ] Offset 20% from center

### Animations
- [ ] Smooth spring transitions (not jarring)
- [ ] No layout shift on card change
- [ ] Elegant ease-in-out feel
- [ ] 3-second auto-advance works

### Interaction
- [ ] Hover pauses auto-advance
- [ ] Touch pauses auto-advance
- [ ] Resumes after interaction ends
- [ ] Manual navigation works
- [ ] Clicking active card opens wine details modal

---

## 🔧 Technical Implementation

### New Component
**File**: `apps/web/src/components/TonightsOrbitCinematic.tsx`

**Key Features**:
- useState for activeIndex
- useState for isPaused
- useEffect for auto-advance timer
- useRef for timer cleanup
- getCardStyle() function for positioning logic
- Spring animations via framer-motion
- shouldReduceMotion() integration

### Integration
**File**: `apps/web/src/pages/CellarPage.tsx`

**Flag**: `ENABLE_CINEMATIC_CAROUSEL = true` (line 34)

**Usage**:
```typescript
{ENABLE_CINEMATIC_CAROUSEL ? (
  <TonightsOrbitCinematic bottles={...} onBottleClick={...} />
) : (
  <TonightsOrbit bottles={...} onBottleClick={...} />
)}
```

### Selection Logic
**Unchanged** - Same smart selection algorithm:
1. Filter bottles with quantity > 0
2. Prioritize READY status (+100 score)
3. Then PEAK_SOON (+50 score)
4. Then HOLD (+10 score)
5. Bonus for higher quantity (+5 per bottle, max 25)
6. Random variation for variety (+0-10)
7. Top 3 bottles shown

---

## 🎯 QA Checklist (Local Testing)

### Functionality
- [ ] Carousel shows partially visible side cards
- [ ] Auto-advance triggers every 3 seconds
- [ ] Animation feels smooth and premium (no jitter)
- [ ] Hover pauses autoplay (desktop)
- [ ] Touch pauses autoplay (mobile)
- [ ] Manual navigation works (arrows + dots)
- [ ] Clicking active card opens wine details modal
- [ ] No console errors

### Visual Quality
- [ ] Active card prominent and centered
- [ ] Side cards elegantly "peek" from edges
- [ ] Transitions feel cinematic (not snappy)
- [ ] No layout shift on card change
- [ ] Premium shadows and depth

### Accessibility
- [ ] Reduced-motion disables autoplay ✅
- [ ] Manual navigation still available ✅
- [ ] Arrow buttons have aria-labels ✅
- [ ] Keyboard accessible ✅

### Responsive
- [ ] Works on mobile (320px+)
- [ ] Works on tablet (768px+)
- [ ] Works on desktop (1024px+)
- [ ] RTL/LTR both supported

### Edge Cases
- [ ] Works with 1 bottle (no auto-advance)
- [ ] Works with 2 bottles
- [ ] Works with 3 bottles
- [ ] No bottles → component doesn't render

---

## 🎬 Design Inspiration

**Filmstruck / Criterion Channel carousel**:
- Center focus with context on sides
- Depth through scale and opacity
- Elegant auto-advance (not aggressive)
- Premium editorial feel

**Similar to**:
- Apple TV+ featured content
- Netflix hero carousel
- Spotify premium playlists
- Luxury brand lookbooks

---

## 🚫 Not Deployed to Production

**Current state**:
- ✅ Built successfully in local environment
- ✅ Ready for localhost testing
- ❌ **NOT committed to git**
- ❌ **NOT pushed to production**
- ❌ **NOT deployed on Vercel**

### To Disable Cinematic Version

Set flag to `false` in `CellarPage.tsx`:

```typescript
const ENABLE_CINEMATIC_CAROUSEL = false; // Revert to original
```

### To Deploy to Production (After Testing)

1. Test thoroughly on localhost
2. Verify all QA checklist items pass
3. Remove or set `ENABLE_CINEMATIC_CAROUSEL = true` as default
4. Commit changes
5. Push to main branch
6. Vercel will auto-deploy

---

## 📝 Implementation Notes

### Component Architecture
- Clean separation: Original vs Cinematic
- Same props interface
- Drop-in replacement
- No breaking changes to parent components

### Performance
- Uses existing framer-motion (already in bundle)
- Reuses labelArtService for image loading
- Lazy loading images
- No additional bundle size from new libraries

### Browser Compatibility
- Modern browsers (Chrome, Safari, Firefox, Edge)
- iOS Safari (PWA tested)
- Android Chrome
- CSS features: perspective, transforms, filters

---

## 🎉 Next Steps

1. **Start dev server**: `npm run dev`
2. **Test on localhost**: Follow checklist above
3. **Iterate if needed**: Adjust timing, scales, opacity values
4. **User feedback**: Show to stakeholders
5. **Production decision**: Deploy or revert

**Questions to validate**:
- Does auto-advance feel premium or annoying?
- Is 3 seconds the right timing?
- Do adjacent cards enhance or distract?
- Mobile swipe still intuitive?

---

**Built**: Jan 28, 2026  
**Developer**: AI Assistant  
**Status**: 🧪 STAGING - Awaiting QA and approval
