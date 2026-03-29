/**
 * Wine Pour Transition
 *
 * Premium animation overlay that creates a subtle wine-pouring effect
 * when switching between light (white wine) and dark (red wine) themes.
 * Uses only transforms and opacity for GPU-accelerated performance.
 * Blur softens the gradient into an atmospheric color wash.
 */

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Theme } from '../contexts/ThemeContext';

interface WinePourContextType {
  triggerPour: (targetTheme: Theme, applyTheme: () => void) => void;
}

const WinePourContext = createContext<WinePourContextType | undefined>(undefined);

export function useWinePour() {
  return useContext(WinePourContext);
}

const THEME_SWITCH_DELAY = 150;
const OVERLAY_DURATION = 420;

const WINE_COLORS = {
  red: {
    pour: 'rgba(100, 18, 38, 0.62)',
    mid: 'rgba(78, 14, 30, 0.34)',
    edge: 'rgba(60, 10, 24, 0.10)',
    shimmer: 'rgba(155, 42, 62, 0.10)',
  },
  white: {
    pour: 'rgba(210, 185, 125, 0.55)',
    mid: 'rgba(225, 205, 155, 0.28)',
    edge: 'rgba(240, 228, 196, 0.08)',
    shimmer: 'rgba(248, 238, 215, 0.14)',
  },
} as const;

// Smooth deceleration — liquid settling into a glass
const POUR_EASE = [0.16, 1, 0.3, 1] as const;

export function WinePourProvider({ children }: { children: ReactNode }) {
  const [pourTarget, setPourTarget] = useState<Theme | null>(null);
  const pouringRef = useRef(false);

  const triggerPour = useCallback((target: Theme, applyTheme: () => void) => {
    if (pouringRef.current) {
      applyTheme();
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyTheme();
      return;
    }

    pouringRef.current = true;
    setPourTarget(target);

    setTimeout(applyTheme, THEME_SWITCH_DELAY);

    setTimeout(() => {
      setPourTarget(null);
      pouringRef.current = false;
    }, OVERLAY_DURATION);
  }, []);

  return (
    <WinePourContext.Provider value={{ triggerPour }}>
      {children}
      <AnimatePresence>
        {pourTarget !== null && (
          <WinePourOverlay key="wine-pour" targetTheme={pourTarget} />
        )}
      </AnimatePresence>
    </WinePourContext.Provider>
  );
}

function WinePourOverlay({ targetTheme }: { targetTheme: Theme }) {
  const colors = WINE_COLORS[targetTheme];

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {/* Pour wash — blurred directional sweep from header area */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: '-8%',
          width: '116%',
          height: '120%',
          background: `linear-gradient(
            176deg,
            ${colors.pour} 0%,
            ${colors.mid} 30%,
            ${colors.edge} 55%,
            transparent 76%
          )`,
          filter: 'blur(16px)',
        }}
        initial={{ y: '-105%' }}
        animate={{ y: '-10%' }}
        transition={{ duration: 0.36, ease: POUR_EASE }}
      />

      {/* Shimmer — faint highlight near toggle origin (top-right) */}
      <motion.div
        style={{
          position: 'absolute',
          top: '-4%',
          right: '-2%',
          width: '36%',
          height: '38%',
          background: `radial-gradient(
            ellipse 80% 75% at 55% 32%,
            ${colors.shimmer} 0%,
            transparent 70%
          )`,
          filter: 'blur(8px)',
        }}
        initial={{ y: '-35%', opacity: 0 }}
        animate={{ y: '0%', opacity: 0.5 }}
        transition={{
          y: { duration: 0.3, ease: POUR_EASE, delay: 0.03 },
          opacity: { duration: 0.14, delay: 0.03 },
        }}
      />
    </motion.div>
  );
}
