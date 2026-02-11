# CORS Error Fix - Wine Events Feature

## Problem
The app was showing CORS errors in the browser console on every page load:

```
Access to fetch at 'https://wine-production.railway.app/api/events/active' 
from origin 'https://wine-cellar-brain.vercel.app' has been blocked by CORS policy
```

## Root Cause

The **Wine World Moments** feature (celebration days like "Syrah Day") tries to fetch events from an external API hosted on Railway. However:
- The Railway API is either **down** or **not configured**
- The `VITE_API_URL` environment variable is **not set** in your `.env` file
- The service was attempting to fetch anyway, causing CORS errors

## Solution Implemented

### 1. Added Feature Flag
```typescript
// Only enable Wine Events if API URL is configured
const ENABLE_WINE_EVENTS = !!import.meta.env.VITE_API_URL;
```

### 2. Graceful Degradation
- Skip events fetch if `VITE_API_URL` not configured
- Add 5-second timeout to prevent hanging
- Silent error handling (no console spam)
- App works perfectly without events feature

### 3. Defensive Checks
- Check feature flag before fetching
- Try-catch around all API calls
- Timeout on fetch requests
- Silent logging (informational only)

## What You'll See Now

### ✅ Before Fix:
- 🔴 Red CORS errors in console
- ⚠️ TypeError: Failed to fetch
- 🔄 Repeated fetch attempts every 5 minutes
- Console spam

### ✅ After Fix:
- ✅ No errors in console
- ✅ App loads cleanly
- ✅ All features work normally
- ✅ Events feature simply doesn't show (gracefully disabled)

## How to Enable Wine Events (Optional)

If you want to enable the Wine World Moments feature in the future:

### Option 1: Set Up Railway API
1. Deploy the wine events API to Railway
2. Add environment variable to your app:
   ```bash
   # In apps/web/.env
   VITE_API_URL=https://your-railway-app.railway.app
   ```
3. Redeploy your app
4. Events will automatically start working

### Option 2: Disable Permanently
The feature is already gracefully disabled. No action needed!

## Files Changed

1. ✅ `apps/web/src/services/wineEventsService.ts`
   - Added 5-second timeout
   - Better error handling
   - Silent failures
   - Skip if no API URL

2. ✅ `apps/web/src/pages/CellarPage.tsx`
   - Added `ENABLE_WINE_EVENTS` flag
   - Skip events fetch if disabled
   - No periodic polling if disabled

## Testing

### ✅ Verified:
1. App loads without errors
2. Console is clean (no CORS errors)
3. Cellar page works normally
4. All core features functional:
   - Add bottles ✅
   - Analyze cellar ✅
   - Tonight's selection ✅
   - Drink window ✅

### ✅ Events Feature:
- Disabled when `VITE_API_URL` not set
- No UI elements shown
- No API calls made
- No errors

## Deployment

Changes have been committed and pushed:
```bash
commit 4625c56
Fix Wine Events CORS errors - graceful degradation when API unavailable
```

### To Deploy:
1. **Vercel (frontend)** - Auto-deploys from git push ✅
2. **No backend changes needed** ✅

The fix is live after your next deployment or when you refresh the app!

---

## Summary

The Wine World Moments feature was trying to fetch from an unavailable API, causing CORS errors. It's now:
- ✅ Gracefully disabled when API not configured
- ✅ No errors in console
- ✅ App works perfectly without it
- ✅ Can be re-enabled anytime by setting `VITE_API_URL`

The app is now error-free! 🎉
