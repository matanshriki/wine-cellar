/**
 * Offline hero: continuous one-line luxury illustration (wine bottle + flowing line +
 * neck zigzag), with wine struggling to fill inside the silhouette and broken Wi‑Fi
 * at the opening. Theme-aware strokes; Framer Motion; PWA-safe HTML wrapper;
 * respects parent reducedMotion and reconnect phase.
 */

import { useEffect, useId, useState } from 'react';
import { motion } from 'framer-motion';

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

/**
 * Closed interior for wine fill (inside the line-art silhouette).
 * viewBox 0 0 320 168.
 */
const BOTTLE_FILL_CLIP =
  'M 68 90 L 68 72 C 72 58 86 52 102 50 L 258 36 C 290 32 312 50 316 72 C 312 94 290 110 258 106 L 102 98 C 82 102 68 92 68 90 Z';

/**
 * One continuous stroke: flowing curve in → neck → body (read as Bordeaux on its side,
 * neck left) → zigzag “worm” → flowing curve out — minimalist luxury line art.
 */
const LINE_CONTINUOUS =
  'M 4 36 C 24 52 44 66 58 74 L 58 60 C 62 46 78 42 96 44 L 260 30 C 294 26 318 46 322 72 C 318 98 294 118 260 114 L 108 102 C 84 106 64 96 58 80 L 58 70 L 48 78 L 38 68 L 48 62 L 58 70 C 44 96 24 124 6 142';

interface Props {
  phase: OfflineIllustrationPhase;
  reducedMotion: boolean;
}

