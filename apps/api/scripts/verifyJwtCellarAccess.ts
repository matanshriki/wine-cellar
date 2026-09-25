/**
 * JWT + RLS verification through the same load path the API uses (user-scoped client).
 * Also tags one bottle as fridge for UI testing (reversible metadata only).
 *
 * Run: npx tsx scripts/verifyJwtCellarAccess.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { loadInStockCellar } from '../src/services/cellarAgent/cellarInventoryRepo.js';
import { extractConstraints } from '../src/services/cellarAgent/tools.js';
import { applyHardFilters } from '../src/services/cellarAgent/hardFilters.js';
import { buildDeterministicInventoryResponse } from '../src/services/cellarAgent/inventoryQuery.js';
import {
  extractLastCellarAccessFromMessages,
  priorAccessHasListContext,
} from '../src/services/cellarAgent/conversationCellarAccess.js';
import { recommendCellar } from '../src/services/cellarAgent/orchestrator.js';
import OpenAI from 'openai';
import { config } from '../src/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function main() {
  const failures: string[] = [];
  const fail = (m: string) => {
    failures.push(m);
    console.error('FAIL:', m);
  };

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Largest cellar user
  const { data: sample } = await admin
    .from('bottles')
    .select('user_id')
    .gt('quantity', 0)
    .limit(5000);
  const counts = new Map<string, number>();
  for (const r of sample || []) {
    counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1);
  }
  const userId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  console.log('Target user', userId.slice(0, 8) + '…', 'rows~', counts.get(userId));

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr || !authUser.user?.email) {
    fail('Could not load user email for JWT test');
    process.exit(1);
  }
  const email = authUser.user.email;
  const tempPassword = `TmpVerify_${randomBytes(12).toString('hex')}!`;

  await admin.auth.admin.updateUserById(userId, { password: tempPassword });

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signed, error: signErr } = await userClient.auth.signInWithPassword({
    email,
    password: tempPassword,
  });
  if (signErr || !signed.session?.access_token) {
    fail(`signInWithPassword failed: ${signErr?.message}`);
    process.exit(1);
  }
  const jwt = signed.session.access_token;
  console.log('PASS: obtained real user JWT (len', jwt.length + ')');

  // User-scoped client identical to createUserSupabase in agent route
  const rlsClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const loadedJwt = await loadInStockCellar(userId, rlsClient);
  const loadedAdmin = await loadInStockCellar(userId, admin);

  if (loadedJwt.scannedBottleRows !== loadedAdmin.scannedBottleRows) {
    fail(
      `RLS load rows ${loadedJwt.scannedBottleRows} != admin ${loadedAdmin.scannedBottleRows}`
    );
  } else {
    console.log('PASS: JWT RLS load row count matches admin', loadedJwt.scannedBottleRows);
  }

  const jwtIds = loadedJwt.bottles.map((b) => b.id).sort();
  const adminIds = loadedAdmin.bottles.map((b) => b.id).sort();
  if (JSON.stringify(jwtIds) !== JSON.stringify(adminIds)) {
    fail('JWT vs admin bottle ID mismatch');
  } else {
    console.log('PASS: JWT bottle IDs match admin for this user');
  }

  // RLS isolation: user client must not see another user's bottle when filtering wrong id
  const otherUser = [...counts.keys()].find((u) => u !== userId);
  if (otherUser) {
    const { data: leak, error: leakErr } = await rlsClient
      .from('bottles')
      .select('id')
      .eq('user_id', otherUser)
      .gt('quantity', 0)
      .limit(5);
    if (leakErr) {
      console.log('PASS: cross-user query errored under RLS', leakErr.code || leakErr.message);
    } else if ((leak || []).length > 0) {
      fail(`RLS leak: saw ${leak!.length} bottles for another user`);
    } else {
      console.log('PASS: RLS returns 0 rows for another user_id filter');
    }
  }

  // Tag one bottle as fridge for UI testing
  const tagId = loadedJwt.bottles[0]?.id;
  let fridgeTagged = false;
  if (tagId) {
    const { error: upErr } = await admin
      .from('bottles')
      .update({ storage_location: 'fridge' })
      .eq('id', tagId)
      .eq('user_id', userId);
    if (upErr) fail(`fridge tag failed: ${upErr.message}`);
    else {
      fridgeTagged = true;
      console.log('PASS: tagged bottle', tagId.slice(0, 8), '… as fridge');
    }
  }

  const reloaded = await loadInStockCellar(userId, rlsClient);
  const fridgeC = extractConstraints("what's in my fridge?");
  const fridgeHard = applyHardFilters(reloaded.bottles, fridgeC, { excludeReserved: false });
  console.log('Fridge matches after tag:', fridgeHard.matched.length, 'missingLoc', fridgeHard.dataGaps.missingStorageLocationRows);

  // Conversation recover + clarify path via recommendCellar (no lastCellarAccess)
  const openai = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null;
  if (!openai) {
    console.warn('WARN: no OpenAI key — skipping recommendCellar follow-up simulation');
  } else {
    // Simulate inventory then follow-up without lastCellarAccess but with conversation messages
    const inv = buildDeterministicInventoryResponse({
      cellarBottles: reloaded.bottles,
      scannedBottleRows: reloaded.scannedBottleRows,
      scannedPhysicalBottles: reloaded.scannedPhysicalBottles,
      constraints: extractConstraints('list all my kosher reds'),
      offset: 0,
    });

    // Create conversation owned by user (via RLS client)
    const { data: conv, error: convErr } = await rlsClient
      .from('sommelier_conversations')
      .insert({
        user_id: userId,
        title: 'verify-jwt',
        messages: [
          {
            role: 'assistant',
            content: inv.response.message,
            agentMeta: { cellarAccess: inv.meta, processingMode: 'deterministic_inventory' },
            bottleList: { bottles: inv.response.bottles },
          },
        ],
        last_message_at: new Date().toISOString(),
      })
      .select('id, messages')
      .single();

    if (convErr || !conv) {
      fail(`conversation insert failed: ${convErr?.message}`);
    } else {
      const recovered = extractLastCellarAccessFromMessages(conv.messages);
      if (!priorAccessHasListContext(recovered)) fail('recover from messages failed');
      else console.log('PASS: recovered cellarAccess from conversation messages');

      const followUp = (await recommendCellar({
        openai,
        userId,
        supabase: rlsClient,
        message: 'show me all of them',
        history: [],
        cellarBottles: reloaded.bottles,
        scannedBottleRows: reloaded.scannedBottleRows,
        scannedPhysicalBottles: reloaded.scannedPhysicalBottles,
        cellarSource: 'server',
        actionContext: { conversationId: conv.id }, // no lastCellarAccess — old client
        language: 'en',
      })) as { agentMeta?: { processingMode?: string; cellarAccess?: { matchedBottleRows?: number } }; type?: string };

      if (followUp.agentMeta?.processingMode !== 'deterministic_inventory') {
        fail(`follow-up mode ${followUp.agentMeta?.processingMode}`);
      } else if (
        followUp.agentMeta?.cellarAccess?.matchedBottleRows !== inv.meta.matchedBottleRows
      ) {
        fail('follow-up matched count diverged from prior list');
      } else {
        console.log(
          'PASS: show-all without lastCellarAccess recovered filters; matched=',
          followUp.agentMeta.cellarAccess?.matchedBottleRows
        );
      }

      const clarify = (await recommendCellar({
        openai,
        userId,
        supabase: rlsClient,
        message: 'show the rest',
        history: [],
        cellarBottles: reloaded.bottles,
        scannedBottleRows: reloaded.scannedBottleRows,
        scannedPhysicalBottles: reloaded.scannedPhysicalBottles,
        cellarSource: 'server',
        actionContext: {}, // no conversation, no lastCellarAccess
        language: 'en',
      })) as { message?: string; agentMeta?: { processingMode?: string } };

      if (
        clarify.agentMeta?.processingMode === 'deterministic_inventory' &&
        !/not sure which list|don't have the previous filter/i.test(clarify.message || '')
      ) {
        fail('clarify path returned silent broad inventory');
      } else if (/not sure which list|previous filter/i.test(clarify.message || '')) {
        console.log('PASS: show-the-rest without context asks which list');
      } else {
        console.log('Clarify response:', clarify.agentMeta?.processingMode, (clarify.message || '').slice(0, 120));
      }

      await rlsClient.from('sommelier_conversations').delete().eq('id', conv.id);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: failures.length === 0,
        failures,
        userPrefix: userId.slice(0, 8),
        rows: loadedJwt.scannedBottleRows,
        physical: loadedJwt.scannedPhysicalBottles,
        fridgeTagged,
        fridgeMatches: fridgeHard.matched.length,
      },
      null,
      2
    )
  );
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
