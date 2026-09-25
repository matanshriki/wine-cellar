/**
 * Production smoke against wineapi-production with the largest-cellar user.
 * Steps: kosher list → recommend one → “are those all?” → fridge.
 * Exits non-zero if inventory fails closed / errors / scan incomplete.
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const apiBase = process.env.PROD_API_URL || 'https://wineapi-production.up.railway.app';

type Step = {
  step: string;
  status: number;
  ok: boolean;
  message?: string;
  processingMode?: string;
  routedAction?: string;
  actionResult?: string;
  cellarAccess?: unknown;
  bottleCount?: number;
  error?: string;
};

async function main() {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sample } = await admin
    .from('bottles')
    .select('user_id')
    .gt('quantity', 0)
    .limit(5000);
  const counts = new Map<string, number>();
  for (const r of sample || []) counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1);
  const userId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  await admin.from('profiles').update({ cellar_agent_enabled: true }).eq('id', userId);
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser.user!.email!;
  const tempPassword = `ProdSmoke_${randomBytes(12).toString('hex')}!`;
  await admin.auth.admin.updateUserById(userId, { password: tempPassword });

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signed, error } = await userClient.auth.signInWithPassword({
    email,
    password: tempPassword,
  });
  if (error || !signed.session) throw error || new Error('no session');
  const token = signed.session.access_token;

  const { count: dbKosherReds } = await admin
    .from('bottles')
    .select('id, wine:wines!inner(color, is_kosher)', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gt('quantity', 0)
    .eq('wines.color', 'red')
    .eq('wines.is_kosher', true);

  let lastCellarAccess: unknown;
  let lastBottleId: string | undefined;
  const steps: Step[] = [];

  async function call(step: string, message: string, actionContext?: Record<string, unknown>) {
    const res = await fetch(`${apiBase}/api/agent/recommend`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history: [],
        cellarContext: { bottles: [] },
        actionContext: {
          ...(lastCellarAccess ? { lastCellarAccess } : {}),
          ...(lastBottleId ? { lastRecommendationBottleId: lastBottleId } : {}),
          ...actionContext,
        },
        language: 'en',
      }),
    });
    const body = await res.json().catch(() => ({}));
    const access = body?.agentMeta?.cellarAccess;
    if (access) lastCellarAccess = access;
    if (body?.bottles?.[0]?.bottleId) lastBottleId = body.bottles[0].bottleId;
    if (body?.recommendation?.bottleId) lastBottleId = body.recommendation.bottleId;

    const failClosed =
      typeof body?.message === 'string' &&
      /won't guess from a partial|couldn't complete a full cellar/i.test(body.message);
    const mode = body?.agentMeta?.processingMode;
    const actionResult = body?.agentMeta?.actionResult;
    const ok =
      res.status === 200 &&
      !failClosed &&
      actionResult !== 'error' &&
      !(access && access.cellarScannedFully === false);

    const row: Step = {
      step,
      status: res.status,
      ok,
      message: (body?.message || body?.error || '').slice(0, 280),
      processingMode: mode,
      routedAction: body?.agentMeta?.routedAction,
      actionResult,
      cellarAccess: access
        ? {
            scannedBottleRows: access.scannedBottleRows,
            scannedPhysicalBottles: access.scannedPhysicalBottles,
            matchedBottleRows: access.matchedBottleRows,
            displayedBottleRows: access.displayedBottleRows,
            hasMore: access.hasMore,
            listFullyDisplayed: access.listFullyDisplayed,
            cellarScannedFully: access.cellarScannedFully,
            truncated: access.truncated,
            hardFilters: access.hardFilters,
            dataGaps: access.dataGaps,
            scope: access.scope,
          }
        : undefined,
      bottleCount: (body?.bottles || []).length,
      error: failClosed ? 'fail_closed_partial_scan' : undefined,
    };
    steps.push(row);
    return row;
  }

  await call('kosher_list', 'list all my kosher reds');
  await call('recommend_one', 'recommend one wine for dinner tonight');
  await call('are_those_all', 'are those all?');
  await call('fridge', "what's in my fridge?");

  const failed = steps.filter((s) => !s.ok);
  const report = {
    apiBase,
    userPrefix: userId.slice(0, 8),
    dbKosherReds: dbKosherReds ?? null,
    steps,
    failed: failed.map((s) => s.step),
    rollbackRecommended: failed.some(
      (s) =>
        s.error === 'fail_closed_partial_scan' ||
        (s.step === 'kosher_list' && !s.ok) ||
        (s.step === 'fridge' && !s.ok)
    ),
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.rollbackRecommended || failed.length > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
