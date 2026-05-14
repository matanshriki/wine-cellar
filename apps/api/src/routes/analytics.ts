/**
 * /api/analytics/ga4  — Admin-only Google Analytics 4 Data API proxy.
 *
 * Fetches aggregated GA4 reporting data server-side so credentials never
 * reach the browser.  Supports two auth methods (checked in order):
 *
 *   Method A — Service account (if your org allows adding it to GA4):
 *     GA4_SERVICE_ACCOUNT_JSON  full service-account key JSON as a string
 *
 *   Method B — OAuth 2.0 refresh token (recommended; uses your own Google
 *               account which already has GA4 access):
 *     GA4_OAUTH_CLIENT_ID       OAuth 2.0 Desktop-app client ID
 *     GA4_OAUTH_CLIENT_SECRET   corresponding client secret
 *     GA4_OAUTH_REFRESH_TOKEN   long-lived refresh token (generate once with
 *                               npx tsx apps/api/scripts/ga4-get-refresh-token.ts)
 *
 *   Both methods also require:
 *     GA4_PROPERTY_ID  numeric GA4 property ID (e.g. "123456789")
 *
 * The calling user must be an admin (verified via Supabase `is_admin` RPC).
 */

import { Router } from 'express';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { AuthRequest, authenticateSupabase } from '../middleware/auth.js';

export const analyticsRouter = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

type AuthMethod = 'service_account' | 'oauth2' | 'none';

function detectAuthMethod(): AuthMethod {
  // Prefer OAuth2 — works even when service-account emails are blocked by Google Workspace.
  if (config.ga4OauthClientId && config.ga4OauthClientSecret && config.ga4OauthRefreshToken) {
    return 'oauth2';
  }
  if (config.ga4ServiceAccountJson) return 'service_account';
  return 'none';
}

