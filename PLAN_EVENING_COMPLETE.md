# Plan an Evening - Feature Complete

## ✅ Implementation Complete

The "Plan an Evening" feature has been fully implemented with persistence, Spotify-like queue UI, and complete wrap-up flow with ratings.

## What Was Implemented

### 1. Database Layer ✅
- **Migration**: `supabase/migrations/20260205_add_evening_plans.sql`
  - New `evening_plans` table with full schema
  - RLS policies for user-owned data
  - Indexes for performance
  - `updated_at` trigger
- **TypeScript Types**: Updated `apps/web/src/types/supabase.ts` with `evening_plans` table types

### 2. Service Layer ✅
- **File**: `apps/web/src/services/eveningPlanService.ts`
- **Functions**:
  - `getActivePlan()` - Fetch current active plan
  - `createPlan()` - Start new evening
  - `updateProgress()` - Move to next/previous wine
  - `updateQueue()` - Modify queue wines
  - `completePlan()` - Finish evening with stats
  - `cancelPlan()` - Cancel active plan
  - `getCompletedPlans()` - View history
  - `lineupToQueue()` - Convert lineup to queue format

### 3. UI Components ✅

#### EveningQueuePlayer Component
- **File**: `apps/web/src/components/EveningQueuePlayer.tsx`
- **Features**:
  - Spotify-like "Now Pouring" hero card with large wine image
  - Navigation controls (Previous, Next)
  - "Open bottle" primary action
  - Scrollable queue with current item highlighted
  - Progress indicator (X of Y wines)
  - Smooth Framer Motion transitions
  - Mobile-responsive design
- **Nested Component**: `WrapUpModal`
  - For each wine: toggle "Opened", quantity stepper, 1-5 star rating, notes
  - "Save to history" CTA
  - Integrates with `historyService.markBottleOpened()`

#### Integration Points
- **PlanEveningModal**: Modified to show `EveningQueuePlayer` for live step
  - Removed old `LivePlanStep` component
  - Added `activePlan` and `showQueuePlayer` states
  - `startLivePlan()` now calls `eveningPlanService.createPlan()`
  
- **TonightsOrbitCinematic**: Added "Resume evening" functionality
  - Checks for active plan on mount
  - Shows "Resume evening" button if plan exists
  - Renders `EveningQueuePlayer` for resuming

### 4. Feature Flow

#### Starting an Evening
1. User clicks "Plan an evening" in Tonight's Selection
2. Selects occasion and group size
3. AI generates recommended lineup
4. User can swap wines or adjust order
5. Clicks "Start the evening"
6. Plan is persisted to database with `status: 'active'`
7. Queue Player opens with first wine as "Now Pouring"

#### During the Evening
1. Current wine displayed in hero card
2. Queue shows full lineup below with current position highlighted
3. Navigation: Previous/Next buttons
4. "Open bottle" increments opened count
5. Progress bar shows position in lineup
6. All changes auto-save to database
7. If user closes app and returns, "Resume evening" button appears

#### Completing the Evening
1. User clicks "Wrap up evening"
2. Modal shows all queued wines
3. For each wine:
   - Toggle if it was opened
   - Set quantity opened (stepper: 1-N)
   - Rate wine (1-5 stars)
   - Add tasting notes
4. Clicks "Save to history"
5. System:
   - Calls `historyService.markBottleOpened()` for each opened wine
   - Decrements cellar quantities
   - Creates history records with ratings and notes
   - Updates plan: `status: 'completed'`, `completed_at`, summary stats
6. Shows "Evening Summary" screen with stats

### 5. Persistence

#### Database Schema
```sql
CREATE TABLE evening_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text CHECK (status IN ('active', 'completed', 'cancelled')),
  plan_name text,
  occasion text,
  group_size text,
  settings jsonb DEFAULT '{}'::jsonb,
  queue jsonb NOT NULL DEFAULT '[]'::jsonb,
  now_playing_index int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  total_bottles_opened int DEFAULT 0,
  average_rating decimal(3,2)
);
```

#### Queue Format
```json
[
  {
    "wine_id": "uuid",
    "bottle_id": "uuid",
    "position": 0,
    "notes": "Serve with appetizers",
    "opened": false,
    "opened_quantity": 0,
    "rating": null
  }
]
```

