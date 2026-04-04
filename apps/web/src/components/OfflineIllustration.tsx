/**
 * Offline hero: horizontal “sketch” bottle (base left, cork right) as a painted SVG —
 * thick organic outline, wine fill with a hand-drawn wavy meniscus, tiny specks,
 * broken Wi‑Fi at the cork. No loading text (copy lives on OfflineCellarScreen).
 * PWA-safe motion wrapper; parent reducedMotion + reconnect phase.
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

/** Interior — horizontal bottle, opening/cork on the right (viewBox 0 0 300 132). */
const BOTTLE_INNER_CLIP =
  'M 54 84 L 54 52 C 56 44 64 40 74 40 L 218 36 C 244 34 258 44 264 52 L 268 52 L 274 56 L 276 64 L 274 74 L 266 80 L 258 80 L 250 86 C 232 92 210 92 188 90 L 74 88 C 62 88 54 86 54 84 Z';

/**
 * Hand-drawn feel: thick outline, base left, neck + cork right (slight asymmetry on purpose).
 */
const BOTTLE_OUTLINE =
  'M 48 86 C 38 86 28 76 28 66 C 28 54 40 44 54 42 L 216 38 C 242 35 262 44 270 54 L 278 56 C 286 58 292 66 292 74 C 292 84 284 92 274 94 L 266 96 L 260 102 C 246 108 228 110 208 108 L 56 94 C 44 92 48 86 48 86 Z';

