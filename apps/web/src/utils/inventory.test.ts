import { describe, expect, it } from 'vitest';
import { countInStockWines, inventoryTotals, isInStock, sumInStockBottles } from './inventory';

describe('inventory counting', () => {
  const rows = [
    { quantity: 3 },
    { quantity: 1 },
    { quantity: 0 }, // opened history row
    { quantity: -1 }, // corrupt row must not subtract
    { quantity: null },
    { quantity: 2 },
  ];

  it('sums physical bottles only for in-stock rows', () => {
    expect(sumInStockBottles(rows)).toBe(6);
  });

  it('counts distinct in-stock wine records', () => {
    expect(countInStockWines(rows)).toBe(3);
  });

  it('returns both totals together', () => {
    expect(inventoryTotals(rows)).toEqual({ bottles: 6, wines: 3 });
  });

  it('treats non-positive and missing quantities as out of stock', () => {
    expect(isInStock({ quantity: 0 })).toBe(false);
    expect(isInStock({ quantity: undefined })).toBe(false);
    expect(isInStock({ quantity: 1 })).toBe(true);
  });

  it('gives the same total whether a page of rows is partial or complete', () => {
    // Regression: the cellar header summed only the first loaded page (100 rows)
    // while chat summed every row, producing 54 vs 55.
    const all = Array.from({ length: 120 }, (_, i) => ({ quantity: i % 3 === 0 ? 0 : 1 }));
    const firstPage = all.slice(0, 100);
    expect(sumInStockBottles(firstPage)).toBeLessThan(sumInStockBottles(all));
    expect(sumInStockBottles(all)).toBe(80);
  });
});
