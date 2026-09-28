/**
 * OpenRitualContext
 *
 * Global provider for the "Open Bottle Ritual" flow.
 * Renders OpenRitualSheet and FloatingTimerPill globally so any page can
 * trigger the ritual via `useOpenRitual().openRitual(bottle, opts)`.
 *
 * Also handles Web Push deep links (?reminder=rate|decant&…) including cold start.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { BottleWithWineInfo } from '../services/bottleService';
import { useTimerManager } from '../hooks/useTimerManager';
import { OpenRitualSheet } from '../components/OpenRitualSheet';
import { FloatingTimerPill } from '../components/FloatingTimerPill';
import { RateRitualSheet } from '../components/RateRitualSheet';
import { NotificationEnableCard } from '../components/NotificationEnableCard';

interface OpenRitualOptions {
  occasion?: string;
  mealType?: string;
  vibe?: string;
  /** Called after successful open with the history row id */
  onComplete?: (historyId: string) => void;
}

interface OpenRitualContextValue {
  openRitual: (bottle: BottleWithWineInfo, opts?: OpenRitualOptions) => void;
  isRitualOpen: boolean;
}

const OpenRitualContext = createContext<OpenRitualContextValue | null>(null);

type PushRateTarget = {
  historyId: string;
  wineName: string;
  producer: string;
};

type PushDecantAlert = {
  bottleId: string | null;
  wineName: string;
  producer: string;
};

function readPushParams(search: string): {
  rate: PushRateTarget | null;
  decant: PushDecantAlert | null;
} {
  const params = new URLSearchParams(search);
  const reminder = params.get('reminder');
  if (reminder === 'rate') {
    const historyId = params.get('historyId');
    if (historyId) {
      return {
        rate: {
          historyId,
          wineName: params.get('wineName') || 'Wine',
          producer: params.get('producer') || '',
        },
        decant: null,
      };
    }
  }
  if (reminder === 'decant') {
    return {
      rate: null,
      decant: {
        bottleId: params.get('bottleId'),
        wineName: params.get('wineName') || 'Wine',
        producer: params.get('producer') || '',
      },
    };
  }
  return { rate: null, decant: null };
}

export function OpenRitualProvider({ children }: { children: React.ReactNode }) {
  const timerManager = useTimerManager();
  const location = useLocation();
  const navigate = useNavigate();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [bottle, setBottle] = useState<BottleWithWineInfo | null>(null);
  const [opts, setOpts] = useState<OpenRitualOptions>({});

  const [pushRate, setPushRate] = useState<PushRateTarget | null>(null);
  const [pushDecant, setPushDecant] = useState<PushDecantAlert | null>(null);

  const openRitual = useCallback((b: BottleWithWineInfo, options: OpenRitualOptions = {}) => {
    setBottle(b);
    setOpts(options);
    setSheetOpen(true);
  }, []);

  function handleClose() {
    setSheetOpen(false);
  }

  function handleComplete(historyId: string) {
    opts.onComplete?.(historyId);
  }

  // Cold start / notification tap: open rate sheet or decant-ready alert
  useEffect(() => {
    const { rate, decant } = readPushParams(location.search);
    if (!rate && !decant) return;

    if (rate) setPushRate(rate);
    if (decant) setPushDecant(decant);

    // Strip query so refresh does not re-open; keep path (usually /cellar)
    const path = location.pathname || '/cellar';
    navigate(path, { replace: true });
  }, [location.search, location.pathname, navigate]);

  const hasActiveTimers = timerManager.activeTimers.length > 0;

  return (
    <OpenRitualContext.Provider value={{ openRitual, isRitualOpen: sheetOpen }}>
      {children}

      <OpenRitualSheet
        isOpen={sheetOpen}
        onClose={handleClose}
        bottle={bottle}
        occasion={opts.occasion}
        mealType={opts.mealType}
        vibe={opts.vibe}
        onComplete={handleComplete}
        createTimer={timerManager.createTimer}
      />

      <FloatingTimerPill
        activeTimers={timerManager.activeTimers}
        recentlyExpiredTimers={timerManager.recentlyExpiredTimers}
        formatCountdown={timerManager.formatCountdown}
        getRemainingMs={timerManager.getRemainingMs}
        cancelTimer={timerManager.cancelTimer}
        dismissTimer={timerManager.dismissTimer}
      />

      {/* Nudge to enable Web Push while a timer is running */}
      {hasActiveTimers && (
        <div
          className="fixed left-4 right-4 z-[54]"
          style={{
            bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 0px) + 148px)',
          }}
        >
          <NotificationEnableCard userId={timerManager.userId} compact />
        </div>
      )}

      {/* Push deep link → rate */}
      {pushRate && (
        <RateRitualSheet
          isOpen
          onClose={() => setPushRate(null)}
          historyId={pushRate.historyId}
          wineName={pushRate.wineName}
          producer={pushRate.producer}
        />
      )}

      {/* Push deep link → decant ready */}
      {pushDecant && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-5">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            aria-label="Close"
            onClick={() => setPushDecant(null)}
          />
          <div
            className="relative w-full max-w-sm rounded-3xl p-6 text-center"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <div className="text-5xl mb-3">🍷</div>
            <h3
              className="text-lg font-bold mb-1"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              Decant ready
            </h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              <strong>{pushDecant.wineName}</strong>
              {pushDecant.producer ? ` · ${pushDecant.producer}` : ''} is ready to pour.
            </p>
            <button
              type="button"
              onClick={() => setPushDecant(null)}
              className="w-full py-3.5 rounded-xl font-semibold text-sm text-white"
              style={{ background: 'var(--wine-600)' }}
            >
              Enjoy!
            </button>
          </div>
        </div>
      )}
    </OpenRitualContext.Provider>
  );
}

/** Hook to trigger the open ritual from any component */
export function useOpenRitual(): OpenRitualContextValue {
  const ctx = useContext(OpenRitualContext);
  if (!ctx) {
    throw new Error('useOpenRitual must be used within <OpenRitualProvider>');
  }
  return ctx;
}
