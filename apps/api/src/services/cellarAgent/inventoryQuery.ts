/**
 * Deterministic inventory listing — LLM must not select, omit, or count results.
 */

import type {
  BottleListBottle,
  CellarAccessMeta,
  CellarBottleInput,
  ExtractedConstraints,
  HardFilterSnapshot,
} from './types.js';
import {
  applyHardFilters,
  buildCellarAccessMeta,
  isFridgeHint,
  physicalCount,
} from './hardFilters.js';

/** Max bottles returned in one inventory page (UI can request next page). */
export const INVENTORY_PAGE_SIZE = 50;

export function sliceInventoryPage(
  matched: CellarBottleInput[],
  offset: number,
  pageSize = INVENTORY_PAGE_SIZE
): {
  page: CellarBottleInput[];
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
} {
  const safeOffset = Math.max(0, Math.min(offset, matched.length));
  const page = matched.slice(safeOffset, safeOffset + pageSize);
  const next = safeOffset + page.length;
  const hasMore = next < matched.length;
  return {
    page,
    offset: safeOffset,
    hasMore,
    nextOffset: hasMore ? next : null,
  };
}

export function bottleToInventoryListItem(b: CellarBottleInput): BottleListBottle {
  const keepNote = b.isReserved
    ? b.reservedFor
      ? `Keep (${b.reservedFor})`
      : 'Keep'
    : null;
  const kosherNote =
    b.isKosher === true
      ? 'Kosher'
      : b.isKosher === false
        ? 'Not kosher'
        : 'Kosher unknown';
  const loc = b.storageLocation?.trim();
  const parts = [kosherNote, loc ? `Storage: ${loc}` : null, keepNote].filter(Boolean);

  return {
    bottleId: b.id,
    name: b.wineName || 'Unknown',
    producer: b.producer || 'Unknown',
    vintage: b.vintage ?? null,
    region: b.region ?? null,
    rating: null,
    readinessStatus: b.readinessStatus ?? null,
    serveTempC: null,
    decantMinutes: null,
    shortWhy: parts.join(' · ') || 'In stock',
    isReserved: b.isReserved === true,
    reservedFor: b.reservedFor,
    isKosher: b.isKosher ?? null,
    storageLocation: b.storageLocation ?? null,
    quantity: b.quantity,
  };
}

function filterDescription(constraints: ExtractedConstraints, language?: string): string {
  const he = language === 'he';
  const bits: string[] = [];
  if (constraints.wantsKosher) bits.push(he ? 'כשר' : 'kosher');
  if (constraints.colors.includes('red')) bits.push(he ? 'אדום' : 'red');
  if (constraints.colors.includes('white')) bits.push(he ? 'לבן' : 'white');
  if (constraints.colors.includes('rose')) bits.push(he ? 'רוזה' : 'rosé');
  if (constraints.colors.includes('sparkling')) bits.push(he ? 'תוסס' : 'sparkling');
  if (isFridgeHint(constraints.storageLocationHints)) {
    bits.push(he ? 'במקרר' : 'in the fridge');
  } else if (constraints.storageLocationHints.length) {
    bits.push(
      he
        ? `במיקום: ${constraints.storageLocationHints.join(', ')}`
        : `at: ${constraints.storageLocationHints.join(', ')}`
    );
  }
  if (!bits.length) return he ? 'במלאי' : 'in stock';
  return bits.join(he ? ' ' : ' ');
}

