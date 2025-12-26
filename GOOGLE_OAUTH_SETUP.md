# Google OAuth Setup Guide

## Overview
Wine Cellar Brain now supports Google OAuth login alongside traditional email/password authentication. This provides users with a convenient, secure way to sign in using their Google account.

## Features
- ✅ One-click Google Sign-In
- ✅ Automatic account creation on first login
- ✅ Account linking (Google can be linked to existing email/password accounts)
- ✅ Profile picture support
- ✅ Secure OAuth 2.0 flow
- ✅ Mobile-friendly
- ✅ RTL-aware design
- ✅ Fully internationalized (EN/HE)

## How It Works

### User Flow
1. User clicks "Sign in with Google" on the login page
2. Redirected to Google's OAuth consent screen
3. User authorizes the app
4. Google redirects back to the app with authorization code
5. Backend exchanges code for user profile information
6. User is automatically logged in with a JWT token

### Account Linking
- If a user signs in with Google using an email that already exists in the system (local account), the Google account is automatically linked
- Users can then use either method to log in
- If a user tries to log in with email/password but registered via Google, they'll see a helpful message

## Setup Instructions

### 1. Get Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create or Select a Project**
   - Click "Select a project" at the top
   - Click "New Project"
   - Name it (e.g., "Wine Cellar Brain")
   - Click "Create"

3. **Enable Google+ API** (or People API)
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" or "People API"
   - Click on it and click "Enable"

4. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" (unless you have Google Workspace)
   - Click "Create"
   - Fill in required fields:
     - App name: "Wine Cellar Brain"
     - User support email: your email
     - Developer contact: your email
   - Click "Save and Continue"
   - Skip "Scopes" (we only need profile and email)
   - Add test users if needed (your email)
   - Click "Save and Continue"

5. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Name: "Wine Cellar Brain Web"
   - Authorized JavaScript origins:
     - `http://localhost:5173` (development)
     - Add your production domain when deploying
   - Authorized redirect URIs:
     - `http://localhost:3001/api/auth/google/callback` (development)
     - Add your production API domain when deploying
   - Click "Create"
   - **Copy the Client ID and Client Secret** - you'll need these!

### 2. Configure Environment Variables

Create or update `/apps/api/.env` with your Google OAuth credentials:

```bash
# Google OAuth (optional - enables "Sign in with Google")
GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret-here"

# URLs (for OAuth callbacks)
API_URL="http://localhost:3001"
WEB_URL="http://localhost:5173"
```

**Note**: If these variables are not set, the app will still work but the Google sign-in button will show an error message. The traditional email/password login will continue to work normally.

### 3. Restart the API Server

```bash
cd apps/api
npm run dev
```

You should see:
```
✅ Google OAuth configured
```

If you see:
```
⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.
```

Then check your `.env` file.

### 4. Test the Integration

1. Open the app: http://localhost:5173/login
2. Click "Sign in with Google"
3. Authorize the app
4. You should be redirected back and logged in automatically

## Technical Implementation

### Backend Changes

#### Database Schema
Added OAuth support to the User model:
- `authProvider` (String): "local" or "google"
- `googleId` (String): Unique Google user ID
- `passwordHash` (String?): Now optional for OAuth users
- `picture` (String?): Profile picture URL

#### New Files
- `/apps/api/src/auth/google.ts`: Google OAuth strategy using Passport.js
- Migration: `add_oauth_support`

#### Updated Files
- `/apps/api/src/config.ts`: Added Google OAuth config
- `/apps/api/src/routes/auth.ts`: Added Google OAuth routes
- `/apps/api/src/index.ts`: Initialize Passport and Google strategy

#### New Routes
- `GET /api/auth/google`: Initiates OAuth flow
- `GET /api/auth/google/callback`: Handles OAuth callback

### Frontend Changes

#### Updated Files
- `/apps/web/src/pages/LoginPage.tsx`: Added "Sign in with Google" button
- `/apps/web/src/contexts/AuthContext.tsx`: Handle OAuth token from URL
- `/apps/web/src/i18n/locales/en.json`: Added translations
- `/apps/web/src/i18n/locales/he.json`: Added translations

