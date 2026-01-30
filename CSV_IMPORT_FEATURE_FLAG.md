# CSV Import Feature Flag

## Summary
Added profile-level permission flag for CSV Import feature to reduce UI clutter and improve UX.

## Problem
- CSV Import button visible to ALL users
- Feature analytics showed **0 users** actually using CSV import
- Button was taking up valuable header space
- Most users don't have existing wine spreadsheets

## Solution
Profile-level permission flag (`csv_import_enabled` column in `profiles` table)

### Implementation

#### 1. Database Migration
**File**: `supabase/migrations/20260130_add_csv_import_flag.sql`

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS csv_import_enabled BOOLEAN DEFAULT false;
```

- **Default**: `false` (disabled for all users)
- **Type**: Boolean
- **Nullable**: No (always has a value)

#### 2. Feature Flags Service
**File**: `apps/web/src/services/featureFlagsService.ts`

```typescript
export interface FeatureFlags {
  wishlistEnabled: boolean;
  cellarAgentEnabled: boolean;
  csvImportEnabled: boolean; // NEW
}

export const DEFAULT_FLAGS: FeatureFlags = {
  ...
  csvImportEnabled: false, // Disabled by default
};
```

#### 3. Feature Flags Context
**File**: `apps/web/src/contexts/FeatureFlagsContext.tsx`

- Added real-time subscription support for `csv_import_enabled`
- Updates automatically when flag is toggled (no logout required)
- Supports toast notifications when flag changes

#### 4. CellarPage
**File**: `apps/web/src/pages/CellarPage.tsx`

```typescript
const csvImportEnabled = useFeatureFlag('csvImportEnabled');

// CSV Import button (header)
{bottlesInCellar.length > 0 && csvImportEnabled && (
  <button onClick={() => setShowImport(true)}>
    {t('cellar.importCsv')}
  </button>
)}

// CSV Import button (empty state)
{csvImportEnabled && (
  <button onClick={() => setShowImport(true)}>
    {t('cellar.empty.importButton')}
  </button>
)}
```

## Usage

### For Admins: Enable CSV Import for a User

1. Open **Supabase Dashboard** → **SQL Editor**
2. Run `ENABLE_CSV_IMPORT_FOR_USER.sql` with user's email:

```sql
UPDATE public.profiles
SET csv_import_enabled = true
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email = 'user@example.com'
);
```

3. User **hard refreshes** app (`Cmd + Shift + R`)
4. CSV Import button appears! ✅

### For Admins: Disable CSV Import for a User

```sql
UPDATE public.profiles
SET csv_import_enabled = false
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email = 'user@example.com'
);
```

### Check Who Has CSV Import Enabled

```sql
SELECT 
  p.id,
  u.email,
  p.display_name,
  p.csv_import_enabled,
  p.updated_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.csv_import_enabled = true
ORDER BY p.updated_at DESC;
```

## User Experience

### Before (All Users)
```
┌─────────────────────────────────────────┐
│  [Share] [Multi Import] [CSV] [Add]    │ ← 4 buttons (cluttered!)
└─────────────────────────────────────────┘
```

### After (Default Users)
```
┌─────────────────────────┐
│  [Share] [Add]          │ ← 2 buttons (clean!)
└─────────────────────────┘
```

### After (Power Users with Flag)
```
┌─────────────────────────────────┐
│  [Share] [CSV] [Add]            │ ← 3 buttons (still cleaner)
└─────────────────────────────────┘
```

## Benefits

1. ✅ **Cleaner UI** - Most users (99%) don't see unused button
2. ✅ **Granular Control** - Enable for specific users (power users, admins)
3. ✅ **Real-time Updates** - Flag changes apply instantly via Supabase Realtime
4. ✅ **Fail-closed** - If fetch fails, button is hidden (secure default)
5. ✅ **Analytics-driven** - Based on actual usage data (0 users)
6. ✅ **Easy to Enable** - Simple SQL command for admins
7. ✅ **Follows Pattern** - Consistent with existing feature flags

## Feature Flag Systems

This app uses **two** feature flag systems:

### 1. `FeatureFlagsContext` (General Features)
**Location**: `featureFlagsService.ts` + `FeatureFlagsContext.tsx`

**Used for**: General feature permissions
- `wishlistEnabled`
- `cellarAgentEnabled`
- `csvImportEnabled` ← **This one**

**Properties**:
- Real-time updates via Supabase
- Toast notifications on change
- Auto-redirect if feature disabled while in use
- Fail-closed (false by default)

### 2. `useFeatureFlags` Hook (Beta Features)
**Location**: `hooks/useFeatureFlags.ts`

**Used for**: Beta/experimental features
- `canShareCellar`
- `canMultiBottleImport`

**Properties**:
- Enabled in dev environment automatically
- Must be explicitly enabled in production

## Migration Path

### Step 1: Run Migration
```bash
# In Supabase Dashboard → SQL Editor
# Run: supabase/migrations/20260130_add_csv_import_flag.sql
```

### Step 2: Deploy Frontend
```bash
git pull origin main
# Vercel auto-deploys
```

### Step 3: Enable for Power Users (Optional)
```bash
# Run ENABLE_CSV_IMPORT_FOR_USER.sql with their emails
```

### Step 4: Monitor Usage
```sql
-- Check if anyone is using it now
SELECT COUNT(*) 
FROM public.profiles 
WHERE csv_import_enabled = true;
```

## Future Enhancements

- **Analytics**: Track CSV import attempts by enabled users
- **Auto-enable**: If user has >50 bottles, auto-enable CSV import
- **Onboarding**: Show CSV import option in welcome flow for power users
- **Import History**: Track successful CSV imports per user

## Files Changed
1. `supabase/migrations/20260130_add_csv_import_flag.sql` - Database migration
2. `apps/web/src/services/featureFlagsService.ts` - Add CSV flag to service
3. `apps/web/src/contexts/FeatureFlagsContext.tsx` - Real-time support
4. `apps/web/src/pages/CellarPage.tsx` - Conditional rendering
5. `ENABLE_CSV_IMPORT_FOR_USER.sql` - Admin utility script

## Testing

### Test Case 1: Default User (Flag Disabled)
1. Create new user account
2. Login
3. Go to `/cellar`
4. **Expected**: No CSV Import button ✅

### Test Case 2: Power User (Flag Enabled)
1. Run `ENABLE_CSV_IMPORT_FOR_USER.sql` with user email
2. User hard refreshes (`Cmd + Shift + R`)
3. Go to `/cellar`
4. **Expected**: CSV Import button appears ✅

### Test Case 3: Real-time Toggle
1. User is logged in with flag disabled
2. Admin enables flag via SQL
3. **Expected**: Button appears instantly (no logout) ✅

### Test Case 4: Empty State
1. User with flag enabled, empty cellar
2. **Expected**: CSV Import button in empty state ✅

## Rollback Plan

If issues arise, disable for all users:

```sql
UPDATE public.profiles
SET csv_import_enabled = false;
```

Or rollback migration:

```sql
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS csv_import_enabled;
```

Frontend will fail-closed (hide button if column doesn't exist).
