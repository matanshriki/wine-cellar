/**
 * OpenRitualContext
 *
 * Global provider for the "Open Bottle Ritual" flow.
 * Renders OpenRitualSheet and FloatingTimerPill globally so any page can
 * trigger the ritual via `useOpenRitual().openRitual(bottle, opts)`.
 *
 * Timer state (useTimerManager) lives here so it's shared between the sheet
 * and the floating pill – avoiding duplication.
 */

import { createContext, useCallback, useContext, useState } from 'react';
import type { BottleWithWineInfo } from '../services/bottleService';
import { useTimerManager } from '../hooks/useTimerManager';
import { OpenRitualSheet } from '../components/OpenRitualSheet';
import { FloatingTimerPill } from '../components/FloatingTimerPill';

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

export function OpenRitualProvider({ children }: { children: React.ReactNode }) {
  const timerManager = useTimerManager();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [bottle, setBottle] = useState<BottleWithWineInfo | null>(null);
  const [opts, setOpts] = useState<OpenRitualOptions>({});

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

  return (
    <OpenRitualContext.Provider value={{ openRitual, isRitualOpen: sheetOpen }}>
      {children}

      {/* Global open ritual sheet */}
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

      {/* Persistent floating timer pill */}
      <FloatingTimerPill
        activeTimers={timerManager.activeTimers}
        recentlyExpiredTimers={timerManager.recentlyExpiredTimers}
        formatCountdown={timerManager.formatCountdown}
        getRemainingMs={timerManager.getRemainingMs}
        cancelTimer={timerManager.cancelTimer}
        dismissTimer={timerManager.dismissTimer}
      />
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
