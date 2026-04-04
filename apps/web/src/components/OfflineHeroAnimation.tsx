/**
 * Premium offline hero: horizontal bottle + Wi‑Fi slash, wine fills from empty then
 * “breathes”; “NO CONNECTION” fades in as the liquid reaches the label. Framer Motion;
 * respects reduced motion; reconnect fills to 100%.
 */

import { useEffect, useId, useState } from 'react';
import { motion } from 'framer-motion';

export type OfflineHeroPhase = 'offline' | 'reconnect';

const easeInOut = [0.42, 0, 0.58, 1] as const;

const VB = 512;
const CLIP_X = 80;
const CLIP_Y = 216;
const CLIP_H = 78;
const CLIP_RX = 8;
const WINE_MAX_W = 292;

/** After intro: liquid fills enough to reveal full "NO CONNECTION" (text ends ~x 311). */
const W_INTRO_TARGET = WINE_MAX_W * 0.82;
const W_OFFLINE_LOW = WINE_MAX_W * 0.76;
const W_OFFLINE_HIGH = WINE_MAX_W * 0.88;

const INTRO_S = 3.5;

const LIQUID_LEFT = 80;
const LIQUID_RIGHT = 372;
const LIQUID_BOTTOM = 294;

function liquidPath(ys: readonly [number, number, number, number, number, number, number]): string {
  const [y0, y1, y2, y3, y4, y5, y6] = ys;
  return [
    `M ${LIQUID_LEFT} ${LIQUID_BOTTOM}`,
    `L ${LIQUID_LEFT} ${y0}`,
    `L 100 ${y1}`,
    `L 160 ${y2}`,
    `L 220 ${y3}`,
    `L 280 ${y4}`,
    `L 340 ${y5}`,
    `L ${LIQUID_RIGHT} ${y6}`,
    `L ${LIQUID_RIGHT} ${LIQUID_BOTTOM}`,
    'Z',
  ].join(' ');
}

function shinePath(ys: readonly [number, number, number, number, number, number, number]): string {
  const [, y1, y2, y3, y4, y5] = ys;
  return `M 92 ${ys[0] + 2} L 120 ${y1 - 1} L 180 ${y2 + 1} L 240 ${y3 - 1} L 300 ${y4 + 1} L 360 ${y5 - 1}`;
}

const WAVE_FRAMES = [
  liquidPath([222, 216, 228, 218, 232, 220, 224]),
  liquidPath([226, 230, 218, 228, 216, 226, 222]),
  liquidPath([220, 224, 226, 220, 228, 218, 226]),
  liquidPath([224, 218, 232, 222, 226, 224, 220]),
] as const;

const SHINE_FRAMES = [
  shinePath([222, 216, 228, 218, 232, 220, 224]),
  shinePath([226, 230, 218, 228, 216, 226, 222]),
  shinePath([220, 224, 226, 220, 228, 218, 226]),
  shinePath([224, 218, 232, 222, 226, 224, 220]),
] as const;

const WAVE_STATIC = liquidPath([224, 220, 226, 222, 224, 222, 224]);
const SHINE_STATIC = shinePath([224, 220, 226, 222, 224, 222, 224]);

interface Props {
  phase: OfflineHeroPhase;
  reducedMotion: boolean;
}

export function OfflineHeroAnimation({ phase, reducedMotion }: Props) {
  const uid = useId().replace(/:/g, '');
  const clipId = `wine-clip-${uid}`;

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
        ? { width: WINE_MAX_W }
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
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <motion.rect
              x={CLIP_X}
              y={CLIP_Y}
              height={CLIP_H}
              rx={CLIP_RX}
              ry={CLIP_RX}
              initial={clipInitial}
              animate={clipAnimate}
              transition={clipTransition}
            />
          </clipPath>
        </defs>

        <motion.g
          id="glow"
          style={{ transformOrigin: '256px 270px', transformBox: 'fill-box' }}
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
            cx={256}
            cy={270}
            rx={190}
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
          <motion.g
            id="wine-wave"
            clipPath={`url(#${clipId})`}
            style={{ transformOrigin: '226px 255px' }}
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
              x={226}
              y={256}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#FFFFFF"
              fontSize={19}
              fontWeight={700}
              letterSpacing="0.12em"
              style={{
                fontFamily:
                  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
              NO CONNECTION
            </motion.text>
          </motion.g>

          <g id="bottle-outline" fill="none">
            <path
              d="M375 300 H80 c-16.5 0 -30 -13.5 -30 -30 v-30 c0 -16.5 13.5 -30 30 -30 h295 c30 0 35 15 45 25 l45 5 c11 1.2 20 10 20 21 v18 c0 11 -9 19.8 -20 21 l-45 5 c-10 10 -15 25 -45 25 Z"
              stroke="var(--text-secondary)"
              strokeWidth={10}
              strokeLinejoin="round"
            />
            <path
              d="M90 220 h260"
              stroke="var(--text-inverse, #fff)"
              strokeWidth={4}
              opacity={0.22}
              strokeLinecap="round"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
