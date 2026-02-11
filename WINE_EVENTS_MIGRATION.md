# Wine Events Migration: Railway → Supabase Edge Functions

## Overview

Wine Events (Wine World Moments) feature has been migrated from Railway API to Supabase Edge Functions. This migration:

- ✅ Eliminates dependency on Railway (no cost, no downtime when trial ends)
- ✅ Uses existing Supabase infrastructure (already in use)
- ✅ Maintains all functionality (active events, dismiss, seen tracking)
- ✅ Simplifies deployment (single platform)

## What Changed

### Backend Migration

**Old Architecture:**
```
Frontend → Railway Express API (/api/events/*) → Supabase DB
```

**New Architecture:**
```
Frontend → Supabase Edge Function (wine-events) → Supabase DB
```

### Files Modified

1. **Created: `supabase/functions/wine-events/index.ts`**
   - New Supabase Edge Function that replaces Railway API
   - Endpoints:
     - `GET /wine-events` - Get active events
     - `POST /wine-events` (action: 'dismiss') - Dismiss event
     - `POST /wine-events` (action: 'seen') - Mark as seen
   - Includes bottle matching logic (grapes/color tags)
   - Handles user state tracking (dismissed, seen)

2. **Updated: `apps/web/src/services/wineEventsService.ts`**
   - `getActiveEvents()`: Now calls `supabase.functions.invoke('wine-events')`
   - `dismissEvent()`: Updated to POST to Edge Function
   - `markEventSeen()`: Updated to POST to Edge Function
   - Removed Railway API URL dependency
   - Removed feature flag checks (always enabled)

3. **Updated: `apps/web/src/pages/CellarPage.tsx`**
   - Removed `ENABLE_WINE_EVENTS` feature flag
   - Wine Events now always enabled (no API URL env var needed)

## Deployment

### Deploy the Edge Function

**Option 1: Supabase CLI**
```bash
cd /path/to/wine
npx supabase functions deploy wine-events
```

**Option 2: Supabase Dashboard**
1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/functions
2. Click "Create Function"
3. Name: `wine-events`
4. Copy/paste code from `supabase/functions/wine-events/index.ts`
5. Click "Deploy"

### Verify Deployment

1. Check function is deployed:
   ```bash
   npx supabase functions list
   ```

2. Test in browser console (after login):
   ```javascript
   const { data, error } = await supabase.functions.invoke('wine-events');
   console.log('Events:', data);
   ```

## Testing

After deployment, verify:

1. ✅ Events load on CellarPage (check banner appears)
2. ✅ Dismiss button works (event disappears)
3. ✅ Events match user's bottles correctly
4. ✅ No CORS errors in console
5. ✅ No Railway API errors

## Rollback (if needed)

If issues arise, you can temporarily disable Wine Events:

```typescript
// In CellarPage.tsx
const ENABLE_WINE_EVENTS = false; // Add this line back
```

Then revert the changes and redeploy Railway API.

## Benefits

1. **Cost**: Supabase Edge Functions are free (generous free tier)
2. **Simplicity**: Single platform for everything
3. **Reliability**: No external service dependency
4. **Performance**: Same or better latency
5. **Maintenance**: Easier to manage and deploy

## Notes

- Railway API (`apps/api/src/routes/events.ts`) can now be deprecated
- Environment variable `VITE_API_URL` is no longer required
- All Wine Events data remains in Supabase (`wine_events`, `user_event_states` tables)
