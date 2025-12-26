# 🚀 Vercel Deployment Guide - Wine Cellar Brain

This guide will walk you through deploying the Wine Cellar Brain app to Vercel.

---

## ✅ Pre-Deployment Checklist

- [x] Build succeeds locally (`npm run build`)
- [x] No secrets hardcoded in source files
- [x] Environment variables use `import.meta.env`
- [x] `.env` is in `.gitignore`
- [x] `vercel.json` configured for React Router SPA
- [x] Supabase Edge Functions deployed
- [x] Supabase Storage buckets configured

---

## 📋 Required Information

Before deploying, have these ready:

### 1. Supabase Credentials
- **Project URL**: `https://pktelrzyllbwrmcfgocx.supabase.co`
- **Anon Key**: (Get from Supabase Dashboard → Settings → API)

### 2. GitHub Repository
- **Repo URL**: https://github.com/matanshriki/wine-cellar
- Ensure you have push access

---

## 🔧 Step 1: Prepare GitHub Repository

### Commit and Push All Changes

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "feat: Add Vercel deployment configuration

- Add vercel.json for monorepo and SPA routing
- Add ENV_TEMPLATE.md for environment variables
- Add VERCEL_DEPLOYMENT_GUIDE.md
- Ready for production deployment"

# Push to main
git push origin main
```

---

## 🚀 Step 2: Deploy to Vercel

### Option A: Vercel Dashboard (Recommended)

1. **Go to Vercel**: https://vercel.com/new

2. **Import Git Repository**
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Paste: `https://github.com/matanshriki/wine-cellar`
   - Click "Import"

3. **Configure Project**
   - **Project Name**: `wine-cellar-brain` (or your preferred name)
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: Leave as `./` (monorepo config in vercel.json handles this)
   - **Build Command**: Will use vercel.json setting
   - **Output Directory**: Will use vercel.json setting

4. **Add Environment Variables**
   Click "Environment Variables" and add:
   
   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://pktelrzyllbwrmcfgocx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | *(Paste your anon key from Supabase)* |

   **Important**: Add these for **Production**, **Preview**, and **Development** environments.

5. **Deploy**
   - Click "Deploy"
   - Wait 1-2 minutes for build to complete
   - Note your deployment URL (e.g., `https://wine-cellar-brain.vercel.app`)

### Option B: Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from project root
cd /Users/matanshr/Desktop/Projects/Playground/wine
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Scope: Select your account
# - Link to existing project? No
# - Project name: wine-cellar-brain
# - Directory: ./ (root)
# - Override settings? No (vercel.json will be used)

# Set environment variables
vercel env add VITE_SUPABASE_URL production
# Enter: https://pktelrzyllbwrmcfgocx.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# Paste your anon key

# Deploy to production
vercel --prod
```

---

## 🔐 Step 3: Configure Supabase for Production

After deployment, you'll have a Vercel URL (e.g., `https://wine-cellar-brain.vercel.app`).

### Update Supabase Auth URLs

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: `pktelrzyllbwrmcfgocx`
3. **Navigate to**: Authentication → URL Configuration
4. **Add these URLs**:

   **Site URL**:
   ```
   https://wine-cellar-brain.vercel.app
   ```

   **Redirect URLs** (add all of these):
   ```
   http://localhost:5173/*
   http://localhost:5173/**
   https://wine-cellar-brain.vercel.app/*
   https://wine-cellar-brain.vercel.app/**
   https://*.vercel.app/*
   https://*.vercel.app/**
   ```

   *(Replace `wine-cellar-brain` with your actual Vercel project name)*

5. **Save changes**

### Update Google OAuth (if enabled)

1. **Go to Google Cloud Console**: https://console.cloud.google.com
2. **Select your project**
3. **Navigate to**: APIs & Services → Credentials
4. **Select your OAuth 2.0 Client ID**
5. **Add Authorized JavaScript Origins**:
   ```
   https://wine-cellar-brain.vercel.app
   https://pktelrzyllbwrmcfgocx.supabase.co
   ```

6. **Add Authorized Redirect URIs**:
   ```
   https://pktelrzyllbwrmcfgocx.supabase.co/auth/v1/callback
   https://wine-cellar-brain.vercel.app
   ```

7. **Save**

---

## ✅ Step 4: Post-Deployment Validation

### Automated Checks

Visit your deployed site and test these flows:

#### 1. **Authentication** ✓
- [ ] Email/password login works
- [ ] Google OAuth login works
- [ ] Sign up creates new account
- [ ] Session persists on refresh

#### 2. **Profile** ✓
- [ ] Profile page loads
- [ ] Display name shows correctly (not email)
- [ ] Google OAuth auto-populates first/last name
- [ ] Avatar upload works (Supabase Storage)
- [ ] Profile edits save correctly

#### 3. **Cellar** ✓
- [ ] Empty state shows when no bottles
- [ ] "Add Bottle" button works
- [ ] Add Bottle sheet displays correct translations
- [ ] Manual bottle creation works
- [ ] CSV import works
- [ ] Search and filters work
- [ ] Bottles display correctly with wine info

#### 4. **Label Scanning** ✓
- [ ] "Scan Label" option appears in Add Bottle sheet
- [ ] Camera/upload interface loads
- [ ] Image upload to Supabase Storage works
- [ ] AI extraction Edge Function is called
- [ ] Extracted data pre-fills form
- [ ] Bottle saves with label image URL

