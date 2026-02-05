# PlanEveningModal Food-Aware Updates

## Required Imports

Add to the top of `PlanEveningModal.tsx`:

```typescript
import * as wineProfileService from '../services/wineProfileService';
import type { FoodProfile, WineProfile } from '../services/wineProfileService';
```

## Extended WineSlot Interface

Update the `WineSlot` interface:

```typescript
interface WineSlot {
  bottle: BottleWithWineInfo;
  position: number;
  label: string;
  isLocked: boolean;
  wineProfile?: WineProfile; // ADD THIS
}
```

## Add Food State Variables

After the existing state declarations (around line 50):

```typescript
// Food selection state (NEW)
const [selectedProtein, setSelectedProtein] = useState<'beef' | 'lamb' | 'chicken' | 'fish' | 'veggie' | 'none'>('none');
const [selectedSauce, setSelectedSauce] = useState<'tomato' | 'bbq' | 'creamy' | 'none'>('none');
const [selectedSpice, setSelectedSpice] = useState<'low' | 'med' | 'high'>('low');
const [selectedSmoke, setSelectedSmoke] = useState<'low' | 'med' | 'high'>('low');
```

## Replace `generateLineup()` Function

Replace the entire `generateLineup()` function (around lines 65-116) with:

```typescript
// Generate lineup based on inputs (FOOD-AWARE)
const generateLineup = () => {
  console.log('[PlanEvening] Generating food-aware lineup...', {
    occasion,
    groupSize,
    food: { selectedProtein, selectedSauce, selectedSpice, selectedSmoke },
  });
  
  // Determine number of wines
  const wineCount = groupSize === '2-4' ? 3 : groupSize === '5-8' ? 4 : 5;
  
  // Filter candidates
  let candidates = [...candidateBottles].filter(b => b.quantity > 0);
  
  if (redsOnly) {
    candidates = candidates.filter(b => b.wine.color === 'red');
  }
  
  if (highRatingOnly) {
    candidates = candidates.filter(b => (b.wine.rating || 0) >= 4.2);
  }
  
  // Build food profile
  const foodProfile: FoodProfile = {
    protein: selectedProtein,
    fat: selectedProtein === 'beef' || selectedProtein === 'lamb' ? 'high' 
       : selectedProtein === 'fish' || selectedProtein === 'veggie' ? 'low'
       : 'med',
    sauce: selectedSauce,
    spice: selectedSpice,
    smoke: selectedSmoke,
  };
  
  // Score each candidate with food pairing
  const scoredCandidates = candidates.map(bottle => {
    const wineProfile = wineProfileService.getWineProfile(bottle.wine);
    
    let score = 0;
    
    // Readiness score
    const analysis = bottle as any;
    if (analysis.readiness_label === 'READY') score += 100;
    else if (analysis.readiness_label === 'PEAK_SOON') score += 50;
    
    // Rating score
    if (bottle.wine.rating && bottle.wine.rating >= 4.2) score += 30;
    
    // Food pairing score (NEW - uses wine profiles!)
    if (selectedProtein !== 'none') {
      const pairingScore = wineProfileService.calculateFoodPairingScore(wineProfile, foodProfile);
      score += pairingScore;
    }
    
    // Diversity bonus (slight randomization)
    score += Math.random() * 10;
    
    return { bottle, score, wineProfile };
  });
  
  // Sort by score (highest first)
  scoredCandidates.sort((a, b) => b.score - a.score);
  
  // Take top wines
  const selectedBottles = scoredCandidates.slice(0, Math.min(wineCount, scoredCandidates.length));
  
  // ORDER BY POWER for smooth progression (NEW!)
  // Sort ascending (light to powerful)
  selectedBottles.sort((a, b) => a.wineProfile.power - b.wineProfile.power);
  
  // Avoid back-to-back high tannin+oak if possible
  for (let i = 1; i < selectedBottles.length - 1; i++) {
    const prev = selectedBottles[i - 1].wineProfile;
    const curr = selectedBottles[i].wineProfile;
    const next = selectedBottles[i + 1]?.wineProfile;
    
    if (prev.tannin >= 4 && prev.oak >= 4 && curr.tannin >= 4 && curr.oak >= 4) {
      // Try to find a lighter wine to swap
      if (next && next.tannin < 4) {
        [selectedBottles[i], selectedBottles[i + 1]] = [selectedBottles[i + 1], selectedBottles[i]];
      }
    }
  }
  
  // Create lineup with labels and profiles
  const labels = ['Warm-up', 'Mid', 'Main', 'Finale', 'Grand Finale', 'Closer'];
  
  const newLineup: WineSlot[] = selectedBottles.map(({ bottle, wineProfile }, idx) => ({
    bottle,
    position: idx + 1,
    label: labels[idx] || `Wine ${idx + 1}`,
    isLocked: false,
    wineProfile, // Store for later use
  }));
  
  console.log('[PlanEvening] Generated lineup with power progression:', newLineup.map(s => ({
    name: s.bottle.wine.wine_name,
    power: s.wineProfile?.power,
  })));
  
  setLineup(newLineup);
  setCurrentStep('lineup');
};
```

## Add Food Selection UI to InputStep

In the `InputStep` component (around line 360), add after the group size selection:

