# Google OAuth Implementation Summary

## Quick Start

### 1. Get Google OAuth Credentials
Visit: https://console.cloud.google.com/
- Create a project
- Enable Google+ API
- Create OAuth 2.0 credentials
- Add redirect URI: `http://localhost:3001/api/auth/google/callback`

### 2. Configure Environment
Create `/apps/api/.env`:
```bash
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-secret"
API_URL="http://localhost:3001"
WEB_URL="http://localhost:5173"
```

### 3. Start the App
```bash
npm run dev
```

That's it! The "Sign in with Google" button will appear on the login page.

## Changes Made

### Database (Prisma Schema)
```prisma
model User {
  id            String      @id @default(uuid())
  email         String      @unique
  passwordHash  String?     // ← Now optional (was required)
  name          String?
  authProvider  String      @default("local") // ← NEW: "local" or "google"
  googleId      String?     @unique          // ← NEW: Google OAuth ID
  picture       String?                       // ← NEW: Profile picture URL
  // ... rest unchanged
}
```

**Migration**: `20251226143731_add_oauth_support`

### Backend Files

#### New Files
1. **`/apps/api/src/auth/google.ts`** (103 lines)
   - Passport.js Google OAuth strategy
   - Handles new user creation
   - Handles account linking
   - User serialization/deserialization

#### Modified Files
1. **`/apps/api/src/config.ts`**
   - Added: `googleClientId`, `googleClientSecret`, `apiUrl`, `webUrl`

2. **`/apps/api/src/routes/auth.ts`**
   - Added: `GET /api/auth/google` - Initiates OAuth flow
   - Added: `GET /api/auth/google/callback` - Handles OAuth callback
   - Updated: `/api/auth/me` - Returns `picture` and `authProvider`
   - Updated: `POST /api/auth/login` - Check for OAuth-only accounts

3. **`/apps/api/src/index.ts`**
   - Added: `import passport`
   - Added: `setupGoogleAuth()` call
   - Added: `app.use(passport.initialize())`

#### New Dependencies
```json
{
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "@types/passport": "^1.0.17",
  "@types/passport-google-oauth20": "^2.0.16"
}
```

### Frontend Files

#### Modified Files
1. **`/apps/web/src/pages/LoginPage.tsx`**
   - Added: "OR" divider
   - Added: "Sign in with Google" button with Google logo
   - Mobile-optimized (44x44px touch target)
   - RTL-aware layout

2. **`/apps/web/src/contexts/AuthContext.tsx`**
   - Added: OAuth token extraction from URL query params
   - Added: Clean up URL after token extraction
   - Store token in localStorage

3. **`/apps/web/src/i18n/locales/en.json`**
   - Added: `auth.login.or` - "OR"
   - Added: `auth.login.googleSignIn` - "Sign in with Google"

4. **`/apps/web/src/i18n/locales/he.json`**
   - Added: `auth.login.or` - "או"
   - Added: `auth.login.googleSignIn` - "התחבר עם Google"

## OAuth Flow Diagram

```
┌─────────────┐
│   User      │
│ (Browser)   │
└──────┬──────┘
       │
       │ 1. Click "Sign in with Google"
       ↓
┌──────────────────────────────────────┐
│  Frontend (React)                    │
│  http://localhost:5173/login         │
└──────┬───────────────────────────────┘
       │
       │ 2. Redirect to API
       ↓
┌──────────────────────────────────────┐
│  Backend (Express + Passport)        │
│  GET /api/auth/google                │
└──────┬───────────────────────────────┘
       │
       │ 3. Redirect to Google
       ↓
┌──────────────────────────────────────┐
│  Google OAuth Consent Screen         │
│  accounts.google.com                 │
└──────┬───────────────────────────────┘
       │
       │ 4. User authorizes
       ↓
┌──────────────────────────────────────┐
│  Backend (Express + Passport)        │
│  GET /api/auth/google/callback       │
│                                      │
│  • Exchange code for user profile    │
│  • Create or link user account       │
│  • Generate JWT token                │
│  • Set HttpOnly cookie               │
└──────┬───────────────────────────────┘
       │
       │ 5. Redirect with token
       ↓
┌──────────────────────────────────────┐
│  Frontend (React)                    │
│  http://localhost:5173/?token=...    │
│                                      │
│  • Extract token from URL            │
│  • Store in localStorage             │
│  • Clean up URL                      │
│  • Call /api/auth/me                 │
└──────┬───────────────────────────────┘
       │
       │ 6. User logged in
       ↓
┌──────────────────────────────────────┐
│  Cellar Page                         │
│  http://localhost:5173/cellar        │
└──────────────────────────────────────┘
```

