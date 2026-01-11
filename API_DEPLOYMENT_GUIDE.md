# API Server Deployment Guide

## Problem

The Express API server (`apps/api`) is not deployed in production. The web app is looking for API endpoints that don't exist.

## Quick Solution: Deploy API to Railway (Free & Easy)

### Step 1: Create Railway Account

1. Go to https://railway.app/
2. Sign up with GitHub
3. Click "New Project"

### Step 2: Deploy from GitHub

1. Click "Deploy from GitHub repo"
2. Select your `wine-cellar` repository
3. Click "Add variables" and set:

```
NODE_ENV=production
JWT_SECRET=your-random-secret-here
OPENAI_API_KEY=sk-proj-your-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
PORT=3001
```

4. Click "Deploy"

### Step 3: Configure Build

Railway might auto-detect the setup, but if not:

1. Click "Settings" tab
2. Set **Root Directory**: `apps/api`
3. Set **Build Command**: `npm install && npm run build`
4. Set **Start Command**: `npm start`
5. Click "Save"

### Step 4: Get Your API URL

1. Once deployed, go to "Settings" tab
2. Under "Domains", click "Generate Domain"
3. Copy the URL (e.g., `https://your-app.up.railway.app`)

### Step 5: Update Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add new variable:

```
VITE_API_URL=https://your-app.up.railway.app
```

3. Redeploy your Vercel app (or it will auto-deploy)

### Step 6: Test

1. Wait for Vercel to finish deploying
2. Refresh your production app
3. Try the Sommelier feature
4. Should work now! 🎉

---

## Alternative: Deploy API to Render

### Step 1: Create Render Account

1. Go to https://render.com/
2. Sign up with GitHub
3. Click "New +" → "Web Service"

### Step 2: Connect Repository

1. Select your `wine-cellar` repository
2. Configure:
   - **Name**: `wine-cellar-api`
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### Step 3: Add Environment Variables

```
NODE_ENV=production
JWT_SECRET=your-random-secret-here
OPENAI_API_KEY=sk-proj-your-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
PORT=3001
```

### Step 4: Deploy

1. Click "Create Web Service"
2. Wait for deployment (~5 minutes)
3. Copy your API URL (e.g., `https://wine-cellar-api.onrender.com`)

### Step 5: Update Vercel

Same as Railway - add `VITE_API_URL` to Vercel environment variables.

---

## Alternative: Separate Vercel Project for API

### Step 1: Create New Vercel Project

1. Go to Vercel Dashboard
2. Click "Add New" → "Project"
3. Import your GitHub repository again
4. Name it: `wine-cellar-api`

### Step 2: Configure Build

In project settings:
- **Root Directory**: `apps/api`
- **Build Command**: `npm install && npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 3: Add Environment Variables

Same as above - add all environment variables.

### Step 4: Deploy

Deploy and copy the URL.

### Step 5: Update Main Vercel Project

Add `VITE_API_URL` pointing to the API Vercel project.

---

## Verifying API is Working

Test your API directly:

```bash
# Check health endpoint
curl https://your-api-url.com/health

# Should return: {"status":"ok","timestamp":"..."}
```

Test the agent endpoint:

```bash
# This should return 401 (requires auth)
curl -X POST https://your-api-url.com/api/agent/recommend

# Expected: {"error":"Authentication required"}
```

---

## Cost Estimates

### Railway
- **Free tier**: 500 hours/month (enough for MVP)
- **Pro**: $5/month

### Render
- **Free tier**: Available (spins down after inactivity)
- **Starter**: $7/month (always on)

### Vercel
- **Hobby**: Free (with limitations)
- **Pro**: $20/month

---

## Which to Choose?

**For MVP/Testing**: Railway (easiest, free tier is good)  
**For Production**: Render or Railway Pro (more reliable)  
**For Integration**: Separate Vercel project (keeps everything in Vercel)

---

## After Deployment

Once the API is deployed and `VITE_API_URL` is set in Vercel:

1. Vercel will auto-redeploy
2. Wait 2-3 minutes
3. Refresh your app
4. Sommelier feature should work! 🍷

---

## Troubleshooting

**Error: "Failed to fetch"**
- Check API is deployed and running
- Check `VITE_API_URL` is set correctly in Vercel
- Check no trailing slash in URL

**Error: "403 Forbidden"**
- Feature flag is not enabled for user
- Run in Supabase: `UPDATE profiles SET cellar_agent_enabled = true WHERE email = 'your@email.com';`

**Error: "503 Service Unavailable"**
- `OPENAI_API_KEY` not set in API environment
- Check API deployment logs

**Error: CORS issues**
- Add your Vercel domain to CORS whitelist in API if needed