export function buildInventoryMessage(params: {
  meta: CellarAccessMeta;
  constraints: ExtractedConstraints;
  language?: string;
}): string {
  const he = params.language === 'he';
  const { meta, constraints } = params;
  const desc = filterDescription(constraints, params.language);
  const matched = meta.matchedBottleRows;
  const displayed = meta.displayedBottleRows;
  const scanned = meta.scannedBottleRows;
  const gaps = meta.dataGaps;

  const lines: string[] = [];

  if (he) {
    lines.push(
      `סרקתי את כל המרתף במלאי (${scanned} רשומות). נמצאו ${matched} התאמות לסינון (${desc}).`
    );
    if (displayed < matched) {
      lines.push(
        `מציג ${displayed} מתוך ${matched}. אפשר לבקש "הצג את השאר" לראות את המשך הרשימה.`
      );
    } else {
      lines.push(`זו הרשימה המלאה של ההתאמות (${matched}).`);
    }
    if (constraints.wantsKosher && (gaps.unknownKosherAmongFilteredColor ?? gaps.unknownKosherRows) > 0) {
      const u = gaps.unknownKosherAmongFilteredColor ?? gaps.unknownKosherRows;
      lines.push(
        `${u} יינות${constraints.colors.length ? ' בצבע המבוקש' : ''} עדיין ללא סטטוס כשרות במערכת (לא נספרו ככשרים).`
      );
    }
    if (isFridgeHint(constraints.storageLocationHints) && gaps.missingStorageLocationRows > 0) {
      lines.push(
        `${gaps.missingStorageLocationRows} בקבוקים ללא מיקום אחסון רשום — לא ניתן לדעת אם הם במקרר.`
      );
    }
    if (matched === 0) {
      lines.push('לא נמצאו בקבוקים שתואמים את הסינון.');
    }
  } else {
    lines.push(
      `I scanned your full in-stock cellar (${scanned} bottle records). ${matched} match your filter (${desc}).`
    );
    if (displayed < matched) {
      lines.push(
        `Showing ${displayed} of ${matched}. Say “show the rest” to see the next page.`
      );
    } else {
      lines.push(`This is the complete matching list (${matched}).`);
    }
    if (constraints.wantsKosher && (gaps.unknownKosherAmongFilteredColor ?? gaps.unknownKosherRows) > 0) {
      const u = gaps.unknownKosherAmongFilteredColor ?? gaps.unknownKosherRows;
      lines.push(
        `${u} wine${u === 1 ? '' : 's'}${constraints.colors.length ? ' in that color' : ''} still have unknown kosher status and were not counted as kosher.`
      );
    }
    if (isFridgeHint(constraints.storageLocationHints) && gaps.missingStorageLocationRows > 0) {
      lines.push(
        `${gaps.missingStorageLocationRows} bottle${gaps.missingStorageLocationRows === 1 ? '' : 's'} have no recorded storage location — I can’t tell if those are in the fridge.`
      );
    }
    if (matched === 0) {
      lines.push('No bottles matched this filter.');
    }
  }

  return lines.join(' ');
}

export function buildDeterministicInventoryResponse(params: {
  cellarBottles: CellarBottleInput[];
  scannedBottleRows: number;
  scannedPhysicalBottles: number;
  constraints: ExtractedConstraints;
  offset?: number;
  language?: string;
  pageSize?: number;
}): {
  response: Record<string, unknown>;
  meta: CellarAccessMeta;
  matched: CellarBottleInput[];
} {
  // Inventory always includes Keep — show status, never silently drop
  const { matched, dataGaps, applied } = applyHardFilters(
    params.cellarBottles,
    params.constraints,
    { excludeReserved: false }
  );

  return buildDeterministicInventoryFromMatched({
    matched,
    scannedBottleRows: params.scannedBottleRows,
    scannedPhysicalBottles: params.scannedPhysicalBottles,
    constraints: params.constraints,
    hardFilters: applied,
    dataGaps,
    offset: params.offset,
    language: params.language,
    pageSize: params.pageSize,
    scope: 'filtered_full',
  });
}

/** Build inventory list from a precomputed match set (e.g. similar-to-anchor). */
export function buildDeterministicInventoryFromMatched(params: {
  matched: CellarBottleInput[];
  scannedBottleRows: number;
  scannedPhysicalBottles: number;
  constraints: ExtractedConstraints;
  hardFilters: HardFilterSnapshot;
  dataGaps: CellarAccessMeta['dataGaps'];
  offset?: number;
  language?: string;
  pageSize?: number;
  scope?: CellarAccessMeta['scope'];
}): {
  response: Record<string, unknown>;
  meta: CellarAccessMeta;
  matched: CellarBottleInput[];
} {
  const matched = params.matched;
  const pageSize = params.pageSize ?? INVENTORY_PAGE_SIZE;
  const { page, offset, hasMore, nextOffset } = sliceInventoryPage(
    matched,
    params.offset ?? 0,
    pageSize
  );

  const meta = buildCellarAccessMeta({
    scope: params.scope ?? 'filtered_full',
    scannedBottleRows: params.scannedBottleRows,
    scannedPhysicalBottles: params.scannedPhysicalBottles,
    matched,
    dataGaps: params.dataGaps,
    hardFilters: params.hardFilters,
    displayedBottleRows: page.length,
    inventoryOffset: offset,
    hasMore,
    nextOffset,
  });

  const bottles = page.map(bottleToInventoryListItem);
  const title =
    params.language === 'he'
      ? `התאמות במרתף (${meta.matchedBottleRows})`
      : `Cellar matches (${meta.matchedBottleRows})`;

  const response: Record<string, unknown> = {
    type: 'bottle_list',
    title,
    message: buildInventoryMessage({
      meta,
      constraints: params.constraints,
      language: params.language,
    }),
    bottles,
    inventory: {
      matchedCount: meta.matchedBottleRows,
      matchedPhysicalBottles: physicalCount(matched),
      displayedCount: page.length,
      hasMore,
      nextOffset,
      cellarScannedFully: true,
      listFullyDisplayed: meta.listFullyDisplayed,
    },
  };

  if (hasMore) {
    response.followUpQuestion =
      params.language === 'he'
        ? 'להציג את המשך הרשימה?'
        : 'Want me to show the next page of matches?';
  }

  return { response, meta, matched };
}