#### 5. **AI Analysis (Sommelier Notes)** ✓
- [ ] "Generate Sommelier Notes" button appears
- [ ] Clicking button calls Edge Function
- [ ] Analysis displays in premium card
- [ ] Fallback to deterministic analysis if OpenAI fails
- [ ] Refresh analysis works

#### 6. **Tonight Recommendations** ✓
- [ ] Page loads with luxury form
- [ ] All choice cards work (meal, occasion, vibe)
- [ ] Toggles work correctly
- [ ] "Get Recommendations" generates results
- [ ] Results display correctly
- [ ] "Mark as Opened" creates history entry

#### 7. **History** ✓
- [ ] History page loads without errors
- [ ] Shows empty state when no history
- [ ] Displays opened bottles correctly
- [ ] Stats display correctly

#### 8. **Internationalization** ✓
- [ ] Language switcher works (EN/HE)
- [ ] All UI text translates
- [ ] RTL layout works correctly in Hebrew
- [ ] Wine names remain untranslated
- [ ] No translation key errors in console

#### 9. **Mobile Experience** ✓
- [ ] Bottom navigation displays on mobile
- [ ] All pages are responsive
- [ ] Touch targets are adequate (44px min)
- [ ] Modals and sheets work on mobile
- [ ] Camera capture works on mobile browsers

---

## 🐛 Troubleshooting

### Build Fails on Vercel

**Error**: `Missing Supabase environment variables`
- **Solution**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project settings

**Error**: `Cannot find module`
- **Solution**: Ensure `npm install` runs correctly. Check that all dependencies are in `package.json` (not devDependencies for production deps)

### Auth Doesn't Work on Production

**Error**: `redirect_uri_mismatch` or `Invalid redirect URL`
- **Solution**: Add your Vercel URL to Supabase Auth → Redirect URLs
- **Solution**: Add Supabase callback URL to Google OAuth (if using Google login)

### Routes Don't Work (404 on Refresh)

**Error**: 404 when refreshing on `/cellar` or `/tonight`
- **Solution**: Verify `vercel.json` exists and has the rewrite rule
- **Solution**: Redeploy if you added `vercel.json` after initial deploy

### Images Don't Upload (Avatar/Labels)

**Error**: `Permission denied` or `Bucket not found`
- **Solution**: Run Supabase Storage migrations:
  ```bash
  supabase db push
  ```
- **Solution**: Verify RLS policies allow authenticated users to upload to their own folders

### AI Features Don't Work

**Error**: `Failed to analyze` or `Edge Function error`
- **Solution**: Deploy Edge Functions:
  ```bash
  supabase functions deploy analyze-wine
  supabase functions deploy extract-wine-label
  ```
- **Solution**: Set OpenAI API key:
  ```bash
  supabase secrets set OPENAI_API_KEY=sk-...
  ```
- **Note**: The app has a deterministic fallback if OpenAI is unavailable

### CORS Errors in Console

**Error**: `CORS policy: No 'Access-Control-Allow-Origin' header`
- **Solution**: Verify Edge Functions include CORS headers (already configured in code)
- **Solution**: Check Supabase project settings for allowed origins

---

## 📊 Monitoring & Performance

### Vercel Analytics

Enable Vercel Analytics for insights:
1. Go to your Vercel project
2. Navigate to Analytics tab
3. Enable Analytics (free tier available)

### Supabase Logs

Monitor API usage and errors:
1. Go to Supabase Dashboard
2. Navigate to Logs → API Logs
3. Monitor auth, database, and storage logs

### Performance Optimization

Current bundle size: **~709 KB** (gzipped: ~209 KB)

**To improve**:
1. **Code splitting**: Use `React.lazy()` for routes
2. **Tree shaking**: Verify unused code is removed
3. **Image optimization**: Use Vercel Image Optimization for label images
4. **CDN caching**: Assets are cached (configured in `vercel.json`)

---

## 🔄 Continuous Deployment

Vercel automatically deploys:
- **Production**: Every push to `main` branch
- **Preview**: Every pull request

### Manual Redeployment

If you need to redeploy without code changes:
```bash
vercel --prod
```

Or in Vercel Dashboard:
1. Go to Deployments tab
2. Click "..." on latest deployment
3. Click "Redeploy"

---

## 🎉 Success!

Your Wine Cellar Brain app is now live! 🍷

**Next Steps**:
1. Share the URL with users
2. Monitor Supabase usage (free tier: 500 MB database, 1 GB storage, 50K monthly active users)
3. Monitor OpenAI API costs (if using AI features)
4. Set up custom domain (optional): Vercel → Settings → Domains

**Production URL**: `https://wine-cellar-brain.vercel.app`  
*(Update this with your actual URL)*

---

## 📚 Additional Resources

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **React Router**: https://reactrouter.com/
- **Vite**: https://vitejs.dev/

---

## 🆘 Need Help?

If you encounter issues not covered here:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Check browser console for errors
4. Review this guide's troubleshooting section

---

**Last Updated**: December 27, 2025  
**App Version**: 1.0.0  
**Deployment Status**: ✅ Ready for Production

