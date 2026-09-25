/**
 * Full-cellar inventory + hard-filter tests (no LLM).
 */
import { describe, it, expect } from 'vitest';
import { applyHardFilters } from './hardFilters.js';
import {
  buildDeterministicInventoryResponse,
  INVENTORY_PAGE_SIZE,
  sliceInventoryPage,
} from './inventoryQuery.js';
import {
  detectIntent,
  detectsInventoryFollowUp,
  detectsWantsKosher,
  extractConstraints,
  extractStorageLocationHints,
  mergeConstraintsWithPrior,
  resolveQueryMode,
} from './tools.js';
import { classifyAgentRoute } from './agentRouter.js';
import type { CellarBottleInput } from './types.js';
import { mapBottleRowToInput } from './cellarInventoryRepo.js';

function bottle(
  partial: Partial<CellarBottleInput> & { id: string }
): CellarBottleInput {
  return {
    producer: 'P',
    wineName: 'W',
    quantity: 1,
    color: 'red',
    ...partial,
  };
}

describe('kosher + storage constraint detection', () => {
  it('detects kosher EN/HE', () => {
    expect(detectsWantsKosher('kosher red for dinner')).toBe(true);
    expect(detectsWantsKosher('יין כשר אדום')).toBe(true);
    expect(detectsWantsKosher('red for steak')).toBe(false);
  });

  it('treats bare fridge / מקרר / wine fridge as cellar synonyms (no location filter)', () => {
    expect(extractStorageLocationHints("what's in my fridge?")).toEqual([]);
    expect(extractStorageLocationHints('מה יש במקרר')).toEqual([]);
    expect(extractStorageLocationHints('wine fridge kosher reds')).toEqual([]);
    expect(extractStorageLocationHints('איזה יינות כשרים יש לי במקרר')).toEqual([]);
  });

  it('still extracts distinct places like kitchen fridge', () => {
    expect(extractStorageLocationHints("what's in my kitchen fridge?")).toContain('kitchen');
  });

  it('extractConstraints: kosher + fridge keeps kosher, drops cellar-synonym storage filter', () => {
    const c = extractConstraints('list all my kosher reds in the fridge');
    expect(c.wantsKosher).toBe(true);
    expect(c.colors).toContain('red');
    expect(c.storageLocationHints).toEqual([]);

    const he = extractConstraints('איזה יינות כשרים יש לי במקרר');
    expect(he.wantsKosher).toBe(true);
    expect(he.storageLocationHints).toEqual([]);
  });
});

describe('query mode + follow-ups', () => {
  it('routes inventory for list/browse kosher', () => {
    const c = extractConstraints('what kosher reds do I have?');
    expect(resolveQueryMode('what kosher reds do I have?', 'browse_cellar', c)).toBe(
      'inventory'
    );
  });

  it('routes recommend for kosher recommendation asks', () => {
    const c = extractConstraints('recommend a kosher red for roast beef tonight');
    // has food → pairing intent often; still recommend mode
    const intent = detectIntent('recommend a kosher red for roast beef tonight', 0);
    expect(resolveQueryMode('recommend a kosher red for roast beef tonight', intent, c)).toBe(
      'recommend'
    );
  });

  it('detects show-all follow-up and merges prior filters', () => {
    expect(detectsInventoryFollowUp('show me all of them')).toBe(true);
    expect(detectsInventoryFollowUp('הצג את כולם')).toBe(true);
    const merged = mergeConstraintsWithPrior(extractConstraints('show me all of them'), {
      colors: ['red'],
      wantsKosher: true,
      storageLocationHints: [],
    });
    expect(merged.wantsKosher).toBe(true);
    expect(merged.colors).toEqual(['red']);
  });

  it('classifyAgentRoute sends inventory follow-up to recommend when lastCellarAccess set', () => {
    expect(
      classifyAgentRoute('show me all of them', {
        lastCellarAccess: {
          scope: 'filtered_full',
          cellarScannedFully: true,
          listFullyDisplayed: false,
          truncated: false,
          scannedBottleRows: 80,
          scannedPhysicalBottles: 80,
          matchedBottleRows: 10,
          matchedPhysicalBottles: 10,
          displayedBottleRows: 1,
          hardFilters: {
            colors: ['red'],
            wantsKosher: true,
            storageLocationHints: [],
            excludeReserved: false,
          },
          dataGaps: {
            unknownKosherRows: 0,
            missingStorageLocationRows: 0,
            reservedExcluded: 0,
          },
        },
      })
    ).toBe('recommend');
  });

  it('does not treat “list all my kosher reds” as inventory follow-up', () => {
    expect(detectsInventoryFollowUp('list all my kosher reds')).toBe(false);
    expect(detectsInventoryFollowUp('show the rest')).toBe(true);
    expect(detectsInventoryFollowUp('show all of them')).toBe(true);
    expect(detectsInventoryFollowUp('הצג את כולם')).toBe(true);
    expect(detectsInventoryFollowUp('הצג את כל האדומים הכשרים')).toBe(false);
  });

  it('routes similar for EN/HE “what else like this” phrasing', () => {
    const ctx = { lastRecommendationBottleId: 'b0000000-0000-4000-8000-000000000001' };
    expect(classifyAgentRoute('what else do I have like this?', ctx)).toBe('similar');
    expect(classifyAgentRoute('איזה עוד יינות כאלה יש לי?', ctx)).toBe('similar');
  });

  it('treats HE “are these all my kosher wines?” as inventory follow-up', () => {
    expect(detectsInventoryFollowUp('אלה כל היינות הכשרים שלי?')).toBe(true);
    const c = extractConstraints('אלה כל היינות הכשרים שלי?');
    expect(c.wantsKosher).toBe(true);
    expect(
      resolveQueryMode('אלה כל היינות הכשרים שלי?', detectIntent('אלה כל היינות הכשרים שלי?', 1), c, {
        inventoryFollowUp: true,
        hasPriorHardFilters: true,
      })
    ).toBe('inventory');
  });
});

