/**
 * Timer Context
 * 
 * Provides global timer state for wine rituals (decant, rating reminders).
 */

import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './SupabaseAuthContext';

export interface WineTimer {
  id: string;
  wine_id: string;
  wine_name: string;
  producer?: string;
  vintage?: number;
  started_at: number;
  duration_minutes: number;
  type: 'decant' | 'rate';
  label: string;
  plan_evening_id?: string;
  bottle_id?: string;
  image_url?: string;
}

interface TimerContextValue {
  timers: WineTimer[];
  activeTimers: WineTimer[];
  completedTimers: WineTimer[];
  hasActiveTimers: boolean;
  hasCompletedTimers: boolean;
  createTimer: (timer: Omit<WineTimer, 'id' | 'started_at'>) => WineTimer;
  cancelTimer: (timerId: string) => void;
  dismissCompletedTimer: (timerId: string) => void;
  getTimerById: (timerId: string) => WineTimer | undefined;
  getRemainingTime: (timer: WineTimer) => number;
  formatRemainingTime: (timer: WineTimer) => string;
  tick: number; // Force re-render every second
}

const TimerContext = createContext<TimerContextValue | null>(null);

const STORAGE_KEY_PREFIX = 'wineTimers';

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

interface TimerState {
  timers: WineTimer[];
  completedTimerIds: string[];
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
    console.warn('[TimerContext] Failed to load timers:', e);
  }
  return { timers: [], completedTimerIds: [] };
}

function saveTimersToStorage(userId: string, state: TimerState): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch (e) {
    console.warn('[TimerContext] Failed to save timers:', e);
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<TimerState>({ timers: [], completedTimerIds: [] });
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load timers on mount/user change
  useEffect(() => {
    if (user?.id) {
      const loaded = loadTimersFromStorage(user.id);
      setState(loaded);
    } else {
      setState({ timers: [], completedTimerIds: [] });
    }
  }, [user?.id]);

  // Save timers whenever state changes
  useEffect(() => {
    if (user?.id) {
      saveTimersToStorage(user.id, state);
    }
  }, [user?.id, state]);

  // Tick every second
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
      
      // Check for newly completed timers
      const now = Date.now();
      setState((prev) => {
        const newCompleted: string[] = [];
        prev.timers.forEach((timer) => {
          const endTime = timer.started_at + timer.duration_minutes * 60 * 1000;
          if (now >= endTime && !prev.completedTimerIds.includes(timer.id)) {
            newCompleted.push(timer.id);
          }
        });
        if (newCompleted.length > 0) {
          return {
            ...prev,
            completedTimerIds: [...prev.completedTimerIds, ...newCompleted],
          };
        }
        return prev;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

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

  const activeTimers = getActiveTimers();
  const completedTimers = getCompletedTimers();

  const value: TimerContextValue = {
    timers: state.timers,
    activeTimers,
    completedTimers,
    hasActiveTimers: activeTimers.length > 0,
    hasCompletedTimers: completedTimers.length > 0,
    createTimer,
    cancelTimer,
    dismissCompletedTimer,
    getTimerById,
    getRemainingTime,
    formatRemainingTime,
    tick,
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimers(): TimerContextValue {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimers must be used within a TimerProvider');
  }
  return context;
}
