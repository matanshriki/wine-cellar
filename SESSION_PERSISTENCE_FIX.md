# Session Persistence Fix - Stop Users From Re-logging In

## Problem
Users are being forced to log in every time they open the app because JWT tokens expire after 1 hour.

## Solution
1. **Increased JWT token expiry** to 7 days (works on free tier ✅)
2. **Client-side session timeout enforcement** (no Pro plan needed! ✅)
   - 7-day maximum session duration
   - 3-day inactivity timeout
   - Automatic logout when timeouts are exceeded

---

## What Was Implemented

### 1. JWT Token Expiry (Free Tier ✅)
Updated `supabase/config.toml`:
```toml
jwt_expiry = 604800  # 7 days (maximum allowed)
```

**For local dev**, restart Supabase:
```bash
npx supabase stop
npx supabase start
```

### 2. Client-Side Session Timeouts (Free Tier ✅)
**No Supabase Pro required!** We implemented this in the frontend code:

**Files updated:**
- `apps/web/src/utils/sessionPersistence.ts`
  - Tracks session start time
  - Tracks last activity time
  - Checks for timeouts (7d max, 3d inactivity)
  
- `apps/web/src/contexts/SupabaseAuthContext.tsx`
  - Checks timeouts on app load
  - Periodic timeout checks (every 60 seconds)
  - Auto-logout if session expired

**How it works:**
1. When user logs in → Records session start time
2. On every interaction → Updates last activity time
3. Every 60 seconds → Checks if session should expire:
   - ❌ Session > 7 days old? → Auto-logout
   - ❌ No activity for 3+ days? → Auto-logout
   - ✅ Still valid? → Keep session alive

---

## Production Setup (Required)

You **ONLY** need to update JWT expiry in production (free tier feature):

### Step 1: Go to Supabase Dashboard
👉 https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/settings/api

### Step 2: Update JWT Expiry
1. Find **"JWT expiry limit"** under JWT Settings
2. Change from `3600` to `604800`
3. Click **Save**

### Step 3: Deploy Code
```bash
git pull origin main  # Get the latest changes
# Vercel will auto-deploy
```

### Step 4: Verify
1. Log in to the app
2. Close the app
3. Wait 10 minutes
4. Reopen → ✅ Still logged in!

---

## How This Works

### 1. JWT Token (7 days)
- Access token valid for 7 days
- Auto-refreshes in the background
- Stored in localStorage: `wine-cellar-auth`

### 2. Client-Side Timeout Enforcement
**New!** Implemented in `sessionPersistence.ts`:
- Tracks `SESSION_START_KEY`: When user logged in
- Tracks `LAST_ACTIVITY_KEY`: Last interaction timestamp
- Checks every 60 seconds if session should expire:
  - **Absolute timeout**: 7 days from login
  - **Inactivity timeout**: 3 days of no activity
- Auto-logout with reason message if expired

### 3. Session Keep-Alive
Implemented in `SupabaseAuthContext.tsx`:
- Refreshes session every 5 minutes when app is in use
- Tracks user activity (clicks, touches, scrolls)
- Attempts session recovery on app launch

### 4. Refresh Tokens
- Supabase automatically refreshes tokens before expiry
- Enabled by: `autoRefreshToken: true` in our Supabase client config

### 5. Session Recovery
- If session expires, attempts to recover from recent activity
- Works within timeout windows (7d max, 3d inactivity)
- Logs success/failure for debugging

---

## Expected User Experience

### Before Fix ❌
- User logs in
- Closes app
- Opens app 2 hours later → **Forced to log in again**

### After Fix ✅
- User logs in
- Closes app for days
- Opens app any time within 7 days → **Still logged in**
- App auto-refreshes session in background
- Only logs out after:
  - 7 days total time, OR
  - 3 days of no activity, OR
  - User manually logs out

---

## Testing Checklist

