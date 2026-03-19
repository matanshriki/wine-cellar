/**
 * useTimerManager
 *
 * Manages in-app decant / rate-reminder timers persisted to localStorage.
 * Survives page refresh and app-close cycles.
 * Keyed per user: `activeTimers:<userId>`
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

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

// ── OS notification helpers ────────────────────────────────────────────────────

/** Returns true if the browser supports notifications and SW messaging */
function notificationsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

/**
 * Requests notification permission if not already granted.
 * Must be called from within a user-gesture handler (button click etc.)
 * Returns true if permission is now granted.
 */
async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/** Posts a SCHEDULE_NOTIFICATION message to the active service worker */
async function scheduleOSNotification(timer: WineTimer): Promise<void> {
  if (!notificationsSupported()) return;
  if (Notification.permission !== 'granted') return;

  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg?.active) return;

  const endMs = new Date(timer.started_at).getTime() + timer.duration_minutes * 60_000;
  const delayMs = endMs - Date.now();
  if (delayMs <= 0) return;

  const isRate = timer.type === 'rate';
  const title = isRate ? '⭐ Time to rate your wine!' : '🫙 Decanting complete!';
  const body = isRate
    ? `How was ${timer.producer} ${timer.wine_name}? Open the app to rate it.`
    : `${timer.producer} ${timer.wine_name} is ready to pour.`;

  reg.active.postMessage({
    type: 'SCHEDULE_NOTIFICATION',
    timerId: timer.id,
    title,
    body,
    delayMs,
    tag: `wine-timer-${timer.id}`,
  });
}

/** Cancels a previously scheduled OS notification */
async function cancelOSNotification(timerId: string): Promise<void> {
  if (!notificationsSupported()) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  reg?.active?.postMessage({ type: 'CANCEL_NOTIFICATION', timerId });
}

function getKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function loadFromStorage(userId: string): WineTimer[] {
  try {
    const raw = localStorage.getItem(getKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as WineTimer[];
  } catch {
    return [];
  }
}

function saveToStorage(userId: string, timers: WineTimer[]) {
  try {
    localStorage.setItem(getKey(userId), JSON.stringify(timers));
  } catch {
    // Silently ignore storage errors
  }
}

export function useTimerManager() {
  const [userId, setUserId] = useState<string | null>(null);
  const [timers, setTimers] = useState<WineTimer[]>([]);
  /** Increments every second to force derived value re-evaluation */
  const [tick, setTick] = useState(0);

  // Load user + timers on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        setTimers(loadFromStorage(data.user.id));
      }
    });
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

      // Request OS notification permission (requires user-gesture context) then
      // schedule a native notification for when this timer expires.
      requestNotificationPermission().then(granted => {
        if (granted) scheduleOSNotification(timer);
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
      cancelOSNotification(timerId);
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
      cancelOSNotification(timerId);
    },
    [userId],
  );

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
    createTimer,
    cancelTimer,
    dismissTimer,
    getRemainingMs,
    formatCountdown,
  };
}