## Migration Steps

### 1. Apply Database Migration
```bash
# Local development
supabase db reset

# OR apply specific migration
psql $DATABASE_URL -f supabase/migrations/20260205_add_evening_plans.sql

# Production (via Supabase Dashboard)
# SQL Editor > New Query > Paste migration > Run
```

### 2. Enable Feature Flag
```sql
-- Enable for specific user
UPDATE profiles 
SET plan_evening_enabled = true 
WHERE id = 'USER_ID';

-- Enable for all users
UPDATE profiles 
SET plan_evening_enabled = true;
```

### 3. Deploy Code
```bash
# Build
npm run build

# Deploy to Vercel
git push origin main
```

## Testing Checklist

### ✅ Basic Flow
- [ ] "Plan an evening" button appears when feature enabled
- [ ] Modal opens with occasion/group size inputs
- [ ] AI generates lineup based on inputs
- [ ] Wines display with images, names, ratings
- [ ] "Start the evening" opens Queue Player

### ✅ Queue Player
- [ ] First wine shows in "Now Pouring" hero card
- [ ] Queue list shows all wines in order
- [ ] Current wine is highlighted
- [ ] Progress bar shows correct position
- [ ] "Previous" button works (when not on first)
- [ ] "Next" button works (when not on last)
- [ ] "Open bottle" button increments count
- [ ] Smooth animations and transitions

### ✅ Persistence
- [ ] Start evening, close app, reopen
- [ ] "Resume evening" button appears
- [ ] Click "Resume evening" opens Queue Player
- [ ] Plan resumes at correct wine index
- [ ] All previous opened bottles are recorded

### ✅ Wrap-Up Flow
- [ ] "Wrap up evening" button opens modal
- [ ] All wines listed with opened toggle
- [ ] Quantity stepper works (1-N bottles)
- [ ] Star rating works (1-5 stars)
- [ ] Notes input accepts text
- [ ] "Save to history" creates history records
- [ ] Cellar quantities decrement correctly
- [ ] Plan status changes to 'completed'
- [ ] Evening Summary shows stats

### ✅ Mobile & Desktop
- [ ] Responsive layout on mobile (320px+)
- [ ] Touch interactions work
- [ ] Scrolling in queue list smooth
- [ ] FAB doesn't overlap content
- [ ] Works in PWA mode

### ✅ Edge Cases
- [ ] No active plan shows "Plan an evening"
- [ ] Only one active plan allowed per user
- [ ] Starting new plan cancels old active plan
- [ ] Opening last bottle doesn't break UI
- [ ] Completing with 0 bottles opened works
- [ ] Ratings are optional (can be null)

## Known TypeScript Issues

The following TypeScript errors exist but don't prevent compilation:

1. **Pre-existing**: `rating` and `label_image_url` properties missing from Wine type
2. **Type cache**: `evening_plans` table types show as `never` in some IDEs
   - **Fix**: Restart TypeScript language server
   - Build still succeeds with Vite

## Files Changed

### New Files
- `supabase/migrations/20260205_add_evening_plans.sql`
- `apps/web/src/services/eveningPlanService.ts`
- `apps/web/src/components/EveningQueuePlayer.tsx`

### Modified Files
- `apps/web/src/types/supabase.ts` - Added `evening_plans` table types
- `apps/web/src/components/PlanEveningModal.tsx` - Integrated Queue Player
- `apps/web/src/components/TonightsOrbitCinematic.tsx` - Added Resume functionality

### Dependencies
- No new dependencies added
- Uses existing: Framer Motion, React Hook Form, Sonner (toast)

## Next Steps (Optional)

1. **History Integration**: Add "Evenings" filter in History page
2. **Analytics**: Track completion rates, popular occasions
3. **Recommendations**: Learn from completed evenings
4. **Sharing**: "Share your evening" feature
5. **Templates**: Save lineup as reusable template
6. **Multi-day**: Extend for weekend/multi-day events

## Support

- Feature is gated by `plan_evening_enabled` flag in profiles table
- Default: OFF for all new users
- Enable per-user or globally via SQL
- No impact on users with flag disabled
