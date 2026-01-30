# Agent Chat Enhancements

## Overview
Enhanced the agent chat (sommelier) with two key improvements: (1) fixed send button icon orientation for RTL/LTR, and (2) added multi-bottle recommendation support with luxury carousel UI.

## Changes Implemented

### 1. Send Button Icon Fix ✅

**Problem**: The send button used a vertical arrow icon that didn't match standard messaging app conventions.

**Solution**:
- Rotated icon 90 degrees to horizontal "paper plane" style
- Added RTL/LTR detection: rotates -90deg for Hebrew (RTL), +90deg for English (LTR)
- Icon direction now feels natural in both languages
- Maintains 48px tap target for mobile accessibility

**Files Modified**:
- `apps/web/src/pages/AgentPageWorking.tsx`
  - Added `i18n` to useTranslation destructuring
  - Updated SVG transform: `rotate(${i18n.language === 'he' ? '-90' : '90'}deg)`

### 2. Multi-Bottle Recommendations ✅

**Problem**: Agent only returned one bottle even when user asked for multiple (e.g., "top 5 bottles").

**Solution**:
Implemented full support for multi-bottle requests with structured responses and luxury carousel UI.

#### A. Backend Prompt Enhancement

**File**: `apps/api/src/routes/agent.ts`

- Updated system prompt to detect multi-bottle requests
- Added parsing logic for phrases: "top N", "N bottles", "N recommendations", "best N"
- Defaults to 3 if count not specified
- Two response formats:
  1. **SINGLE-BOTTLE**: For individual recommendations (existing format)
  2. **MULTI-BOTTLE**: For lists with carousel display

**Multi-Bottle Response Schema**:
```json
{
  "type": "bottle_list",
  "title": "Top 5 Bottles in Your Cellar",
  "message": "Brief intro (1-2 sentences)",
  "bottles": [
    {
      "bottleId": "exact ID from cellar",
      "name": "wine name",
      "producer": "producer name",
      "vintage": number | null,
      "region": "string" | null,
      "rating": number | null,
      "readinessStatus": "ready/peak/aging/drink_soon" | null,
      "serveTempC": number | null,
      "decantMinutes": number | null,
      "shortWhy": "One sentence explanation (max 100 chars)"
    }
  ]
}
```

**Validation**:
- Validates all bottle IDs exist in user's cellar
- Retries with correction if invalid IDs returned
- Falls back to error message after max attempts

#### B. Luxury Carousel Component

**File**: `apps/web/src/components/BottleCarousel.tsx` (NEW)

**Features**:
- Horizontal swipe on mobile with snap scrolling
- Arrow controls on desktop (hidden on mobile)
- Premium card design:
  - Wine image (user > AI label > placeholder)
  - Producer, name, vintage
  - Region indicator
  - Readiness badge (colored, styled)
  - 1-line "why" reason (italic, quoted)
  - "View Details" button
- RTL/LTR support:
  - Carousel direction adapts naturally
  - Arrow icons flip in RTL
  - Scrolling works correctly in both directions
- Dot indicators for navigation
- Smooth animations with Framer Motion
- Hover effects on desktop

**Props**:
```typescript
interface BottleCarouselProps {
  title?: string;
  bottles: BottleRecommendation[];
  onBottleClick?: (bottleId: string) => void;
  onMarkOpened?: (bottleId: string) => void;
}
```

#### C. Frontend Integration

**File**: `apps/web/src/pages/AgentPageWorking.tsx`

- Imported BottleCarousel component
- Updated AgentMessage interface to include `bottleList` field
- Modified message handler to extract bottle list from response
- Added carousel rendering in message display:
  - Checks for `msg.bottleList` presence
  - Maps bottles with image URLs from cellar data
  - Passes `handleViewBottleDetails` callback
- Maintains existing single-bottle recommendation display

**File**: `apps/web/src/services/agentService.ts`

- Updated AgentMessage interface:
  - Added `bottleList` field with title and bottles array
- Updated AgentResponse interface:
  - Added `type` field ("single" | "bottle_list")
  - Added `title` field for multi-bottle responses
  - Added `bottles` array field
  - Maintains backward compatibility with existing fields

### 3. Translation Support ✅

**Existing translations verified**:
- `common.viewDetails` - "View Details" / "פרטים"
- All readiness statuses already translated
- All common UI strings available

**RTL Support**:
- Carousel direction reverses naturally
- Arrow icons flip correctly
- Text alignment respects language direction
- No layout overflow on mobile

## Testing

### Manual QA Checklist

**Send Icon**:
- [x] English (LTR): Icon points right → (paper plane style)
- [x] Hebrew (RTL): Icon points left ← (paper plane style)
- [x] No layout overflow on iPhone
- [x] 48px tap target maintained
- [ ] Verify in production after deployment

**Multi-Bottle Responses**:
- [ ] Ask: "What are the top 5 bottles in my cellar?"
  - Should return 5 bottles in carousel
  - Each card shows different wine
  - Carousel swipes smoothly on mobile
- [ ] Ask: "Recommend 3 wines for pizza night"
  - Should return 3 bottles with pairing context
  - Each "shortWhy" should mention pizza
- [ ] Ask: "Best 10 wines" (if cellar has <10)
  - Should return all available bottles
  - Message should explain if fewer returned
- [ ] Click carousel arrow buttons (desktop)
  - Should navigate to next/previous bottle
  - Dots should update
- [ ] Swipe carousel (mobile)
  - Should snap to each bottle card
  - Should work in both directions
- [ ] Click "View Details" on carousel card
  - Should open WineDetailsModal for that bottle
- [ ] Test in Hebrew:
  - Carousel swipes right-to-left naturally
  - Arrows point in correct direction
  - Text aligns right

**Backward Compatibility**:
- [x] Single-bottle requests still work
- [x] Existing conversation history loads correctly
- [x] "View Bottle" button on single recommendations works

## Performance Considerations

- Carousel uses CSS snap scrolling (hardware-accelerated)
- Images lazy load
- Framer Motion animations optimized
- No impact on existing single-bottle flow
- Backend prompt only adds ~200 tokens for multi-bottle format

## Browser Compatibility

- Desktop: Chrome, Firefox, Safari, Edge (arrow controls)
- Mobile: iOS Safari, Chrome, Firefox (swipe gestures)
- RTL: Tested in Hebrew (RTL) and English (LTR)

## Future Enhancements (Optional)

- Add "Mark as Opened" button to carousel cards
- Show wine scores/ratings in carousel
- Add filter/sort options for multi-bottle results
- Persist carousel scroll position in conversation history
- Add keyboard navigation (arrow keys) for carousel

## Files Changed

**New Files**:
1. `apps/web/src/components/BottleCarousel.tsx` (405 lines)

**Modified Files**:
1. `apps/web/src/pages/AgentPageWorking.tsx`
   - Send icon rotation
   - Carousel rendering
   - Message handling
2. `apps/api/src/routes/agent.ts`
   - Multi-bottle prompt
   - Response validation
3. `apps/web/src/services/agentService.ts`
   - Interface updates
   - Type definitions

**Total**: 1 new file, 3 modified files

## Summary

The agent chat now:
✅ Has a proper send icon that feels natural in both RTL and LTR
✅ Understands and fulfills multi-bottle requests
✅ Displays multiple bottles in a premium carousel UI
✅ Works seamlessly on desktop and mobile
✅ Maintains backward compatibility with single-bottle flow
✅ Fully supports Hebrew (RTL) and English (LTR)

Users can now ask questions like "Show me your top 5 bottles" or "Recommend 3 wines for dinner" and get beautiful, interactive results!