function buildClient(): BetaAnalyticsDataClient {
  const method = detectAuthMethod();

  if (method === 'service_account') {
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(config.ga4ServiceAccountJson);
    } catch {
      throw new Error('GA4_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
    const client = new BetaAnalyticsDataClient({ credentials });
    // Suppress unhandled gRPC channel errors from escaping the request scope
    (client as any).on?.('error', (e: Error) =>
      console.warn('[Analytics] GA4 client error (non-fatal):', e.message?.slice(0, 120)));
    return client;
  }

  if (method === 'oauth2') {
    const oauth2 = new OAuth2Client({
      clientId:     config.ga4OauthClientId,
      clientSecret: config.ga4OauthClientSecret,
    });
    oauth2.setCredentials({ refresh_token: config.ga4OauthRefreshToken });
    const client = new BetaAnalyticsDataClient({ auth: oauth2 } as any);
    (client as any).on?.('error', (e: Error) =>
      console.warn('[Analytics] GA4 client error (non-fatal):', e.message?.slice(0, 120)));
    return client;
  }

  throw new Error('GA4 not configured');
}

/** Extract a single string cell value from a GA4 RunReportResponse row */
function dim(row: any, idx: number): string {
  return row.dimensionValues?.[idx]?.value ?? '(not set)';
}
function met(row: any, idx: number): number {
  return Number(row.metricValues?.[idx]?.value ?? 0);
}

async function isAdminUser(userId: string): Promise<boolean> {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return false;
  const sb = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const { data, error } = await sb.rpc('is_admin', { check_user_id: userId });
  return !error && data === true;
}

// ── GET /api/analytics/ga4 ───────────────────────────────────────────────────

// ── GET /api/analytics/ga4/health — public config check, no credentials exposed ──
// Visit this directly in a browser to verify Railway env vars are set correctly.

analyticsRouter.get('/ga4/health', (_req, res) => {
  const method = detectAuthMethod();
  const propertyId = config.ga4PropertyId;
  const propertyIdLooksWrong = !!propertyId && (propertyId.startsWith('G-') || propertyId.startsWith('g-'));

  const issues: string[] = [];
  if (!propertyId)        issues.push('GA4_PROPERTY_ID is not set');
  if (propertyIdLooksWrong) issues.push(`GA4_PROPERTY_ID "${propertyId}" looks like a Measurement ID (G-... format). Use the numeric Property ID from GA4 Admin → Property Settings.`);
  if (method === 'none') {
    const hasPartialOauth = config.ga4OauthClientId && config.ga4OauthClientSecret;
    issues.push(
      hasPartialOauth
        ? 'GA4_OAUTH_CLIENT_ID and GA4_OAUTH_CLIENT_SECRET are set but GA4_OAUTH_REFRESH_TOKEN is missing. Run: npx tsx apps/api/scripts/ga4-get-refresh-token.ts'
        : 'No GA4 auth credentials found. Set GA4_OAUTH_CLIENT_ID + GA4_OAUTH_CLIENT_SECRET + GA4_OAUTH_REFRESH_TOKEN (recommended) or GA4_SERVICE_ACCOUNT_JSON.',
    );
  }

  return res.json({
    ok: issues.length === 0,
    authMethod: method,
    propertyIdSet: !!propertyId,
    propertyIdFormat: propertyIdLooksWrong ? 'WRONG (G-... Measurement ID)' : propertyId ? 'ok (numeric)' : 'not set',
    oauthPartiallyConfigured: !!(config.ga4OauthClientId && config.ga4OauthClientSecret && !config.ga4OauthRefreshToken),
    issues,
    hints: {
      missingRefreshToken: 'Run locally: npx tsx apps/api/scripts/ga4-get-refresh-token.ts — then set GA4_OAUTH_REFRESH_TOKEN in Railway.',
      propertyId: 'GA4 Admin (gear) → Property Settings → Property ID (top-right, numbers only, e.g. 123456789)',
      enableDataApi: 'https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com',
    },
  });
});

// ── GET /api/analytics/ga4/status — admin-only, same check + redacted cred presence ──

analyticsRouter.get('/ga4/status', authenticateSupabase, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });
    const adminOk = await isAdminUser(req.userId);
    if (!adminOk) return res.status(403).json({ error: 'Admin access required' });

    const method = detectAuthMethod();
    const propertyId = config.ga4PropertyId;
    const propertyIdLooksWrong = !!propertyId && (propertyId.startsWith('G-') || propertyId.startsWith('g-'));

    const issues: string[] = [];
    if (!propertyId)        issues.push('GA4_PROPERTY_ID is not set');
    if (propertyIdLooksWrong) issues.push(`GA4_PROPERTY_ID "${propertyId}" looks like a Measurement ID. Use the numeric Property ID.`);
    if (method === 'none')  issues.push('No auth credentials set.');

    return res.json({
      ok: issues.length === 0,
      authMethod: method,
      propertyId: propertyId || null,
      propertyIdFormat: propertyIdLooksWrong ? 'WRONG (G-... Measurement ID)' : propertyId ? 'ok (numeric)' : 'not set',
      credentialsPresent: {
        GA4_PROPERTY_ID:           !!config.ga4PropertyId,
        GA4_OAUTH_CLIENT_ID:       !!config.ga4OauthClientId,
        GA4_OAUTH_CLIENT_SECRET:   !!config.ga4OauthClientSecret,
        GA4_OAUTH_REFRESH_TOKEN:   !!config.ga4OauthRefreshToken,
        GA4_SERVICE_ACCOUNT_JSON:  !!config.ga4ServiceAccountJson,
      },
      issues,
      hints: {
        propertyId: 'GA4 Admin (gear) → Property Settings → Property ID (top-right, numeric only)',
        enableDataApi: 'https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com',
        generateRefreshToken: 'npx tsx apps/api/scripts/ga4-get-refresh-token.ts',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// ── GET /api/analytics/ga4/realtime — lightweight live data, no quota-heavy reports ──

analyticsRouter.get('/ga4/realtime', authenticateSupabase, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });
    const adminOk = await isAdminUser(req.userId);
    if (!adminOk) return res.status(403).json({ error: 'Admin access required' });

    if (!config.ga4PropertyId) return res.status(503).json({ error: 'GA4 not configured' });
    if (detectAuthMethod() === 'none') return res.status(503).json({ error: 'GA4 not configured' });

    const property = `properties/${config.ga4PropertyId}`;
    const ga = buildClient();

    const [totalRes, countryRes, deviceRes, pageRes] = await Promise.allSettled([
      ga.runRealtimeReport({ property, metrics: [{ name: 'activeUsers' }] }),
      ga.runRealtimeReport({
        property,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      }),
      ga.runRealtimeReport({
        property,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }],
      }),
      ga.runRealtimeReport({
        property,
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 8,
      }),
    ]);

    function ok<T>(r: PromiseSettledResult<T>): T | null {
      return r.status === 'fulfilled' ? r.value : null;
    }

    const totalData = ok(totalRes);
    const activeUsers = Number(totalData?.[0]?.rows?.[0]?.metricValues?.[0]?.value ?? 0);

    const byCountry = (ok(countryRes)?.[0]?.rows ?? []).map(row => ({
      country: dim(row, 0),
      users: met(row, 0),
    }));

    const totalDeviceUsers = (ok(deviceRes)?.[0]?.rows ?? []).reduce((s: number, r: any) => s + met(r, 0), 0);
    const byDevice = (ok(deviceRes)?.[0]?.rows ?? []).map(row => ({
      device: dim(row, 0),
      users: met(row, 0),
      pct: totalDeviceUsers > 0 ? parseFloat(((met(row, 0) / totalDeviceUsers) * 100).toFixed(1)) : 0,
    }));

    const byPage = (ok(pageRes)?.[0]?.rows ?? []).map(row => ({
      page: dim(row, 0),
      users: met(row, 0),
    }));

    return res.json({ activeUsers, byCountry, byDevice, byPage, fetchedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('[Analytics] Realtime error:', err?.message);
    return res.status(500).json({ error: 'Failed to fetch realtime data', detail: err?.message });
  }
});

