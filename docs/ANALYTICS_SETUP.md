# Google Analytics 4 (GA4) Setup Guide

## Overview

The Wine app integrates Google Analytics 4 (GA4) to track user interactions and product usage. This implementation is **privacy-first** and **production-safe**.

## Privacy & Compliance

✅ **NO PII (Personally Identifiable Information) is tracked**
- No emails, names, or free-text fields
- No wine notes or tasting notes
- Only internal IDs and interaction events
- IP addresses are anonymized
- Google Signals and ad personalization are disabled

## Setup Instructions

### 1. Get Your GA4 Measurement ID

1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new GA4 property (or use an existing one)
3. Navigate to: **Admin** → **Data Streams** → **Web**
4. Copy your **Measurement ID** (format: `G-XXXXXXXXXX`)

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```bash
# Google Analytics 4 (GA4)
VITE_GA4_MEASUREMENT_ID=G-BFK8L7TM68
VITE_ANALYTICS_ENABLED=true
```

**Important:**
- Replace `G-BFK8L7TM68` with your actual Measurement ID
- Set `VITE_ANALYTICS_ENABLED=false` to disable analytics (useful for development)
- Analytics will NOT run if either variable is missing or disabled

### 3. Deploy to Production

After adding the environment variables:

```bash
# Rebuild the app
npm run build

# Deploy to Vercel (or your hosting platform)
git add .
git commit -m "feat: add Google Analytics 4 integration"
git push origin main
```

**Vercel Users:**
1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add both `VITE_GA4_MEASUREMENT_ID` and `VITE_ANALYTICS_ENABLED`
4. Redeploy your app

## Verification

### Local Development (Debug Mode)

When running locally (`npm run dev`), GA4 runs in **debug mode** with console logging:

```javascript
[Analytics] Initializing GA4: {
  measurementId: 'G-BFK8L7TM68',
  debugMode: true,
  environment: 'development'
}
[Analytics] 📄 Page view: { path: '/cellar', title: 'Cellar' }
[Analytics] 📊 Event: bottle_add_manual
```

### Production Verification

1. **GA4 DebugView** (Recommended):
   - Go to [Google Analytics](https://analytics.google.com/)
   - Navigate to: **Admin** → **DebugView**
   - Open your app and perform actions
   - Events should appear in real-time

2. **Browser DevTools**:
   - Open DevTools → Network tab
   - Filter by `google-analytics.com`
   - Perform actions in the app
   - You should see network requests to GA

3. **GA4 Realtime Reports**:
   - Navigate to: **Reports** → **Realtime**
   - Open your app and perform actions
   - Users and events should appear within 30 seconds

## Tracked Events

### Authentication
- `sign_up` - User creates a new account
- `login` - User logs in (email or Google)
- `logout` - User logs out

### Bottles
- `bottle_add_manual` - User manually adds a bottle
- `bottle_add_scan` - User adds a bottle via label scan
- `bottle_edit` - User edits bottle details
- `bottle_delete` - User deletes a bottle
- `bottle_opened` - User marks a bottle as opened (includes vintage)

### CSV Import
- `bottle_import_csv_start` - CSV import initiated
- `bottle_import_csv_success` - CSV import completed (includes bottle count)
- `bottle_import_csv_error` - CSV import failed (includes error type)

### Recommendations
- `recommendation_run` - User requests recommendations (includes meal type, occasion)
- `recommendation_results_shown` - Results displayed (includes result count)

### AI Label Generation
- `ai_label_generate_start` - AI label generation started (includes style)
- `ai_label_generate_success` - AI label generated successfully (includes style)
- `ai_label_generate_error` - AI label generation failed (includes error type)

### Uploads
- `bottle_image_upload_success` - Bottle image uploaded
- `bottle_image_upload_error` - Bottle image upload failed (includes error type)
- `profile_avatar_upload_success` - Profile avatar uploaded
- `profile_avatar_upload_error` - Profile avatar upload failed (includes error type)

### Sommelier AI
- `sommelier_notes_generate` - AI sommelier analysis requested
- `sommelier_notes_success` - AI analysis completed
- `sommelier_notes_error` - AI analysis failed (includes error type)

### Localization
- `language_change` - User changes language (includes language code)

### Errors
- `app_error` - General app error (includes error type, code)
- `api_error` - API request error (includes endpoint, status code)

### Page Views
- Automatic tracking on all route changes:
  - `/cellar` - Cellar page
  - `/recommendation` - Recommendation page
  - `/history` - History page
  - `/profile` - Profile page
  - `/login` - Login page

## Event Parameters

All events include safe, non-PII parameters:

✅ **Safe to track:**
- Internal IDs (bottle_id, user_id)
- Counts (bottle_count, result_count)
- Categories (meal_type, occasion, style)
- Statuses (error_type, status_code)
- Numeric values (vintage, price ranges)

❌ **Never tracked:**
- Emails
- Names (user, producer, wine)
- Notes (tasting notes, user notes)
- Free-text fields
- Raw wine names or producers

## Disabling Analytics

To disable analytics:

1. **For development:**
   ```bash
   VITE_ANALYTICS_ENABLED=false
   ```

2. **For specific users:**
   - Analytics respects browser "Do Not Track" settings
   - Users can block GA with browser extensions (e.g., uBlock Origin)

3. **Complete removal:**
   - Remove `VITE_GA4_MEASUREMENT_ID` from environment variables
   - Analytics will not initialize

## Troubleshooting

### Events not appearing in GA4

1. **Check environment variables:**
   ```bash
   echo $VITE_GA4_MEASUREMENT_ID
   echo $VITE_ANALYTICS_ENABLED
   ```

2. **Check browser console:**
   - Look for `[Analytics]` logs
   - Verify initialization message appears

3. **Check Network tab:**
   - Filter by `google-analytics.com`
   - Verify requests are being sent

4. **Check GA4 DebugView:**
   - Events may take 24-48 hours to appear in standard reports
   - Use DebugView for real-time verification

### Analytics not initializing

- Verify `VITE_ANALYTICS_ENABLED=true`
- Verify Measurement ID is correct (format: `G-XXXXXXXXXX`)
- Check browser console for errors
- Ensure ad blockers are disabled for testing

### Events blocked by ad blockers

- This is expected behavior
- Analytics is designed to fail gracefully
- App functionality is NOT affected by blocked analytics

## Best Practices

1. **Test in DebugView first** before deploying to production
2. **Monitor event volume** to stay within GA4 free tier limits
3. **Review tracked events quarterly** to ensure relevance
4. **Never add PII** to custom events or parameters
5. **Document new events** in this file when adding them

## GA4 Free Tier Limits

- **10 million events per month** (should be sufficient for most apps)
- **25 custom event parameters** per event
- **50 custom user properties**
- **Unlimited standard events**

## Support

For issues or questions:
1. Check this documentation first
2. Review GA4 official docs: https://support.google.com/analytics/
3. Check browser console for `[Analytics]` logs
4. Verify environment variables are set correctly

## Privacy Policy

If you're deploying this app publicly, ensure your privacy policy mentions:
- Google Analytics usage
- Types of data collected (non-PII only)
- Purpose of tracking (product improvement, usage analytics)
- User rights (opt-out, data deletion)
- Link to Google's privacy policy

## Changelog

- **Dec 30, 2025**: Initial GA4 integration
  - Page view tracking for SPA
  - Event tracking for key user actions
  - Privacy-first implementation (no PII)
  - Debug mode for development
  - Comprehensive documentation


