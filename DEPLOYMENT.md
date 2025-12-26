# Deployment Guide

This guide covers deploying the Wine app to production.

## Prerequisites

- Supabase project (production database)
- Hosting platform account (Vercel, Netlify, or similar)
- Domain name (optional)

## 🗄️ Database Setup (Supabase)

### 1. Create Production Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project (choose a strong password)
3. Wait for provisioning to complete (~2 minutes)

### 2. Run Migrations

In the Supabase dashboard:

1. Navigate to **SQL Editor**
2. Create a new query
3. Copy and paste contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run**
5. Repeat for `002_rls_policies.sql` and `003_realtime.sql`

### 3. Verify Setup

Run this query in SQL Editor to verify tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

You should see: `workspaces`, `workspace_members`, `babies`, `events`, `invites`

### 4. Configure Auth

1. Go to **Authentication** > **Settings**
2. Configure **Site URL**: Set to your production domain
3. Configure **Redirect URLs**: Add your production domain
4. Enable **Email Auth** if not already enabled
5. Customize email templates (optional)

### 5. Get API Credentials

1. Go to **Project Settings** > **API**
2. Copy:
   - Project URL
   - `anon` `public` key (this is safe for client-side use)

## 🚀 Deploy to Vercel

### Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Build the project
npm run build

# Deploy
vercel --prod

# Set environment variables
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production

# Redeploy with env vars
vercel --prod
```

### Option 2: GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click **Import Project**
4. Select your repository
5. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add Environment Variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
7. Click **Deploy**

## 🌐 Deploy to Netlify

### Using Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build the project
npm run build

# Deploy
netlify deploy --prod

# Set environment variables in Netlify dashboard
```

### Using Git Integration

1. Push code to GitHub/GitLab
2. Go to [netlify.com](https://netlify.com)
3. Click **New site from Git**
4. Select your repository
5. Configure:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Go to **Site settings** > **Environment variables**
7. Add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
8. Trigger a new deploy

## 🔒 Security Checklist

Before going live, ensure:

- [ ] RLS policies are enabled on all tables
- [ ] Test with multiple users to verify access control
- [ ] Environment variables are set correctly
- [ ] `.env` file is in `.gitignore`
- [ ] Supabase project has a strong password
- [ ] Auth email templates are configured
- [ ] Site URL and redirect URLs are set in Supabase
- [ ] SSL/HTTPS is enabled (automatic on Vercel/Netlify)

## 🧪 Testing Production

### Manual Testing Steps

1. **Auth Flow**
   - Sign in with email magic link
   - Verify email is received
   - Verify redirect after clicking link

2. **Workspace Setup**
   - Create a workspace
   - Create a baby profile
   - Verify redirect to timeline

3. **Event Creation**
   - Add events of each type
   - Verify they appear in timeline
   - Test edit and delete

4. **Multi-User**
   - Invite another user
   - Have them accept invite
   - Verify both see same data
   - Test real-time sync

5. **Export**
   - Export events to CSV
   - Verify data is correct

### Verify RLS

Test that users cannot access other workspaces:

```sql
-- In Supabase SQL Editor, as a test user
SELECT * FROM events WHERE workspace_id != 'your-workspace-id';
-- Should return 0 rows
```

## 📊 Monitoring

### Supabase Dashboard

Monitor:
- **Database** > **Database Performance**: Query performance
- **Authentication** > **Users**: Active users
- **Logs** > **Postgres Logs**: Database errors
- **Database** > **API Logs**: API usage

### Application Monitoring

Consider adding:
- [Sentry](https://sentry.io) for error tracking
- [LogRocket](https://logrocket.com) for session replay
- [PostHog](https://posthog.com) for analytics

## 🔄 Continuous Deployment

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test
      - run: npm run lint
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## 🆙 Updating Production

### Database Migrations

When adding new features:

1. Create a new migration file: `supabase/migrations/004_feature_name.sql`
2. Test in development
3. Run in Supabase SQL Editor for production
4. Verify with `SELECT` queries

### Application Updates

```bash
git push origin main
# Automatic deploy via CI/CD or:
vercel --prod
```

## 🐛 Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Auth Redirect Issues

Check Supabase auth settings:
- Site URL matches your domain
- Redirect URLs include your domain

### CORS Errors

Supabase automatically handles CORS. If you see CORS errors:
- Verify your domain is in Supabase allowed URLs
- Check browser console for exact error
- Ensure you're using the correct Supabase URL

### Real-time Not Working

- Enable Realtime in Supabase: **Database** > **Replication**
- Verify publications include your tables
- Check RLS policies allow SELECT on tables

## 📱 Mobile Optimization

The app is mobile-first, but consider:

1. **PWA Support**: Add a service worker for offline functionality
2. **App Icons**: Add to `public/` folder
3. **Meta Tags**: Already included for mobile viewport

## 💰 Cost Estimation

### Supabase Free Tier Includes:
- 500MB database
- 2GB storage
- 50,000 monthly active users
- Unlimited API requests

### Vercel/Netlify Free Tier:
- 100GB bandwidth/month
- Unlimited sites
- Automatic SSL

**Estimated Cost**: $0/month for small families up to ~10 users

**Scaling**: Upgrade to Supabase Pro ($25/month) when you hit free tier limits

## 🎉 Launch Checklist

Before announcing your app:

- [ ] Production database migrated
- [ ] Environment variables set
- [ ] SSL enabled
- [ ] Custom domain configured (optional)
- [ ] Email auth working
- [ ] Multi-user tested
- [ ] RLS verified
- [ ] Error monitoring setup
- [ ] README updated with production URL
- [ ] Privacy policy added (if collecting user data)

## 🆘 Support

If you encounter issues:

1. Check Supabase logs
2. Check browser console
3. Review this guide
4. Open a GitHub issue with:
   - Error message
   - Steps to reproduce
   - Browser/device info

---

**Congratulations!** 🎉 Your Wine app is now live!

