/**
 * Offline hero: vintage-print style tilted bottle, cork-born broken Wi‑Fi arcs,
 * floating grape garland with vein / thread glow. Framer Motion; respects reduced motion.
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
  reducedMotion: boolean;
}

export function OfflineIllustration({ phase, reducedMotion }: Props) {
  const rawId = useId().replace(/:/g, '');
  const id = `off-${rawId}`;
  const sysReduce = useReducedMotion();
  const staticMode = reducedMotion || !!sysReduce;
  const theme = useDataTheme();
  const reconnecting = phase === 'reconnect';

  const glowA = theme === 'red' ? 0.14 : 0.08;
  const glowB = theme === 'red' ? 0.04 : 0.028;

  const W = 260;
  const H = 200;
  /** Scene origin for bottle tilt (base center) */
  const ox = 128;
  const oy = 158;

  return (
    <div
      className="relative flex justify-center items-center mx-auto shrink-0"
      style={{ width: W, height: H, maxWidth: '100%' }}
      aria-hidden
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible max-w-full h-auto"
        style={{ width: '100%', height: 'auto', maxHeight: H }}
      >
        <defs>
          <radialGradient id={`${id}-vignette`} cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor="var(--wine-400)" stopOpacity={glowA} />
            <stop offset="55%" stopColor="var(--wine-300)" stopOpacity={glowB} />
            <stop offset="100%" stopColor="var(--wine-300)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-warm`} cx="28%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#f4e4c8" stopOpacity="0.45" />
            <stop offset="35%" stopColor="#d4a574" stopOpacity="0.12" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-bottleGlass`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--wine-300)" stopOpacity="0.35" />
            <stop offset="40%" stopColor="var(--bg-surface)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--wine-600)" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id={`${id}-bottleWine`} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="var(--wine-700)" />
            <stop offset="55%" stopColor="var(--wine-600)" />
            <stop offset="100%" stopColor="var(--wine-500)" />
          </linearGradient>
          <linearGradient id={`${id}-cork`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c4a574" />
            <stop offset="50%" stopColor="#8b6914" />
            <stop offset="100%" stopColor="#5c4510" />
          </linearGradient>
          <linearGradient id={`${id}-grape`} x1="30%" y1="20%" x2="70%" y2="90%">
            <stop offset="0%" stopColor="#6b2d4a" />
            <stop offset="45%" stopColor="var(--wine-700)" />
            <stop offset="100%" stopColor="#3d1528" />
          </linearGradient>
          <linearGradient id={`${id}-grapeHi`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0d4a8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>
          <filter id={`${id}-softBlur`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
          <filter id={`${id}-dofFar`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5.5" />
          </filter>
          <filter id={`${id}-glowSoft`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${id}-veinGlow`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="0.8" result="v" />
            <feMerge>
              <feMergeNode in="v" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Depth: distant warm wash */}
        <ellipse
          cx={ox - 8}
          cy={oy - 52}
          rx={88}
          ry={62}
          fill={`url(#${id}-vignette)`}
          filter={`url(#${id}-dofFar)`}
          opacity={0.85}
        />
        <ellipse cx={ox} cy={oy - 48} rx={72} ry={50} fill={`url(#${id}-warm)`} opacity={0.7} />

        {/* Bottle + cork + Wi‑Fi — tilted */}
        <motion.g
          style={{ transformOrigin: `${ox}px ${oy}px` }}
          animate={
            staticMode
              ? { rotate: -12, x: 0, y: 0 }
              : reconnecting
                ? { rotate: -9, x: 0, y: -2, scale: 1.02 }
                : {
                    rotate: [-13.5, -11, -13.5],
                    y: [0, 2.2, 0],
                    x: [0, 0.6, 0],
                  }
          }
          transition={
            staticMode
              ? { duration: 0 }
              : reconnecting
                ? { duration: 0.45, ease: easeLuxury }
                : {
                    duration: 5.2,
                    repeat: Infinity,
                    ease: easeLuxury,
                  }
          }
        >
          <g transform={`translate(${ox},${oy})`}>
            {/* Ground shadow */}
            <ellipse
              cx={4}
              cy={6}
              rx={38}
              ry={9}
              fill="var(--wine-700)"
              opacity={0.14}
              filter={`url(#${id}-softBlur)`}
            />

            {/* Bottle body (local: base ~ y=0) */}
            <path
              d="M -15 2 L -18 10 L 18 10 L 15 2 C 24 0 28 -38 26 -66 C 25 -82 18 -94 9 -100 L 7 -100 L 7 -118 L 9 -124 L 8 -136 L -8 -136 L -9 -124 L -7 -118 L -7 -100 L -9 -100 C -18 -94 -25 -82 -26 -66 C -28 -38 -24 0 -15 2 Z"
              fill={`url(#${id}-bottleWine)`}
              stroke="var(--wine-700)"
              strokeWidth={1.1}
              opacity={0.92}
            />
            <path
              d="M -15 2 L -18 10 L 18 10 L 15 2 C 24 0 28 -38 26 -66 C 25 -82 18 -94 9 -100 L 7 -100 L 7 -118 L 9 -124 L 8 -136 L -8 -136 L -9 -124 L -7 -118 L -7 -100 L -9 -100 C -18 -94 -25 -82 -26 -66 C -28 -38 -24 0 -15 2 Z"
              fill={`url(#${id}-bottleGlass)`}
              stroke="var(--border-medium)"
              strokeWidth={0.6}
              opacity={0.55}
            />
            {/* Vintage label */}
            <rect x={-9} y={-78} width={18} height={26} rx={1.5} fill="var(--bg-surface)" opacity={0.42} />
            <rect x={-8} y={-77} width={16} height={24} rx={1} fill="none" stroke="var(--wine-600)" strokeWidth={0.45} opacity={0.5} />
            <line x1={-5} y1={-68} x2={5} y2={-68} stroke="var(--wine-600)" strokeWidth={0.35} opacity={0.35} />
            <line x1={-6} y1={-62} x2={6} y2={-62} stroke="var(--wine-600)" strokeWidth={0.35} opacity={0.35} />
            <line x1={-7} y1={-54} x2={7} y2={-58} stroke="var(--wine-600)" strokeWidth={0.2} opacity={0.2} />
            <line x1={-6} y1={-50} x2={6} y2={-54} stroke="var(--wine-600)" strokeWidth={0.2} opacity={0.18} />
            {/* Highlight edge */}
            <path
              d="M -22 -58 C -24 -40 -22 -15 -16 2"
              stroke="#f8ead0"
              strokeWidth={1.2}
              strokeLinecap="round"
              opacity={0.35}
            />

            {/* Cork */}
            <rect x={-6.5} y={-150} width={13} height={16} rx={2} fill={`url(#${id}-cork)`} stroke="#4a3a18" strokeWidth={0.5} />
            <ellipse cx={0} cy={-150} rx={6.5} ry={2.2} fill="#d9bc86" opacity={0.9} />

            {/* Broken Wi‑Fi arcs from cork */}
            <g transform="translate(0 -142)" fill="none" strokeLinecap="round">
              {[
                { d: 'M 0 0 Q -32 -42 -58 -28', delay: 0 },
                { d: 'M 0 0 Q -18 -52 -28 -68', delay: 0.12 },
                { d: 'M 0 0 Q 32 -42 58 -28', delay: 0.24 },
                { d: 'M 0 0 Q 18 -52 28 -68', delay: 0.08 },
              ].map((arc, i) => (
                <motion.path
                  key={i}
                  d={arc.d}
                  stroke="var(--wine-600)"
                  strokeWidth={2.4}
                  strokeDasharray={reconnecting ? undefined : '5 10 3 14'}
                  animate={
                    reconnecting
                      ? { opacity: 1, strokeDashoffset: 0 }
                      : staticMode
                        ? { opacity: 0.38, strokeDashoffset: 0 }
                        : {
                            opacity: [0.2, 0.85, 0.25, 0.65, 0.15, 0.75, 0.22],
                            strokeDashoffset: [0, -18, -6, -24, -12],
                          }
                  }
                  transition={
                    reconnecting
                      ? { duration: 0.35, ease: easeLuxury }
                      : staticMode
                        ? {}
                        : {
                            duration: 2.1 + i * 0.15,
                            repeat: Infinity,
                            ease: 'linear',
                            delay: arc.delay,
                          }
                  }
                />
              ))}
              {/* Center arc — most “broken” */}
              <motion.path
                d="M 0 0 Q 0 -48 2 -72"
                stroke="var(--wine-700)"
                strokeWidth={2.2}
                strokeDasharray={reconnecting ? undefined : '2 9 4 11'}
                animate={
                  reconnecting
                    ? { opacity: 1 }
                    : staticMode
                      ? { opacity: 0.32 }
                      : { opacity: [0.12, 0.55, 0.18, 0.5, 0.1, 0.62, 0.14] }
                }
                transition={
                  reconnecting
                    ? { duration: 0.35 }
                    : staticMode
                      ? {}
                      : { duration: 1.65, repeat: Infinity, ease: easeLuxury }
                }
              />
            </g>

            {/* Grape garland — local to bottle, near neck */}
            <motion.g
              style={{ transformOrigin: '20px -108px' }}
              animate={
                staticMode
                  ? { x: 0, y: 0, rotate: 0 }
                  : { x: [0, 1.2, 0], y: [0, -2.5, 0], rotate: [-1.2, 0.8, -1.2] }
              }
              transition={
                staticMode
                  ? {}
                  : { duration: 4.2, repeat: Infinity, ease: easeLuxury }
              }
            >
              {/* Vine */}
              <path
                d="M -4 -112 Q 12 -128 34 -118 Q 48 -108 52 -92"
                stroke="#3d5c3a"
                strokeWidth={1.6}
                strokeLinecap="round"
                fill="none"
                opacity={0.85}
              />
              <path
                d="M -4 -112 Q 12 -128 34 -118 Q 48 -108 52 -92"
                stroke="#7a9e72"
                strokeWidth={0.45}
                strokeLinecap="round"
                fill="none"
                opacity={0.4}
              />

              {(
                [
                  { cx: 8, cy: -120, r: 5.2 },
                  { cx: 18, cy: -114, r: 6 },
                  { cx: 28, cy: -118, r: 5.4 },
                  { cx: 38, cy: -110, r: 5.8 },
                  { cx: 46, cy: -100, r: 4.8 },
                  { cx: 22, cy: -106, r: 4.2 },
                ] as const
              ).map((g, idx) => (
                <g key={idx}>
                  <circle
                    cx={g.cx}
                    cy={g.cy}
                    r={g.r + 0.8}
                    fill="var(--wine-700)"
                    opacity={0.22}
                    filter={`url(#${id}-softBlur)`}
                  />
                  <motion.circle
                    cx={g.cx}
                    cy={g.cy}
                    r={g.r}
                    fill={`url(#${id}-grape)`}
                    stroke="var(--wine-700)"
                    strokeWidth={0.45}
                    initial={false}
                    animate={
                      staticMode
                        ? { r: g.r }
                        : { r: [g.r, g.r * 1.045, g.r * 0.985, g.r] }
                    }
                    transition={
                      staticMode
                        ? {}
                        : {
                            duration: 3.2 + idx * 0.2,
                            repeat: Infinity,
                            ease: easeLuxury,
                            delay: idx * 0.08,
                          }
                    }
                  />
                  <ellipse
                    cx={g.cx - g.r * 0.35}
                    cy={g.cy - g.r * 0.35}
                    rx={g.r * 0.35}
                    ry={g.r * 0.28}
                    fill={`url(#${id}-grapeHi)`}
                    opacity={0.5}
                  />
                  {/* Glowing veins */}
                  <motion.path
                    d={`M ${g.cx - 1.2} ${g.cy + 1} Q ${g.cx + 0.5} ${g.cy - 0.5} ${g.cx + 1.5} ${g.cy - 2}`}
                    stroke="#f5e6d3"
                    strokeWidth={0.35}
                    fill="none"
                    filter={`url(#${id}-veinGlow)`}
                    animate={
                      staticMode
                        ? { opacity: 0.35 }
                        : { opacity: [0.2, 0.75, 0.35, 0.65, 0.25] }
                    }
                    transition={
                      staticMode
                        ? {}
                        : {
                            duration: 2.4 + idx * 0.17,
                            repeat: Infinity,
                            ease: easeLuxury,
                            delay: idx * 0.11,
                          }
                    }
                  />
                </g>
              ))}

              {/* Light threads */}
              {[0, 1, 2].map((i) => (
                <motion.line
                  key={`th-${i}`}
                  x1={14 + i * 10}
                  y1={-122 - i * 2}
                  x2={10 + i * 8}
                  y2={-148 - i * 5}
                  stroke="#fcefd9"
                  strokeWidth={0.35}
                  strokeLinecap="round"
                  opacity={0.5}
                  filter={`url(#${id}-glowSoft)`}
                  animate={
                    staticMode
                      ? { opacity: 0.25 }
                      : { opacity: [0.15, 0.55, 0.2, 0.45, 0.18] }
                  }
                  transition={
                    staticMode
                      ? {}
                      : {
                          duration: 3 + i * 0.4,
                          repeat: Infinity,
                          ease: easeLuxury,
                          delay: i * 0.25,
                        }
                  }
                />
              ))}
            </motion.g>
          </g>
        </motion.g>
      </svg>
    </div>
  );
}
