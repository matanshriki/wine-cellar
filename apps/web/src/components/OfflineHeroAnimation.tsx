/**
 * Premium offline hero: horizontal bottle + Wi‑Fi slash, wine fills from empty then
 * "breathes"; "NO CONNECTION" fades in as the liquid reaches the label. Framer Motion;
 * respects reduced motion; reconnect fills to 100%.
 */

import { useEffect, useId, useState } from 'react';
import { motion } from 'framer-motion';

export type OfflineHeroPhase = 'offline' | 'reconnect';

const easeInOut = [0.42, 0, 0.58, 1] as const;

const VB = 512;

/** Smooth bottle outline — single closed path matching reference silhouette. */
const BOTTLE_OUTLINE =
  'M 55 255 C 55 211 69 211 97 211 H 320 C 348 211 363 227 373 244 H 420 ' +
  'C 420 241 428 238 435 238 C 445 238 449 246 449 255 ' +
  'C 449 264 445 272 435 272 C 428 272 420 269 420 266 ' +
  'H 373 C 363 283 348 299 320 299 H 97 C 69 299 55 299 55 255 Z';

/** Inner cavity contour — used as clipPath so wine fills the bottle shape. */
const BOTTLE_CAVITY =
  'M 61 255 C 61 218 73 217 100 217 H 316 C 340 217 354 231 364 248 H 416 ' +
  'C 416 245 422 243 429 243 C 438 243 443 249 443 255 ' +
  'C 443 261 438 267 429 267 C 422 267 416 265 416 262 ' +
  'H 364 C 354 279 340 293 316 293 H 100 C 73 293 61 292 61 255 Z';

const CAVITY_X = 61;
const CAVITY_WIDTH = 382;

const W_INTRO_TARGET = CAVITY_WIDTH * 0.82;
const W_OFFLINE_LOW = CAVITY_WIDTH * 0.76;
const W_OFFLINE_HIGH = CAVITY_WIDTH * 0.88;

const INTRO_S = 3.5;

const LIQUID_LEFT = 61;
const LIQUID_RIGHT = 443;
const LIQUID_BOTTOM = 293;

function liquidPath(
  ys: readonly [number, number, number, number, number, number, number],
): string {
  const [y0, y1, y2, y3, y4, y5, y6] = ys;
  return [
    `M ${LIQUID_LEFT} ${LIQUID_BOTTOM}`,
    `L ${LIQUID_LEFT} ${y0}`,
    `L 120 ${y1}`,
    `L 180 ${y2}`,
    `L 240 ${y3}`,
    `L 300 ${y4}`,
    `L 370 ${y5}`,
    `L ${LIQUID_RIGHT} ${y6}`,
    `L ${LIQUID_RIGHT} ${LIQUID_BOTTOM}`,
    'Z',
  ].join(' ');
}

function shinePath(
  ys: readonly [number, number, number, number, number, number, number],
): string {
  const [, y1, y2, y3, y4, y5] = ys;
  return `M 80 ${ys[0] + 2} L 120 ${y1 - 1} L 180 ${y2 + 1} L 240 ${y3 - 1} L 300 ${y4 + 1} L 370 ${y5 - 1}`;
}

const WAVE_FRAMES = [
  liquidPath([232, 226, 238, 228, 240, 230, 234]),
  liquidPath([236, 240, 228, 236, 226, 236, 232]),
  liquidPath([230, 234, 236, 230, 238, 228, 236]),
  liquidPath([234, 228, 240, 232, 234, 234, 230]),
] as const;

const SHINE_FRAMES = [
  shinePath([232, 226, 238, 228, 240, 230, 234]),
  shinePath([236, 240, 228, 236, 226, 236, 232]),
  shinePath([230, 234, 236, 230, 238, 228, 236]),
  shinePath([234, 228, 240, 232, 234, 234, 230]),
] as const;

const WAVE_STATIC = liquidPath([234, 230, 236, 232, 234, 232, 234]);
const SHINE_STATIC = shinePath([234, 230, 236, 232, 234, 232, 234]);

interface Props {
  phase: OfflineHeroPhase;
  reducedMotion: boolean;
  /** Localized label inside the wine fill (e.g. NO CONNECTION / אין אינטרנט). */
  labelText: string;
  /** When true, SVG text uses RTL bidi hints for Hebrew. */
  bottleTextRtl?: boolean;
}