export function OfflineIllustration({ phase, reducedMotion }: Props) {
  const rawId = useId().replace(/:/g, '');
  const id = `off-${rawId}`;
  const staticMode = reducedMotion;
  const theme = useDataTheme();
  const reconnecting = phase === 'reconnect';

  const glowA = theme === 'red' ? 0.09 : 0.055;
  const glowB = theme === 'red' ? 0.028 : 0.018;

  const W = 320;
  const H = 168;
  const fillOriginX = 68;
  const fillMaxW = 248;
  const fillY = 50;
  const fillH = 58;

  return (
    <div
      className="relative flex justify-center items-center mx-auto shrink-0"
      style={{ width: W, height: H, maxWidth: '100%' }}
      aria-hidden
    >
      <motion.div
        className="flex max-w-full justify-center"
        style={{
          width: '100%',
          willChange: 'transform',
          transformOrigin: '50% 48%',
          WebkitTransformOrigin: '50% 48%',
        }}
        initial={false}
        animate={
          staticMode
            ? { y: 0, scale: 1 }
            : reconnecting
              ? { y: -2, scale: 1.02 }
              : { y: [0, 1.5, 0], scale: 1 }
        }
        transition={
          staticMode
            ? { duration: 0 }
            : reconnecting
              ? { duration: 0.5, ease: easeLuxury }
              : { duration: 5, repeat: Infinity, ease: easeLuxury }
        }
      >
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="block overflow-visible max-w-full h-auto"
          style={{ width: '100%', height: 'auto', maxHeight: H }}
        >
          <defs>
            <clipPath id={`${id}-cavity`} clipPathUnits="userSpaceOnUse">
              <path d={BOTTLE_FILL_CLIP} />
            </clipPath>
            <radialGradient id={`${id}-wash`} cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="var(--wine-400)" stopOpacity={glowA} />
              <stop offset="60%" stopColor="var(--wine-300)" stopOpacity={glowB} />
              <stop offset="100%" stopColor="var(--wine-300)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${id}-wineFill`} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="var(--wine-700)" stopOpacity="0.92" />
              <stop offset="50%" stopColor="var(--wine-600)" stopOpacity="0.88" />
              <stop offset="100%" stopColor="var(--wine-500)" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id={`${id}-pour`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--wine-500)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="var(--wine-700)" stopOpacity="0.35" />
            </linearGradient>
          </defs>

          <ellipse cx={158} cy={78} rx={132} ry={52} fill={`url(#${id}-wash)`} opacity={0.85} />

          {/* Soft under-draw (readable on light + dark) */}
          <path
            d={LINE_CONTINUOUS}
            stroke="var(--wine-600)"
            strokeWidth={4.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.12}
          />

          {/* Wine struggling to fill */}
          <g clipPath={`url(#${id}-cavity)`}>
            <motion.rect
              x={fillOriginX}
              y={fillY}
              height={fillH}
              fill={`url(#${id}-wineFill)`}
              initial={false}
              animate={
                reconnecting
                  ? { width: fillMaxW, opacity: 1 }
                  : staticMode
                    ? { width: fillMaxW * 0.1, opacity: 0.4 }
                    : {
                        width: [0, fillMaxW * 0.85, fillMaxW * 0.9, fillMaxW * 0.3, fillMaxW * 0.06, 0],
                        opacity: [0.45, 0.9, 0.82, 0.5, 0.38, 0.32],
                      }
              }
              transition={
                reconnecting
                  ? { duration: 0.55, ease: easeLuxury }
                  : staticMode
                    ? {}
                    : {
                        duration: 5.4,
                        repeat: Infinity,
                        ease: easeLuxury,
                        times: [0, 0.28, 0.42, 0.58, 0.78, 1],
                      }
              }
            />
            {!staticMode && !reconnecting && (
              <motion.rect
                x={fillOriginX}
                y={fillY}
                width={fillMaxW}
                height={fillH}
                fill="#fff9f2"
                initial={false}
                animate={{ opacity: [0, 0.12, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: easeLuxury, repeatDelay: 2.6 }}
              />
            )}
          </g>

          {/* Main one-line drawing — always full stroke (fill + pour carry motion) */}
          <path
            d={LINE_CONTINUOUS}
            stroke="var(--text-primary)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Wine-toned echo for depth (luxury print feel) */}
          <path
            d={LINE_CONTINUOUS}
            stroke="var(--wine-600)"
            strokeWidth={1.05}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.38}
          />

          {/* Label — open rectangle, line-art (reference-style) */}
          <rect
            x={132}
            y={54}
            width={84}
            height={28}
            rx={2}
            stroke="var(--text-primary)"
            strokeWidth={1.25}
            opacity={0.4}
            fill="none"
            transform="rotate(-7 174 68)"
          />

          {/* Pour from vault */}
          <motion.path
            d="M 20 16 Q 42 42 56 66"
            stroke={`url(#${id}-pour)`}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={reconnecting ? undefined : '5 9 4 12'}
            animate={
              reconnecting
                ? { opacity: 0.9, strokeDashoffset: 0 }
                : staticMode
                  ? { opacity: 0.3, strokeDashoffset: 0 }
                  : {
                      opacity: [0.2, 0.68, 0.25, 0.58, 0.18],
                      strokeDashoffset: [0, -12, -4, -18],
                    }
            }
            transition={
              reconnecting
                ? { duration: 0.4, ease: easeLuxury }
                : staticMode
                  ? {}
                  : { duration: 2.2, repeat: Infinity, ease: 'linear' }
            }
          />

          {/* Broken Wi‑Fi — same line weight as art */}
          <g transform="translate(56 54)" fill="none" strokeLinecap="round">
            {[
              { d: 'M 0 0 Q -16 -20 -32 -12', del: 0 },
              { d: 'M 0 0 Q -10 -26 -18 -38', del: 0.08 },
              { d: 'M 0 0 Q 16 -20 32 -12', del: 0.04 },
            ].map((arc, i) => (
              <motion.path
                key={i}
                d={arc.d}
                stroke="var(--wine-600)"
                strokeWidth={1.85}
                strokeDasharray={reconnecting ? undefined : '3 7 2 9'}
                animate={
                  reconnecting
                    ? { opacity: 1 }
                    : staticMode
                      ? { opacity: 0.28 }
                      : { opacity: [0.12, 0.65, 0.18, 0.55, 0.1] }
                }
                transition={
                  reconnecting
                    ? { duration: 0.35 }
                    : staticMode
                      ? {}
                      : { duration: 1.7 + i * 0.15, repeat: Infinity, ease: easeLuxury, delay: arc.del }
                }
              />
            ))}
          </g>
        </svg>
      </motion.div>
    </div>
  );
}