/** Wavy meniscus (SVG y matches liquid band ~52–90; group only translates x). */
const WAVE_EDGE_PATH =
  'M 0 52 L 3.5 58 L -1.2 64 L 4 70 L -0.5 76 L 3 82 L -1.5 88 L 2.5 90';

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

  const glowA = theme === 'red' ? 0.085 : 0.05;
  const glowB = theme === 'red' ? 0.025 : 0.016;

  const W = 300;
  const H = 132;

  const fillX = 54;
  const fillY = 52;
  const fillH = 38;
  const fillMaxW = 208;

  const widthKeyframes = reconnecting
    ? [fillMaxW]
    : staticMode
      ? [fillMaxW * 0.12]
      : [0, fillMaxW * 0.82, fillMaxW * 0.9, fillMaxW * 0.32, fillMaxW * 0.06, 0];

  const widthTransition =
    reconnecting
      ? { duration: 0.55, ease: easeLuxury }
      : staticMode
        ? {}
        : {
            duration: 5.4,
            repeat: Infinity,
            ease: easeLuxury,
            times: [0, 0.28, 0.42, 0.58, 0.78, 1],
          };

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
          transformOrigin: '50% 50%',
          WebkitTransformOrigin: '50% 50%',
        }}
        initial={false}
        animate={
          staticMode
            ? { y: 0, scale: 1 }
            : reconnecting
              ? { y: -2, scale: 1.02 }
              : { y: [0, 1.2, 0], scale: 1 }
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
            <clipPath id={`${id}-inner`} clipPathUnits="userSpaceOnUse">
              <path d={BOTTLE_INNER_CLIP} />
            </clipPath>
            <radialGradient id={`${id}-wash`} cx="50%" cy="48%" r="72%">
              <stop offset="0%" stopColor="var(--wine-400)" stopOpacity={glowA} />
              <stop offset="65%" stopColor="var(--wine-300)" stopOpacity={glowB} />
              <stop offset="100%" stopColor="var(--wine-300)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}-wine`} cx="35%" cy="45%" r="75%">
              <stop offset="0%" stopColor="var(--wine-500)" />
              <stop offset="55%" stopColor="var(--wine-600)" />
              <stop offset="100%" stopColor="var(--wine-700)" />
            </radialGradient>
            <linearGradient id={`${id}-cork`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d4b896" />
              <stop offset="45%" stopColor="#8b6239" />
              <stop offset="100%" stopColor="#4a3420" />
            </linearGradient>
            <linearGradient id={`${id}-pour`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--wine-500)" stopOpacity="0.65" />
              <stop offset="100%" stopColor="var(--wine-700)" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          <ellipse cx={148} cy={64} rx={128} ry={48} fill={`url(#${id}-wash)`} opacity={0.88} />

          {/* Soft silhouette under-paint */}
          <path
            d={BOTTLE_OUTLINE}
            fill="var(--wine-600)"
            fillOpacity={0.06}
            stroke="none"
          />

          {/* Wine (rect) + wavy meniscus stroke locked to same width keyframes */}
          <g clipPath={`url(#${id}-inner)`}>
            <motion.rect
              x={fillX}
              y={fillY}
              height={fillH}
              fill={`url(#${id}-wine)`}
              initial={false}
              animate={{ width: widthKeyframes }}
              transition={widthTransition}
            />
            {!staticMode && !reconnecting && (
              <motion.rect
                x={fillX}
                y={fillY}
                width={fillMaxW}
                height={fillH}
                fill="#fff5f0"
                fillOpacity={0.15}
                initial={false}
                animate={{ opacity: [0, 0.35, 0] }}
                transition={{ duration: 1.15, repeat: Infinity, ease: easeLuxury, repeatDelay: 2.4 }}
              />
            )}
            {/* Ink specks (sketch texture) */}
            {[
              [72, 62],
              [88, 74],
              [102, 58],
              [118, 70],
            ].map(([cx, cy], i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={0.9}
                fill="var(--wine-700)"
                fillOpacity={0.35}
              />
            ))}
          </g>

          {/* Wavy liquid edge — moves with fill width (HTML transform on wrapper would break SVG; use motion.g x) */}
          <g clipPath={`url(#${id}-inner)`}>
            <motion.g
              initial={false}
              animate={{ x: widthKeyframes.map((w) => fillX + w) }}
              transition={widthTransition}
              style={{ transformOrigin: '0px 0px' }}
            >
              <path
                d={WAVE_EDGE_PATH}
                stroke="var(--wine-700)"
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.92}
              />
            </motion.g>
          </g>

          {/* Bottle ink outline */}
          <path
            d={BOTTLE_OUTLINE}
            stroke="var(--text-primary)"
            strokeWidth={3.15}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Cork block */}
          <path
            d="M 268 52 L 286 56 L 288 66 L 286 76 L 268 80 L 266 70 Z"
            fill={`url(#${id}-cork)`}
            stroke="var(--text-primary)"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />

          {/* Pour toward cork */}
          <motion.path
            d="M 248 12 Q 268 36 278 52"
            stroke={`url(#${id}-pour)`}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={reconnecting ? undefined : '5 8 4 10'}
            animate={
              reconnecting
                ? { opacity: 0.88, strokeDashoffset: 0 }
                : staticMode
                  ? { opacity: 0.28, strokeDashoffset: 0 }
                  : {
                      opacity: [0.18, 0.62, 0.22, 0.52, 0.15],
                      strokeDashoffset: [0, -11, -4, -16],
                    }
            }
            transition={
              reconnecting
                ? { duration: 0.4, ease: easeLuxury }
                : staticMode
                  ? {}
                  : { duration: 2.1, repeat: Infinity, ease: 'linear' }
            }
          />

          {/* Wi‑Fi at cork */}
          <g transform="translate(278 44)" fill="none" strokeLinecap="round">
            {[
              { d: 'M 0 0 Q 14 -16 28 -8', del: 0 },
              { d: 'M 0 0 Q 8 -22 14 -32', del: 0.07 },
              { d: 'M 0 0 Q -14 -16 -28 -8', del: 0.03 },
            ].map((arc, i) => (
              <motion.path
                key={i}
                d={arc.d}
                stroke="var(--wine-600)"
                strokeWidth={1.75}
                strokeDasharray={reconnecting ? undefined : '3 6 2 8'}
                animate={
                  reconnecting
                    ? { opacity: 1 }
                    : staticMode
                      ? { opacity: 0.26 }
                      : { opacity: [0.1, 0.62, 0.15, 0.5, 0.08] }
                }
                transition={
                  reconnecting
                    ? { duration: 0.35 }
                    : staticMode
                      ? {}
                      : { duration: 1.65 + i * 0.12, repeat: Infinity, ease: easeLuxury, delay: arc.del }
                }
              />
            ))}
          </g>
        </svg>
      </motion.div>
    </div>
  );
}
