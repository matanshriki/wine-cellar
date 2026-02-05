# Plan an Evening - Completion Implementation Guide

## Summary

This document outlines the complete implementation of persistence, Queue Player UI, and completion flow for the "Plan an evening" feature. Due to the substantial changes required, this serves as a comprehensive guide for the remaining integration work.

## What Was Implemented

### 1. Database Schema ✅
**File**: `supabase/migrations/20260205_add_evening_plans.sql`

- Created `evening_plans` table with:
  - Status tracking (active/completed/cancelled)
  - Queue storage (JSONB array of wines)
  - Progress tracking (now_playing_index)
  - Completion statistics
  - RLS policies for user isolation

### 2. Service Layer ✅
**File**: `apps/web/src/services/eveningPlanService.ts`

Functions:
- `getActivePlan()` - Fetch user's active plan
- `createPlan()` - Create new plan (cancels existing active plans)
- `updateProgress()` - Save current position
- `updateQueue()` - Update wine list
- `completePlan()` - Mark as completed with stats
- `cancelPlan()` - Cancel active plan
- `getCompletedPlans()` - Fetch history
- `lineupToQueue()` - Convert lineup format to queue format

### 3. Queue Player UI ✅
**File**: `apps/web/src/components/EveningQueuePlayer.tsx`

**Features**:
- Spotify-like "Now Pouring" hero card
- Scrollable queue list with current item highlight
- Navigation controls (prev/next/jump)
- Progress bar showing completion percentage
- Smooth animations between wines
- Wrap-up modal for marking opened wines and ratings

## Remaining Integration Work

### Step 1: Update PlanEveningModal

**Changes needed in** `apps/web/src/components/PlanEveningModal.tsx`:

1. **Import new dependencies**:
```typescript
import { EveningQueuePlayer } from './EveningQueuePlayer';
import * as eveningPlanService from '../services/eveningPlanService';
import type { EveningPlan } from '../services/eveningPlanService';
```

2. **Add state for active plan**:
```typescript
const [activePlan, setActivePlan] = useState<EveningPlan | null>(null);
const [showQueuePlayer, setShowQueuePlayer] = useState(false);
```

3. **Replace `startLivePlan()` function**:
```typescript
const startLivePlan = async () => {
  console.log('[PlanEvening] Creating persistent plan...');
  
  try {
    // Convert lineup to queue format
    const queue = eveningPlanService.lineupToQueue(lineup);
    
    // Create plan in database
    const plan = await eveningPlanService.createPlan({
      occasion,
      group_size: groupSize,
      settings: {
        redsOnly,
        highRatingOnly,
        startTime,
      },
      queue,
    });
    
    setActivePlan(plan);
    setShowQueuePlayer(true);
  } catch (error) {
    console.error('[PlanEvening] Error creating plan:', error);
    toast.error('Failed to start evening plan');
  }
};
```

4. **Add Queue Player render**:
```typescript
{showQueuePlayer && activePlan && (
  <EveningQueuePlayer
    isOpen={showQueuePlayer}
    onClose={() => {
      setShowQueuePlayer(false);
      onClose();
    }}
    plan={activePlan}
    onPlanUpdated={setActivePlan}
    onComplete={async () => {
      setShowQueuePlayer(false);
      onClose();
      toast.success('🎉 Wonderful evening! Hope you enjoyed your wines.');
      // Trigger parent reload if needed
    }}
  />
)}
```

5. **Remove old LivePlanStep** - It's now replaced by EveningQueuePlayer

### Step 2: Add Resume Functionality to Tonight's Selection

**Changes needed in** `apps/web/src/components/TonightsOrbitCinematic.tsx`:

1. **Add state for active plan**:
```typescript
const [activePlan, setActivePlan] = useState<EveningPlan | null>(null);
const [checkingForPlan, setCheckingForPlan] = useState(true);
```

2. **Check for active plan on mount**:
```typescript
useEffect(() => {
  async function checkActivePlan() {
    if (!isPlanEveningEnabled) {
      setCheckingForPlan(false);
      return;
    }
    
    const plan = await eveningPlanService.getActivePlan();
    setActivePlan(plan);
    setCheckingForPlan(false);
  }
  
  checkActivePlan();
}, [isPlanEveningEnabled]);
```

3. **Show Resume button if plan exists**:
```typescript
{/* Plan an evening CTA (gated feature) */}
{!isPlanEveningLoading && isPlanEveningEnabled && !checkingForPlan && (
  <>
    {activePlan ? (
      <motion.button
        onClick={() => setShowQueuePlayer(true)}
        className="ml-4 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2"
        style={{
          background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
          color: 'white',
          border: '1px solid var(--wine-700)',
        }}
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.98 }}
      >
        <span>▶️</span>
        <span className="hidden sm:inline">Resume evening</span>
        <span className="sm:hidden">Resume</span>
      </motion.button>
    ) : (
      <motion.button
        onClick={() => setShowPlanEveningModal(true)}
        ...existing Plan button...
      </motion.button>
    )}
  </>
)}
```

4. **Add Queue Player for resume**:
```typescript
{activePlan && showQueuePlayer && (
  <EveningQueuePlayer
    isOpen={showQueuePlayer}
    onClose={() => setShowQueuePlayer(false)}
    plan={activePlan}
    onPlanUpdated={setActivePlan}
    onComplete={async () => {
      setShowQueuePlayer(false);
      setActivePlan(null);
      // Reload plans
      const newPlan = await eveningPlanService.getActivePlan();
      setActivePlan(newPlan);
    }}
  />
)}
```

### Step 3: Implement History Saving in Wrap-Up

**Changes needed in** `WrapUpModal` (inside `EveningQueuePlayer.tsx`):

Replace the TODO in `handleSaveToHistory` with:

