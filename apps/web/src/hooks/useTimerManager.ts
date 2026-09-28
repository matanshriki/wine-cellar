/**
 * useTimerManager
 *
 * Manages in-app decant / rate-reminder timers persisted to localStorage.
 * Countdown UI works without notification permission.
 * Server wine_reminders (absolute fire_at) drive closed-app Web Push delivery.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/safeLocalStorage';
import {
  cancelWineReminder,
  upsertWineReminder,
} from '../services/pushNotificationService';

export interface WineTimer {
  id: string;
  bottle_id: string;
  wine_id: string;
  wine_name: string;
  producer: string;
  /** ID of the consumption_history row created when the bottle was opened */
  history_id?: string;
  /** ISO timestamp when timer was started */
  started_at: string;
  duration_minutes: number;
  type: 'decant' | 'rate';
  label: string;
}

const STORAGE_PREFIX = 'activeTimers:';

function getKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function loadFromStorage(userId: string): WineTimer[] {
  try {
    const raw = safeGetItem(getKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as WineTimer[];
  } catch {
    return [];
  }
}

function saveToStorage(userId: string, timers: WineTimer[]) {
  safeSetItem(getKey(userId), JSON.stringify(timers));
}

function fireAtIso(timer: WineTimer): string {
  const endMs = new Date(timer.started_at).getTime() + timer.duration_minutes * 60_000;
  return new Date(endMs).toISOString();
}

async function persistServerReminder(userId: string, timer: WineTimer): Promise<void> {
  await upsertWineReminder({
    userId,
    clientTimerId: timer.id,
    reminderType: timer.type,
    fireAt: fireAtIso(timer),
    bottleId: timer.bottle_id,
    wineId: timer.wine_id,
    historyId: timer.history_id,
    wineName: timer.wine_name,
    producer: timer.producer,
  });
}

export function useTimerManager() {
  const [userId, setUserId] = useState<string | null>(null);
  const [timers, setTimers] = useState<WineTimer[]>([]);
  /** Increments every second to force derived value re-evaluation */
  const [tick, setTick] = useState(0);

  // Load user + timers; clear in-memory state on sign-out
  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (data.user) {
        setUserId(data.user.id);
        setTimers(loadFromStorage(data.user.id));
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setUserId(null);
        setTimers([]);
        return;
      }
      if (session.user) {
        setUserId(session.user.id);
        setTimers(loadFromStorage(session.user.id));
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Tick every second to update countdowns
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /** Timers that have not yet expired */
  const activeTimers = useMemo(() => {
    const now = Date.now();
    return timers.filter(t => {
      const end = new Date(t.started_at).getTime() + t.duration_minutes * 60_000;
      return end > now;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timers, tick]);

  /** Timers that just expired (in the last 5 minutes) and haven't been cleaned */
  const recentlyExpiredTimers = useMemo(() => {
    const now = Date.now();
    const fiveMin = 5 * 60_000;
    return timers.filter(t => {
      const end = new Date(t.started_at).getTime() + t.duration_minutes * 60_000;
      return end <= now && now - end < fiveMin;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timers, tick]);

  const createTimer = useCallback(
    (data: Omit<WineTimer, 'id'>): WineTimer => {
      if (!userId) throw new Error('Not authenticated');
      const timer: WineTimer = {
        ...data,
        id: `tmr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };
      setTimers(prev => {
        const next = [...prev, timer];
        saveToStorage(userId, next);
        return next;
      });

      // Server reminder (absolute fire_at) — delivery is Web Push cron, not SW setTimeout.
      // Failures are non-critical: in-app countdown still works.
      persistServerReminder(userId, timer).catch(err => {
        console.warn('[TimerManager] Server reminder persist failed:', err);
      });

      return timer;
    },
    [userId],
  );

  const cancelTimer = useCallback(
    (timerId: string) => {
      if (!userId) return;
      setTimers(prev => {
        const next = prev.filter(t => t.id !== timerId);
        saveToStorage(userId, next);
        return next;
      });
      cancelWineReminder(userId, timerId).catch(() => {});
    },
    [userId],
  );

  /** Remove a timer (used after user responds to expired notification) */
  const dismissTimer = useCallback(
    (timerId: string) => {
      if (!userId) return;
      setTimers(prev => {
        const next = prev.filter(t => t.id !== timerId);
        saveToStorage(userId, next);
        return next;
      });
      cancelWineReminder(userId, timerId).catch(() => {});
    },
    [userId],
  );

  /** Clear local timer storage for the signed-in user (call on sign-out). */
  const clearLocalTimers = useCallback(() => {
    if (userId) {
      safeRemoveItem(getKey(userId));
    }
    setTimers([]);
  }, [userId]);

  const getRemainingMs = useCallback(
    (timer: WineTimer): number => {
      const end = new Date(timer.started_at).getTime() + timer.duration_minutes * 60_000;
      return Math.max(0, end - Date.now());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );

  const formatCountdown = useCallback(
    (timer: WineTimer): string => {
      const ms = getRemainingMs(timer);
      const totalSec = Math.ceil(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    },
    [getRemainingMs],
  );

  return {
    activeTimers,
    recentlyExpiredTimers,
    allTimers: timers,
    userId,
    createTimer,
    cancelTimer,
    dismissTimer,
    clearLocalTimers,
    getRemainingMs,
    formatCountdown,
  };
}