```tsx
{/* Food Selection (NEW) */}
<div className="space-y-4 mt-6">
  <div className="flex items-center gap-2">
    <span className="text-lg">🍽️</span>
    <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
      What are you eating?
    </label>
  </div>
  
  {/* Protein */}
  <div>
    <div className="text-xs mb-2 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
      Protein
    </div>
    <div className="flex flex-wrap gap-2">
      {(['beef', 'lamb', 'chicken', 'fish', 'veggie', 'none'] as const).map(protein => (
        <button
          key={protein}
          onClick={() => setSelectedProtein(protein)}
          className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
          style={{
            background: selectedProtein === protein 
              ? 'linear-gradient(135deg, var(--wine-500), var(--wine-600))'
              : 'var(--bg-surface-elevated)',
            color: selectedProtein === protein ? 'white' : 'var(--text-secondary)',
            border: `1px solid ${selectedProtein === protein ? 'var(--wine-600)' : 'var(--border-medium)'}`,
          }}
        >
          {protein === 'none' ? 'No food' : protein.charAt(0).toUpperCase() + protein.slice(1)}
        </button>
      ))}
    </div>
  </div>
  
  {/* Sauce (only show if protein selected) */}
  {selectedProtein !== 'none' && (
    <div>
      <div className="text-xs mb-2 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
        Sauce
      </div>
      <div className="flex flex-wrap gap-2">
        {(['tomato', 'bbq', 'creamy', 'none'] as const).map(sauce => (
          <button
            key={sauce}
            onClick={() => setSelectedSauce(sauce)}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: selectedSauce === sauce 
                ? 'linear-gradient(135deg, var(--wine-500), var(--wine-600))'
                : 'var(--bg-surface-elevated)',
              color: selectedSauce === sauce ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${selectedSauce === sauce ? 'var(--wine-600)' : 'var(--border-medium)'}`,
            }}
          >
            {sauce === 'none' ? 'No sauce' : sauce.charAt(0).toUpperCase() + sauce.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )}
  
  {/* Spice (only show if protein selected) */}
  {selectedProtein !== 'none' && (
    <div className="flex gap-4">
      <div className="flex-1">
        <div className="text-xs mb-2 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          Spice
        </div>
        <div className="flex gap-2">
          {(['low', 'med', 'high'] as const).map(spice => (
            <button
              key={spice}
              onClick={() => setSelectedSpice(spice)}
              className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: selectedSpice === spice 
                  ? 'linear-gradient(135deg, var(--wine-500), var(--wine-600))'
                  : 'var(--bg-surface-elevated)',
                color: selectedSpice === spice ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${selectedSpice === spice ? 'var(--wine-600)' : 'var(--border-medium)'}`,
              }}
            >
              {spice === 'low' ? '🌶️' : spice === 'med' ? '🌶️🌶️' : '🌶️🌶️🌶️'}
            </button>
          ))}
        </div>
      </div>
      
      {/* Smoke */}
      <div className="flex-1">
        <div className="text-xs mb-2 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          Smoke
        </div>
        <div className="flex gap-2">
          {(['low', 'med', 'high'] as const).map(smoke => (
            <button
              key={smoke}
              onClick={() => setSelectedSmoke(smoke)}
              className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: selectedSmoke === smoke 
                  ? 'linear-gradient(135deg, var(--wine-500), var(--wine-600))'
                  : 'var(--bg-surface-elevated)',
                color: selectedSmoke === smoke ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${selectedSmoke === smoke ? 'var(--wine-600)' : 'var(--border-medium)'}`,
              }}
            >
              {smoke === 'low' ? '💨' : smoke === 'med' ? '💨💨' : '💨💨💨'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )}
</div>
```

## Add Pairing Explanations to LineupStep

In the `LineupStep` component (around line 730), add under each wine card:

```tsx
{/* Wine card content... existing code... */}

{/* ADD THIS: Pairing explanation */}
{slot.wineProfile && selectedProtein !== 'none' && (
  <p className="text-xs mt-2 italic leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
    {wineProfileService.getPairingExplanation(
      slot.bottle,
      slot.wineProfile,
      {
        protein: selectedProtein,
        fat: selectedProtein === 'beef' || selectedProtein === 'lamb' ? 'high' 
           : selectedProtein === 'fish' || selectedProtein === 'veggie' ? 'low'
           : 'med',
        sauce: selectedSauce,
        spice: selectedSpice,
        smoke: selectedSmoke,
      },
      idx === 0 ? 'first' : idx === lineup.length - 1 ? 'last' : 'middle'
    )}
  </p>
)}
```

## Summary of Changes

1. ✅ Added food state variables (protein, sauce, spice, smoke)
2. ✅ Updated `generateLineup()` to use wine profiles + food pairing scores
3. ✅ Added power-based ordering (light → powerful progression)
4. ✅ Added constraint to avoid back-to-back high tannin+oak wines
5. ✅ Added food selection UI (chips for protein, sauce, spice, smoke)
6. ✅ Added pairing explanations under each wine in lineup

The implementation:
- Uses existing luxury UI patterns
- Reuses existing animation system (Framer Motion)
- Falls back gracefully if wine profiles missing (uses heuristics)
- Adds no new dependencies
- Maintains mobile responsiveness

Apply these changes to `PlanEveningModal.tsx` to complete the food-aware planning feature.
