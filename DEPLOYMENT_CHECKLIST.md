# 🚀 Quick Deployment Checklist

## Prerequisites ✅

- [x] Build succeeds: `npm run build`
- [x] No secrets hardcoded
- [x] `.env` in `.gitignore`
- [x] `vercel.json` configured
- [x] Environment variables documented

---

## Step-by-Step (15 minutes)

### 1️⃣ Commit & Push (2 min)

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
git add .
git commit -m "feat: Add Vercel deployment configuration"
git push origin main
```

### 2️⃣ Deploy to Vercel (5 min)

1. Go to: https://vercel.com/new
2. Import: `https://github.com/matanshriki/wine-cellar`
3. Add Environment Variables:
   - `VITE_SUPABASE_URL` = `https://pktelrzyllbwrmcfgocx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = *(Get from Supabase Dashboard)*
4. Click **Deploy**
5. Wait for build (~2 min)
6. Copy your deployment URL

### 3️⃣ Update Supabase Auth (3 min)

1. Go to: https://supabase.com/dashboard
2. Select project: `pktelrzyllbwrmcfgocx`
3. Go to: **Authentication → URL Configuration**
4. **Site URL**: `https://your-app.vercel.app`
5. **Redirect URLs**: Add:
   ```
   https://your-app.vercel.app/*
   https://*.vercel.app/**
   ```
6. **Save**

### 4️⃣ Update Google OAuth (if enabled) (2 min)

1. Go to: https://console.cloud.google.com
2. **APIs & Services → Credentials**
3. Edit OAuth Client ID
4. Add **Authorized Origins**:
   ```
   https://your-app.vercel.app
   ```
5. Add **Redirect URIs**:
   ```
   https://pktelrzyllbwrmcfgocx.supabase.co/auth/v1/callback
   ```
6. **Save**

### 5️⃣ Test Production (3 min)

Visit: `https://your-app.vercel.app`

Quick tests:
- [ ] App loads
- [ ] Login with email works
- [ ] Login with Google works (if enabled)
- [ ] Add a bottle
- [ ] View History
- [ ] Language switch (EN/HE) works

---

## Environment Variables Needed

Get from Supabase Dashboard → Settings → API:

| Variable | Value | Where to Find |
|----------|-------|---------------|
| `VITE_SUPABASE_URL` | `https://pktelrzyllbwrmcfgocx.supabase.co` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | anon public key |

---

## Common Issues

### Build Fails
- ✅ Ensure env vars are added in Vercel

### Auth Doesn't Work
- ✅ Add Vercel URL to Supabase Redirect URLs
- ✅ Add callback URL to Google Console

### 404 on Routes
- ✅ `vercel.json` must be in repo root (already added)

---

## Done! 🎉

Your app is live at: `https://your-app.vercel.app`

For detailed troubleshooting, see: `VERCEL_DEPLOYMENT_GUIDE.md`