// ── GET /api/analytics/ga4 ───────────────────────────────────────────────────

analyticsRouter.get('/ga4', authenticateSupabase, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const adminOk = await isAdminUser(req.userId);
    if (!adminOk) return res.status(403).json({ error: 'Admin access required' });

    if (!config.ga4PropertyId) {
      return res.status(503).json({
        error: 'GA4 not configured',
        hint: 'Set GA4_PROPERTY_ID (numeric, from GA4 Admin → Property Settings) plus OAuth or service account credentials.',
        authMethod: 'none',
        debugUrl: '/api/analytics/ga4/status',
      });
    }

    if (config.ga4PropertyId.startsWith('G-') || config.ga4PropertyId.startsWith('g-')) {
      console.error('[Analytics] GA4_PROPERTY_ID looks like a Measurement ID:', config.ga4PropertyId,
        '— must be the numeric Property ID from GA4 Admin → Property Settings.');
      return res.status(503).json({
        error: 'GA4_PROPERTY_ID is set to a Measurement ID (G-... format)',
        hint: 'The Data API requires the numeric Property ID, not the Measurement ID. Find it in GA4 Admin → Property Settings → Property ID (top-right, numbers only, e.g. 123456789).',
        current: config.ga4PropertyId,
        debugUrl: '/api/analytics/ga4/status',
      });
    }

    if (detectAuthMethod() === 'none') {
      return res.status(503).json({
        error: 'GA4 auth credentials not configured',
        hint: 'Set GA4_OAUTH_CLIENT_ID + GA4_OAUTH_CLIENT_SECRET + GA4_OAUTH_REFRESH_TOKEN (recommended) or GA4_SERVICE_ACCOUNT_JSON.',
        authMethod: 'none',
        debugUrl: '/api/analytics/ga4/status',
      });
    }

    const property = `properties/${config.ga4PropertyId}`;
    const ga = buildClient();

    const dateRanges = [
      { startDate: '7daysAgo', endDate: 'today', name: '7d' },
      { startDate: '30daysAgo', endDate: 'today', name: '30d' },
    ];

    // ── Run all reports in parallel ──────────────────────────────────────────

    const [
      overviewRes,
      sourcesRes,
      countriesRes,
      pagesRes,
      devicesRes,
      landingRes,
      realtimeRes,
      dailyRes,
      sourceMediumRes,
      acquisitionRes,
    ] = await Promise.allSettled([

      // 1. Overview KPIs — both date ranges in one request (dateRangeName dimension)
      ga.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'dateRange' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'newUsers' },
          { name: 'engagementRate' },
        ],
      }),

      // 2. Traffic channels (last 30 days)
      ga.runReport({
        property,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),

      // 3. Countries (last 30 days)
      ga.runReport({
        property,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'country' }, { name: 'countryId' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 15,
      }),

      // 4. Top pages (last 30 days)
      ga.runReport({
        property,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 12,
      }),

      // 5. Device categories (last 30 days)
      ga.runReport({
        property,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),

      // 6. Top landing pages (last 30 days)
      ga.runReport({
        property,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'landingPage' }],
        metrics: [{ name: 'sessions' }, { name: 'bounceRate' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),

      // 7. Real-time active users
      ga.runRealtimeReport({
        property,
        metrics: [{ name: 'activeUsers' }],
      }),

      // 8. Daily sessions over 30 days (trend chart data)
      ga.runReport({
        property,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      }),

      // 9. Source / medium detail — identifies ChatGPT, Gemini, Perplexity etc.
      ga.runReport({
        property,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'newUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 25,
      }),

      // 10. New-user acquisition — first touch source/medium
      ga.runReport({
        property,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'firstUserSource' }, { name: 'firstUserMedium' }],
        metrics: [{ name: 'newUsers' }],
        orderBys: [{ metric: { metricName: 'newUsers' }, desc: true }],
        limit: 20,
      }),
    ]);

    // ── Parse results ────────────────────────────────────────────────────────

    // Helper to safely unwrap PromiseSettledResult
    function ok<T>(r: PromiseSettledResult<T>): T | null {
      return r.status === 'fulfilled' ? r.value : null;
    }

    // 1. Overview
    const overviewData = ok(overviewRes);
    const overviewRows = overviewData?.[0]?.rows ?? [];
    const overviewByRange: Record<string, Record<string, number>> = {};
    for (const row of overviewRows) {
      const range = dim(row, 0); // '7d' or '30d'
      overviewByRange[range] = {
        activeUsers: met(row, 0),
        sessions: met(row, 1),
        pageViews: met(row, 2),
        avgSessionDuration: met(row, 3),
        bounceRate: parseFloat((met(row, 4) * 100).toFixed(1)),
        newUsers: met(row, 5),
        engagementRate: parseFloat((met(row, 6) * 100).toFixed(1)),
      };
    }

    // 2. Traffic sources
    const sourcesData = ok(sourcesRes);
    const sources = (sourcesData?.[0]?.rows ?? []).map(row => ({
      channel: dim(row, 0),
      sessions: met(row, 0),
      users: met(row, 1),
    }));

    // 3. Countries
    const countriesData = ok(countriesRes);
    const countries = (countriesData?.[0]?.rows ?? []).map(row => ({
      country: dim(row, 0),
      countryCode: dim(row, 1).toLowerCase(),
      users: met(row, 0),
      sessions: met(row, 1),
    }));

    // 4. Pages
    const pagesData = ok(pagesRes);
    const pages = (pagesData?.[0]?.rows ?? []).map(row => ({
      path: dim(row, 0),
      title: dim(row, 1),
      views: met(row, 0),
      users: met(row, 1),
      avgDuration: met(row, 2),
      bounceRate: parseFloat((met(row, 3) * 100).toFixed(1)),
    }));

    // 5. Devices
    const devicesData = ok(devicesRes);
    const totalDeviceSessions = (devicesData?.[0]?.rows ?? []).reduce(
      (s: number, r: any) => s + met(r, 0), 0
    );
    const devices = (devicesData?.[0]?.rows ?? []).map(row => ({
      device: dim(row, 0),
      sessions: met(row, 0),
      users: met(row, 1),
      pct: totalDeviceSessions > 0
        ? parseFloat(((met(row, 0) / totalDeviceSessions) * 100).toFixed(1))
        : 0,
    }));

    // 6. Landing pages
    const landingData = ok(landingRes);
    const landingPages = (landingData?.[0]?.rows ?? []).map(row => ({
      path: dim(row, 0),
      sessions: met(row, 0),
      bounceRate: parseFloat((met(row, 1) * 100).toFixed(1)),
    }));

    // 7. Real-time
    const realtimeData = ok(realtimeRes);
    const realtimeUsers = Number(realtimeData?.[0]?.rows?.[0]?.metricValues?.[0]?.value ?? 0);

    // 8. Daily trend
    const dailyData = ok(dailyRes);
    const dailyTrend = (dailyData?.[0]?.rows ?? []).map(row => ({
      date: dim(row, 0), // "YYYYMMDD"
      sessions: met(row, 0),
      users: met(row, 1),
      pageViews: met(row, 2),
    }));

    // 9. Source / medium detail
    const sourceMediumData = ok(sourceMediumRes);
    const totalSMSessions = (sourceMediumData?.[0]?.rows ?? []).reduce((s: number, r: any) => s + met(r, 0), 0);
    const sourcesDetail = (sourceMediumData?.[0]?.rows ?? []).map(row => ({
      source: dim(row, 0),
      medium: dim(row, 1),
      sessions: met(row, 0),
      users: met(row, 1),
      newUsers: met(row, 2),
      pct: totalSMSessions > 0 ? parseFloat(((met(row, 0) / totalSMSessions) * 100).toFixed(1)) : 0,
    }));

    // 10. New-user acquisition (first touch)
    const acquisitionData = ok(acquisitionRes);
    const totalAcqUsers = (acquisitionData?.[0]?.rows ?? []).reduce((s: number, r: any) => s + met(r, 0), 0);
    const acquisition = (acquisitionData?.[0]?.rows ?? []).map(row => ({
      source: dim(row, 0),
      medium: dim(row, 1),
      newUsers: met(row, 0),
      pct: totalAcqUsers > 0 ? parseFloat(((met(row, 0) / totalAcqUsers) * 100).toFixed(1)) : 0,
    }));

    return res.json({
      propertyId: config.ga4PropertyId,
      authMethod: detectAuthMethod(),
      fetchedAt: new Date().toISOString(),
      realtimeUsers,
      overview: {
        '7d': overviewByRange['7d'] ?? null,
        '30d': overviewByRange['30d'] ?? null,
      },
      sources,
      sourcesDetail,
      acquisition,
      countries,
      pages,
      devices,
      landingPages,
      dailyTrend,
    });
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    const code: number = err?.code ?? err?.status ?? 0;

    // Surface actionable hints for the most common Google API errors
    if (msg.includes('has not been used') || msg.includes('API_NOT_ENABLED') || code === 403) {
      console.error('[Analytics] GA4 Data API not enabled in GCP project.',
        'Enable it at: https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com',
        'Full error:', msg);
      return res.status(503).json({
        error: 'Google Analytics Data API is not enabled in the GCP project',
        hint: 'Enable it at https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com — make sure you are in the correct GCP project (the one that owns your OAuth client ID / service account).',
        detail: msg,
      });
    }

    if (msg.includes('invalid_grant') || msg.includes('invalid_client')) {
      console.error('[Analytics] GA4 OAuth credentials are invalid or refresh token expired.', msg);
      return res.status(503).json({
        error: 'GA4 OAuth credentials invalid',
        hint: 'Re-run: npx tsx apps/api/scripts/ga4-get-refresh-token.ts to generate a new refresh token, then update GA4_OAUTH_REFRESH_TOKEN in Railway.',
        detail: msg,
      });
    }

    if (msg.includes('PERMISSION_DENIED') || msg.includes('does not have sufficient permissions')) {
      console.error('[Analytics] GA4 account does not have access to this property.', msg);
      return res.status(503).json({
        error: 'GA4 permission denied',
        hint: 'The Google account used to generate the refresh token must have Viewer access to the GA4 property.',
        detail: msg,
      });
    }

    if (msg.includes('INVALID_ARGUMENT') || msg.includes('Property') && msg.includes('not found')) {
      console.error('[Analytics] GA4_PROPERTY_ID may be wrong. Current value:', config.ga4PropertyId, msg);
      return res.status(503).json({
        error: 'GA4 property not found',
        hint: `GA4_PROPERTY_ID "${config.ga4PropertyId}" is not valid. Find the numeric Property ID in GA4 Admin → Property Settings → Property ID (top-right).`,
        detail: msg,
      });
    }

    console.error('[Analytics] GA4 error:', msg);
    return res.status(500).json({ error: 'Failed to fetch GA4 data', detail: msg });
  }
});
