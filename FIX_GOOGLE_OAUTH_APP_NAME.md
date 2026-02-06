# Fix Google OAuth App Name

## Issue
The Google sign-in screen shows "pktelrzyllbwrmcfgocx.supabase.co" instead of a friendly app name like "Wine Cellar Brain".

## Root Cause
The OAuth consent screen in Google Cloud Console doesn't have a proper application name configured.

## Solution: Update Google Cloud Console

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. **Select your project** (the one you created for Wine Cellar Brain OAuth)

### Step 2: Navigate to OAuth Consent Screen
1. In the left sidebar, click **"APIs & Services"**
2. Click **"OAuth consent screen"**
3. You should see your existing OAuth consent screen configuration

### Step 3: Edit the App Information
1. Click **"Edit App"** button (top right)
2. Update the following fields:

   **App name:** `Wine Cellar Brain`  
   *(This is what users will see on the Google sign-in screen)*

   **User support email:** Your email (probably already set)

   **App logo (optional):** You can upload a wine glass icon or your app logo
   - Must be 120x120px or larger
   - JPG or PNG format

   **Application home page (optional):** `https://your-production-url.com`  
   *(Leave blank for now if not deployed yet)*

   **Application privacy policy link (optional):** Your privacy policy URL  
   *(Recommended but not required for internal/testing use)*

   **Application terms of service link (optional):** Your terms URL

3. **Authorized domains:** Add your domains:
   - `pktelrzyllbwrmcfgocx.supabase.co` (already there)
   - Add your production domain if you have one

4. Click **"Save and Continue"**

### Step 4: Review Scopes (Already Configured)
1. Click **"Save and Continue"** on the Scopes page
2. Your scopes should already include:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`

### Step 5: Review Test Users (If in Testing Mode)
- If your app is in **"Testing"** mode, you can add test users here
- Or you can **publish your app** to make it available to all Google users

### Step 6: Publish Your App (Optional but Recommended)
1. Go back to **"OAuth consent screen"**
2. If status shows **"Testing"**, click **"Publish App"**
3. This makes Google login available to **all users** (not just test users)
4. ⚠️ Note: Publishing requires Google verification only if you request sensitive scopes (we only use basic profile/email, so no verification needed)

### Step 7: Test the Changes
1. **Clear your browser cookies** for Supabase (important!)
2. Go to your Wine Cellar Brain app
3. Click **"Sign in with Google"**
4. ✅ You should now see **"Wine Cellar Brain"** on the consent screen instead of the Supabase URL

---

## Quick Visual Guide

**Before (Current):**
```
┌─────────────────────────────────────┐
│  Sign in with Google                │
│                                     │
│  Choose an account                  │
│  to continue to                     │
│  pktelrzyllbwrmcfgocx.supabase.co  │  ❌ Shows ugly URL
│                                     │
│  [Your Gmail Account]               │
└─────────────────────────────────────┘
```

**After (Fixed):**
```
┌─────────────────────────────────────┐
│  Sign in with Google                │
│                                     │
│  Choose an account                  │
│  to continue to                     │
│  Wine Cellar Brain                  │  ✅ Shows app name!
│                                     │
│  [Your Gmail Account]               │
└─────────────────────────────────────┘
```

---

## Troubleshooting

### Changes not appearing?
- **Clear browser cookies** for `*.supabase.co`
- Try in an **incognito/private window**
- Wait 5-10 minutes for Google to propagate changes

### Can't find the project?
- Make sure you're logged into the correct Google account
- Check the project list at the top of Google Cloud Console

### "App name already taken"?
- Choose a different name like "Wine Cellar Brain App" or "My Wine Cellar"

### Want to add a logo?
- Create a 512x512px PNG with a wine glass icon
- Upload in the OAuth consent screen settings
- Logo is optional but makes the consent screen look more professional

---

## Result

After these changes, users will see:
- ✅ **"Wine Cellar Brain"** instead of the Supabase URL
- ✅ Professional-looking OAuth consent screen
- ✅ Optional app logo (if you upload one)
- ✅ Matches your app branding

---

## Need Help?

If you encounter issues:
1. Screenshot the error
2. Check Google Cloud Console for any warnings
3. Verify your OAuth client is still active
4. Make sure the Supabase callback URL is still in authorized redirect URIs:
   - `https://pktelrzyllbwrmcfgocx.supabase.co/auth/v1/callback`
