/**
 * Keep/Reserve → Web Push schedule helpers.
 * reserved_date is date-only; we fire at KEEP_NOTIFY_LOCAL_HOUR in the user's timezone.
 */

/** Local hour (0–23) when the Keep push fires on reserved_date. */
export const KEEP_NOTIFY_LOCAL_HOUR = 10;

export function keepClientTimerId(bottleId: string): string {
  return `keep_${bottleId}`;
}

function getZonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Convert a civil date/time in `timeZone` to a UTC Date.
 * Iterates to correct for the zone offset at that instant (DST-safe).
 */
export function zonedCivilTimeToUtc(
  year: number,
  month: number, // 1–12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const asIfUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    utcMs += desired - asIfUtc;
  }
  return new Date(utcMs);
}

/** Parse YYYY-MM-DD → fire_at ISO (UTC) at KEEP_NOTIFY_LOCAL_HOUR in timeZone. */
export function keepReminderFireAtIso(reservedDateYmd: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reservedDateYmd.trim());
  if (!match) {
    throw new Error(`Invalid reserved date: ${reservedDateYmd}`);
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return zonedCivilTimeToUtc(y, m, d, KEEP_NOTIFY_LOCAL_HOUR, 0, timeZone).toISOString();
}

export function isKeepFireAtInFuture(fireAtIso: string, nowMs: number = Date.now()): boolean {
  return new Date(fireAtIso).getTime() > nowMs;
}

/** Human-readable local notify time for UI copy. */
export function formatKeepNotifyWhen(
  reservedDateYmd: string,
  timeZone: string,
  locale: string,
): string {
  const fireAt = new Date(keepReminderFireAtIso(reservedDateYmd, timeZone));
  return fireAt.toLocaleString(locale, {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
