# PWA Session Persistence Implementation

## Problem
When the Wine Cellar Brain app is added to the iPhone home screen and opened, users had to log in every time because iOS can clear session storage between app launches.

## Solution
Implemented comprehensive PWA support with enhanced session persistence:

### 1. Enhanced Supabase Client Configuration
**File**: `apps/web/src/lib/supabase.ts`

- Added explicit `localStorage` storage strategy (more persistent than default)
- Custom storage key (`wine-cellar-auth`) for better isolation
- Enabled PKCE flow for better security and mobile compatibility
- Auto token refresh enabled

### 2. Session Persistence Utilities
**File**: `apps/web/src/utils/sessionPersistence.ts`

Features:
- **Session Activity Tracking**: Marks user activity in localStorage
- **Standalone Mode Detection**: Detects when app runs from home screen
- **Session Recovery**: Attempts to recover sessions from recent activity (7-day window)
- **Keep-Alive Mechanism**: Periodic session refresh (every 5 minutes) when in standalone mode
- **User Activity Monitoring**: Updates activity on clicks, touches, and scrolls

### 3. Enhanced Auth Context
**File**: `apps/web/src/contexts/SupabaseAuthContext.tsx`

Improvements:
- Automatic session recovery on app launch if recent activity detected
- Keep-alive mechanism activated in standalone mode
- Activity markers updated on all auth state changes
- Proper cleanup on sign out
- Detailed logging for debugging

### 4. PWA Manifest
**File**: `apps/web/public/manifest.json`

Defines:
- App name, icons, and theme colors
- Standalone display mode
- Proper scope and start URL
- iOS-specific configurations

### 5. Service Worker
**File**: `apps/web/public/sw.js`

Features:
- Precaches critical assets (index.html, manifest, icons)
- Network-first strategy with cache fallback
- Runtime caching for static assets
- Offline support for navigation
- Automatic cache cleanup

### 6. Service Worker Registration
**File**: `apps/web/src/utils/registerServiceWorker.ts`

- Registers service worker in production
- Handles updates and version changes
- Automatic reload on new version

### 7. iOS PWA Meta Tags
**File**: `apps/web/index.html`

Added:
- `apple-mobile-web-app-capable` for standalone mode
- `apple-mobile-web-app-status-bar-style` for status bar appearance
- `apple-mobile-web-app-title` for home screen name
- Apple touch icon
- Theme colors for iOS

## How It Works

### First Visit
1. User logs in normally
2. Session saved to localStorage with custom key
3. Activity markers set
4. Service worker registered (in production)

### App Reopened from Home Screen
1. Auth context checks for existing session in localStorage
2. If session found, user is automatically logged in
3. If session expired but recent activity detected, attempts token refresh
4. Keep-alive mechanism starts refreshing tokens every 5 minutes
5. User interactions (clicks, scrolls) update activity markers

### Session Expiration
- Sessions are valid for 7 days of inactivity
- Active usage resets the activity timer
- After 7 days of no use, user must log in again

## Testing

### Development Testing
To test PWA features in development:
```bash
# Enable service worker in dev mode
VITE_ENABLE_SW=true npm run dev
```

### iOS Testing
1. Open Safari on iPhone
2. Navigate to the app
3. Tap Share → Add to Home Screen
4. Open app from home screen
5. Log in
6. Close app completely
7. Reopen from home screen → Should stay logged in

### Debugging
Check browser console for these logs:
- `[PWA] Service worker registered`
- `Running in standalone mode - enabling session keep-alive`
- `Attempting session recovery...`
- `Session recovered successfully`
- `Auth state changed: [event]`

## Browser Storage Used
- **localStorage**:
  - `wine-cellar-auth` - Supabase session tokens
  - `wine-cellar-session-active` - Session active flag
  - `wine-cellar-last-activity` - Last activity timestamp
  
## Security Notes
- PKCE flow used for enhanced security
- Tokens auto-refresh before expiration
- Session markers cleared on explicit sign out
- 7-day activity window prevents indefinite persistence

## Limitations
- Requires localStorage support (all modern browsers)
- iOS Safari may still clear storage under extreme memory pressure (rare)
- Private browsing mode may limit persistence
- Requires network for initial token refresh

## Future Improvements
- Add biometric authentication option (Face ID/Touch ID)
- Implement push notifications for wine recommendations
- Add offline mode for viewing existing cellar data
- Background sync for pending changes

## Related Files
- `apps/web/src/lib/supabase.ts` - Supabase client config
- `apps/web/src/contexts/SupabaseAuthContext.tsx` - Auth context
- `apps/web/src/utils/sessionPersistence.ts` - Persistence utilities
- `apps/web/src/utils/registerServiceWorker.ts` - SW registration
- `apps/web/public/sw.js` - Service worker
- `apps/web/public/manifest.json` - PWA manifest
- `apps/web/index.html` - iOS meta tags
- `apps/web/src/main.tsx` - Entry point with SW init

## Deployment
After deploying these changes:
1. Users will need to log in once more
2. Subsequent opens from home screen will maintain the session
3. Service worker will install on first visit after deployment
4. Old sessions may need to be refreshed once

## Support
Works on:
- ✅ iOS Safari (iOS 11.3+)
- ✅ Android Chrome
- ✅ Android Firefox
- ✅ Desktop Chrome/Edge/Firefox
- ✅ Desktop Safari

Not tested:
- Samsung Internet
- Opera Mobile



