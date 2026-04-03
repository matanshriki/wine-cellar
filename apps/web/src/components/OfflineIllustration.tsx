/**
 * Premium offline hero: bottle + glass, ambient glow, Wi‑Fi cue, wine level.
 * Animated with Framer Motion; static when prefers reduced motion.
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

interface Props {
  phase: OfflineIllustrationPhase;
  /** When true, no looping motion; reconnect fill may still run if phase changes */
  reducedMotion: boolean;
}

export function OfflineIllustration({ phase, reducedMotion }: Props) {
  const rawId = useId().replace(/:/g, '');
  const id = `off-${rawId}`;
  const sysReduce = useReducedMotion();
  const staticMode = reducedMotion || !!sysReduce;
  const theme = useDataTheme();

  const glowCenterOpacity = theme === 'red' ? 0.14 : 0.09;
  const glowEdgeOpacity = theme === 'red' ? 0.05 : 0.03;

  const glassInner = { x: 124, y: 72, w: 36, h: 118 };
  const bottomY = glassInner.y + glassInner.h;
  const wineOfflineH = glassInner.h * 0.7;
  const wineOfflineTop = bottomY - wineOfflineH;
  const wineOnlineH = glassInner.h;
  const wineOnlineTop = glassInner.y;

  const reconnecting = phase === 'reconnect';

  return (
    <div
      className="relative flex items-end justify-center mx-auto"
      style={{ width: 220, height: 228 }}
      aria-hidden
    >
      {/* Ambient glow — SVG radial only (no CSS blur) */}
      <motion.svg
        className="absolute pointer-events-none"
        style={{
          width: 200,
          height: 200,
          left: '50%',
          bottom: -8,
          transform: 'translateX(-50%)',
          overflow: 'visible',
        }}
        viewBox="0 0 200 200"
      >
        <defs>
          <radialGradient id={`${id}-glow`} cx="50%" cy="55%" r="55%">
            <stop offset="0%" stopColor="var(--wine-400)" stopOpacity={glowCenterOpacity} />
            <stop offset="45%" stopColor="var(--wine-300)" stopOpacity={glowEdgeOpacity} />
            <stop offset="100%" stopColor="var(--wine-300)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.g
          animate={
            staticMode
              ? { scale: 1, opacity: 1 }
              : { scale: [1, 1.02, 1], opacity: [0.92, 1, 0.92] }
          }
          transition={{
            duration: 3.6,
            repeat: staticMode ? 0 : Infinity,
            ease: easeLuxury,
          }}
          style={{ transformOrigin: '100px 118px', transformBox: 'fill-box' }}
        >
          <ellipse cx={100} cy={118} rx={72} ry={56} fill={`url(#${id}-glow)`} />
        </motion.g>
      </motion.svg>

      <svg
        width={200}
        height={210}
        viewBox="0 0 200 210"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-[1]"
      >
        <defs>
          <linearGradient id={`${id}-bottle`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--wine-200, #f0dfe4)" stopOpacity="0.9" />
            <stop offset="55%" stopColor="var(--wine-100, #f8eef1)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--wine-300)" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id={`${id}-wine`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="var(--wine-500)" />
            <stop offset="100%" stopColor="var(--wine-700)" />
          </linearGradient>
          <linearGradient id={`${id}-glass-stroke`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--border-medium)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--border-medium)" stopOpacity="0.2" />
          </linearGradient>
          <clipPath id={`${id}-glass-clip`}>
            <rect x={glassInner.x} y={glassInner.y} width={glassInner.w} height={glassInner.h} rx="10" />
          </clipPath>
        </defs>

        {/* Wi‑Fi cue — static wrapper keeps translate; inner motion avoids transform clashes */}
        <g transform="translate(100, 24)">
          <motion.g
            animate={
              staticMode
                ? { opacity: reconnecting ? 1 : 0.38 }
                : reconnecting
                  ? { opacity: 1, scale: 1 }
                  : { opacity: [0.26, 0.52, 0.26], scale: [0.99, 1, 0.99] }
            }
            transition={
              reconnecting
                ? { duration: 0.4, ease: easeLuxury }
                : staticMode
                  ? { duration: 0 }
                  : { duration: 3.4, repeat: Infinity, ease: easeLuxury }
            }
            style={{ transformOrigin: '0px 14px' }}
          >
          <path
            d="M-14 8 A 18 18 0 0 1 14 8"
            stroke="var(--wine-500)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            opacity={reconnecting ? 1 : 0.45}
          />
          <path
            d="M-9 12 A 11 11 0 0 1 9 12"
            stroke="var(--wine-500)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            opacity={reconnecting ? 1 : 0.55}
          />
          <path
            d="M-4 16 A 5 5 0 0 1 4 16"
            stroke="var(--wine-500)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            opacity={reconnecting ? 1 : 0.7}
          />
            {!reconnecting && !staticMode && (
              <motion.line
                x1="-16"
                y1="-2"
                x2="16"
                y2="20"
                stroke="var(--text-tertiary)"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity={0.35}
                animate={{ opacity: [0.18, 0.42, 0.18] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: easeLuxury }}
              />
            )}
          </motion.g>
        </g>

        {/* Bottle silhouette */}
        <path
          d="M52 56 L49 64 L44 168 Q44 188 68 188 Q92 188 92 168 L87 64 L84 56 Q68 50 52 56Z"
          fill={`url(#${id}-bottle)`}
          stroke="var(--border-medium)"
          strokeWidth="0.8"
          opacity="0.95"
        />
        <path
          d="M56 78 L53 162 Q53 176 68 176 Q83 176 83 162 L80 78 Q68 73 56 78Z"
          fill={`url(#${id}-wine)`}
          opacity="0.88"
        />
        <path
          d="M58 52 L58 38 Q58 32 68 32 Q78 32 78 38 L78 52 Z"
          fill={`url(#${id}-bottle)`}
          stroke="var(--border-medium)"
          strokeWidth="0.5"
        />
        <rect
          x="60"
          y="50"
          width="16"
          height="5"
          rx="1"
          fill="var(--wine-400)"
          opacity="0.35"
        />

        {/* Glass (test-tube style) */}
        <path
          d={`M ${glassInner.x} ${glassInner.y} L ${glassInner.x} ${glassInner.y + glassInner.h - 12} Q ${glassInner.x + glassInner.w / 2} ${bottomY} ${glassInner.x + glassInner.w} ${glassInner.y + glassInner.h - 12} L ${glassInner.x + glassInner.w} ${glassInner.y} Z`}
          fill="var(--bg-surface)"
          fillOpacity="0.25"
          stroke={`url(#${id}-glass-stroke)`}
          strokeWidth="1.2"
        />

        <g clipPath={`url(#${id}-glass-clip)`}>
          <motion.rect
            x={glassInner.x}
            fill={`url(#${id}-wine)`}
            opacity="0.92"
            initial={false}
            animate={{
              y: reconnecting ? wineOnlineTop : wineOfflineTop,
              height: reconnecting ? wineOnlineH : wineOfflineH,
            }}
            width={glassInner.w}
            transition={{
              duration: reconnecting ? (staticMode ? 0.15 : 0.72) : 0,
              ease: easeLuxury,
            }}
          />
          {/* Surface wave */}
          {!staticMode && (
            <motion.g
              animate={
                reconnecting
                  ? { opacity: 0, x: 0 }
                  : { x: [-1.2, 1.2, -1.2], opacity: 0.85 }
              }
              transition={
                reconnecting
                  ? { duration: 0.35, ease: easeLuxury }
                  : { duration: 4.2, repeat: Infinity, ease: easeLuxury }
              }
            >
              <path
                d={`M ${glassInner.x - 4} ${wineOfflineTop + 2} Q ${glassInner.x + glassInner.w * 0.25} ${wineOfflineTop - 1} ${glassInner.x + glassInner.w * 0.5} ${wineOfflineTop + 2} T ${glassInner.x + glassInner.w + 4} ${wineOfflineTop + 2} L ${glassInner.x + glassInner.w + 4} ${wineOfflineTop + 8} L ${glassInner.x - 4} ${wineOfflineTop + 8} Z`}
                fill="var(--wine-400)"
                fillOpacity="0.4"
              />
            </motion.g>
          )}
        </g>

        {/* Glass rim highlight */}
        <line
          x1={glassInner.x + 4}
          y1={glassInner.y + 2}
          x2={glassInner.x + glassInner.w - 4}
          y2={glassInner.y + 2}
          stroke="var(--wine-300)"
          strokeOpacity="0.4"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