export function OfflineHeroAnimation({
  phase,
  reducedMotion,
  labelText,
  bottleTextRtl = false,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const cavityClipId = `cavity-${uid}`;
  const fillClipId = `fill-${uid}`;

  const rm = reducedMotion;
  const reconnecting = phase === 'reconnect';

  const [fillIntroDone, setFillIntroDone] = useState(rm);

  useEffect(() => {
    if (rm || reconnecting) return;
    const t = window.setTimeout(() => setFillIntroDone(true), INTRO_S * 1000);
    return () => window.clearTimeout(t);
  }, [rm, reconnecting]);

  useEffect(() => {
    if (rm) setFillIntroDone(true);
  }, [rm]);

  const allowSlosh = fillIntroDone && !rm && !reconnecting;
  const liquidKeyframes = [...WAVE_FRAMES, WAVE_FRAMES[0]] as string[];
  const shineKeyframes = [...SHINE_FRAMES, SHINE_FRAMES[0]] as string[];

  const clipAnimate =
    rm
      ? { width: W_INTRO_TARGET }
      : reconnecting
        ? { width: CAVITY_WIDTH }
        : fillIntroDone
          ? { width: [W_INTRO_TARGET, W_OFFLINE_HIGH, W_OFFLINE_LOW, W_INTRO_TARGET] }
          : { width: W_INTRO_TARGET };

  const clipTransition =
    rm
      ? { duration: 0 }
      : reconnecting
        ? { duration: 0.6, ease: easeInOut }
        : fillIntroDone
          ? { duration: 4.2, repeat: Infinity, ease: easeInOut }
          : { duration: INTRO_S, ease: easeInOut };

  const clipInitial = rm ? { width: W_INTRO_TARGET } : { width: 0 };

  return (
    <div
      className="relative mx-auto flex w-full max-w-[min(100%,320px)] shrink-0 justify-center"
      style={{ aspectRatio: `${VB} / ${VB}` }}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${VB} ${VB}`}
        className="h-auto w-full max-h-[min(85vw,320px)]"
        fill="none"
      >
        <defs>
          <clipPath id={cavityClipId} clipPathUnits="userSpaceOnUse">
            <path d={BOTTLE_CAVITY} />
          </clipPath>
          <clipPath id={fillClipId} clipPathUnits="userSpaceOnUse">
            <motion.rect
              x={CAVITY_X}
              y={200}
              height={120}
              initial={clipInitial}
              animate={clipAnimate}
              transition={clipTransition}
            />
          </clipPath>
        </defs>

        <motion.g
          id="glow"
          style={{ transformOrigin: '252px 285px', transformBox: 'fill-box' }}
          initial={false}
          animate={
            rm
              ? { opacity: 0.12, scale: 1 }
              : { opacity: [0.1, 0.16, 0.1], scale: [1, 1.02, 1] }
          }
          transition={
            rm ? { duration: 0 } : { duration: 3.8, repeat: Infinity, ease: easeInOut }
          }
        >
          <ellipse
            cx={252}
            cy={285}
            rx={200}
            ry={118}
            fill="var(--wine-500)"
            fillOpacity={0.22}
          />
        </motion.g>

        <g id="wifi-offline" stroke="var(--text-secondary)" strokeLinecap="round">
          <motion.path
            id="wifi-arc-1"
            d="M198 122c16.2-12.7 36.8-20 58-20s41.8 7.3 58 20"
            strokeWidth={12}
            fill="none"
            initial={false}
            animate={
              rm
                ? { opacity: 0.35 }
                : reconnecting
                  ? { opacity: [0.35, 1, 0], strokeDashoffset: 0 }
                  : { opacity: [0.2, 0.9, 0.2], strokeDashoffset: [0, -4, 0] }
            }
            transition={
              rm
                ? { duration: 0 }
                : reconnecting
                  ? { duration: 1, ease: easeInOut, times: [0, 0.4, 1] }
                  : {
                      opacity: { duration: 1.8, repeat: Infinity, ease: easeInOut },
                      strokeDashoffset: { duration: 2.2, repeat: Infinity, ease: 'linear' },
                    }
            }
            strokeDasharray="4 10"
          />
          <motion.path
            id="wifi-arc-2"
            d="M220 153.5c10.2-6.5 22.8-10.5 36-10.5s25.8 4 36 10.5"
            strokeWidth={12}
            fill="none"
            initial={false}
            animate={
              rm
                ? { opacity: 0.28 }
                : reconnecting
                  ? { opacity: [0.28, 1, 0] }
                  : { opacity: [0.1, 0.6, 0.1], strokeDashoffset: [0, -6, 0] }
            }
            transition={
              rm
                ? { duration: 0 }
                : reconnecting
                  ? { duration: 1, ease: easeInOut, times: [0, 0.4, 1] }
                  : {
                      opacity: { duration: 2.2, repeat: Infinity, ease: easeInOut },
                      strokeDashoffset: { duration: 2.5, repeat: Infinity, ease: 'linear' },
                    }
            }
            strokeDasharray="3 8"
          />
          <motion.circle
            id="wifi-arc-3"
            cx={256}
            cy={195}
            r={10}
            fill="var(--text-secondary)"
            stroke="none"
            initial={false}
            animate={
              rm
                ? { opacity: 0.22 }
                : reconnecting
                  ? { opacity: [0.22, 1, 0] }
                  : { opacity: [0.05, 0.35, 0.05] }
            }
            transition={
              rm
                ? { duration: 0 }
                : reconnecting
                  ? { duration: 1, ease: easeInOut, times: [0, 0.4, 1] }
                  : { duration: 2.6, repeat: Infinity, ease: easeInOut }
            }
          />
          <motion.line
            x1={170}
            y1={90}
            x2={342}
            y2={220}
            strokeWidth={12}
            initial={false}
            animate={
              rm
                ? { opacity: 0.45 }
                : reconnecting
                  ? { opacity: [0.45, 0.85, 0.2] }
                  : { opacity: [0.25, 0.55, 0.25] }
            }
            transition={
              rm
                ? { duration: 0 }
                : reconnecting
                  ? { duration: 1, times: [0, 0.35, 1], ease: easeInOut }
                  : { duration: 2.4, repeat: Infinity, ease: easeInOut }
            }
          />
        </g>

        <g id="bottle-group" transform="translate(0, 30)">
          <g clipPath={`url(#${cavityClipId})`}>
            <motion.g
              id="wine-wave"
              clipPath={`url(#${fillClipId})`}
              style={{ transformOrigin: '200px 260px' }}
              initial={false}
              animate={
                allowSlosh
                  ? { x: [-5, 5, -5], rotate: [-0.35, 0.35, -0.35] }
                  : { x: 0, rotate: 0 }
              }
              transition={
                allowSlosh
                  ? { duration: 2.8, repeat: Infinity, ease: easeInOut }
                  : { duration: 0.35, ease: easeInOut }
              }
            >
              <motion.path
                id="wine-liquid"
                fill="#6B1431"
                opacity={reconnecting ? 1 : 0.97}
                initial={false}
                animate={{ d: allowSlosh ? liquidKeyframes : WAVE_STATIC }}
                transition={
                  allowSlosh
                    ? { duration: 3.2, repeat: Infinity, ease: easeInOut }
                    : { duration: 0 }
                }
              />
              <motion.path
                fill="none"
                stroke="var(--text-inverse, #fff)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.4}
                initial={false}
                animate={{ d: allowSlosh ? shineKeyframes : SHINE_STATIC }}
                transition={
                  allowSlosh
                    ? { duration: 3.2, repeat: Infinity, ease: easeInOut }
                    : { duration: 0 }
                }
              />
              <motion.text
                id="no-connection-text"
                x={200}
                y={262}
                textAnchor="middle"
                dominantBaseline="central"
                direction={bottleTextRtl ? 'rtl' : 'ltr'}
                unicodeBidi={bottleTextRtl ? 'embed' : undefined}
                lang={bottleTextRtl ? 'he' : 'en'}
                fill="#FFFFFF"
                fontSize={19}
                fontWeight={700}
                letterSpacing="0.12em"
                style={{
                  fontFamily:
                    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  direction: bottleTextRtl ? 'rtl' : 'ltr',
                }}
                initial={{ opacity: rm ? 1 : 0 }}
                animate={{
                  opacity:
                    rm || reconnecting
                      ? 1
                      : fillIntroDone
                        ? 1
                        : [0, 0, 0.08, 0.45, 1],
                }}
                transition={
                  rm || reconnecting
                    ? { duration: 0 }
                    : fillIntroDone
                      ? { duration: 0.2 }
                      : {
                          duration: INTRO_S,
                          times: [0, 0.38, 0.52, 0.72, 1],
                          ease: easeInOut,
                        }
                }
              >
                {labelText}
              </motion.text>
            </motion.g>
          </g>

          <g id="bottle-outline" fill="none">
            <path
              d={BOTTLE_OUTLINE}
              stroke="var(--text-secondary)"
              strokeWidth={10}
              strokeLinejoin="round"
            />
            <path
              d="M 100 219 H 316"
              stroke="var(--text-inverse, #fff)"
              strokeWidth={3}
              opacity={0.16}
              strokeLinecap="round"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