#### UI Components
- OR divider between login methods
- Google-branded sign-in button
- Mobile-optimized (44x44px minimum touch target)
- RTL-aware layout

## Security Considerations

### What's Secure ✅
- OAuth 2.0 standard protocol
- Server-side token exchange (secrets never exposed to client)
- HttpOnly cookies for JWT tokens
- CSRF protection via OAuth state parameter (handled by Passport)
- Secure cookie in production (`secure: true` when NODE_ENV=production)

### Production Checklist
- [ ] Use strong JWT_SECRET (not the default)
- [ ] Add your production domain to Google OAuth authorized origins
- [ ] Add your production API callback URL to authorized redirect URIs
- [ ] Enable HTTPS (required for production OAuth)
- [ ] Set NODE_ENV=production
- [ ] Review and restrict OAuth scopes (currently: profile, email)

## Troubleshooting

### "Google OAuth not configured" error
- Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in `/apps/api/.env`
- Restart the API server
- Check the server logs for warnings

### Redirect URI mismatch
- Make sure the redirect URI in Google Cloud Console exactly matches: `http://localhost:3001/api/auth/google/callback`
- Check for trailing slashes
- Verify the port number (3001 for API)

### "This account uses Google login"
- This means the user previously registered via Google OAuth
- They should use the "Sign in with Google" button instead of email/password

### Token not persisting
- Check browser localStorage for the token
- Check Network tab for the `/api/auth/me` request
- Verify cookies are being set (check Application tab > Cookies)

### CORS errors
- Verify API CORS configuration allows `http://localhost:5173`
- Check that `credentials: true` is set in both API and client

## Optional: Profile Picture Display

The backend now stores the user's Google profile picture URL. To display it in the UI:

1. Update the Layout component to show the profile picture
2. Use the `user.picture` field from the auth context
3. Add a fallback for users without pictures (email/password users)

Example:
```tsx
{user.picture ? (
  <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
) : (
  <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center">
    {user.name?.[0] || user.email[0]}
  </div>
)}
```

## Translations

### English
- "OR"
- "Sign in with Google"

### Hebrew
- "או"
- "התחבר עם Google"

All UI text is fully translated and RTL-aware.

## Testing

### Manual Testing Checklist
- [ ] Click "Sign in with Google" - redirects to Google
- [ ] Authorize app - redirects back and logs in
- [ ] New user creates account automatically
- [ ] Existing user (same email) links Google account
- [ ] Profile picture loads (if available)
- [ ] Can log out and log back in with Google
- [ ] Email/password login still works
- [ ] Mobile: button is touch-friendly (44x44px)
- [ ] RTL: button displays correctly in Hebrew
- [ ] Error handling: invalid credentials, network errors

### OAuth-Specific Edge Cases
- [ ] User cancels OAuth consent screen
- [ ] User denies permission
- [ ] Network error during callback
- [ ] Email not provided by Google (rare)
- [ ] Account already exists with same email

## Future Enhancements (Optional)

1. **Multiple OAuth Providers**
   - Add Facebook, GitHub, Microsoft, etc.
   - Use a unified OAuth strategy

2. **Account Management**
   - Allow users to unlink OAuth providers
   - Manage connected accounts
   - Require password before unlinking

3. **Progressive Profile**
   - Ask for additional info after OAuth login
   - Save timezone, preferences, etc.

4. **OAuth Token Refresh**
   - Store refresh tokens for long-lived sessions
   - Refresh access tokens automatically

5. **Account Merging**
   - UI to merge duplicate accounts
   - Transfer bottles between accounts

## Summary

Google OAuth is now fully integrated into Wine Cellar Brain! Users can:
- Sign in with Google (one-click)
- Create accounts automatically
- Link Google to existing accounts
- Use either login method

The implementation is:
- ✅ Production-ready
- ✅ Secure (OAuth 2.0)
- ✅ Mobile-optimized
- ✅ Internationalized
- ✅ Accessible
- ✅ Well-documented

**Status**: ✅ Complete and ready for testing!

