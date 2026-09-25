/**
 * Authenticated full in-stock cellar load (user JWT + RLS).
 * Source of truth for Sommi inventory and hard-filter recommendations.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CellarBottleInput } from './types.js';

const PAGE_SIZE = 500;

type WineRow = {
  producer?: string | null;
  wine_name?: string | null;
  vintage?: number | null;
  region?: string | null;
  country?: string | null;
  grapes?: string | string[] | null;
  color?: string | null;
  vivino_rating?: number | null;
  is_kosher?: boolean | null;
  kosher_confidence?: string | null;
  translations?: {
    he?: { wine_name?: string; producer?: string; region?: string };
  } | null;
};

type BottleRow = {
  id: string;
  quantity: number;
  purchase_price?: number | null;
  purchase_price_currency?: string | null;
  storage_location?: string | null;
  drink_window_start?: number | null;
  drink_window_end?: number | null;
  readiness_status?: string | null;
  notes?: string | null;
  is_reserved?: boolean | null;
  reserved_for?: string | null;
  wine?: WineRow | WineRow[] | null;
};

function wineOf(row: BottleRow): WineRow | null {
  const w = row.wine;
  if (!w) return null;
  return Array.isArray(w) ? w[0] ?? null : w;
}

export function mapBottleRowToInput(row: BottleRow): CellarBottleInput {
  const wine = wineOf(row);
  const he = wine?.translations?.he;
  return {
    id: row.id,
    producer: wine?.producer ?? undefined,
    wineName: wine?.wine_name ?? undefined,
    vintage: wine?.vintage ?? undefined,
    region: wine?.region ?? undefined,
    country: wine?.country ?? undefined,
    grapes: wine?.grapes ?? undefined,
    color: wine?.color ?? undefined,
    drinkWindowStart: row.drink_window_start ?? undefined,
    drinkWindowEnd: row.drink_window_end ?? undefined,
    readinessStatus: row.readiness_status ?? undefined,
    notes: row.notes ?? undefined,
    quantity: row.quantity,
    purchasePrice: row.purchase_price ?? undefined,
    purchasePriceCurrency: row.purchase_price_currency ?? undefined,
    storageLocation: row.storage_location ?? null,
    ...(row.is_reserved ? { isReserved: true } : {}),
    ...(row.reserved_for ? { reservedFor: row.reserved_for } : {}),
    ...(he?.producer && { producerHe: he.producer }),
    ...(he?.wine_name && { wineNameHe: he.wine_name }),
    ...(he?.region && { regionHe: he.region }),
    ...(wine && 'is_kosher' in wine && { isKosher: wine.is_kosher ?? null }),
    ...(wine?.kosher_confidence != null && {
      kosherConfidence: wine.kosher_confidence,
    }),
  };
}

export interface LoadedCellarInventory {
  bottles: CellarBottleInput[];
  scannedBottleRows: number;
  scannedPhysicalBottles: number;
}

/**
 * Load every in-stock bottle row for the authenticated user (quantity > 0).
 * Paginates until exhausted so large cellars are never silently truncated.
 */
export async function loadInStockCellar(
  userId: string,
  supabase: SupabaseClient
): Promise<LoadedCellarInventory> {
  const bottles: CellarBottleInput[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('bottles')
      .select(
        `
        id,
        quantity,
        purchase_price,
        purchase_price_currency,
        storage_location,
        drink_window_start,
        drink_window_end,
        readiness_status,
        notes,
        is_reserved,
        reserved_for,
        wine:wines(
          producer,
          wine_name,
          vintage,
          region,
          country,
          grapes,
          color,
          is_kosher,
          kosher_confidence,
          translations
        )
      `
      )
      .eq('user_id', userId)
      .gt('quantity', 0)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`cellar_load_failed:${error.message}`);
    }

    const rows = (data ?? []) as BottleRow[];
    for (const row of rows) {
      bottles.push(mapBottleRowToInput(row));
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const scannedPhysicalBottles = bottles.reduce(
    (sum, b) => sum + (typeof b.quantity === 'number' ? b.quantity : 1),
    0
  );

  return {
    bottles,
    scannedBottleRows: bottles.length,
    scannedPhysicalBottles,
  };
}

/** Merge optional client history fields onto server-loaded bottles by id. */
export function mergeClientHistoryOntoCellar(
  serverBottles: CellarBottleInput[],
  clientBottles: CellarBottleInput[] | undefined
): CellarBottleInput[] {
  if (!clientBottles?.length) return serverBottles;
  const byId = new Map(clientBottles.map((b) => [b.id, b]));
  return serverBottles.map((b) => {
    const c = byId.get(b.id);
    if (!c) return b;
    return {
      ...b,
      pastOpeningsCount: c.pastOpeningsCount ?? b.pastOpeningsCount,
      pastOpeningsAvgRating: c.pastOpeningsAvgRating ?? b.pastOpeningsAvgRating,
      pastOpeningsRatingCount: c.pastOpeningsRatingCount ?? b.pastOpeningsRatingCount,
      pastNotesSummary: c.pastNotesSummary ?? b.pastNotesSummary,
    };
  });
}