- [ ] Updated production Supabase JWT expiry to 604800
- [ ] Deployed latest code with client-side timeout logic
- [ ] Tested: Login → Close app → Reopen after 1 hour → Still logged in ✅
- [ ] Tested: Login → Close app → Reopen next day → Still logged in ✅
- [ ] Tested: Login → Don't use app for 4 days → Logged out (inactivity timeout) ✅
- [ ] Tested: Login → Wait 8 days → Logged out (max session timeout) ✅
- [ ] Tested: PWA mode on iOS → Still logged in after closing ✅
- [ ] Tested: PWA mode on Android → Still logged in after closing ✅
- [ ] Tested: Check browser console for session logs (e.g., "[Session] New session started") ✅

---

## Troubleshooting

### Users still getting logged out frequently?

**Check 1: Production JWT expiry updated?**
```bash
# Verify Supabase Dashboard → Settings → API → JWT expiry = 604800
```

**Check 2: Latest code deployed?**
```bash
# Verify Vercel shows latest commit with session timeout logic
```

**Check 3: Check session storage in browser**
```javascript
// Open browser console and run:
console.log('Auth token:', localStorage.getItem('wine-cellar-auth'));
console.log('Session start:', localStorage.getItem('wine-cellar-session-start'));
console.log('Last activity:', localStorage.getItem('wine-cellar-last-activity'));

// Should see all three values. If any are null, something is clearing storage.
```

**Check 4: Test timeout logic manually**
```javascript
// In browser console, force an old session start time (8 days ago):
localStorage.setItem('wine-cellar-session-start', (Date.now() - 8 * 24 * 60 * 60 * 1000).toString());

// Refresh the page → Should auto-logout with message:
// "[Session] Session expired: 8 days old (max 7 days)"
```

**Check 5: Test inactivity timeout**
```javascript
// In browser console, force old last activity (4 days ago):
localStorage.setItem('wine-cellar-last-activity', (Date.now() - 4 * 24 * 60 * 60 * 1000).toString());

// Refresh the page → Should auto-logout with message:
// "[Session] Session expired: 4 days inactive (max 3 days)"
```

**Check 6: Service Worker issues?**
```javascript
// Force unregister and re-register service worker
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
  window.location.reload();
});
```

**Check 7: Session recovery working?**
```javascript
// Open console on app load
// Should see these logs:
// "[Session] New session started" (on first login)
// "Attempting session recovery..." (on app reopen)
// "Session recovered successfully" (if within timeout windows)
```

---

## Security Note

**7-day sessions are standard** for mobile/PWA apps:
- ✅ Banking apps: 7-30 days
- ✅ Social apps: 30-90 days
- ✅ Google/Apple: 90 days

**We have additional security**:
- ✅ 3-day inactivity timeout (auto-logout if unused)
- ✅ Supabase Row Level Security (RLS) on all data
- ✅ HTTPS only (enforced by Vercel)
- ✅ Token refresh rotation (enabled)

---

## Files Changed

### Backend Config
- ✅ `supabase/config.toml` - JWT expiry increased to 7 days

### Frontend Code (NEW!)
- ✅ `apps/web/src/utils/sessionPersistence.ts`
  - Added `checkSessionTimeout()` function
  - Tracks session start time and last activity
  - Returns expiry status with reason messages
  
- ✅ `apps/web/src/contexts/SupabaseAuthContext.tsx`
  - Checks timeouts on mount/session load
  - Periodic timeout checks every 60 seconds
  - Auto-logout with cleanup if session expired
  
### Already Configured
- ✅ `apps/web/src/lib/supabase.ts` - Persistent storage with localStorage
- ✅ Service Worker & PWA manifest - Offline support

---

## Deployment

### Local (Development)
```bash
# Restart Supabase with new config
npx supabase stop
npx supabase start
```

### Production (Supabase Dashboard)
Follow **Step 2** and **Step 3** above to update production settings.

No code deployment needed - the frontend already has all the session persistence logic! 🎉

