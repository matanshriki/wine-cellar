# Unified Add Bottle Button - UX Improvement

## Summary
Merged the "Add Bottle" and "Multi Bottle Import" buttons into a single unified entry point for better UX.

## Problem
- **Before**: Two separate buttons in the header ("Add Bottle" + "Multi Bottle Import")
- **Issue**: Visual clutter, cognitive load, unclear which option to use

## Solution
- **After**: Single "Add Bottle" button that opens a bottom sheet with 3 options:
  1. 📸 **Scan Label** - Single bottle (camera/upload) - PRIMARY
  2. 📋 **Manual Entry** - Single bottle (form) - SECONDARY
  3. 🎞️ **Scan Multiple Bottles** - Multi-bottle mode - BETA (feature-flagged)

## Implementation

### 1. AddBottleSheet Component (`apps/web/src/components/AddBottleSheet.tsx`)
- Added `onMultiBottleImport` prop
- Added `showMultiBottleOption` prop (feature-flagged)
- New UI option with:
  - Amber gradient background (to differentiate from primary)
  - Film/grid icon
  - "BETA" badge
  - Translation: "Scan multiple bottles at once"

### 2. CellarPage (`apps/web/src/pages/CellarPage.tsx`)
- **Removed** standalone "Multi Bottle Import" button from header
- **Removed** "Multi Bottle Import" button from empty state
- **Updated** AddBottleSheet to handle multi-bottle flow
- Feature flag (`canMultiBottleImport`) still controls visibility

### 3. Translations
- **EN**: `cellar.addBottle.multiBottleDesc`: "Scan multiple bottles at once"
- **HE**: `cellar.addBottle.multiBottleDesc`: "סרוק מספר בקבוקים בבת אחת"

## User Flow

### Before (2 buttons):
```
Header: [Add Bottle] [Multi Bottle Import] [Import CSV]
        ↓                ↓
   Single bottle    Multi-bottle
   flow             flow
```

### After (1 button):
```
Header: [Add Bottle] [Import CSV]
        ↓
   Bottom Sheet:
   ┌────────────────────────────────┐
   │  📸 Scan Label                 │ → Single bottle (AI)
   │  📋 Manual Entry               │ → Single bottle (form)
   │  🎞️ Scan Multiple Bottles BETA │ → Multi-bottle (if enabled)
   └────────────────────────────────┘
```

## Benefits

1. **Cleaner UI** - One less button in header (less visual clutter)
2. **Unified Entry Point** - One place to start adding bottles
3. **Progressive Disclosure** - User sees all options at once, chooses what they need
4. **Feature Flag Support** - Multi-bottle option hidden if flag is off
5. **No Functionality Lost** - All flows preserved
6. **Better Mobile UX** - Less crowded header on small screens
7. **Consistent Pattern** - Similar to other apps (WhatsApp, Instagram camera options)

## Feature Flag Behavior

- **If `canMultiBottleImport` is `true`**: 
  - Bottom sheet shows all 3 options
  - User can access multi-bottle import
  
- **If `canMultiBottleImport` is `false`**:
  - Bottom sheet shows only 2 options (Scan Label + Manual Entry)
  - Multi-bottle option is hidden
  - No visual indication that feature exists (clean for non-beta users)

## Testing

1. **Verify UI Changes**:
   - Hard refresh app: `Cmd + Shift + R`
   - Click "Add Bottle" button
   - Should see bottom sheet with 3 options (if beta flag is on)
   - Click "Scan Multiple Bottles" → should open multi-bottle modal

2. **Verify Feature Flag**:
   - Disable `canMultiBottleImport` flag in Supabase
   - Hard refresh
   - Click "Add Bottle"
   - Should only see 2 options (no multi-bottle)

3. **Verify Translations**:
   - Switch to Hebrew
   - Click "Add Bottle" (הוסף בקבוק)
   - Multi-bottle option should say: "סרוק מספר בקבוקים בבת אחת"

## Files Changed
- `apps/web/src/components/AddBottleSheet.tsx`
- `apps/web/src/pages/CellarPage.tsx`
- `apps/web/src/i18n/locales/en.json`
- `apps/web/src/i18n/locales/he.json`

## Git Commits
1. `a1bce9b` - Merge Add Bottle and Multi-Bottle Import into one button
2. `545b928` - Add multiBottleDesc translation (EN + HE)

## Future Enhancements
- Could add more options in the future (e.g., "Import from URL", "Connect to Vivino")
- All new bottle-adding methods can be added to this same bottom sheet
- Maintains consistency and doesn't clutter the header