```typescript
const handleSaveToHistory = async () => {
  console.log('[WrapUp] Saving to history...', wineStates);
  
  try {
    // For each opened wine, create history entry and update cellar
    for (const [idx, state] of Object.entries(wineStates)) {
      if (!state.opened) continue;
      
      const wine = queue[parseInt(idx)];
      
      // Call existing history service
      await historyService.recordOpen({
        bottle_id: wine.bottle_id,
        opened_quantity: state.quantity,
        notes: state.notes || undefined,
        rating: state.rating || undefined,
        opened_at: new Date().toISOString(),
      });
      
      console.log('[WrapUp] ✅ Recorded:', wine.wine_name, state.quantity, 'bottles');
    }
    
    // Calculate completion stats
    const openedCount = Object.values(wineStates).filter(s => s.opened).length;
    const ratings = Object.values(wineStates)
      .filter(s => s.opened && s.rating)
      .map(s => s.rating!);
    const avgRating = ratings.length > 0 
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
      : null;
    
    // Update queue with completion data
    const updatedQueue = queue.map((wine: QueuedWine, idx: number) => ({
      ...wine,
      opened: wineStates[idx]?.opened || false,
      opened_quantity: wineStates[idx]?.quantity || 0,
      user_rating: wineStates[idx]?.rating || null,
      notes: wineStates[idx]?.notes || undefined,
    }));
    
    // Complete the plan
    await eveningPlanService.completePlan(plan.id, {
      queue: updatedQueue,
      total_bottles_opened: openedCount,
      average_rating: avgRating,
    });
    
    toast.success(`🎉 Saved! ${openedCount} ${openedCount === 1 ? 'wine' : 'wines'} added to history.`);
    onComplete();
  } catch (error) {
    console.error('[WrapUp] Error saving to history:', error);
    toast.error('Failed to save to history. Please try again.');
  }
};
```

### Step 4: Update TypeScript Types

**Add to** `apps/web/src/types/supabase.ts`:

```typescript
evening_plans: {
  Row: {
    id: string
    user_id: string
    status: 'active' | 'completed' | 'cancelled'
    plan_name: string | null
    occasion: string | null
    group_size: string | null
    settings: Json
    queue: Json
    now_playing_index: number
    created_at: string
    updated_at: string
    completed_at: string | null
    total_bottles_opened: number
    average_rating: number | null
  }
  Insert: {
    id?: string
    user_id: string
    status?: 'active' | 'completed' | 'cancelled'
    plan_name?: string | null
    occasion?: string | null
    group_size?: string | null
    settings?: Json
    queue: Json
    now_playing_index?: number
    created_at?: string
    updated_at?: string
    completed_at?: string | null
    total_bottles_opened?: number
    average_rating?: number | null
  }
  Update: {
    id?: string
    user_id?: string
    status?: 'active' | 'completed' | 'cancelled'
    plan_name?: string | null
    occasion?: string | null
    group_size?: string | null
    settings?: Json
    queue?: Json
    now_playing_index?: number
    created_at?: string
    updated_at?: string
    completed_at?: string | null
    total_bottles_opened?: number
    average_rating?: number | null
  }
}
```

## Testing Checklist

After integration:

### A) New Plan Flow
- [ ] Click "Plan an evening" → Inputs work
- [ ] Generate lineup → Queue Player opens
- [ ] Now Pouring shows current wine
- [ ] Queue list shows all wines
- [ ] Current wine is highlighted
- [ ] Progress bar updates
- [ ] Next/Prev buttons work
- [ ] Jump to wine works
- [ ] Close and reopen → Plan resumes at same position

### B) Persistence
- [ ] Start plan → Close app → Reopen
- [ ] "Resume evening" button appears
- [ ] Click Resume → Queue Player opens at saved position
- [ ] Navigate wines → Close → Reopen → Position saved

### C) Completion Flow
- [ ] Reach last wine → "Wrap up evening" appears
- [ ] Click Wrap up → Modal opens
- [ ] Mark wines as opened
- [ ] Set quantities with stepper
- [ ] Rate wines with stars
- [ ] Click "Save to history"
- [ ] Success toast appears
- [ ] History entries created
- [ ] Cellar quantities updated
- [ ] Plan marked as completed

### D) Regression Testing
- [ ] Non-flagged users don't see button
- [ ] Scan label → Add works
- [ ] Scan receipt → Add works
- [ ] Duplicate detection works
- [ ] Tonight's Selection still works

## Known Limitations / Future Enhancements

1. **Swap functionality in Queue Player**: Currently not implemented - would need to add swap button in queue list
2. **Notes field in wrap-up**: Currently minimal - could be expanded
3. **Evening summary screen**: After completion, could show detailed stats
4. **History integration**: Could add "Evenings" filter in History page
5. **Multiple plans**: Currently cancels old plans - could allow multiple saved plans

## Migration Path

1. **Apply migration**: Run `20260205_add_evening_plans.sql`
2. **Deploy code**: All new components and services
3. **Test locally**: Run full test checklist
4. **Deploy to production**: Vercel auto-deploy + Supabase migration

## Rollback Plan

If issues occur:
1. Set `plan_evening_enabled = false` for all users (hides feature)
2. Fix issues in development
3. Re-enable for test users
4. Gradual rollout

---

## Implementation Priority

Given the scope, implement in this order:

1. ✅ Database + Service Layer (DONE)
2. ✅ Queue Player UI (DONE)
3. 🔄 Integration into PlanEveningModal (IN PROGRESS)
4. 🔄 Resume functionality (IN PROGRESS)
5. 🔄 History saving (IN PROGRESS)
6. ⏳ Testing (PENDING)
7. ⏳ Documentation (PENDING)

This allows incremental testing and reduces risk of breaking existing features.
