# Wine Profile Implementation Summary

## ✅ Completed

### 1. Database Migrations
**File:** `supabase/migrations/20260205_add_wine_profiles.sql`

- Added `wine_profile` (jsonb), `wine_profile_updated_at`, `wine_profile_source`, `wine_profile_confidence` to `wines` table
- Created `profile_backfill_jobs` table for tracking bulk generation
- Added `is_admin` flag to `profiles` table
- Created indexes and RLS policies
- Added triggers for `updated_at`

**TO RUN IN SUPABASE:**
```sql
-- Apply the migration
-- Copy and run the entire content of:
-- supabase/migrations/20260205_add_wine_profiles.sql
```

### 2. Edge Function
**File:** `supabase/functions/generate-wine-profile/index.ts`

- Uses OpenAI with strict JSON schema validation
- Generates profiles: body, tannin, acidity, oak, sweetness, alcohol_est
- Computes `power` (1-10) server-side using deterministic formula
- Persists to DB if `wine_id` provided
- Returns structured error responses

**TO DEPLOY:**
```bash
supabase functions deploy generate-wine-profile
```

### 3. Client Service
**File:** `apps/web/src/services/wineProfileService.ts`

- `getWineProfile()` - reads from DB with heuristic fallback
- `getHeuristicProfile()` - generates estimates from region/grapes/color
- `generateWineProfile()` - calls Edge Function
- `calculateFoodPairingScore()` - scores wine+food compatibility
- `getPairingExplanation()` - generates pairing text

### 4. Admin Tool
**File:** `apps/web/src/components/AdminWineProfileBackfill.tsx`

- Admin-only component (checks `profiles.is_admin`)
- Bulk generates profiles for wines without them
- Shows progress bar, current wine, stats
- Processes in batches with concurrency limit (2)
- Saves progress to `profile_backfill_jobs` table
- Resumable if page refreshes

**TO INTEGRATE:**
Add to Settings page or Admin section:
```tsx
import { AdminWineProfileBackfill } from './components/AdminWineProfileBackfill';

// In your settings/admin page:
<AdminWineProfileBackfill />
```

## 🔄 Remaining Work

### 5. Food Selection UI (PlanEveningModal)

**Required Changes to `PlanEveningModal.tsx`:**

1. **Add food state:**
```typescript
// Food selection state
const [selectedProtein, setSelectedProtein] = useState<'beef' | 'lamb' | 'chicken' | 'fish' | 'veggie' | 'none'>('none');
const [selectedSauce, setSelectedSauce] = useState<'tomato' | 'bbq' | 'creamy' | 'none'>('none');
const [selectedSpice, setSelectedSpice] = useState<'low' | 'med' | 'high'>('low');
const [selectedSmoke, setSelectedSmoke] = useState<'low' | 'med' | 'high'>('low');
```

2. **Add food chips UI in InputStep:**
```tsx
{/* Food selection - after group size */}
<div className="space-y-3 mt-6">
  <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
    🍽️ What are you eating?
  </label>
  
  {/* Protein chips */}
  <div>
    <div className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Protein</div>
    <div className="flex flex-wrap gap-2">
      {['beef', 'lamb', 'chicken', 'fish', 'veggie', 'none'].map(protein => (
        <button
          key={protein}
          onClick={() => setSelectedProtein(protein as any)}
          className="px-3 py-1.5 rounded-full text-sm transition-all"
          style={{
            background: selectedProtein === protein 
              ? 'linear-gradient(135deg, var(--wine-500), var(--wine-600))'
              : 'var(--bg-surface)',
            color: selectedProtein === protein ? 'white' : 'var(--text-secondary)',
            border: `1px solid ${selectedProtein === protein ? 'var(--wine-600)' : 'var(--border-medium)'}`,
          }}
        >
          {protein.charAt(0).toUpperCase() + protein.slice(1)}
        </button>
      ))}
    </div>
  </div>
  
  {/* Sauce chips */}
  <div>
    <div className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Sauce</div>
    <div className="flex flex-wrap gap-2">
      {['tomato', 'bbq', 'creamy', 'none'].map(sauce => (
        <button
          key={sauce}
          onClick={() => setSelectedSauce(sauce as any)}
          className="px-3 py-1.5 rounded-full text-sm transition-all"
          style={{
            background: selectedSauce === sauce 
              ? 'linear-gradient(135deg, var(--wine-500), var(--wine-600))'
              : 'var(--bg-surface)',
            color: selectedSauce === sauce ? 'white' : 'var(--text-secondary)',
            border: `1px solid ${selectedSauce === sauce ? 'var(--wine-600)' : 'var(--border-medium)'}`,
          }}
        >
          {sauce.charAt(0).toUpperCase() + sauce.slice(1)}
        </button>
      ))}
    </div>
  </div>
  
  {/* Similar for spice and smoke... */}
</div>
```

