/**
 * Offline hero: horizontal empty bottle on a lit surface; wine strains to pour in
 * from the “vault” (stream + rising level) but the level ebbs—broken Wi‑Fi at the
 * neck signals no connection. Luxury gradients and soft depth; Framer Motion;
 * respects reduced motion and reconnect phase.
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

/** Inner cavity for wine clip (horizontal bottle, neck left) */
const WINE_CLIP_PATH =
  'M 62 73 L 94 69 C 145 63 205 63 246 72 C 254 76 258 78 258 78 C 258 78 254 80 246 84 C 205 93 145 93 94 87 L 62 83 C 56 82 52 78 52 78 C 52 78 56 74 62 73 Z';

interface Props {
  phase: OfflineIllustrationPhase;
  reducedMotion: boolean;
}

export function OfflineIllustration({ phase, reducedMotion }: Props) {
  const rawId = useId().replace(/:/g, '');
  const id = `off-${rawId}`;
  /** Parent passes `shouldReduceMotion()` (PWA overrides iOS false positives); do not OR with `useReducedMotion` here. */
  const staticMode = reducedMotion;
  const theme = useDataTheme();
  const reconnecting = phase === 'reconnect';

  const glowA = theme === 'red' ? 0.13 : 0.075;
  const glowB = theme === 'red' ? 0.038 : 0.024;

  const W = 300;
  const H = 152;
  const fillMaxW = 198;

  return (
    <div
      className="relative flex justify-center items-center mx-auto shrink-0"
      style={{ width: W, height: H, maxWidth: '100%' }}
      aria-hidden
    >
      {/**
       * PWA / WebKit: run the gentle bob + reconnect scale on HTML, not SVG &lt;g&gt;,
       * so transforms stay on a stable compositor layer (iOS Safari + Android Chrome).
       */}
      <motion.div
        className="flex max-w-full justify-center"
        style={{
          width: '100%',
          willChange: 'transform',
          transformOrigin: '50% 45%',
          WebkitTransformOrigin: '50% 45%',
        }}
        initial={false}
        animate={
          staticMode
            ? { y: 0, scale: 1 }
            : reconnecting
              ? { y: -3, scale: 1.02 }
              : { y: [0, 1.8, 0], scale: 1 }
        }
        transition={
          staticMode
            ? { duration: 0 }
            : reconnecting
              ? { duration: 0.5, ease: easeLuxury }
              : { duration: 4.8, repeat: Infinity, ease: easeLuxury }
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
            <path d={WINE_CLIP_PATH} />
          </clipPath>
          <radialGradient id={`${id}-wash`} cx="50%" cy="42%" r="68%">
            <stop offset="0%" stopColor="var(--wine-400)" stopOpacity={glowA} />
            <stop offset="55%" stopColor="var(--wine-300)" stopOpacity={glowB} />
            <stop offset="100%" stopColor="var(--wine-300)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-key`} cx="22%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#f8ecd8" stopOpacity="0.5" />
            <stop offset="40%" stopColor="#d4a574" stopOpacity="0.14" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-wineFill`} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="var(--wine-700)" />
            <stop offset="40%" stopColor="var(--wine-600)" />
            <stop offset="100%" stopColor="var(--wine-500)" stopOpacity="0.94" />
          </linearGradient>
          <linearGradient id={`${id}-glass`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--wine-300)" stopOpacity="0.22" />
            <stop offset="45%" stopColor="var(--bg-surface)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--wine-400)" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id={`${id}-pour`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--wine-400)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--wine-700)" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id={`${id}-rim`} x1="100%" y1="50%" x2="0%" y2="50%">
            <stop offset="0%" stopColor="#c9a063" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#8b6914" stopOpacity="0.2" />
          </linearGradient>
          <filter id={`${id}-blur`} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="2.8" />
          </filter>
          <filter id={`${id}-blurFar`} x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id={`${id}-sheen`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="s" />
            <feMerge>
              <feMergeNode in="s" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient depth */}
        <ellipse
          cx={148}
          cy={72}
          rx={118}
          ry={48}
          fill={`url(#${id}-wash)`}
          filter={`url(#${id}-blurFar)`}
          opacity={0.9}
        />
        <ellipse cx={135} cy={68} rx={90} ry={38} fill={`url(#${id}-key)`} opacity={0.65} />

          {/* Surface shadow */}
          <ellipse
            cx={158}
            cy={108}
            rx={102}
            ry={7}
            fill="var(--wine-700)"
            opacity={0.12}
            filter={`url(#${id}-blur)`}
          />

          {/* Bottle body — horizontal, neck at left */}
          <path
            d="M 68 66 L 92 62.5 C 138 56 208 56 248 66.5 C 262 70 268 74 270 78 C 268 82 262 86 248 89.5 C 208 100 138 100 92 93.5 L 68 90 C 56 88 48 84 46 78 C 48 72 56 68 68 66 Z"
            fill={`url(#${id}-glass)`}
            stroke="var(--border-medium)"
            strokeWidth={0.85}
            opacity={0.95}
          />
          <path
            d="M 68 66 L 92 62.5 C 138 56 208 56 248 66.5 C 262 70 268 74 270 78 C 268 82 262 86 248 89.5 C 208 100 138 100 92 93.5 L 68 90 C 56 88 48 84 46 78 C 48 72 56 68 68 66 Z"
            fill="none"
            stroke="var(--wine-600)"
            strokeWidth={0.45}
            opacity={0.35}
          />

          {/* Neck opening ring — empty bottle */}
          <ellipse cx={52} cy={78} rx={11} ry={14} stroke={`url(#${id}-rim)`} strokeWidth={2.2} fill="#1a0d10" fillOpacity={0.35} />
          <ellipse cx={52} cy={78} rx={7} ry={9} fill="#0d0608" fillOpacity={0.5} />

          {/* Label band */}
          <rect x={118} y={64} width={52} height={22} rx={2} fill="var(--bg-surface)" opacity={0.38} />
          <rect x={119} y={65} width={50} height={20} rx={1.5} fill="none" stroke="var(--wine-600)" strokeWidth={0.4} opacity={0.45} />
          <line x1={124} y1={72} x2={164} y2={72} stroke="var(--wine-600)" strokeWidth={0.35} opacity={0.3} />
          <line x1={126} y1={78} x2={162} y2={78} stroke="var(--wine-600)" strokeWidth={0.35} opacity={0.28} />

          {/* Glass highlight */}
          <path
            d="M 95 64 C 150 58 210 60 245 69"
            stroke="#fdf6eb"
            strokeWidth={1.1}
            strokeLinecap="round"
            opacity={0.28}
          />

          {/* Wine level — struggles to fill, then ebbs (offline) */}
          <g clipPath={`url(#${id}-cavity)`}>
            <motion.rect
              x={62}
              y={66}
              height={24}
              fill={`url(#${id}-wineFill)`}
              initial={false}
              animate={
                reconnecting
                  ? { width: fillMaxW, opacity: 1 }
                  : staticMode
                    ? { width: fillMaxW * 0.12, opacity: 0.45 }
                    : {
                        width: [0, fillMaxW * 0.88, fillMaxW * 0.92, fillMaxW * 0.35, fillMaxW * 0.08, 0],
                        opacity: [0.5, 0.95, 0.88, 0.55, 0.4, 0.35],
                      }
              }
              transition={
                reconnecting
                  ? { duration: 0.55, ease: easeLuxury }
                  : staticMode
                    ? {}
                    : {
                        duration: 5.6,
                        repeat: Infinity,
                        ease: easeLuxury,
                        times: [0, 0.28, 0.42, 0.58, 0.78, 1],
                      }
              }
            />
            {!staticMode && !reconnecting && (
              <motion.rect
                x={62}
                y={66}
                width={fillMaxW}
                height={24}
                fill="#fff9f2"
                initial={false}
                animate={{ opacity: [0, 0.14, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: easeLuxury, repeatDelay: 2.8 }}
              />
            )}
          </g>

          {/* “Pour from the cellar” — stream stutters when offline */}
          <motion.path
            d="M 28 22 Q 42 48 50 72"
            stroke={`url(#${id}-pour)`}
            strokeWidth={3.2}
            strokeLinecap="round"
            fill="none"
            filter={`url(#${id}-sheen)`}
            strokeDasharray={reconnecting ? undefined : '6 10 4 14'}
            animate={
              reconnecting
                ? { opacity: 0.95, strokeDashoffset: 0 }
                : staticMode
                  ? { opacity: 0.35, strokeDashoffset: 0 }
                  : {
                      opacity: [0.25, 0.75, 0.3, 0.65, 0.2, 0.55, 0.22],
                      strokeDashoffset: [0, -14, -4, -20, -8],
                    }
            }
            transition={
              reconnecting
                ? { duration: 0.4, ease: easeLuxury }
                : staticMode
                  ? {}
                  : { duration: 2.4, repeat: Infinity, ease: 'linear' }
            }
          />

          {/* Broken Wi‑Fi at the neck — no link to the vault */}
          <g transform="translate(44 58)" fill="none" strokeLinecap="round">
            {[
              { d: 'M 0 0 Q -14 -18 -28 -10', o: 0 },
              { d: 'M 0 0 Q -8 -24 -14 -34', o: 0.1 },
              { d: 'M 0 0 Q 14 -18 28 -10', o: 0.05 },
            ].map((arc, i) => (
              <motion.path
                key={i}
                d={arc.d}
                stroke="var(--wine-600)"
                strokeWidth={2}
                strokeDasharray={reconnecting ? undefined : '3 8 2 10'}
                animate={
                  reconnecting
                    ? { opacity: 1 }
                    : staticMode
                      ? { opacity: 0.32 }
                      : { opacity: [0.15, 0.72, 0.2, 0.6, 0.12] }
                }
                transition={
                  reconnecting
                    ? { duration: 0.35 }
                    : staticMode
                      ? {}
                      : { duration: 1.8 + i * 0.2, repeat: Infinity, ease: easeLuxury, delay: arc.o }
                }
              />
            ))}
          </g>
        </svg>
      </motion.div>
    </div>
  );
}