describe('hard filters', () => {
  const cellar: CellarBottleInput[] = [
    bottle({ id: 'k1', isKosher: true, color: 'red' }),
    bottle({ id: 'k2', isKosher: true, color: 'red', isReserved: true, reservedFor: 'Passover' }),
    bottle({ id: 'u1', isKosher: null, color: 'red' }),
    bottle({ id: 'n1', isKosher: false, color: 'red' }),
    bottle({ id: 'w1', isKosher: true, color: 'white' }),
    bottle({ id: 'f1', isKosher: true, color: 'red', storageLocation: 'Fridge' }),
    bottle({ id: 'f2', color: 'red', storageLocation: null }),
  ];

  it('inventory includes Keep; recommend can exclude Keep', () => {
    const constraints = extractConstraints('list kosher reds');
    const inv = applyHardFilters(cellar, constraints, { excludeReserved: false });
    expect(inv.matched.map((b) => b.id).sort()).toEqual(['f1', 'k1', 'k2']);

    const rec = applyHardFilters(cellar, constraints, { excludeReserved: true });
    expect(rec.matched.map((b) => b.id).sort()).toEqual(['f1', 'k1']);
    expect(rec.reservedExcluded).toBe(1);
  });

  it('never treats null kosher as kosher', () => {
    const constraints = extractConstraints('kosher reds');
    const { matched, dataGaps } = applyHardFilters(cellar, constraints, {
      excludeReserved: false,
    });
    expect(matched.some((b) => b.id === 'u1')).toBe(false);
    expect(dataGaps.unknownKosherAmongFilteredColor).toBeGreaterThan(0);
  });

  it('kitchen fridge filter still matches tagged storage_location', () => {
    const cellarWithKitchen = [
      ...cellar,
      bottle({ id: 'kitch', isKosher: true, color: 'red', storageLocation: 'kitchen fridge' }),
    ];
    const constraints = extractConstraints("what's in my kitchen fridge?");
    const { matched } = applyHardFilters(cellarWithKitchen, constraints, {
      excludeReserved: false,
    });
    expect(matched.map((b) => b.id)).toEqual(['kitch']);
  });

  it('kosher + במקרר returns kosher wines (fridge is cellar synonym)', () => {
    const constraints = extractConstraints('איזה יינות כשרים יש לי במקרר');
    expect(constraints.wantsKosher).toBe(true);
    expect(constraints.storageLocationHints).toEqual([]);
    const { matched } = applyHardFilters(cellar, constraints, { excludeReserved: false });
    expect(matched.map((b) => b.id).sort()).toEqual(['f1', 'k1', 'k2', 'w1']);
  });
});

