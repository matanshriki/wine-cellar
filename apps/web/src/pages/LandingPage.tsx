/**
 * Public marketing home — indexable by Google & cited by AI tools (with llms.txt).
 * Logged-in users are redirected to /cellar from App.tsx before this mounts.
 *
 * Video framing: file demos use a 9:16 stage with `object-fit: cover` so the picture
 * fills the phone “screen” edge-to-edge. Important end-card text should stay inside
 * the safe area in the source export; `contain` avoids crop but shrinks the video.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Wine, CalendarClock, UtensilsCrossed, ShieldCheck, Upload, Sparkles } from 'lucide-react';
import { trackCTAButtonClick } from '../lib/metaPixel';
import { Helmet } from 'react-helmet-async';
import { useTranslation, Trans } from 'react-i18next';
import { MetaHead } from '../components/MetaHead';
import {
  SITE_URL,
  organizationSchema,
  webSiteSchema,
  softwareApplicationSchema,
  webPageSchema,
  landingFaqSchema,
} from '../lib/seoSchemas';
import { resolveLandingDemoVideo } from '../lib/landingDemoVideo';
import type { LandingDemoResolved } from '../lib/landingDemoVideo';

const PROOF_CHIP_KEYS = ['vivino', 'label', 'windows', 'pwa', 'private'] as const;

/** Map legacy env paths to the current bundled landing demo asset. */
function normalizeLandingDemoVideoUrl(raw: string): string {
  const u = raw.trim();
  if (u === '/videos/sommi-demo.mp4' || u.endsWith('/videos/sommi-demo.mp4')) {
    return '/videos/sommi-ai-smarter.mp4';
  }
  if (u === '/videos/sommi-landing-demo.mp4' || u.endsWith('/videos/sommi-landing-demo.mp4')) {
    return '/videos/sommi-ai-smarter.mp4';
  }
  return u;
}

function videoSourceType(src: string): string | undefined {
  const path = src.split('?')[0].split('#')[0].toLowerCase();
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.mp4')) return 'video/mp4';
  if (path.endsWith('.ogg') || path.endsWith('.ogv')) return 'video/ogg';
  return undefined;
}

const ctaPrimaryClass =
  'inline-flex justify-center items-center min-h-[48px] px-7 sm:px-8 py-3.5 rounded-full text-base font-semibold text-white shadow-lg transition-[transform,box-shadow] duration-150 ease-out motion-safe:hover:-translate-y-px motion-safe:hover:shadow-xl';
const ctaPrimaryStyle: CSSProperties = {
  background: 'linear-gradient(135deg, #8b2741, #6b1f2f)',
  boxShadow: '0 12px 32px rgba(107, 31, 47, 0.28)',
};
const ctaGhostClass =
  'inline-flex justify-center items-center min-h-[48px] px-7 sm:px-8 py-3.5 rounded-full text-base font-semibold border transition-[transform,background-color,border-color] duration-150 ease-out motion-safe:hover:-translate-y-px';
const ctaGhostOnDark: CSSProperties = {
  borderColor: 'rgba(255,255,255,0.22)',
  color: '#f5f0e8',
  background: 'rgba(255,255,255,0.06)',
};
const ctaGhostOnLight: CSSProperties = {
  borderColor: 'rgba(74, 23, 34, 0.18)',
  color: '#2d1810',
  background: 'rgba(255,255,255,0.75)',
};

/**
 * Muted in-view autoplay: unmuted needs a user gesture, but many mobile browsers
 * (iOS, especially Private) still require a *real* user gesture for the *first*
 * `play()`. `IntersectionObserver` and timers are not gestures, so if autoplay
 * is blocked, we show a tap target that uses a true pointer event.
 * Respects prefers-reduced-motion.
 */
