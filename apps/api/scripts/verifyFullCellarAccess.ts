/**
 * Staging verification: compare loadInStockCellar + hard filters vs direct SQL-shaped queries.
 * Run: npx tsx scripts/verifyFullCellarAccess.ts
 * Uses apps/api/.env (SERVICE ROLE) — never logs secrets or emails in full.
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  loadInStockCellar,
} from '../src/services/cellarAgent/cellarInventoryRepo.js';
import { applyHardFilters } from '../src/services/cellarAgent/hardFilters.js';
import {
  buildDeterministicInventoryResponse,
  INVENTORY_PAGE_SIZE,
} from '../src/services/cellarAgent/inventoryQuery.js';
import {
  classifyAgentRoute,
} from '../src/services/cellarAgent/agentRouter.js';
import {
  detectIntent,
  extractConstraints,
  resolveQueryMode,
  detectsInventoryFollowUp,
} from '../src/services/cellarAgent/tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !serviceKey) {
  console.error('FAIL: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/api/.env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Row = {
  id: string;
  user_id: string;
  quantity: number;
  is_reserved: boolean | null;
  storage_location: string | null;
  wine: {
    color: string | null;
    is_kosher: boolean | null;
  } | null;
};

async function findCandidateUser(): Promise<string | null> {
  // Pull a large page of in-stock bottles and pick the user with the most rows
  const { data, error } = await admin
    .from('bottles')
    .select('user_id, quantity')
    .gt('quantity', 0)
    .limit(5000);

  if (error) throw error;
  const counts = new Map<string, number>();
  for (const r of data || []) {
    counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [uid, n] of counts) {
    if (n > bestN) {
      best = uid;
      bestN = n;
    }
  }
  console.log(`Candidate users scanned; largest in-stock row count among sample: ${bestN}`);
  if (!best || bestN < 20) {
    console.warn('WARN: no user with ≥20 in-stock rows in first 5000 bottle rows');
  }
  return best;
}

async function directStats(userId: string) {
  const { data, error } = await admin
    .from('bottles')
    .select(
      `
      id,
      quantity,
      is_reserved,
      storage_location,
      wine:wines(color, is_kosher)
    `
    )
    .eq('user_id', userId)
    .gt('quantity', 0);

  if (error) throw error;
  const rows = (data || []) as unknown as Row[];
  const physical = rows.reduce((s, r) => s + (r.quantity || 0), 0);
  const kosherTrue = rows.filter((r) => r.wine?.is_kosher === true).length;
  const kosherFalse = rows.filter((r) => r.wine?.is_kosher === false).length;
  const kosherNull = rows.filter(
    (r) => r.wine?.is_kosher === null || r.wine?.is_kosher === undefined
  ).length;
  const keep = rows.filter((r) => r.is_reserved).length;
  const fridge = rows.filter((r) =>
    (r.storage_location || '').toLowerCase().includes('fridge') ||
    (r.storage_location || '').includes('מקרר')
  ).length;
  const noLoc = rows.filter((r) => !r.storage_location || !String(r.storage_location).trim()).length;
  const redKosher = rows.filter(
    (r) =>
      (r.wine?.color || '').toLowerCase() === 'red' && r.wine?.is_kosher === true
  );
  return {
    rows,
    rowCount: rows.length,
    physical,
    kosherTrue,
    kosherFalse,
    kosherNull,
    keep,
    fridge,
    noLoc,
    redKosherIds: redKosher.map((r) => r.id).sort(),
  };
}

function routeReport(message: string, ctx?: Parameters<typeof classifyAgentRoute>[1]) {
  const route = classifyAgentRoute(message, ctx);
  const intent = detectIntent(message, 1);
  const constraints = extractConstraints(message);
  const queryMode = resolveQueryMode(message, intent, constraints, {
    inventoryFollowUp: detectsInventoryFollowUp(message),
    hasPriorHardFilters: !!ctx?.lastCellarAccess?.hardFilters,
  });
  return { message, route, intent, queryMode, constraints };
}

async function main() {
  const report: Record<string, unknown> = { ok: true, failures: [] as string[] };
  const fail = (msg: string) => {
    (report.failures as string[]).push(msg);
    report.ok = false;
    console.error('FAIL:', msg);
  };

  const userId = await findCandidateUser();
  if (!userId) {
    fail('No candidate user found');
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(`Using user ${userId.slice(0, 8)}…`);

  const direct = await directStats(userId);
  console.log('Direct DB stats:', {
    rows: direct.rowCount,
    physical: direct.physical,
    kosherTrue: direct.kosherTrue,
    kosherFalse: direct.kosherFalse,
    kosherNull: direct.kosherNull,
    keep: direct.keep,
    fridge: direct.fridge,
    noLoc: direct.noLoc,
    redKosher: direct.redKosherIds.length,
  });

  // Simulate authenticated load via service role with user filter (same query shape as repo)
  const loaded = await loadInStockCellar(userId, admin);
  if (loaded.scannedBottleRows !== direct.rowCount) {
    fail(
      `loadInStockCellar rows ${loaded.scannedBottleRows} != DB ${direct.rowCount}`
    );
  } else {
    console.log('PASS: scannedBottleRows matches DB row count');
  }
  if (loaded.scannedPhysicalBottles !== direct.physical) {
    fail(
      `physical ${loaded.scannedPhysicalBottles} != DB ${direct.physical}`
    );
  } else {
    console.log('PASS: scannedPhysicalBottles matches DB sum(quantity)');
  }

  const loadIds = loaded.bottles.map((b) => b.id).sort();
  const dbIds = direct.rows.map((r) => r.id).sort();
  if (JSON.stringify(loadIds) !== JSON.stringify(dbIds)) {
    fail('bottle ID set mismatch between loadInStockCellar and direct query');
  } else {
    console.log('PASS: bottle ID sets identical');
  }

  if (direct.rowCount <= 60) {
    console.warn(
      `WARN: candidate has only ${direct.rowCount} rows (≤60). Prefer a larger cellar for cap regression proof.`
    );
  } else {
    console.log(`PASS: cellar has ${direct.rowCount} rows (>60) — beyond old client cap`);
  }

  // Kosher red inventory IDs
  const constraints = extractConstraints('list all my kosher reds');
  const hard = applyHardFilters(loaded.bottles, constraints, { excludeReserved: false });
  const hardIds = hard.matched.map((b) => b.id).sort();
  if (JSON.stringify(hardIds) !== JSON.stringify(direct.redKosherIds)) {
    fail(
      `kosher red IDs diverge: filter=${hardIds.length} db=${direct.redKosherIds.length}`
    );
  } else {
    console.log(`PASS: kosher red IDs match DB (${hardIds.length})`);
  }

  // Keep included in inventory
  const keepInMatch = hard.matched.filter((b) => b.isReserved).length;
  const keepKosherRedDb = direct.rows.filter(
    (r) =>
      r.is_reserved &&
      (r.wine?.color || '').toLowerCase() === 'red' &&
      r.wine?.is_kosher === true
  ).length;
  if (keepInMatch !== keepKosherRedDb) {
    fail(`Keep in kosher-red inventory ${keepInMatch} != DB ${keepKosherRedDb}`);
  } else {
    console.log('PASS: Keep bottles included in inventory matches');
  }

  // Pagination integrity
  if (hardIds.length > INVENTORY_PAGE_SIZE) {
    const page1 = buildDeterministicInventoryResponse({
      cellarBottles: loaded.bottles,
      scannedBottleRows: loaded.scannedBottleRows,
      scannedPhysicalBottles: loaded.scannedPhysicalBottles,
      constraints,
      offset: 0,
    });
    const page2 = buildDeterministicInventoryResponse({
      cellarBottles: loaded.bottles,
      scannedBottleRows: loaded.scannedBottleRows,
      scannedPhysicalBottles: loaded.scannedPhysicalBottles,
      constraints,
      offset: page1.meta.nextOffset ?? INVENTORY_PAGE_SIZE,
    });
    const ids1 = (page1.response.bottles as { bottleId: string }[]).map((b) => b.bottleId);
    const ids2 = (page2.response.bottles as { bottleId: string }[]).map((b) => b.bottleId);
    const overlap = ids1.filter((id) => ids2.includes(id));
    if (overlap.length) fail(`pagination overlap: ${overlap.length} dupes`);
    const combined = [...ids1, ...ids2];
    if (combined.length !== hardIds.length && page2.meta.listFullyDisplayed) {
      // only when two pages cover all
    }
    if (new Set(combined).size !== combined.length) fail('duplicate IDs across pages');
    if (page1.meta.matchedBottleRows !== hardIds.length) {
      fail('page1 matched count wrong');
    }
    if (page1.meta.matchedBottleRows !== page2.meta.matchedBottleRows) {
      fail('matched count changed between pages');
    }
    console.log('PASS: pagination no overlap; matched count stable', {
      matched: page1.meta.matchedBottleRows,
      p1: ids1.length,
      p2: ids2.length,
    });
  } else {
    console.warn(
      `WARN: only ${hardIds.length} kosher reds — cannot exercise >50 pagination on this user`
    );
  }

  // Fridge gaps
  const fridgeC = extractConstraints("what's in my fridge?");
  const fridgeHard = applyHardFilters(loaded.bottles, fridgeC, { excludeReserved: false });
  console.log('Fridge filter:', {
    matched: fridgeHard.matched.length,
    missingStorage: fridgeHard.dataGaps.missingStorageLocationRows,
    dbFridge: direct.fridge,
    dbNoLoc: direct.noLoc,
  });
  if (fridgeHard.matched.length !== direct.fridge) {
    fail(`fridge match ${fridgeHard.matched.length} != DB ${direct.fridge}`);
  } else {
    console.log('PASS: fridge tagged count matches DB');
  }
  if (fridgeHard.dataGaps.missingStorageLocationRows !== direct.noLoc) {
    fail('missing storage gap count mismatch');
  } else {
    console.log('PASS: missing storage_location gap matches DB');
  }

  // Routing matrix
  const priorKosher = {
    lastCellarAccess: {
      scope: 'filtered_full' as const,
      cellarScannedFully: true,
      listFullyDisplayed: false,
      truncated: false,
      scannedBottleRows: loaded.scannedBottleRows,
      scannedPhysicalBottles: loaded.scannedPhysicalBottles,
      matchedBottleRows: hardIds.length,
      matchedPhysicalBottles: hardIds.length,
      displayedBottleRows: Math.min(1, hardIds.length),
      hardFilters: {
        colors: ['red'],
        wantsKosher: true,
        storageLocationHints: [] as string[],
        excludeReserved: false,
      },
      dataGaps: {
        unknownKosherRows: direct.kosherNull,
        missingStorageLocationRows: direct.noLoc,
        reservedExcluded: 0,
      },
      hasMore: hardIds.length > 1,
      nextOffset: 1,
    },
  };

  const routes = [
    routeReport('what else do I have like this?', {
      lastRecommendationBottleId: loadIds[0],
    }),
    routeReport('איזה עוד יינות כאלה יש לי?', {
      lastRecommendationBottleId: loadIds[0],
    }),
    routeReport('אלה כל היינות הכשרים שלי?', priorKosher),
    routeReport('list all my kosher reds'),
    routeReport('הצג את כל האדומים הכשרים'),
    routeReport("what's in my fridge?"),
    routeReport('מה יש במקרר?'),
    routeReport('recommend a kosher red for steak tonight'),
    routeReport('show me all of them', priorKosher),
    routeReport('הצג את השאר', priorKosher),
  ];

  console.log('\n=== Route matrix ===');
  for (const r of routes) {
    console.log(
      JSON.stringify({
        msg: r.message,
        route: r.route,
        queryMode: r.queryMode,
        wantsKosher: r.constraints.wantsKosher,
        colors: r.constraints.colors,
        storage: r.constraints.storageLocationHints,
      })
    );
  }

  // Assertions on critical routes
  const similarEn = routes[0];
  if (similarEn.route !== 'similar') fail(`EN similar phrasing routed ${similarEn.route}`);
  const similarHe = routes[1];
  if (similarHe.route !== 'similar') fail(`HE similar phrasing routed ${similarHe.route}`);
  const allKosherHe = routes[2];
  if (allKosherHe.queryMode !== 'inventory') {
    fail(`HE “are these all my kosher?” queryMode=${allKosherHe.queryMode}`);
  }
  if (allKosherHe.route === 'conversational') {
    fail('HE all-kosher must not be conversational/anchor-only');
  }

  report.userPrefix = userId.slice(0, 8);
  report.direct = {
    rows: direct.rowCount,
    physical: direct.physical,
    kosherTrue: direct.kosherTrue,
    kosherFalse: direct.kosherFalse,
    kosherNull: direct.kosherNull,
    keep: direct.keep,
    fridge: direct.fridge,
    redKosher: direct.redKosherIds.length,
  };
  report.routes = routes.map((r) => ({
    msg: r.message,
    route: r.route,
    queryMode: r.queryMode,
  }));

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ ok: report.ok, failures: report.failures, direct: report.direct }, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
