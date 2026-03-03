/**
 * Timer Manager Hook
 * 
 * Manages wine-related timers (decant, rating reminders) with localStorage persistence.
 * Survives app refresh/close.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/SupabaseAuthContext';

export interface WineTimer {
  id: string;
  wine_id: string;
  wine_name: string;
  producer?: string;
  vintage?: number;
  started_at: number; // Unix timestamp ms
  duration_minutes: number;
  type: 'decant' | 'rate';
  label: string;
  plan_evening_id?: string;
  bottle_id?: string;
  image_url?: string;
}

interface TimerState {
  timers: WineTimer[];
  completedTimerIds: string[];
}

const STORAGE_KEY_PREFIX = 'wineTimers';

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function loadTimersFromStorage(userId: string): TimerState {
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        timers: parsed.timers || [],
        completedTimerIds: parsed.completedTimerIds || [],
      };
    }
  } catch (e) {
    console.warn('[TimerManager] Failed to load timers:', e);
  }
  return { timers: [], completedTimerIds: [] };
}

function saveTimersToStorage(userId: string, state: TimerState): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch (e) {
    console.warn('[TimerManager] Failed to save timers:', e);
  }
}

export function useTimerManager() {
  const { user } = useAuth();
  const [state, setState] = useState<TimerState>({ timers: [], completedTimerIds: [] });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load timers on mount
  useEffect(() => {
    if (user?.id) {
      const loaded = loadTimersFromStorage(user.id);
      setState(loaded);
    }
  }, [user?.id]);

  // Save timers whenever state changes
  useEffect(() => {
    if (user?.id) {
      saveTimersToStorage(user.id, state);
    }
  }, [user?.id, state]);

  // Tick every second to check for completed timers
  useEffect(() => {
    if (state.timers.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const newCompleted: string[] = [];

      state.timers.forEach((timer) => {
        const endTime = timer.started_at + timer.duration_minutes * 60 * 1000;
        if (now >= endTime && !state.completedTimerIds.includes(timer.id)) {
          newCompleted.push(timer.id);
        }
      });

      if (newCompleted.length > 0) {
        setState((prev) => ({
          ...prev,
          completedTimerIds: [...prev.completedTimerIds, ...newCompleted],
        }));
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.timers, state.completedTimerIds]);

  const createTimer = useCallback((timer: Omit<WineTimer, 'id' | 'started_at'>): WineTimer => {
    const newTimer: WineTimer = {
      ...timer,
      id: `${timer.type}-${timer.wine_id}-${Date.now()}`,
      started_at: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      timers: [...prev.timers, newTimer],
    }));
    return newTimer;
  }, []);

  const cancelTimer = useCallback((timerId: string) => {
    setState((prev) => ({
      timers: prev.timers.filter((t) => t.id !== timerId),
      completedTimerIds: prev.completedTimerIds.filter((id) => id !== timerId),
    }));
  }, []);

  const dismissCompletedTimer = useCallback((timerId: string) => {
    setState((prev) => ({
      timers: prev.timers.filter((t) => t.id !== timerId),
      completedTimerIds: prev.completedTimerIds.filter((id) => id !== timerId),
    }));
  }, []);

  const getActiveTimers = useCallback((): WineTimer[] => {
    return state.timers.filter((t) => !state.completedTimerIds.includes(t.id));
  }, [state]);

  const getCompletedTimers = useCallback((): WineTimer[] => {
    return state.timers.filter((t) => state.completedTimerIds.includes(t.id));
  }, [state]);

  const getTimerById = useCallback((timerId: string): WineTimer | undefined => {
    return state.timers.find((t) => t.id === timerId);
  }, [state]);

  const getRemainingTime = useCallback((timer: WineTimer): number => {
    const endTime = timer.started_at + timer.duration_minutes * 60 * 1000;
    const remaining = endTime - Date.now();
    return Math.max(0, remaining);
  }, []);

  const formatRemainingTime = useCallback((timer: WineTimer): string => {
    const remaining = getRemainingTime(timer);
    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [getRemainingTime]);

  const hasActiveTimers = state.timers.length > 0 && getActiveTimers().length > 0;
  const hasCompletedTimers = getCompletedTimers().length > 0;

  return {
    timers: state.timers,
    activeTimers: getActiveTimers(),
    completedTimers: getCompletedTimers(),
    hasActiveTimers,
    hasCompletedTimers,
    createTimer,
    cancelTimer,
    dismissCompletedTimer,
    getTimerById,
    getRemainingTime,
    formatRemainingTime,
  };
}
