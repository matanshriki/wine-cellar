/**
 * Hard inventory filters applied to the full in-stock cellar before any ranking.
 * Inventory includes Keep bottles (status shown). Recommendations may exclude Keep.
 */

import type {
  CellarAccessMeta,
  CellarBottleInput,
  ExtractedConstraints,
  HardFilterSnapshot,
} from './types.js';

export interface HardFilterResult {
  matched: CellarBottleInput[];
  /** Rows that matched color (etc.) but were excluded only because of Keep — recommend path */
  reservedExcluded: number;
  dataGaps: CellarAccessMeta['dataGaps'];
  applied: HardFilterSnapshot;
}

function normalizeColor(c: string | undefined): string {
  return (c || '').toLowerCase().trim();
}

/** Normalize free-text storage for matching (EN + HE). */
export function normalizeStorageToken(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function storageMatchesHint(
  location: string | null | undefined,
  hints: string[]
): boolean {
  if (!hints.length) return true;
  const loc = normalizeStorageToken(location);
  if (!loc) return false;
  return hints.some((h) => {
    const hint = normalizeStorageToken(h);
    if (!hint) return false;
    return loc.includes(hint) || hint.includes(loc);
  });
}

export function isFridgeHint(hints: string[]): boolean {
  return hints.some((h) => {
    const n = normalizeStorageToken(h);
    return (
      n.includes('fridge') ||
      n.includes('refrigerator') ||
      n.includes('מקרר') ||
      n === 'fridge'
    );
  });
}

/**
 * Apply hard constraints to the full cellar.
 * @param excludeReserved when true (recommend default), drop Keep bottles from matches
 *        but still count them in reservedExcluded / gaps when relevant.
 */
export function applyHardFilters(
  bottles: CellarBottleInput[],
  constraints: ExtractedConstraints,
  options?: { excludeReserved?: boolean }
): HardFilterResult {
  const excludeReserved = options?.excludeReserved === true;
  const applied: HardFilterSnapshot = {
    colors: [...constraints.colors],
    wantsKosher: constraints.wantsKosher === true,
    storageLocationHints: [...constraints.storageLocationHints],
    excludeReserved,
  };

  let pool = bottles;
  let reservedExcluded = 0;

  if (excludeReserved) {
    const kept = pool.filter((b) => b.isReserved);
    reservedExcluded = kept.length;
    pool = pool.filter((b) => !b.isReserved);
  }

  if (constraints.colors.length > 0) {
    const colors = new Set(constraints.colors.map((c) => c.toLowerCase()));
    pool = pool.filter((b) => {
      const bc = normalizeColor(b.color);
      return bc && colors.has(bc);
    });
  }

  if (constraints.wantsKosher === true) {
    pool = pool.filter((b) => b.isKosher === true);
  }

  if (constraints.storageLocationHints.length > 0) {
    pool = pool.filter((b) =>
      storageMatchesHint(b.storageLocation, constraints.storageLocationHints)
    );
  }

  // Data gaps measured on full scanned set (not only matched)
  const unknownKosherRows = bottles.filter(
    (b) => b.isKosher === null || b.isKosher === undefined
  ).length;

  const missingStorageLocationRows = bottles.filter(
    (b) => !b.storageLocation || !String(b.storageLocation).trim()
  ).length;

  // Among color-filtered (before kosher) unknowns — useful for kosher inventory messaging
  let colorPool = bottles;
  if (constraints.colors.length > 0) {
    const colors = new Set(constraints.colors.map((c) => c.toLowerCase()));
    colorPool = bottles.filter((b) => {
      const bc = normalizeColor(b.color);
      return bc && colors.has(bc);
    });
  }
  const unknownKosherAmongColor = colorPool.filter(
    (b) => b.isKosher === null || b.isKosher === undefined
  ).length;

  return {
    matched: pool,
    reservedExcluded,
    dataGaps: {
      unknownKosherRows,
      unknownKosherAmongFilteredColor:
        constraints.colors.length > 0 ? unknownKosherAmongColor : undefined,
      missingStorageLocationRows,
      reservedExcluded,
    },
    applied,
  };
}

export function physicalCount(bottles: CellarBottleInput[]): number {
  return bottles.reduce(
    (sum, b) => sum + (typeof b.quantity === 'number' ? b.quantity : 1),
    0
  );
}

export function buildCellarAccessMeta(params: {
  scope: CellarAccessMeta['scope'];
  scannedBottleRows: number;
  scannedPhysicalBottles: number;
  matched: CellarBottleInput[];
  dataGaps: CellarAccessMeta['dataGaps'];
  hardFilters: HardFilterSnapshot;
  displayedBottleRows: number;
  selectionCap?: number;
  inventoryOffset?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
}): CellarAccessMeta {
  const matchedRows = params.matched.length;
  const matchedPhysical = physicalCount(params.matched);
  const listFullyDisplayed =
    params.displayedBottleRows >= matchedRows && matchedRows === params.displayedBottleRows;

  return {
    scope: params.scope,
    cellarScannedFully: true,
    listFullyDisplayed,
    truncated: false,
    scannedBottleRows: params.scannedBottleRows,
    scannedPhysicalBottles: params.scannedPhysicalBottles,
    matchedBottleRows: matchedRows,
    matchedPhysicalBottles: matchedPhysical,
    displayedBottleRows: params.displayedBottleRows,
    hardFilters: params.hardFilters,
    dataGaps: params.dataGaps,
    selectionCap: params.selectionCap,
    inventoryOffset: params.inventoryOffset ?? 0,
    hasMore: params.hasMore ?? false,
    nextOffset: params.nextOffset ?? null,
  };
}