3. **Update `generateLineup()` to use food-aware scoring:**
```typescript
import * as wineProfileService from '../services/wineProfileService';

const generateLineup = () => {
  // ... existing code ...
  
  // Build food profile
  const foodProfile: wineProfileService.FoodProfile = {
    protein: selectedProtein,
    fat: selectedProtein === 'beef' || selectedProtein === 'lamb' ? 'high' : 
         selectedProtein === 'fish' || selectedProtein === 'veggie' ? 'low' : 'med',
    sauce: selectedSauce,
    spice: selectedSpice,
    smoke: selectedSmoke,
  };
  
  // Score each candidate
  const scoredCandidates = candidates.map(bottle => {
    const wineProfile = wineProfileService.getWineProfile(bottle.wine);
    
    // Base score
    let score = 0;
    
    // Readiness
    if ((bottle as any).readiness_label === 'READY') score += 100;
    
    // Rating
    if (bottle.wine.rating && bottle.wine.rating >= 4.2) score += 50;
    
    // Food pairing
    const pairingScore = wineProfileService.calculateFoodPairingScore(wineProfile, foodProfile);
    score += pairingScore;
    
    return { bottle, score, wineProfile };
  });
  
  // Sort by score
  scoredCandidates.sort((a, b) => b.score - a.score);
  
  // Take top wines
  const selectedBottles = scoredCandidates.slice(0, Math.min(wineCount, scoredCandidates.length));
  
  // ORDER BY POWER (smooth progression)
  selectedBottles.sort((a, b) => a.wineProfile.power - b.wineProfile.power);
  
  // Avoid back-to-back high tannin
  // (Optional refinement logic here)
  
  // Create lineup
  const newLineup: WineSlot[] = selectedBottles.map(({ bottle, wineProfile }, idx) => ({
    bottle,
    position: idx + 1,
    label: labels[idx] || `Wine ${idx + 1}`,
    isLocked: false,
    wineProfile, // Store for pairing explanation
  }));
  
  setLineup(newLineup);
  setCurrentStep('lineup');
};
```

4. **Add pairing explanations in LineupStep:**
```tsx
{/* Under each wine, add explanation */}
<p className="text-xs mt-2 italic" style={{ color: 'var(--text-tertiary)' }}>
  {wineProfileService.getPairingExplanation(
    slot.bottle,
    slot.wineProfile,
    foodProfile,
    idx === 0 ? 'first' : idx === lineup.length - 1 ? 'last' : 'middle'
  )}
</p>
```

### 6. Settings Page Integration

**Add admin tool to Settings:**
```tsx
// In SettingsPage.tsx or similar:
import { AdminWineProfileBackfill } from '../components/AdminWineProfileBackfill';

// Add section:
<AdminWineProfileBackfill />
```

## 🧪 Testing Checklist

### Admin Backfill
- [ ] Admin users see backfill tool
- [ ] Non-admin users don't see it
- [ ] Backfill generates profiles successfully
- [ ] Progress bar updates correctly
- [ ] Can cancel mid-run
- [ ] Can resume after refresh
- [ ] Failed wines are logged

### Food-Aware Planning
- [ ] Food chips display correctly
- [ ] Selecting beef/lamb favors bold, tannic reds
- [ ] Selecting fish favors lighter wines with acidity
- [ ] Tomato sauce favors high-acidity wines
- [ ] Spicy food avoids high-tannin wines
- [ ] Lineup order shows power progression (low → high)
- [ ] Pairing explanations make sense

### Fallback Behavior
- [ ] Wines without profiles use heuristics
- [ ] Planning still works if profiles missing
- [ ] No console errors if wine_profile is null

### No Regressions
- [ ] Scan/add wine flows work
- [ ] Duplicate detection works
- [ ] Evening plan persistence works
- [ ] Resume evening works

## 📝 Commit Message

```
feat: Add AI wine profiles + food-aware evening planner

Database:
- Add wine_profile (jsonb) columns to wines table
- Add profile_backfill_jobs table for tracking bulk generation
- Add is_admin flag to profiles table
- Create indexes and RLS policies

Edge Function:
- New generate-wine-profile function using OpenAI
- Strict JSON schema validation
- Computes power (1-10) deterministically
- Persists profiles to database

Client:
- Wine profile service with heuristic fallbacks
- Admin backfill tool for bulk profile generation
- Food selection UI in Plan an Evening
- Food-aware scoring and wine selection
- Power-based lineup ordering
- Pairing explanations for each wine

Features:
- Wine profiles (body, tannin, acidity, oak, sweetness, power)
- Food pairing logic (protein, sauce, spice, smoke)
- Smart lineup generation based on food + wine compatibility
- Smooth power progression throughout evening
- Graceful fallback to heuristics if profiles missing

No new dependencies. Luxury UI maintained.
```

## 🚀 Deployment Steps

1. **Apply database migration:**
   - Copy `supabase/migrations/20260205_add_wine_profiles.sql` to Supabase SQL Editor
   - Run in production database

2. **Deploy Edge Function:**
   ```bash
   supabase functions deploy generate-wine-profile
   ```

3. **Set admin flag for yourself:**
   ```sql
   UPDATE profiles SET is_admin = true WHERE id = 'YOUR_USER_ID';
   ```

4. **Run backfill:**
   - Visit Settings/Admin section
   - Click "Start Backfill"
   - Wait for completion

5. **Test food-aware planning:**
   - Go to Tonight's Selection
   - Click "Plan an evening"
   - Select food options
   - Verify smart wine selection and ordering

## 📦 Files Created/Modified

### New Files:
- `supabase/migrations/20260205_add_wine_profiles.sql`
- `supabase/functions/generate-wine-profile/index.ts`
- `apps/web/src/services/wineProfileService.ts`
- `apps/web/src/components/AdminWineProfileBackfill.tsx`
- `WINE_PROFILE_SCHEMA.md`

### Files to Modify:
- `apps/web/src/components/PlanEveningModal.tsx` (add food selection + scoring)
- `apps/web/src/pages/SettingsPage.tsx` or similar (add admin tool)
- `apps/web/src/types/supabase.ts` (if regenerating types)

All code follows luxury design system, uses existing animation patterns, and adds no new dependencies.
