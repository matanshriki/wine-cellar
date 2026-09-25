/**
 * Drive agent UI flows via the same HTTP API the web client uses,
 * with a real user JWT and empty client cellar (server scan).
 * Captures response text + agentMeta for staging smoke report.
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const apiBase = process.env.API_URL || 'http://localhost:3001';

async function mintToken(): Promise<{ token: string; userId: string }> {
  try {
    const s = JSON.parse(readFileSync('/tmp/sommi-ui-session.json', 'utf8'));
    if (s.access_token && s.user_id) {
      return { token: s.access_token, userId: s.user_id };
    }
  } catch {
    /* mint fresh */
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sample } = await admin.from('bottles').select('user_id').gt('quantity', 0).limit(5000);
  const counts = new Map<string, number>();
  for (const r of sample || []) counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1);
  const userId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  await admin.from('profiles').update({ cellar_agent_enabled: true }).eq('id', userId);
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser.user!.email!;
  const { data: linkData, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const userClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: vErr } = await userClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  });
  if (vErr || !verified.session) throw vErr || new Error('no session');
  return { token: verified.session.access_token, userId };
}

async function main() {
  const { token, userId } = await mintToken();
  let lastCellarAccess: unknown = undefined;
  let conversationId: string | undefined;
  const report: unknown[] = [];

  async function call(message: string, actionContext?: Record<string, unknown>) {
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
          ...(actionContext || {}),
          ...(lastCellarAccess ? { lastCellarAccess } : {}),
          ...(conversationId ? { conversationId } : {}),
        },
        language: 'en',
      }),
    });
    const body = await res.json();
    if (body.agentMeta?.cellarAccess) lastCellarAccess = body.agentMeta.cellarAccess;
    if (body.conversationId) conversationId = body.conversationId;
    return { status: res.status, body };
  }

  // 1) Kosher list
  const k = await call('list all my kosher reds');
  report.push({
    step: 'ui_kosher_list',
    status: k.status,
    message: (k.body.message || '').slice(0, 240),
    processingMode: k.body.agentMeta?.processingMode,
    cellarAccess: k.body.agentMeta?.cellarAccess,
    bottleCount: (k.body.bottles || []).length,
  });

  // 2) Paginate if needed
  let page = 1;
  while (lastCellarAccess && (lastCellarAccess as { hasMore?: boolean }).hasMore && page < 10) {
    page++;
    const p = await call('show the rest');
    report.push({
      step: `ui_page_${page}`,
      status: p.status,
      message: (p.body.message || '').slice(0, 200),
      processingMode: p.body.agentMeta?.processingMode,
      matched: p.body.agentMeta?.cellarAccess?.matchedBottleRows,
      displayed: p.body.agentMeta?.cellarAccess?.displayedBottleRows,
      hasMore: p.body.agentMeta?.cellarAccess?.hasMore,
      bottleCount: (p.body.bottles || []).length,
    });
  }

  // 3) Follow-up without lastCellarAccess (simulate old client) — keep conversationId
  const savedAccess = lastCellarAccess;
  lastCellarAccess = undefined;
  const follow = await call('show the rest', { conversationId });
  report.push({
    step: 'ui_followup_no_client_access',
    status: follow.status,
    message: (follow.body.message || '').slice(0, 200),
    processingMode: follow.body.agentMeta?.processingMode,
    matched: follow.body.agentMeta?.cellarAccess?.matchedBottleRows,
    wantsKosher: follow.body.agentMeta?.cellarAccess?.hardFilters?.wantsKosher,
    note: 'omitted lastCellarAccess; conversationId only',
  });
  lastCellarAccess = savedAccess || follow.body.agentMeta?.cellarAccess;

  // 4) Fridge
  const f = await call("what's in my fridge?");
  report.push({
    step: 'ui_fridge',
    status: f.status,
    message: (f.body.message || '').slice(0, 240),
    processingMode: f.body.agentMeta?.processingMode,
    cellarAccess: f.body.agentMeta?.cellarAccess,
    bottleCount: (f.body.bottles || []).length,
  });

  // 5) Similar inventory completeness
  const anchor =
    (k.body.bottles || [])[0]?.bottleId ||
    (f.body.bottles || [])[0]?.bottleId;
  const sim = await call('what else do I have like this?', {
    lastRecommendationBottleId: anchor,
  });
  report.push({
    step: 'ui_similar',
    status: sim.status,
    message: (sim.body.message || '').slice(0, 280),
    processingMode: sim.body.agentMeta?.processingMode,
    routedAction: sim.body.agentMeta?.routedAction,
    cellarAccess: sim.body.agentMeta?.cellarAccess,
    followUp: sim.body.followUpQuestion,
    bottleCount: (sim.body.bottles || []).length,
  });

  writeFileSync('/tmp/sommi-ui-smoke-report.json', JSON.stringify({ userPrefix: userId.slice(0, 8), report }, null, 2));
  console.log(JSON.stringify({ userPrefix: userId.slice(0, 8), report }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
