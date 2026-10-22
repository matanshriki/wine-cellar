/**
 * Inventory counting semantics shared by every screen that shows a cellar size.
 *
 * - "Bottles" means physical bottles still in the cellar: the sum of `quantity`
 *   over rows with `quantity > 0`. Reserved bottles are still in the cellar and count.
 * - "Wines" means distinct in-stock bottle records (one row per wine/vintage entry).
 * - Rows with `quantity <= 0` are opening history, not inventory.
 *
 * This matches the server-side scan used by Sommi chat
 * (`apps/api/src/services/cellarAgent/cellarInventoryRepo.ts`).
 */

export interface QuantityRow {
  quantity: number | null | undefined;
}

export interface InventoryTotals {
  /** Physical bottles in the cellar (sum of in-stock quantities). */
  bottles: number;
  /** Distinct in-stock bottle records. */
  wines: number;
}

function inStockQuantity(row: QuantityRow): number {
  const q = Number(row.quantity);
  return Number.isFinite(q) && q > 0 ? Math.floor(q) : 0;
}

export function isInStock(row: QuantityRow): boolean {
  return inStockQuantity(row) > 0;
}

export function sumInStockBottles(rows: readonly QuantityRow[]): number {
  return rows.reduce((sum, row) => sum + inStockQuantity(row), 0);
}

export function countInStockWines(rows: readonly QuantityRow[]): number {
  return rows.reduce((n, row) => n + (inStockQuantity(row) > 0 ? 1 : 0), 0);
}

export function inventoryTotals(rows: readonly QuantityRow[]): InventoryTotals {
  return { bottles: sumInStockBottles(rows), wines: countInStockWines(rows) };
}
