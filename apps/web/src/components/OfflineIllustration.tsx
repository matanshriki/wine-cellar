/**
 * Offline hero: centered column — Wi‑Fi “signal seeking” + soft fading barrier + wine oscillation.
 * Framer Motion; respects reduced motion.
 */

import { useEffect, useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export type OfflineIllustrationPhase = 'offline' | 'reconnect';

type ThemeHint = 'red' | 'white' | 'unknown';

function useDataTheme(): ThemeHint {
  const [theme, setTheme] = useState<ThemeHint>(() => {
    if (typeof document === 'undefined') return 'unknown';
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'red' || t === 'white') return t;
    return 'unknown';
  });

  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => {
      const t = el.getAttribute('data-theme');
      setTheme(t === 'red' || t === 'white' ? t : 'unknown');
    });
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  return theme;
}

const easeLuxury = [0.45, 0, 0.55, 1] as const;
/** Keyframe times for one full seek cycle (outer → mid → inner peak) */
const SEEK_TIMES = [0, 0.22, 0.44, 0.66, 1] as const;
const DIM = 0.26;
const PEAK = 0.94;

interface Props {
  phase: OfflineIllustrationPhase;
  reducedMotion: boolean;
}

export function OfflineIllustration({ phase, reducedMotion }: Props) {
  const rawId = useId().replace(/:/g, '');
  const id = `off-${rawId}`;
  const sysReduce = useReducedMotion();
  const staticMode = reducedMotion || !!sysReduce;
  const theme = useDataTheme();
  const reconnecting = phase === 'reconnect';

  const glowA = theme === 'red' ? 0.11 : 0.065;
  const glowB = theme === 'red' ? 0.035 : 0.022;

  const cx = 84;
  const bowl = {
    left: 68,
    right: 100,
    top: 78,
    bottom: 114,
    mid: 84,
  };

  const wineBaseY = bowl.bottom;
  const wineH = { low: 13, mid: 15.5, high: 17 };
  const wineY = (h: number) => wineBaseY - h;

  return (
    <div
      className="relative flex justify-center items-center mx-auto shrink-0"
      style={{ width: 168, height: 148 }}
      aria-hidden
    >
      <svg
        width={168}
        height={148}
        viewBox="0 0 168 148"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <radialGradient id={`${id}-glow`} cx="50%" cy="42%" r="48%">
            <stop offset="0%" stopColor="var(--wine-400)" stopOpacity={glowA} />
            <stop offset="70%" stopColor="var(--wine-300)" stopOpacity={glowB} />
            <stop offset="100%" stopColor="var(--wine-300)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-wine`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="var(--wine-500)" />
            <stop offset="100%" stopColor="var(--wine-700)" />
          </linearGradient>
          <clipPath id={`${id}-bowl`}>
            <path d="M 68 78 L 72 108 Q 77 114 84 114 Q 91 114 96 108 L 100 78 Z" />
          </clipPath>
        </defs>

        <motion.g
          animate={staticMode ? { scale: 1 } : { scale: [1, 1.03, 1] }}
          transition={{ duration: 3.6, repeat: staticMode ? 0 : Infinity, ease: easeLuxury }}
          style={{ transformOrigin: `${cx}px 44px` }}
        >
          <circle cx={cx} cy={44} r={42} fill={`url(#${id}-glow)`} />
        </motion.g>

        {/* Wi‑Fi arcs — symmetric around cx; signal-seeking stagger */}
        <g stroke="var(--wine-600)" strokeWidth={2.8} strokeLinecap="round" fill="none">
          <motion.path
            d={`M 36 56 Q ${cx} 18 132 56`}
            animate={
              reconnecting
                ? { opacity: 1 }
                : staticMode
                  ? { opacity: 0.45 }
                  : { opacity: [DIM, PEAK, DIM, DIM, DIM] }
            }
            transition={
              reconnecting
                ? { duration: 0.35, ease: easeLuxury }
                : staticMode
                  ? {}
                  : {
                      duration: 2.85,
                      repeat: Infinity,
                      ease: easeLuxury,
                      times: [...SEEK_TIMES],
                    }
            }
          />
          <motion.path
            d={`M 48 56 Q ${cx} 34 120 56`}
            animate={
              reconnecting
                ? { opacity: 1 }
                : staticMode
                  ? { opacity: 0.55 }
                  : { opacity: [DIM, DIM, PEAK, DIM, DIM] }
            }
            transition={
              reconnecting
                ? { duration: 0.35, ease: easeLuxury }
                : staticMode
                  ? {}
                  : {
                      duration: 2.85,
                      repeat: Infinity,
                      ease: easeLuxury,
                      times: [...SEEK_TIMES],
                    }
            }
          />
          <motion.path
            d={`M 60 56 Q ${cx} 44 108 56`}
            animate={
              reconnecting
                ? { opacity: 1 }
                : staticMode
                  ? { opacity: 0.7 }
                  : { opacity: [DIM, DIM, DIM, PEAK, DIM] }
            }
            transition={
              reconnecting
                ? { duration: 0.35, ease: easeLuxury }
                : staticMode
                  ? {}
                  : {
                      duration: 2.85,
                      repeat: Infinity,
                      ease: easeLuxury,
                      times: [...SEEK_TIMES],
                    }
            }
          />
        </g>

        <circle cx={cx} cy={62} r={3.5} fill="var(--wine-700)" opacity={0.92} />

        {/* Soft symmetric “no signal” veil — horizontal, fades (no harsh diagonal) */}
        {!reconnecting && (
          <motion.rect
            x={cx - 40}
            y={41}
            width={80}
            height={6}
            rx={3}
            fill="var(--wine-600)"
            animate={
              staticMode
                ? { opacity: 0.12 }
                : { opacity: [0.05, 0.2, 0.05] }
            }
            transition={{
              duration: 2.75,
              repeat: staticMode ? 0 : Infinity,
              ease: easeLuxury,
            }}
          />
        )}

        {/* Wine glass — centered on cx */}
        <path
          d="M 68 78 L 72 108 Q 77 114 84 114 Q 91 114 96 108 L 100 78 Z"
          stroke="var(--border-medium)"
          strokeWidth={1.2}
          fill="var(--bg-surface)"
          fillOpacity={0.22}
        />
        <g clipPath={`url(#${id}-bowl)`}>
          {reconnecting || staticMode ? (
            <motion.rect
              x={bowl.left}
              width={bowl.right - bowl.left}
              fill={`url(#${id}-wine)`}
              opacity={0.88}
              initial={false}
              animate={{
                y: reconnecting ? wineY(wineH.high) : wineY(wineH.mid),
                height: reconnecting ? wineH.high : wineH.mid,
              }}
              transition={{
                duration: reconnecting ? (staticMode ? 0.12 : 0.55) : 0,
                ease: easeLuxury,
              }}
            />
          ) : (
            <motion.rect
              x={bowl.left}
              width={bowl.right - bowl.left}
              fill={`url(#${id}-wine)`}
              opacity={0.88}
              initial={false}
              animate={{
                y: [wineY(wineH.low), wineY(wineH.high), wineY(wineH.low)],
                height: [wineH.low, wineH.high, wineH.low],
              }}
              transition={{
                duration: 3.9,
                repeat: Infinity,
                ease: easeLuxury,
              }}
            />
          )}
        </g>
        <path
          d={`M ${cx - 4} 114 L ${cx - 4} 118 M ${cx + 4} 114 L ${cx + 4} 118`}
          stroke="var(--border-medium)"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <line
          x1={cx - 8}
          y1={118}
          x2={cx + 8}
          y2={118}
          stroke="var(--border-medium)"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
