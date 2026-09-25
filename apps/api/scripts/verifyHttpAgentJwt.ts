/**
 * Hit live local API /api/agent/recommend with a real user JWT.
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
const apiBase = process.env.API_URL || 'http://localhost:3001';

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
  const tempPassword = `TmpApi_${randomBytes(12).toString('hex')}!`;
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

  // Ensure fridge tag still present
  const { data: bottles } = await admin
    .from('bottles')
    .select('id, quantity, storage_location, wine:wines(color, is_kosher)')
    .eq('user_id', userId)
    .gt('quantity', 0);
  const fridge = (bottles || []).find((b) =>
    (b.storage_location || '').toLowerCase().includes('fridge')
  );
  if (!fridge && bottles?.[0]) {
    await admin
      .from('bottles')
      .update({ storage_location: 'fridge' })
      .eq('id', bottles[0].id);
  }

  const kosherReds = (bottles || []).filter(
    (b) =>
      ((b.wine as { color?: string; is_kosher?: boolean | null })?.color || '').toLowerCase() ===
        'red' && (b.wine as { is_kosher?: boolean | null })?.is_kosher === true
  );

  async function callAgent(message: string, actionContext?: Record<string, unknown>) {
    const res = await fetch(`${apiBase}/api/agent/recommend`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history: [],
        cellarContext: { bottles: [] }, // empty client payload — server must load
        actionContext,
        language: 'en',
      }),
    });
    const body = await res.json();
    return { status: res.status, body };
  }

  const results: unknown[] = [];

  const r1 = await callAgent('list all my kosher reds');
  results.push({
    step: 'kosher_list',
    status: r1.status,
    mode: r1.body?.agentMeta?.processingMode,
    matched: r1.body?.agentMeta?.cellarAccess?.matchedBottleRows,
    displayed: r1.body?.agentMeta?.cellarAccess?.displayedBottleRows,
    hasMore: r1.body?.agentMeta?.cellarAccess?.hasMore,
    dbKosherReds: kosherReds.length,
    bottleIds: (r1.body?.bottles || []).map((b: { bottleId: string }) => b.bottleId?.slice(0, 8)),
    msg: (r1.body?.message || '').slice(0, 180),
  });

  const access1 = r1.body?.agentMeta?.cellarAccess;
  let page = 1;
  let access = access1;
  const allIds: string[] = [...(r1.body?.bottles || []).map((b: { bottleId: string }) => b.bottleId)];
  while (access?.hasMore && page < 10) {
    page++;
    const rn = await callAgent('show the rest', { lastCellarAccess: access });
    const ids = (rn.body?.bottles || []).map((b: { bottleId: string }) => b.bottleId);
    allIds.push(...ids);
    access = rn.body?.agentMeta?.cellarAccess;
    results.push({
      step: `page_${page}`,
      status: rn.status,
      matched: access?.matchedBottleRows,
      displayed: access?.displayedBottleRows,
      hasMore: access?.hasMore,
      pageIds: ids.length,
    });
  }

  const dupes = allIds.length - new Set(allIds).size;
  results.push({
    step: 'pagination_integrity',
    collected: allIds.length,
    dupes,
    expected: kosherReds.length,
    ok: dupes === 0 && allIds.length === kosherReds.length,
  });

  const rFridge = await callAgent("what's in my fridge?");
  results.push({
    step: 'fridge',
    status: rFridge.status,
    mode: rFridge.body?.agentMeta?.processingMode,
    matched: rFridge.body?.agentMeta?.cellarAccess?.matchedBottleRows,
    missingLoc: rFridge.body?.agentMeta?.cellarAccess?.dataGaps?.missingStorageLocationRows,
    msg: (rFridge.body?.message || '').slice(0, 200),
  });

  const anchor = kosherReds[0]?.id || allIds[0];
  const rSim = await callAgent('what else do I have like this?', {
    lastRecommendationBottleId: anchor,
  });
  results.push({
    step: 'similar',
    status: rSim.status,
    route: rSim.body?.agentMeta?.routedAction,
    mode: rSim.body?.agentMeta?.processingMode,
    matched: rSim.body?.agentMeta?.cellarAccess?.matchedBottleRows,
    selectionCap: rSim.body?.agentMeta?.cellarAccess?.selectionCap,
    hasMore: rSim.body?.agentMeta?.cellarAccess?.hasMore,
    similarAnchor: rSim.body?.agentMeta?.cellarAccess?.hardFilters?.similarAnchorBottleId?.slice(0, 8),
    msg: (rSim.body?.message || '').slice(0, 220),
    followUp: rSim.body?.followUpQuestion,
  });

  const simAccess = rSim.body?.agentMeta?.cellarAccess;
  if (simAccess?.hasMore) {
    const rShow = await callAgent('show all of them', { lastCellarAccess: simAccess });
    results.push({
      step: 'similar_show_all',
      status: rShow.status,
      mode: rShow.body?.agentMeta?.processingMode,
      matched: rShow.body?.agentMeta?.cellarAccess?.matchedBottleRows,
      displayed: rShow.body?.bottles?.length,
      msg: (rShow.body?.message || '').slice(0, 160),
    });
  }

  const rClarify = await callAgent('show the rest', {});
  results.push({
    step: 'clarify_no_context',
    status: rClarify.status,
    mode: rClarify.body?.agentMeta?.processingMode,
    msg: (rClarify.body?.message || '').slice(0, 180),
  });

  // Old client: no lastCellarAccess — recover filters from conversation messages when possible
  const { data: conv } = await admin
    .from('sommelier_conversations')
    .insert({
      user_id: userId,
      title: 'verify-recover',
      messages: [
        { role: 'user', content: 'list all my kosher reds' },
        {
          role: 'assistant',
          content: 'here are some',
          agentMeta: { cellarAccess: access1 },
        },
      ],
    })
    .select('id')
    .single();

  if (conv?.id && access1) {
    const rRecover = await callAgent('show the rest', {
      conversationId: conv.id,
      // intentionally omit lastCellarAccess
    });
    results.push({
      step: 'recover_from_conversation',
      status: rRecover.status,
      mode: rRecover.body?.agentMeta?.processingMode,
      matched: rRecover.body?.agentMeta?.cellarAccess?.matchedBottleRows,
      wantsKosher: rRecover.body?.agentMeta?.cellarAccess?.hardFilters?.wantsKosher,
      msg: (rRecover.body?.message || '').slice(0, 160),
      clarified:
        typeof rRecover.body?.message === 'string' &&
        rRecover.body.message.toLowerCase().includes("not sure which list"),
    });
    await admin.from('sommelier_conversations').delete().eq('id', conv.id);
  }

  console.log(JSON.stringify({ userPrefix: userId.slice(0, 8), results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
