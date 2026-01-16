# Session Persistence Fix - Stop Users From Re-logging In

## Problem
Users are being forced to log in every time they open the app because JWT tokens expire after 1 hour.

## Solution
Increased token expiry times and configured session timeouts to keep users logged in longer.

---

## Local Development (Already Applied)

Updated `supabase/config.toml`:

```toml
# JWT token valid for 7 days (maximum allowed)
jwt_expiry = 604800

# Session timeouts
[auth.sessions]
timebox = "168h"           # Force logout after 7 days
inactivity_timeout = "72h" # Force logout after 3 days of inactivity
```

**Restart your local Supabase** to apply:
```bash
npx supabase stop
npx supabase start
```

---

## Production Setup (Required)

You **MUST** update these settings in your **Supabase Dashboard** for production:

### Step 1: Go to Supabase Dashboard
1. Visit: https://supabase.com/dashboard
2. Select your project: **Wine Cellar Brain**

### Step 2: Update JWT Expiry
1. Go to **Settings** → **API**
2. Scroll to **JWT Settings**
3. Find **"JWT expiry limit"**
4. Change from `3600` (1 hour) to `604800` (7 days)
5. Click **Save**

### Step 3: Update Session Timeouts
1. Go to **Authentication** → **Settings**
2. Scroll to **Session Management** section
3. Configure:
   - **Session Timeout**: `168 hours` (7 days)
   - **Inactivity Timeout**: `72 hours` (3 days of inactivity)
4. Click **Save**

### Step 4: Verify Changes
After updating, test with a user:
1. Log in to the app
2. Close the app completely
3. Wait 10 minutes
4. Reopen the app
5. ✅ User should still be logged in (no login prompt)

---

## How This Works

### 1. JWT Token (7 days)
- Access token valid for 7 days
- Auto-refreshes in the background
- Stored in localStorage: `wine-cellar-auth`

### 2. Session Keep-Alive
Already implemented in `SupabaseAuthContext.tsx`:
- Refreshes session every 5 minutes when app is in use
- Tracks user activity (clicks, touches, scrolls)
- Attempts session recovery on app launch

### 3. Refresh Tokens
- Supabase automatically refreshes tokens before expiry
- Enabled by: `autoRefreshToken: true` in our Supabase client config

### 4. Session Recovery
- If session expires, attempts to recover from recent activity
- Works within 7-day window
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
- [ ] Updated production session timeouts (168h / 72h)
- [ ] Tested: Login → Close app → Reopen after 1 hour → Still logged in
- [ ] Tested: Login → Close app → Reopen next day → Still logged in
- [ ] Tested: Login → Don't use app for 4 days → Logged out (inactivity timeout works)
- [ ] Tested: PWA mode on iOS → Still logged in after closing
- [ ] Tested: PWA mode on Android → Still logged in after closing

---

## Troubleshooting

### Users still getting logged out frequently?

**Check 1: Production settings applied?**
```bash
# Verify your production Supabase settings match the guide above
```

**Check 2: Browser/PWA clearing storage?**
```javascript
// Open browser console on the login page and run:
console.log(localStorage.getItem('wine-cellar-auth'));
// Should see a token value. If null, storage is being cleared.
```

**Check 3: Service Worker issues?**
```bash
# Force unregister and re-register service worker
# In browser console:
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
  window.location.reload();
});
```

**Check 4: Session recovery working?**
```javascript
// Open console on login screen
// Should see these logs:
// "Attempting session recovery..."
// "Session recovered successfully" (if within 7-day window)
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

- ✅ `supabase/config.toml` - Local JWT expiry & session timeouts
- ✅ `apps/web/src/lib/supabase.ts` - Already configured for persistence
- ✅ `apps/web/src/utils/sessionPersistence.ts` - Already has keep-alive logic
- ✅ `apps/web/src/contexts/SupabaseAuthContext.tsx` - Already has recovery logic

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

