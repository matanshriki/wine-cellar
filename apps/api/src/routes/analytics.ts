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
  if (config.ga4ServiceAccountJson) return 'service_account';
  if (config.ga4OauthClientId && config.ga4OauthClientSecret && config.ga4OauthRefreshToken) {
    return 'oauth2';
  }
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
    return new BetaAnalyticsDataClient({ credentials });
  }

  if (method === 'oauth2') {
    const oauth2 = new OAuth2Client({
      clientId:     config.ga4OauthClientId,
      clientSecret: config.ga4OauthClientSecret,
    });
    oauth2.setCredentials({ refresh_token: config.ga4OauthRefreshToken });
    // google-gax (used by @google-analytics/data) accepts an OAuth2Client as `auth`
    return new BetaAnalyticsDataClient({ auth: oauth2 } as any);
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

analyticsRouter.get('/ga4', authenticateSupabase, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const adminOk = await isAdminUser(req.userId);
    if (!adminOk) return res.status(403).json({ error: 'Admin access required' });

    if (!config.ga4PropertyId) {
      return res.status(503).json({
        error: 'GA4 not configured',
        hint: 'Set GA4_PROPERTY_ID plus either GA4_SERVICE_ACCOUNT_JSON (service account) or GA4_OAUTH_CLIENT_ID + GA4_OAUTH_CLIENT_SECRET + GA4_OAUTH_REFRESH_TOKEN (OAuth2).',
        authMethod: 'none',
      });
    }

    if (detectAuthMethod() === 'none') {
      return res.status(503).json({
        error: 'GA4 not configured',
        hint: 'Set either GA4_SERVICE_ACCOUNT_JSON (service account) or GA4_OAUTH_CLIENT_ID + GA4_OAUTH_CLIENT_SECRET + GA4_OAUTH_REFRESH_TOKEN (OAuth2).',
        authMethod: 'none',
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
      countries,
      pages,
      devices,
      landingPages,
      dailyTrend,
    });
  } catch (err: any) {
    console.error('[Analytics] GA4 error:', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to fetch GA4 data', detail: err?.message });
  }
});