describe('deterministic inventory response', () => {
  it('lists all matches and reports completeness metadata', () => {
    const bottles = Array.from({ length: 12 }, (_, i) =>
      bottle({ id: `k${i}`, isKosher: true, color: 'red' })
    );
    // pad cellar with non-matches
    for (let i = 0; i < 70; i++) {
      bottles.push(bottle({ id: `x${i}`, isKosher: false, color: 'red' }));
    }

    const { response, meta } = buildDeterministicInventoryResponse({
      cellarBottles: bottles,
      scannedBottleRows: bottles.length,
      scannedPhysicalBottles: bottles.length,
      constraints: extractConstraints('list all my kosher reds'),
      offset: 0,
    });

    expect(meta.cellarScannedFully).toBe(true);
    expect(meta.matchedBottleRows).toBe(12);
    expect(meta.listFullyDisplayed).toBe(true);
    expect(response.type).toBe('bottle_list');
    expect((response.bottles as unknown[]).length).toBe(12);
    expect(String(response.message)).toMatch(/12/);
    expect(String(response.message)).not.toMatch(/shortlist/i);
  });

  it('paginates with full match count and hasMore', () => {
    const bottles = Array.from({ length: INVENTORY_PAGE_SIZE + 5 }, (_, i) =>
      bottle({ id: `k${i}`, isKosher: true, color: 'red' })
    );
    const { response, meta } = buildDeterministicInventoryResponse({
      cellarBottles: bottles,
      scannedBottleRows: bottles.length,
      scannedPhysicalBottles: bottles.length,
      constraints: extractConstraints('list kosher reds'),
      offset: 0,
    });
    expect(meta.matchedBottleRows).toBe(INVENTORY_PAGE_SIZE + 5);
    expect(meta.displayedBottleRows).toBe(INVENTORY_PAGE_SIZE);
    expect(meta.listFullyDisplayed).toBe(false);
    expect(meta.hasMore).toBe(true);
    expect(meta.nextOffset).toBe(INVENTORY_PAGE_SIZE);
    expect((response.inventory as { matchedCount: number }).matchedCount).toBe(
      INVENTORY_PAGE_SIZE + 5
    );

    const page2 = sliceInventoryPage(bottles, meta.nextOffset!);
    expect(page2.page.length).toBe(5);
    expect(page2.hasMore).toBe(false);
  });

  it('Keep bottles appear with status in inventory list', () => {
    const bottles = [
      bottle({
        id: 'keep1',
        isKosher: true,
        color: 'red',
        isReserved: true,
        reservedFor: 'Seder',
      }),
    ];
    const { response } = buildDeterministicInventoryResponse({
      cellarBottles: bottles,
      scannedBottleRows: 1,
      scannedPhysicalBottles: 1,
      constraints: extractConstraints('kosher reds'),
    });
    const item = (response.bottles as { shortWhy?: string; isReserved?: boolean }[])[0];
    expect(item.isReserved).toBe(true);
    expect(item.shortWhy).toMatch(/Keep/i);
  });
});

describe('cellarInventoryRepo mapping', () => {
  it('maps is_kosher null and storage_location', () => {
    const mapped = mapBottleRowToInput({
      id: 'b1',
      quantity: 2,
      storage_location: 'fridge',
      wine: {
        producer: 'A',
        wine_name: 'B',
        color: 'red',
        is_kosher: null,
        kosher_confidence: null,
      },
    });
    expect(mapped.isKosher).toBeNull();
    expect(mapped.storageLocation).toBe('fridge');
    expect(mapped.quantity).toBe(2);
  });
});

describe('old-client compatibility', () => {
  it('inventory response does not depend on client-truncated bottle list', () => {
    // Server builds list from full cellarBottles argument; client 60-cap is irrelevant
    const bottles = Array.from({ length: 80 }, (_, i) =>
      bottle({ id: `k${i}`, isKosher: true, color: 'red' })
    );
    const { meta } = buildDeterministicInventoryResponse({
      cellarBottles: bottles,
      scannedBottleRows: 80,
      scannedPhysicalBottles: 80,
      constraints: extractConstraints('list kosher reds'),
    });
    expect(meta.cellarScannedFully).toBe(true);
    expect(meta.matchedBottleRows).toBe(80);
    expect(meta.truncated).toBe(false);
  });

  it('follow-up without prior filters still inventory-mode but cannot restore filters', () => {
    // Documents old-client gap: without lastCellarAccess, “show all” has empty hard filters
    const c = extractConstraints('show me all of them');
    expect(c.wantsKosher).toBe(false);
    expect(c.colors).toEqual([]);
    expect(detectsInventoryFollowUp('show me all of them')).toBe(true);
  });

  it('recovers cellarAccess from conversation messages', async () => {
    const { extractLastCellarAccessFromMessages, priorAccessHasListContext } =
      await import('./conversationCellarAccess.js');
    const meta = {
      scope: 'filtered_full' as const,
      cellarScannedFully: true,
      listFullyDisplayed: true,
      truncated: false,
      scannedBottleRows: 10,
      scannedPhysicalBottles: 10,
      matchedBottleRows: 3,
      matchedPhysicalBottles: 3,
      displayedBottleRows: 3,
      hardFilters: {
        colors: ['red'],
        wantsKosher: true,
        storageLocationHints: [] as string[],
        excludeReserved: false,
      },
      dataGaps: {
        unknownKosherRows: 0,
        missingStorageLocationRows: 0,
        reservedExcluded: 0,
      },
    };
    const recovered = extractLastCellarAccessFromMessages([
      { role: 'user', content: 'list kosher reds' },
      { role: 'assistant', content: 'here', agentMeta: { cellarAccess: meta } },
    ]);
    expect(priorAccessHasListContext(recovered)).toBe(true);
    expect(recovered?.hardFilters.wantsKosher).toBe(true);
  });
});