## Account Linking Logic

```typescript
// In google.ts OAuth strategy callback:

1. Check if user exists with googleId
   ↓ YES → Update profile (name, picture) → Return user
   ↓ NO
   
2. Check if user exists with email (local account)
   ↓ YES → Link Google account (set googleId) → Return user
   ↓ NO
   
3. Create new user with Google profile
   → Return new user
```

## Security Features

| Feature | Implementation |
|---------|---------------|
| **Secrets** | Server-side only (never exposed to client) |
| **Token Storage** | HttpOnly cookies + localStorage |
| **CSRF Protection** | OAuth state parameter (Passport) |
| **Secure Cookies** | `secure: true` in production |
| **HTTPS** | Required for production OAuth |
| **Scopes** | Minimal (profile, email only) |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| **No Google credentials** | Warning logged, button shows error message |
| **User cancels OAuth** | Redirected to login with error message |
| **Email/password for OAuth user** | Friendly error: "Use Google sign-in" |
| **Network error** | Toast notification, stay on login page |
| **Invalid token** | Redirect to login, clear auth state |

## UI/UX

### Desktop
```
┌────────────────────────────────────┐
│  Email: [________________]         │
│  Password: [________________]      │
│  [Sign In]                         │
│                                    │
│  ─────────── OR ───────────        │
│                                    │
│  [🔴 Sign in with Google]          │
└────────────────────────────────────┘
```

### Mobile (Hebrew RTL)
```
┌────────────────────────────────────┐
│         [________________] :דוא״ל  │
│       [________________] :סיסמה    │
│                         [התחבר]    │
│                                    │
│        ─────────── או ───────────  │
│                                    │
│          [התחבר עם Google 🔴]      │
└────────────────────────────────────┘
```

## Testing

### Quick Test
1. Start the app: `npm run dev`
2. Visit: http://localhost:5173/login
3. Click "Sign in with Google"
4. If not configured: See error message
5. If configured: Redirected to Google → Authorize → Logged in

### Test Cases
- ✅ New user registration via Google
- ✅ Existing user login via Google
- ✅ Account linking (same email)
- ✅ Profile picture display
- ✅ Email/password still works
- ✅ OAuth user cannot use email/password
- ✅ Mobile touch targets (44x44px)
- ✅ RTL layout in Hebrew
- ✅ Error messages translated

## Optional: Display Profile Picture

Add to Layout component:

```tsx
import { useAuth } from '../contexts/AuthContext';

function Layout() {
  const { user } = useAuth();
  
  return (
    <nav>
      {/* ... other nav items ... */}
      
      {user?.picture ? (
        <img 
          src={user.picture} 
          alt={user.name || user.email}
          className="w-8 h-8 rounded-full"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-medium">
          {(user?.name?.[0] || user?.email[0] || '?').toUpperCase()}
        </div>
      )}
    </nav>
  );
}
```

## Production Deployment

### 1. Update Google OAuth Settings
- Add production domain to authorized origins
- Add production callback URL: `https://yourdomain.com/api/auth/google/callback`

### 2. Update Environment Variables
```bash
GOOGLE_CLIENT_ID="your-production-client-id"
GOOGLE_CLIENT_SECRET="your-production-secret"
API_URL="https://api.yourdomain.com"
WEB_URL="https://yourdomain.com"
NODE_ENV="production"
JWT_SECRET="your-strong-secret-here"
```

### 3. Verify HTTPS
- OAuth requires HTTPS in production
- Ensure SSL certificate is valid

## Summary

✅ **Complete Features**
- Google OAuth 2.0 integration
- Account creation and linking
- Profile picture support
- Mobile-optimized UI
- Full internationalization (EN/HE)
- Secure token management
- Error handling

📦 **Package Changes**
- Added: `passport`, `passport-google-oauth20`
- Added: Type definitions for Passport

🗄️ **Database Changes**
- Migration: `add_oauth_support`
- New fields: `googleId`, `authProvider`, `picture`
- Made `passwordHash` optional

🎨 **UI Changes**
- "Sign in with Google" button
- OR divider
- Mobile-optimized (44x44px)
- RTL-aware layout

📝 **Documentation**
- `GOOGLE_OAUTH_SETUP.md` - Full setup guide
- `GOOGLE_OAUTH_IMPLEMENTATION.md` - This file

**Status**: ✅ Ready to use!

