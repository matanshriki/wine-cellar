import { describe, expect, it } from 'vitest';
import {
  KEEP_NOTIFY_LOCAL_HOUR,
  formatKeepNotifyWhen,
  isKeepFireAtInFuture,
  keepClientTimerId,
  keepReminderFireAtIso,
  zonedCivilTimeToUtc,
} from './keepReminderSchedule';

describe('keepClientTimerId', () => {
  it('is stable per bottle (duplicate prevention key)', () => {
    expect(keepClientTimerId('abc-123')).toBe('keep_abc-123');
    expect(keepClientTimerId('abc-123')).toBe(keepClientTimerId('abc-123'));
  });
});

describe('zonedCivilTimeToUtc / keepReminderFireAtIso', () => {
  it('maps Asia/Jerusalem civil 10:00 to the expected UTC offset (winter)', () => {
    // 2026-01-15 is standard time in Israel (UTC+2)
    const iso = keepReminderFireAtIso('2026-01-15', 'Asia/Jerusalem');
    expect(iso).toBe('2026-01-15T08:00:00.000Z');
  });

  it('maps Asia/Jerusalem civil 10:00 in summer (IDT UTC+3)', () => {
    // 2026-07-15 is daylight time in Israel (UTC+3)
    const iso = keepReminderFireAtIso('2026-07-15', 'Asia/Jerusalem');
    expect(iso).toBe('2026-07-15T07:00:00.000Z');
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(iso));
    expect(parts.find((p) => p.type === 'hour')?.value).toBe('10');
    expect(parts.find((p) => p.type === 'minute')?.value).toBe('00');
  });

  it('maps America/New_York civil 10:00 in summer (EDT UTC-4)', () => {
    const iso = keepReminderFireAtIso('2026-07-15', 'America/New_York');
    expect(iso).toBe('2026-07-15T14:00:00.000Z');
  });

  it('keeps local 10:00 on US spring-forward Sunday (2026-03-08)', () => {
    // Clocks jump 02:00 → 03:00; 10:00 still exists and must map correctly.
    const iso = keepReminderFireAtIso('2026-03-08', 'America/New_York');
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(iso));
    const get = (t: string) => parts.find((p) => p.type === t)?.value;
    expect(get('year')).toBe('2026');
    expect(get('month')).toBe('03');
    expect(get('day')).toBe('08');
    expect(get('hour')).toBe('10');
    expect(get('minute')).toBe('00');
    // EDT after spring-forward → UTC-4 → 14:00Z
    expect(iso).toBe('2026-03-08T14:00:00.000Z');
  });

  it('keeps local 10:00 on US fall-back Sunday (2026-11-01)', () => {
    const iso = keepReminderFireAtIso('2026-11-01', 'America/New_York');
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(iso));
    expect(parts.find((p) => p.type === 'hour')?.value).toBe('10');
    // EST after fall-back → UTC-5 → 15:00Z
    expect(iso).toBe('2026-11-01T15:00:00.000Z');
  });

  it('handles date-line / late-evening local as next UTC calendar day when needed', () => {
    // Tokyo 10:00 on Jan 15 → 01:00 UTC same day
    const iso = keepReminderFireAtIso('2026-01-15', 'Asia/Tokyo');
    expect(iso).toBe('2026-01-15T01:00:00.000Z');
  });

  it('uses KEEP_NOTIFY_LOCAL_HOUR', () => {
    const d = zonedCivilTimeToUtc(2026, 6, 1, KEEP_NOTIFY_LOCAL_HOUR, 0, 'UTC');
    expect(d.toISOString()).toBe('2026-06-01T10:00:00.000Z');
  });

  it('rejects invalid reserved_date', () => {
    expect(() => keepReminderFireAtIso('15/01/2026', 'UTC')).toThrow(/Invalid reserved date/);
  });
});

describe('isKeepFireAtInFuture (no overdue backfill)', () => {
  it('returns false when fire_at is in the past', () => {
    const past = keepReminderFireAtIso('2020-01-01', 'UTC');
    expect(isKeepFireAtInFuture(past, Date.parse('2026-09-29T12:00:00Z'))).toBe(false);
  });

  it('returns true when fire_at is still ahead', () => {
    const future = keepReminderFireAtIso('2030-06-01', 'UTC');
    expect(isKeepFireAtInFuture(future, Date.parse('2026-09-29T12:00:00Z'))).toBe(true);
  });

  it('treats exactly-now as not future (do not send overdue)', () => {
    const iso = '2026-09-29T10:00:00.000Z';
    expect(isKeepFireAtInFuture(iso, Date.parse(iso))).toBe(false);
  });
});

describe('formatKeepNotifyWhen', () => {
  it('includes a readable local time for the UI', () => {
    const label = formatKeepNotifyWhen('2026-01-15', 'UTC', 'en-US');
    expect(label.toLowerCase()).toMatch(/jan/);
    expect(label).toMatch(/10/);
  });
});
