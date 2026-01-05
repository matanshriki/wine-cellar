# 🧪 Analytics Testing Guide

Quick guide to verify Google Analytics 4 (GA4) is working correctly.

---

## 🚀 Quick Start

### 1. Add Environment Variables to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/)
2. Select your Wine app project
3. Navigate to **Settings** → **Environment Variables**
4. Add these two variables:

```
VITE_GA4_MEASUREMENT_ID = G-BFK8L7TM68
VITE_ANALYTICS_ENABLED = true
```

5. Click **Save**
6. Redeploy your app (or wait for automatic deployment)

---

## ✅ Verification Steps

### Option 1: GA4 DebugView (Recommended) 🔍

**Best for:** Real-time event verification

1. **Open GA4 DebugView:**
   - Go to [Google Analytics](https://analytics.google.com/)
   - Select your property
   - Navigate to: **Admin** → **DebugView**

2. **Open Your App:**
   - Visit your production app (e.g., `https://your-app.vercel.app`)
   - Open it in a new browser window

3. **Perform Test Actions:**
   ```
   ✓ Login or signup
   ✓ Navigate to Cellar page
   ✓ Add a bottle (manual entry)
   ✓ Navigate to Recommendation page
   ✓ Run a recommendation
   ✓ Mark a bottle as opened
   ✓ Change language (EN ↔ HE)
   ✓ Navigate to History page
   ```

4. **Check DebugView:**
   - Events should appear in real-time (within 5 seconds)
   - Look for event names like:
     - `page_view`
     - `login`
     - `bottle_add_manual`
     - `recommendation_run`
     - `bottle_opened`
     - `language_change`

**✅ Success:** Events appear in DebugView with correct parameters

---

### Option 2: Browser DevTools 🛠️

**Best for:** Quick verification without GA4 access

1. **Open DevTools:**
   - Right-click → Inspect
   - Go to **Network** tab
   - Filter by: `google-analytics.com` or `gtag`

2. **Perform Actions:**
   - Login
   - Add a bottle
   - Navigate between pages

3. **Check Network Requests:**
   - You should see POST requests to `google-analytics.com`
   - Each request = an event or page view

**✅ Success:** Network requests appear after each action

---

### Option 3: Console Logs (Development Only) 💻

**Best for:** Local testing before deployment

1. **Run Locally:**
   ```bash
   cd apps/web
   npm run dev
   ```

2. **Open Browser Console:**
   - Press F12 or Cmd+Option+I
   - Go to **Console** tab

3. **Look for Analytics Logs:**
   ```
   [Analytics] Initializing GA4: {
     measurementId: 'G-BFK8L7TM68',
     debugMode: true,
     environment: 'development'
   }
   [Analytics] ✅ GA4 initialized successfully
   [Analytics] 📄 Page view: { path: '/cellar', title: 'Cellar' }
   [Analytics] 📊 Event: login
   [Analytics] 📊 Event: bottle_add_manual
   ```

**✅ Success:** Console logs show analytics events

---

## 🎯 Test Scenarios

### Scenario 1: New User Journey
```
1. Open app → page_view:/login
2. Sign up → sign_up
3. Navigate to Cellar → page_view:/cellar
4. Add first bottle → bottle_add_manual
5. Get recommendation → recommendation_run → recommendation_results_shown
6. Open bottle → bottle_opened
7. View history → page_view:/history
```

**Expected Events:** 7 events total

---

### Scenario 2: CSV Import
```
1. Navigate to Cellar → page_view:/cellar
2. Click Import CSV → bottle_import_csv_start
3. Upload file → (processing)
4. Success → bottle_import_csv_success (with bottle_count)
```

**Expected Events:** 3 events total

---

### Scenario 3: AI Features
```
1. Open bottle details → (no event)
2. Click "Generate AI Label" → ai_label_generate_start
3. Success → ai_label_generate_success
4. Click "Get Sommelier Notes" → sommelier_notes_generate
5. Success → sommelier_notes_success
```

**Expected Events:** 4 events total

---

### Scenario 4: Localization
```
1. Click language switcher
2. Select Hebrew → language_change (language: 'he')
3. UI switches to RTL
4. Select English → language_change (language: 'en')
5. UI switches to LTR
```

**Expected Events:** 2 events total

---

## 🐛 Troubleshooting

### ❌ No Events in GA4

**Problem:** Events not appearing in DebugView or Realtime reports

**Solutions:**
1. **Check Environment Variables:**
   - Verify in Vercel dashboard
   - Ensure `VITE_ANALYTICS_ENABLED=true` (string "true", not boolean)
   - Ensure `VITE_GA4_MEASUREMENT_ID=G-BFK8L7TM68`

2. **Redeploy:**
   - Go to Vercel → Deployments
   - Click "Redeploy" on latest deployment
   - Wait for build to complete

3. **Check Browser Console:**
   - Look for `[Analytics]` logs
   - If you see "Disabled via VITE_ANALYTICS_ENABLED", env vars are not set

4. **Disable Ad Blockers:**
   - Ad blockers may block GA requests
   - Test in incognito mode

---

### ❌ Events Blocked by Ad Blocker

**Problem:** Network requests blocked by uBlock Origin, Privacy Badger, etc.

**Solution:**
- This is expected behavior
- App functionality is NOT affected
- Analytics fails gracefully
- For testing, disable ad blocker temporarily

---

### ❌ Wrong Measurement ID

**Problem:** Events go to wrong GA4 property

**Solution:**
1. Verify Measurement ID in Vercel:
   - Should be `G-BFK8L7TM68`
   - Format: `G-XXXXXXXXXX`
2. Check GA4 property settings
3. Redeploy after fixing

---

## 📊 What to Monitor

### Key Metrics (First Week)
- **Active Users:** How many people use the app?
- **Page Views:** Most visited pages?
- **Top Events:** Most common actions?
- **User Journey:** Login → Cellar → Recommendation → History?

### Key Events to Watch
1. `login` - Entry point
2. `bottle_add_manual` - Core action
3. `recommendation_run` - Key feature
4. `bottle_opened` - Conversion
5. `app_error` - Issues to fix

### Red Flags 🚨
- High `app_error` or `api_error` counts
- Low `recommendation_run` (feature not being used)
- High bounce rate on `/cellar` (users leaving immediately)
- `bottle_import_csv_error` spike (CSV import broken)

---

## 🎉 Success Criteria

### ✅ Analytics is Working If:
- [x] Events appear in GA4 DebugView within 5 seconds
- [x] Page views tracked on route changes
- [x] User actions trigger corresponding events
- [x] Event parameters are correct (no PII)
- [x] Mobile/PWA events fire correctly
- [x] No console errors related to analytics

### ✅ Ready for Production If:
- [x] All test scenarios pass
- [x] Events visible in GA4 Realtime reports
- [x] No PII in event data
- [x] App works even if analytics is blocked
- [x] Debug logs visible in dev mode

---

## 📝 Quick Reference

### Environment Variables
```bash
VITE_GA4_MEASUREMENT_ID=G-BFK8L7TM68
VITE_ANALYTICS_ENABLED=true
```

### GA4 Links
- **DebugView:** Admin → DebugView
- **Realtime:** Reports → Realtime
- **Events:** Reports → Events

### Support
- **Setup Guide:** `docs/ANALYTICS_SETUP.md`
- **Event Catalog:** See `GA4_INTEGRATION_SUCCESS.md`
- **Troubleshooting:** See `docs/ANALYTICS_SETUP.md`

---

**Next Step:** Add env vars to Vercel and test in GA4 DebugView! 🚀

---

**Cheers! 🍷📊**


