import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsertMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const inMock = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: upsertMock,
      update: updateMock,
    })),
  },
}));

import {
  syncKeepPushReminder,
  cancelKeepPushReminder,
} from '../services/pushNotificationService';

function mockCancelChain() {
  inMock.mockResolvedValue({ error: null });
  // update().eq().eq().in()
  eqMock.mockImplementation(() => ({
    eq: eqMock,
    in: inMock,
  }));
  updateMock.mockReturnValue({ eq: eqMock });
}

describe('syncKeepPushReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertMock.mockResolvedValue({ error: null });
    mockCancelChain();
  });

  const base = {
    userId: 'user-1',
    bottleId: 'bottle-1',
    wineId: 'wine-1',
    wineName: 'Test Wine',
    producer: 'Test Producer',
  };

  it('schedules a future keep reminder with keep_<bottleId>', async () => {
    const result = await syncKeepPushReminder({
      ...base,
      isReserved: true,
      reservedDate: '2030-06-01',
      timeZone: 'UTC',
      nowMs: Date.parse('2026-09-29T12:00:00Z'),
    });
    expect(result.scheduled).toBe(true);
    if (result.scheduled) {
      expect(result.clientTimerId).toBe('keep_bottle-1');
      expect(result.fireAtIso).toBe('2030-06-01T10:00:00.000Z');
    }
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_timer_id: 'keep_bottle-1',
        reminder_type: 'keep',
        fire_at: '2030-06-01T10:00:00.000Z',
        status: 'pending',
        bottle_id: 'bottle-1',
      }),
      { onConflict: 'user_id,client_timer_id' },
    );
  });

  it('replaces pending reminder when date changes (same client_timer_id)', async () => {
    await syncKeepPushReminder({
      ...base,
      isReserved: true,
      reservedDate: '2030-07-15',
      timeZone: 'UTC',
      nowMs: Date.parse('2026-09-29T12:00:00Z'),
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_timer_id: 'keep_bottle-1',
        fire_at: '2030-07-15T10:00:00.000Z',
      }),
      expect.anything(),
    );
  });

  it('cancels when reservation cleared (no duplicate leftover)', async () => {
    const result = await syncKeepPushReminder({
      ...base,
      isReserved: false,
      reservedDate: null,
      nowMs: Date.parse('2026-09-29T12:00:00Z'),
    });
    expect(result).toEqual({
      scheduled: false,
      reason: 'cleared',
      clientTimerId: 'keep_bottle-1',
    });
    expect(upsertMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({ status: 'canceled' });
  });

  it('cancels and does not schedule overdue / past reserved_date', async () => {
    const result = await syncKeepPushReminder({
      ...base,
      isReserved: true,
      reservedDate: '2020-01-01',
      timeZone: 'UTC',
      nowMs: Date.parse('2026-09-29T12:00:00Z'),
    });
    expect(result.scheduled).toBe(false);
    if (!result.scheduled) expect(result.reason).toBe('past');
    expect(upsertMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalled();
  });

  it('timezone boundary: still future just before local 10:00', async () => {
    const result = await syncKeepPushReminder({
      ...base,
      isReserved: true,
      reservedDate: '2026-01-15',
      timeZone: 'Asia/Jerusalem',
      nowMs: Date.parse('2026-01-15T07:59:00Z'),
    });
    expect(result.scheduled).toBe(true);
  });

  it('timezone boundary: past after local 10:00', async () => {
    const result = await syncKeepPushReminder({
      ...base,
      isReserved: true,
      reservedDate: '2026-01-15',
      timeZone: 'Asia/Jerusalem',
      nowMs: Date.parse('2026-01-15T08:01:00Z'),
    });
    expect(result.scheduled).toBe(false);
    if (!result.scheduled) expect(result.reason).toBe('past');
  });
});

describe('cancelKeepPushReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCancelChain();
  });

  it('cancels keep_<bottleId>', async () => {
    await cancelKeepPushReminder('user-1', 'bottle-99');
    expect(updateMock).toHaveBeenCalledWith({ status: 'canceled' });
    expect(eqMock).toHaveBeenCalledWith('client_timer_id', 'keep_bottle-99');
  });
});
