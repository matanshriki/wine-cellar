/**
 * Parse chosen bottle ids from DB JSONB — testable, no duplicated JSON hacks.
 */

export function parseChosenBottleIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
  }
  if (raw == null) return [];
  try {
    const s = JSON.stringify(raw);
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
    }
  } catch {
    /* ignore */
  }
  return [];
}
