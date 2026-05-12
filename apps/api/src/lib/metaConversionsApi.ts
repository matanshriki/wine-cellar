/**
 * Meta Conversions API (server-side) — sends redundant events for deduplication with the browser Pixel.
 * Never throws into request handlers; logs safely on failure.
 */

import { createHash } from 'crypto';
import { config } from '../config.js';

const GRAPH_VERSION = 'v21.0';

export interface MetaCapiUserContext {
  /** Plain email — hashed before send */
  email?: string | null;
  /** Plain user id (e.g. Supabase UUID) — hashed before send */
  externalId?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}

export interface SendMetaCapiEventParams {
  eventName: 'Lead' | 'InitiateCheckout' | 'Purchase';
  eventId: string;
  eventTimeSec?: number;
  eventSourceUrl?: string | null;
  actionSource?: 'website';
  customData?: {
    currency?: string;
    value?: number;
  };
  user: MetaCapiUserContext;
}

function hashMeta(value: string): string {
  const normalized = value.trim().toLowerCase();
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function capiLog(message: string, extra?: Record<string, unknown>): void {
  if (config.nodeEnv === 'development') {
    console.log(`[Meta CAPI] ${message}`, extra ?? '');
  }
}

function capiWarn(message: string, err?: unknown): void {
  console.warn(`[Meta CAPI] ${message}`, err instanceof Error ? err.message : err);
}

/**
 * Sends a single event to Meta Conversions API. Safe to call without configured token (no-op).
 */
export async function sendMetaCapiEvent(params: SendMetaCapiEventParams): Promise<void> {
  const pixelId = config.metaPixelId?.trim();
  const accessToken = config.metaConversionsApiAccessToken?.trim();

  if (!pixelId || !accessToken) {
    capiLog('Skipped — META_PIXEL_ID or META_CONVERSIONS_API_ACCESS_TOKEN not set');
    return;
  }

  if (!params.eventId?.trim()) {
    capiWarn('Skipped — missing event_id');
    return;
  }

  const user_data: Record<string, string | string[]> = {};

  if (params.user.email) {
    user_data.em = [hashMeta(params.user.email)];
  }
  if (params.user.externalId) {
    user_data.external_id = [hashMeta(params.user.externalId)];
  }
  if (params.user.clientIpAddress?.trim()) {
    user_data.client_ip_address = params.user.clientIpAddress.trim();
  }
  if (params.user.clientUserAgent?.trim()) {
    user_data.client_user_agent = params.user.clientUserAgent.trim();
  }

  const body: Record<string, unknown> = {
    event_name: params.eventName,
    event_time: params.eventTimeSec ?? Math.floor(Date.now() / 1000),
    event_id: params.eventId,
    action_source: params.actionSource ?? 'website',
    user_data,
  };

  if (params.eventSourceUrl?.trim()) {
    body.event_source_url = params.eventSourceUrl.trim();
  }

  if (params.customData && (params.customData.value != null || params.customData.currency)) {
    body.custom_data = {
      ...(params.customData.currency ? { currency: params.customData.currency } : {}),
      ...(params.customData.value != null ? { value: params.customData.value } : {}),
    };
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`);
  url.searchParams.set('access_token', accessToken);

  const payload: Record<string, unknown> = { data: [body] };
  if (config.metaTestEventCode?.trim()) {
    payload.test_event_code = config.metaTestEventCode.trim();
  }

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string } };

    if (!res.ok) {
      capiWarn(`HTTP ${res.status}`, json?.error?.message ?? json);
      return;
    }

    capiLog(`Sent ${params.eventName}`, { event_id: params.eventId, events_received: json.events_received });
  } catch (e) {
    capiWarn('Request failed', e);
  }
}

/**
 * Paddle amounts are in minor units and arrive as strings (e.g. "1000" = $10.00).
 * Numeric values (used in tests/sandbox) are also accepted.
 */
function parseMinorUnits(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v / 100;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n / 100;
  }
  return undefined;
}

/** Extract Paddle Billing webhook totals when present (shape varies slightly by event). */
export function valueCurrencyFromPaddlePayload(data: Record<string, unknown> | null | undefined): {
  value: number;
  currency: string;
} | null {
  if (!data || typeof data !== 'object') return null;

  const d = data;
  const detailsTotals =
    d.details &&
    typeof d.details === 'object' &&
    (d.details as Record<string, unknown>).totals &&
    typeof (d.details as Record<string, unknown>).totals === 'object'
      ? ((d.details as Record<string, unknown>).totals as Record<string, unknown>)
      : null;

  const topTotals =
    d.totals && typeof d.totals === 'object' ? (d.totals as Record<string, unknown>) : null;

  const currency =
    (typeof d.currency_code === 'string' && d.currency_code) ||
    (typeof detailsTotals?.currency_code === 'string' && detailsTotals.currency_code) ||
    (typeof topTotals?.currency_code === 'string' && topTotals.currency_code) ||
    'USD';

  const value =
    parseMinorUnits(detailsTotals?.total) ??
    parseMinorUnits(detailsTotals?.grand_total) ??
    parseMinorUnits(topTotals?.total) ??
    parseMinorUnits(topTotals?.grand_total);

  if (value == null) return null;

  return { value, currency };
}