function LandingFileDemoVideo({
  src,
  poster,
  onError,
}: {
  src: string;
  poster?: string;
  onError: () => void;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inViewRef = useRef(false);
  const [inView, setInView] = useState(false);
  const [showTapToPlay, setShowTapToPlay] = useState(false);

  const armMuted = (video: HTMLVideoElement) => {
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', 'true');
    try {
      video.setAttribute('webkit-playsinline', 'true');
    } catch {
      // ignore
    }
  };

  const handleUserStart = () => {
    const video = videoRef.current;
    if (!video) return;
    armMuted(video);
    void video.play().then(() => setShowTapToPlay(false)).catch(() => {
      // Keep overlay so user can retry; native controls also work
    });
  };

  useEffect(() => {
    const video = videoRef.current;
    const box = containerRef.current;
    if (!video || !box) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const minVisible = isCoarse ? 0.1 : 0.25;
    let tapDebounce: ReturnType<typeof setTimeout> | undefined;

    const tryPlay = () => {
      armMuted(video);
      const p = video.play();
      if (p === undefined) return;
      p.catch(() => {
        const onReady = () => {
          armMuted(video);
          void video.play().catch(() => {});
        };
        video.addEventListener('canplay', onReady, { once: true });
        video.addEventListener('loadeddata', onReady, { once: true });
      });
    };

    const leave = () => {
      if (tapDebounce) {
        clearTimeout(tapDebounce);
        tapDebounce = undefined;
      }
      inViewRef.current = false;
      setInView(false);
      setShowTapToPlay(false);
      video.pause();
    };

    const enter = () => {
      inViewRef.current = true;
      setInView(true);
      setShowTapToPlay(false);
      tryPlay();
      if (isCoarse) {
        if (tapDebounce) {
          clearTimeout(tapDebounce);
        }
        tapDebounce = setTimeout(() => {
          tapDebounce = undefined;
          if (inViewRef.current && videoRef.current && videoRef.current.paused) {
            setShowTapToPlay(true);
          }
        }, 480);
      }
    };
    let inViewLatched = false;

    const onIo: IntersectionObserverCallback = (entries) => {
      for (const entry of entries) {
        const ok = entry.isIntersecting && entry.intersectionRatio >= minVisible;
        if (ok) {
          if (!inViewLatched) {
            inViewLatched = true;
            enter();
          } else if (video.paused) {
            tryPlay();
          }
        } else {
          inViewLatched = false;
          leave();
        }
      }
    };

    const io = new IntersectionObserver(onIo, {
      root: null,
      threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1],
      rootMargin: '60px 0px',
    });
    io.observe(box);

    const syncFromLayout = () => {
      const r = box.getBoundingClientRect();
      const vh = window.innerHeight;
      const visibleH = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      const ratio = r.height > 0 ? Math.max(0, visibleH) / r.height : 0;
      if (ratio >= minVisible) {
        if (!inViewLatched) {
          inViewLatched = true;
          enter();
        } else if (video.paused) {
          tryPlay();
        }
      } else {
        inViewLatched = false;
        leave();
      }
    };

    const c = { r0: 0, r1: 0, t1: undefined as ReturnType<typeof setTimeout> | undefined };
    c.r0 = requestAnimationFrame(() => {
      c.r1 = requestAnimationFrame(() => {
        syncFromLayout();
        c.t1 = setTimeout(syncFromLayout, 200);
      });
    });

    return () => {
      cancelAnimationFrame(c.r0);
      cancelAnimationFrame(c.r1);
      if (c.t1) clearTimeout(c.t1);
      if (tapDebounce) clearTimeout(tapDebounce);
      io.disconnect();
    };
  }, [src]);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-[#0c0a0b]">
      <video
        ref={videoRef}
        className="absolute inset-0 z-0 h-full w-full object-cover object-center"
        controls
        muted
        autoPlay={inView}
        playsInline
        preload="metadata"
        poster={poster}
        onError={onError}
        onPlaying={() => setShowTapToPlay(false)}
        onLoadStart={() => {
          const v = videoRef.current;
          if (v) armMuted(v);
        }}
        onLoadedData={() => {
          if (!inViewRef.current) return;
          const v = videoRef.current;
          if (!v) return;
          armMuted(v);
          void v.play().catch(() => {});
        }}
      >
        <source src={src} type={videoSourceType(src)} />
      </video>
      {showTapToPlay ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <button
            type="button"
            onClick={handleUserStart}
            className="pointer-events-auto min-h-[44px] min-w-[44px] rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg sm:text-base"
            style={{ background: 'linear-gradient(135deg, #a63552, #6b1f2f)' }}
            aria-label={t('landing.demoTapToPlay')}
          >
            {t('landing.demoTapToPlay')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function trackDemoAnchorClick(placement: string) {
  void trackCTAButtonClick({ placement, cta: 'watch_demo' });
}

function LandingDemoStage({
  demo,
  demoPoster,
  demoTitle,
}: {
  demo: LandingDemoResolved;
  demoPoster?: string;
  demoTitle: string;
}) {
  const inner =
    demo.kind === 'iframe' ? (
      <div className="relative aspect-video w-full overflow-hidden rounded-[1.35rem] bg-black">
        <iframe
          src={demo.src}
          title={demoTitle}
          className="absolute inset-0 h-full w-full border-0"
          allow={demo.allow}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    ) : (
      <div className="relative aspect-[9/16] w-full max-h-[min(82svh,680px)] sm:max-h-[min(78vh,640px)] overflow-hidden rounded-[1.35rem] bg-[#0c0a0b]">
        <LandingFileDemoVideo
          key={demo.src}
          src={demo.src}
          poster={demoPoster}
          onError={() => {
            console.error(
              '[Landing demo] Video failed to load:',
              demo.src,
              '— If this is /videos/…, the file must exist under apps/web/public/videos and be deployed. A missing file returns the SPA HTML and playback never starts.',
            );
          }}
        />
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-[min(360px,calc(100vw-1rem))] sm:max-w-[320px]">
      <div
        className="rounded-[2.25rem] p-[10px] sm:p-3 shadow-2xl border border-white/10"
        style={{
          background:
            'linear-gradient(165deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 42%, rgba(0,0,0,0.25) 100%), linear-gradient(180deg, #2a2426 0%, #120f10 100%)',
          boxShadow: '0 28px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset',
        }}
      >
        {/* “Dynamic island” hint */}
        <div className="flex justify-center pb-2">
          <div className="h-5 w-[4.25rem] rounded-full bg-black/55 ring-1 ring-white/10" aria-hidden />
        </div>
        {inner}
      </div>
    </div>
  );
}

export function LandingPage() {
  const { t, i18n } = useTranslation();

  const demoUrl = normalizeLandingDemoVideoUrl(
    import.meta.env.VITE_LANDING_DEMO_VIDEO_URL?.trim() || '/videos/sommi-ai-smarter.mp4',
  );
  const demoPoster = import.meta.env.VITE_LANDING_DEMO_VIDEO_POSTER?.trim();
  const demo = useMemo(() => resolveLandingDemoVideo(demoUrl), [demoUrl]);

  const jsonLd = useMemo(
    () => [
      organizationSchema(),
      webSiteSchema(),
      softwareApplicationSchema(),
      webPageSchema('/', t('landing.jsonLdPageTitle'), t('landing.metaDescription')),
      landingFaqSchema(),
    ],
    [t, i18n.language],
  );

  const heroSurface: CSSProperties = {
    background:
      'radial-gradient(ellipse 90% 60% at 50% -20%, rgba(139, 39, 65, 0.22), transparent 55%), linear-gradient(180deg, #141011 0%, #0e0c0d 55%, #121010 100%)',
  };

  const stoneSectionBg: CSSProperties = {
    background: 'linear-gradient(180deg, #f3eee6 0%, #ebe4d9 100%)',
  };

  return (
    <>
      <MetaHead
        title={undefined}
        description={t('landing.metaDescription')}
        url="/"
        jsonLd={jsonLd}
      />
      <Helmet>
        <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}/`} />
        <link rel="alternate" hrefLang="en" href={`${SITE_URL}/`} />
        <link rel="alternate" hrefLang="he" href={`${SITE_URL}/`} />
        <meta name="keywords" content={t('landing.metaKeywords')} />
      </Helmet>

      <main className="pb-28 md:pb-0" aria-labelledby="landing-hero-heading">
        {/* --- Premium hero (full-bleed dark) --- */}
        <section className="relative overflow-hidden border-b border-white/5" style={heroSurface}>
          <div className="absolute inset-0 pointer-events-none opacity-[0.07] bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.35%22/%3E%3C/svg%3E')] mix-blend-overlay" aria-hidden />

          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-10 sm:pb-16">
            <div className="max-w-3xl mx-auto text-center">
              <div className="min-w-0">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-3 sm:mb-4"
                  style={{ color: '#c9a227' }}
                >
                  {t('landing.eyebrow')}
                </p>
                <h1
                  id="landing-hero-heading"
                  className="text-[1.875rem] sm:text-5xl lg:text-[3.25rem] font-semibold tracking-tight leading-[1.08] mb-3 sm:mb-5"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: '#f7f1e8',
                    fontWeight: 650,
                  }}
                >
                  {t('landing.heroTitle')}
                </h1>
                <p
                  className="text-base sm:text-xl leading-snug sm:leading-relaxed mb-6 sm:mb-8 max-w-prose mx-auto"
                  style={{ color: 'rgba(245, 240, 232, 0.78)' }}
                >
                  {t('landing.heroSubtitle')}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center sm:justify-center mb-6 sm:mb-8">
                  <Link
                    to="/login"
                    className={ctaPrimaryClass}
                    style={ctaPrimaryStyle}
                    onClick={() => {
                      void trackCTAButtonClick({ placement: 'hero', cta: 'start_free' });
                    }}
                  >
                    {t('landing.ctaStartFree')}
                  </Link>
                  <a
                    href="#sommi-demo"
                    className={ctaGhostClass}
                    style={ctaGhostOnDark}
                    onClick={() => trackDemoAnchorClick('hero')}
                  >
                    {t('landing.ctaWatchDemo')}
                  </a>
                </div>

                <ul
                  className="flex flex-wrap justify-center gap-x-1.5 gap-y-2 sm:gap-x-2 sm:gap-y-2.5 list-none p-0 m-0"
                  aria-label={t('landing.proofChipsAria')}
                >
                  {PROOF_CHIP_KEYS.map((key) => (
                    <li
                      key={key}
                      className="inline-flex items-center rounded-full border px-3 py-1 text-xs sm:px-3.5 sm:py-1.5 sm:text-sm"
                      style={{
                        borderColor: 'rgba(255,255,255,0.14)',
                        color: 'rgba(245, 240, 232, 0.88)',
                        background: 'rgba(255,255,255,0.05)',
                      }}
                    >
                      {t(`landing.proofChip_${key}`)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* --- Proof strip (warm stone) --- */}
        <section
          className="border-b py-8 sm:py-10"
          style={{ ...stoneSectionBg, borderColor: 'rgba(74, 23, 34, 0.08)' }}
          aria-label={t('landing.proofStripAria')}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center sm:text-start">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex flex-col sm:flex-row sm:items-start gap-3 justify-center sm:justify-start">
                  <ShieldCheck
                    className="mx-auto sm:mx-0 h-8 w-8 shrink-0 opacity-90"
                    style={{ color: '#6b1f2f' }}
                    aria-hidden
                  />
                  <p className="text-sm sm:text-[0.9375rem] leading-relaxed" style={{ color: '#3d3530' }}>
                    {t(`landing.proofStrip_${n}`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {!demo ? <div id="sommi-demo" className="sr-only" aria-hidden /> : null}

        {demo ? (
          <section
            id="sommi-demo"
            className="scroll-mt-[5.75rem] border-b border-white/5 py-14 sm:py-20"
            style={{
              background:
                'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(139, 39, 65, 0.12), transparent 55%), linear-gradient(180deg, #121010 0%, #0e0c0d 100%)',
            }}
            aria-labelledby="landing-demo-heading"
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <h2
                id="landing-demo-heading"
                className="text-2xl sm:text-3xl font-semibold mb-2 text-center sm:text-start"
                style={{ fontFamily: 'var(--font-display)', color: '#f7f1e8' }}
              >
                {t('landing.demoTitle')}
              </h2>
              <p
                className="text-sm sm:text-base mb-2 text-center sm:text-start leading-relaxed max-w-2xl"
                style={{ color: 'rgba(245, 240, 232, 0.72)' }}
              >
                {t('landing.demoCaption')}
              </p>
              <p
                className="text-xs sm:text-sm mb-10 text-center sm:text-start leading-relaxed max-w-2xl"
                style={{ color: 'rgba(245, 240, 232, 0.5)' }}
              >
                {t('landing.demoAutoplayHint')}
              </p>
              <div className="flex justify-center">
                <LandingDemoStage demo={demo} demoPoster={demoPoster} demoTitle={t('landing.demoTitle')} />
              </div>
            </div>
          </section>
        ) : null}

        {/* --- Feature cards --- */}
        <section
          className="py-14 sm:py-20 border-b"
          style={{ ...stoneSectionBg, borderColor: 'rgba(74, 23, 34, 0.08)' }}
          aria-labelledby="landing-features-heading"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2
              id="landing-features-heading"
              className="text-2xl sm:text-3xl font-semibold mb-3 text-center sm:text-start"
              style={{ fontFamily: 'var(--font-display)', color: '#2d1810' }}
            >
              {t('landing.featuresSectionTitle')}
            </h2>
            <p
              className="text-center sm:text-start mb-10 max-w-2xl text-base leading-relaxed"
              style={{ color: '#5c534c' }}
            >
              {t('landing.featuresSectionSubtitle')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {(
                [
                  { k: 'open', Icon: Wine },
                  { k: 'when', Icon: CalendarClock },
                  { k: 'pair', Icon: UtensilsCrossed },
                ] as const
              ).map(({ k, Icon }) => (
                <div
                  key={k}
                  className="rounded-2xl border p-6 sm:p-7 transition-[transform,box-shadow,border-color] duration-150 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg"
                  style={{
                    borderColor: 'rgba(74, 23, 34, 0.12)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,252,248,0.72) 100%)',
                    boxShadow: '0 8px 32px rgba(45, 24, 16, 0.06)',
                  }}
                >
                  <div
                    className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      background: 'rgba(107, 31, 47, 0.08)',
                      color: '#6b1f2f',
                    }}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3
                    className="text-lg font-semibold mb-2"
                    style={{ fontFamily: 'var(--font-display)', color: '#2d1810' }}
                  >
                    {t(`landing.feature_${k}_title`)}
                  </h3>
                  <p className="text-sm sm:text-base leading-relaxed" style={{ color: '#5c534c' }}>
                    {t(`landing.feature_${k}_body`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- Privacy --- */}
        <section
          className="py-12 sm:py-16 border-b"
          style={{ background: '#e8e2d8', borderColor: 'rgba(74, 23, 34, 0.08)' }}
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div
              className="rounded-2xl border p-6 sm:p-8"
              style={{
                borderColor: 'rgba(74, 23, 34, 0.12)',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(247,241,232,0.35) 100%)',
              }}
            >
              <h2
                className="text-xl sm:text-2xl font-semibold mb-3 flex items-center gap-2"
                style={{ fontFamily: 'var(--font-display)', color: '#2d1810' }}
              >
                <ShieldCheck className="h-6 w-6 shrink-0" style={{ color: '#6b1f2f' }} aria-hidden />
                {t('landing.privacyTitle')}
              </h2>
              <p className="leading-relaxed text-sm sm:text-base" style={{ color: '#4a423b' }}>
                <Trans
                  i18nKey="landing.privacyBody"
                  components={{
                    privacyLink: (
                      <Link to="/privacy" className="underline font-medium" style={{ color: '#8b2741' }} />
                    ),
                    termsLink: <Link to="/terms" className="underline font-medium" style={{ color: '#8b2741' }} />,
                  }}
                />
              </p>
            </div>
          </div>
        </section>

        {/* --- How it works --- */}
        <section
          className="py-14 sm:py-20"
          style={{ background: '#f7f1e8' }}
          aria-labelledby="landing-how-heading"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2
              id="landing-how-heading"
              className="text-2xl sm:text-3xl font-semibold mb-10 text-center sm:text-start"
              style={{ fontFamily: 'var(--font-display)', color: '#2d1810' }}
            >
              {t('landing.howTitle')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10" role="list">
              {(
                [
                  { step: 1, Icon: Upload },
                  { step: 2, Icon: Sparkles },
                  { step: 3, Icon: Wine },
                ] as const
              ).map(({ step, Icon }) => (
                <div
                  key={step}
                  role="listitem"
                  className="relative flex flex-col items-center text-center md:items-start md:text-start"
                >
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md"
                    style={{ background: 'linear-gradient(135deg, #a63552, #6b1f2f)' }}
                    aria-hidden
                  >
                    <Icon className="h-6 w-6 text-white" strokeWidth={2} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#8b2741' }}>
                    {t('landing.howStepLabel', { step })}
                  </p>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: '#2d1810' }}>
                    {t(`landing.how${step}Title`)}
                  </h3>
                  <p className="text-sm sm:text-base leading-relaxed max-w-sm" style={{ color: '#5c534c' }}>
                    {t(`landing.how${step}Body`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- FAQ teaser (low on page) --- */}
        <section className="py-10 border-t" style={{ borderColor: 'rgba(74, 23, 34, 0.08)', background: '#f0ebe3' }}>
          <div className="max-w-3xl mx-auto px-4 text-center">
            <p className="text-sm sm:text-base" style={{ color: '#5c534c' }}>
              {t('landing.faqTeaser')}{' '}
              <Link to="/about" className="underline font-medium" style={{ color: '#8b2741' }}>
                {t('landing.faqLinkLabel')}
              </Link>
              .
            </p>
          </div>
        </section>

        {/* --- Final CTA --- */}
        <section
          className="py-14 sm:py-16 border-t"
          style={{
            borderColor: 'rgba(74, 23, 34, 0.1)',
            background: 'linear-gradient(180deg, #ebe4d9 0%, #e3dcd2 100%)',
          }}
          aria-labelledby="landing-final-cta"
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <p
              id="landing-final-cta"
              className="text-xl sm:text-2xl font-semibold mb-3"
              style={{ fontFamily: 'var(--font-display)', color: '#2d1810' }}
            >
              {t('landing.ctaFinalHeadline')}
            </p>
            <p className="text-base mb-8 leading-relaxed" style={{ color: '#5c534c' }}>
              {t('landing.ctaFinalSub')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center">
              <Link
                to="/login"
                className={ctaPrimaryClass}
                style={ctaPrimaryStyle}
                onClick={() => {
                  void trackCTAButtonClick({ placement: 'final', cta: 'start_free' });
                }}
              >
                {t('landing.ctaStartFree')}
              </Link>
              <a
                href="#sommi-demo"
                className={ctaGhostClass}
                style={ctaGhostOnLight}
                onClick={() => trackDemoAnchorClick('final')}
              >
                {t('landing.ctaWatchDemo')}
              </a>
            </div>
          </div>
        </section>
      </main>

      <aside
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t px-4 pt-3"
        style={{
          background: 'var(--bg-nav, rgba(255, 255, 255, 0.96))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: 'var(--border-subtle)',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.06)',
        }}
        aria-label={t('landing.stickyCtaAriaLabel')}
      >
        <Link
          to="/login"
          className="flex w-full items-center justify-center rounded-full py-3.5 text-base font-semibold text-white shadow-lg active:opacity-95"
          style={ctaPrimaryStyle}
          onClick={() => {
            void trackCTAButtonClick({ placement: 'sticky', cta: 'start_free' });
          }}
        >
          {t('landing.ctaStartFree')}
        </Link>
      </aside>
    </>
  );
}
