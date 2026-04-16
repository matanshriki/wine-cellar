/**
 * Meta Conversions API — authenticated relay from the browser so the server can send
 * Lead / InitiateCheckout / Purchase with hashed PII and the same event_id as the Pixel.
 */

import { Router, type Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { type AuthRequest, authenticateSupabase } from '../middleware/auth.js';
import { sendMetaCapiEvent, type SendMetaCapiEventParams } from '../lib/metaConversionsApi.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

export const metaRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getServiceClient(): AnySupabase | null {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return null;
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  }) as AnySupabase;
}

function clientIp(req: AuthRequest): string | undefined {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0]?.trim();
  }
  if (Array.isArray(xff) && xff[0]) {
    return xff[0].split(',')[0]?.trim();
  }
  return req.socket?.remoteAddress;
}

function badRequest(res: Response, msg: string) {
  return res.status(400).json({ error: msg });
}

metaRouter.post('/conversion', authenticateSupabase, async (req: AuthRequest, res: Response) => {
  const body = req.body as {
    eventName?: string;
    eventId?: string;
    eventSourceUrl?: string;
    value?: number;
    currency?: string;
  };

  const eventName = body.eventName as SendMetaCapiEventParams['eventName'] | undefined;
  const allowed: SendMetaCapiEventParams['eventName'][] = ['Lead', 'InitiateCheckout', 'Purchase'];

  if (!eventName || !allowed.includes(eventName)) {
    return badRequest(res, 'Invalid or missing eventName');
  }

  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  if (!eventId || !UUID_RE.test(eventId)) {
    return badRequest(res, 'Invalid or missing eventId (expected UUID)');
  }

  if (eventName === 'Purchase') {
    if (body.value == null || typeof body.value !== 'number' || body.value < 0) {
      return badRequest(res, 'Purchase requires a non-negative numeric value');
    }
    if (!body.currency || typeof body.currency !== 'string' || body.currency.length < 3) {
      return badRequest(res, 'Purchase requires currency (ISO 4217)');
    }
  }

  const supabase = getServiceClient();
  if (!supabase || !req.userId) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { data: auth, error: authErr } = await supabase.auth.admin.getUserById(req.userId);
  if (authErr || !auth?.user) {
    console.warn('[Meta CAPI] Could not load user for conversion:', authErr?.message);
    return res.status(500).json({ error: 'Could not resolve user' });
  }

  const email = auth.user.email ?? undefined;

  await sendMetaCapiEvent({
    eventName,
    eventId,
    eventSourceUrl: body.eventSourceUrl ?? `${config.webUrl.replace(/\/$/, '')}/`,
    user: {
      email,
      externalId: req.userId,
      clientIpAddress: clientIp(req),
      clientUserAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    },
    customData:
      eventName === 'Purchase'
        ? { value: body.value!, currency: body.currency!.toUpperCase() }
        : undefined,
  });

  return res.json({ ok: true });
});
