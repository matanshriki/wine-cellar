import type { FC } from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { activeOnScreen, activeVoiceover, captionsByLocale, type CaptionLocale } from './captions';
import { theme } from './theme';
import { PhoneChrome } from './ui/PhoneChrome';
import { AppCellarScreen } from './ui/AppCellarScreen';
import { AppAskScreen } from './ui/AppAskScreen';
import { AppResultScreen } from './ui/AppResultScreen';

type Props = {
  locale: CaptionLocale;
};

/**
 * Hybrid launch cut:
 * 0–3.5s  atmosphere hook
 * 3.5–9s  real-app cellar UI (phone)
 * 9–14s   ask Sommi (phone)
 * 14–20s  recommendation from cellar (phone)
 * 20–24s  brand + CTA
 */
export const SommiLaunch: FC<Props> = ({ locale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;
  const script = captionsByLocale[locale];
  const dir = script.dir;
  const line = activeOnScreen(script, timeSec);
  const vo = activeVoiceover(script, timeSec);

  const hookEnd = Math.round(3.5 * fps);
  const cellarEnd = Math.round(9 * fps);
  const askEnd = Math.round(14 * fps);
  const resultEnd = Math.round(20 * fps);

  const phoneEnter = spring({
    frame: Math.max(0, frame - hookEnd + 4),
    fps,
    config: { damping: 16, stiffness: 110 },
  });
  const phoneScale = interpolate(phoneEnter, [0, 1], [0.94, 1]);
  const phoneOpacity = interpolate(phoneEnter, [0, 1], [0, 1], { extrapolateRight: 'clamp' });

  const showPhone = frame >= hookEnd - 6 && frame < resultEnd;
  const showHook = frame < cellarEnd;
  const showEnd = frame >= resultEnd;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.burgundy, direction: dir }}>
      {/* Atmosphere backgrounds */}
      <Sequence from={0} durationInFrames={hookEnd + Math.round(1.2 * fps)} layout="none">
        <Atmosphere bg="hero-table.jpg" dim={0.35} />
      </Sequence>
      <Sequence from={hookEnd} durationInFrames={resultEnd - hookEnd} layout="none">
        <Atmosphere bg="decision.jpg" dim={0.62} />
      </Sequence>
      <Sequence from={resultEnd} layout="none">
        <Atmosphere bg="hero-table.jpg" dim={0.55} />
      </Sequence>

      {/* Brand chip during story */}
      {!showEnd ? (
        <div
          style={{
            position: 'absolute',
            top: 64,
            insetInlineStart: 48,
            color: theme.gold,
            fontFamily: 'Rubik, Assistant, system-ui, sans-serif',
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: dir === 'rtl' ? 0 : '0.14em',
            textTransform: 'uppercase',
            zIndex: 20,
            opacity: showPhone ? 0.9 : 1,
          }}
        >
          Sommi
        </div>
      ) : null}

      {/* Hook captions */}
      {showHook && frame < hookEnd + 8 ? (
        <div
          style={{
            position: 'absolute',
            bottom: 180,
            insetInline: 56,
            zIndex: 15,
            opacity: interpolate(frame, [0, 12, hookEnd - 10, hookEnd + 6], [0, 1, 1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 52,
              fontWeight: 650,
              color: theme.ivory,
              lineHeight: 1.15,
              textAlign: dir === 'rtl' ? 'right' : 'left',
            }}
          >
            {line}
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: 'Rubik, Assistant, system-ui, sans-serif',
              fontSize: 28,
              color: 'rgba(247,241,232,0.8)',
              lineHeight: 1.4,
              textAlign: dir === 'rtl' ? 'right' : 'left',
            }}
          >
            {vo}
          </div>
        </div>
      ) : null}

      {/* Phone with real-app-style screens */}
      {showPhone ? (
        <AbsoluteFill
          style={{
            opacity: phoneOpacity,
            transform: `scale(${phoneScale})`,
            zIndex: 10,
          }}
        >
          <PhoneChrome>
            {frame < cellarEnd ? <AppCellarScreen locale={locale} /> : null}
            {frame >= cellarEnd && frame < askEnd ? <AppAskScreen locale={locale} /> : null}
            {frame >= askEnd && frame < resultEnd ? <AppResultScreen locale={locale} /> : null}
          </PhoneChrome>
        </AbsoluteFill>
      ) : null}

      {/* Lower VO while phone is up */}
      {showPhone && !showEnd ? (
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            insetInline: 56,
            zIndex: 20,
            fontFamily: 'Rubik, Assistant, system-ui, sans-serif',
            fontSize: 24,
            color: 'rgba(247,241,232,0.88)',
            textAlign: 'center',
            textShadow: '0 2px 12px rgba(0,0,0,0.45)',
          }}
        >
          {vo}
        </div>
      ) : null}

      {/* End card */}
      {showEnd ? (
        <AbsoluteFill
          style={{
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 28,
            padding: 64,
            textAlign: 'center',
            background: 'rgba(20, 12, 14, 0.42)',
          }}
        >
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 76,
              fontWeight: 650,
              color: theme.ivory,
            }}
          >
            Sommi
          </div>
          <div
            style={{
              fontFamily: 'Rubik, Assistant, system-ui, sans-serif',
              fontSize: 34,
              color: 'rgba(247,241,232,0.9)',
              maxWidth: 820,
              lineHeight: 1.35,
            }}
          >
            {locale === 'he'
              ? 'הסומלייה האישי שלכם, סביב היינות שכבר יש לכם'
              : 'Your personal AI sommelier, built around the wines you already own'}
          </div>
          <div
            style={{
              marginTop: 8,
              padding: '22px 48px',
              borderRadius: 999,
              background: `linear-gradient(135deg, ${theme.burgundyBright}, ${theme.burgundyMid})`,
              color: '#fff',
              fontFamily: 'Rubik, system-ui, sans-serif',
              fontSize: 34,
              fontWeight: 600,
            }}
          >
            {line}
          </div>
          <div style={{ fontFamily: 'Rubik, system-ui, sans-serif', fontSize: 26, color: theme.gold }}>
            sommi-ai.com
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

function Atmosphere({ bg, dim }: { bg: string; dim: number }) {
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(bg)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <AbsoluteFill style={{ background: `rgba(26,16,20,${dim})` }} />
    </AbsoluteFill>
  );
}
