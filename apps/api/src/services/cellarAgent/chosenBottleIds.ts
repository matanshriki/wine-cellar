/**
 * Parse chosen bottle ids from DB JSONB — testable, no duplicated JSON hacks.
 */

export function parseChosenBottleIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
  }
  return [];
}
