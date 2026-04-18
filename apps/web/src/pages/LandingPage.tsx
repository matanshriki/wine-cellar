/**
 * Public marketing home — indexable by Google & cited by AI tools (with llms.txt).
 * Logged-in users are redirected to /cellar from App.tsx before this mounts.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
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
} from '../lib/seoSchemas';
import { resolveLandingDemoVideo } from '../lib/landingDemoVideo';

const WHY_KEYS = [1, 2, 3, 4, 5] as const;

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
  'inline-flex justify-center px-8 py-3.5 rounded-full text-base font-semibold text-white shadow-lg';
const ctaPrimaryStyle: CSSProperties = {
  background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
};
const ctaSecondaryClass =
  'inline-flex justify-center px-8 py-3.5 rounded-full text-base font-semibold border';
const ctaSecondaryStyle: CSSProperties = {
  borderColor: 'var(--border-default)',
  color: 'var(--text-primary)',
  background: 'var(--bg-surface)',
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
    <div ref={containerRef} className="absolute inset-0">
      <video
        ref={videoRef}
        className="absolute inset-0 z-0 h-full w-full object-contain bg-black/5"
        controls
        muted
        autoPlay={inView}
        playsInline
        preload="auto"
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
            style={{ background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))' }}
            aria-label={t('landing.demoTapToPlay')}
          >
            {t('landing.demoTapToPlay')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LandingCtaPair({ variant = 'center' }: { variant?: 'hero' | 'center' }) {
  const { t } = useTranslation();
  const row =
    variant === 'hero'
      ? 'flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center sm:justify-start items-stretch sm:items-center w-full'
      : 'flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center w-full max-w-xl mx-auto';
  return (
    <div className={row}>
      <Link
        to="/login"
        className={ctaPrimaryClass}
        style={ctaPrimaryStyle}
        onClick={() => {
          void trackCTAButtonClick({ placement: variant === 'hero' ? 'hero' : 'center' });
        }}
      >
        {t('landing.ctaOpen')}
      </Link>
      <Link to="/about" className={ctaSecondaryClass} style={ctaSecondaryStyle}>
        {t('landing.ctaAbout')}
      </Link>
    </div>
  );
}

export function LandingPage() {
  const { t, i18n } = useTranslation();

  /** Bundled default; override with VITE_LANDING_DEMO_VIDEO_URL (YouTube/Vimeo or another file path). */
  const demoUrl = normalizeLandingDemoVideoUrl(
    import.meta.env.VITE_LANDING_DEMO_VIDEO_URL?.trim() ||
      '/videos/sommi-ai-smarter.mp4',
  );
  const demoPoster = import.meta.env.VITE_LANDING_DEMO_VIDEO_POSTER?.trim();
  const demo = useMemo(() => resolveLandingDemoVideo(demoUrl), [demoUrl]);

  const jsonLd = useMemo(
    () => [
      organizationSchema(),
      webSiteSchema(),
      softwareApplicationSchema(),
      webPageSchema('/', t('landing.jsonLdPageTitle'), t('landing.metaDescription')),
    ],
    [t, i18n.language],
  );

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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-28 md:py-16">
        <article>
          <header className="mb-12 text-center sm:text-start">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-4"
              style={{ color: 'var(--wine-500)' }}
            >
              {t('landing.eyebrow')}
            </p>
            <h1
              className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-6"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-heading)' }}
            >
              {t('landing.heroTitle')}
            </h1>
            <p className="text-lg sm:text-xl leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
              {t('landing.heroSubtitle')}
            </p>
            <LandingCtaPair variant="hero" />
          </header>

          {demo && (
            <section className="mb-14" aria-labelledby="landing-demo-heading">
              <h2
                id="landing-demo-heading"
                className="text-2xl font-bold mb-2 text-center sm:text-start"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-heading)' }}
              >
                {t('landing.demoTitle')}
              </h2>
              <p
                className="text-sm sm:text-base mb-2 text-center sm:text-start leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('landing.demoCaption')}
              </p>
              <p
                className="text-xs sm:text-sm mb-4 text-center sm:text-start leading-relaxed"
                style={{ color: 'var(--text-tertiary, var(--text-secondary))' }}
              >
                {t('landing.demoAutoplayHint')}
              </p>
              <div
                className="relative w-full aspect-video overflow-hidden rounded-2xl border shadow-lg"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}
              >
                {demo.kind === 'iframe' ? (
                  <iframe
                    src={demo.src}
                    title={t('landing.demoTitle')}
                    className="absolute inset-0 h-full w-full border-0"
                    allow={demo.allow}
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
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
                )}
              </div>
            </section>
          )}

          <section className="mb-14" aria-labelledby="why-sommi">
            <h2 id="why-sommi" className="text-2xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
              {t('landing.whyTitle')}
            </h2>
            <ul className="space-y-4 text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {WHY_KEYS.map(n => (
                <li key={n}>
                  <strong style={{ color: 'var(--text-primary)' }}>{t(`landing.why${n}Lead`)}</strong>{' '}
                  {t(`landing.why${n}Body`)}
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-14" aria-labelledby="who-for">
            <h2 id="who-for" className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {t('landing.whoTitle')}
            </h2>
            <p className="leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              <Trans
                i18nKey="landing.whoBody"
                components={{ em1: <em />, em2: <em />, em3: <em /> }}
              />
            </p>
          </section>

          <section className="mb-14 pt-4 border-t text-center" style={{ borderColor: 'var(--border-subtle)' }} aria-labelledby="landing-cta-mid">
            <p
              id="landing-cta-mid"
              className="text-base sm:text-lg font-medium mb-5 leading-snug"
              style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display)' }}
            >
              {t('landing.ctaMidPrompt')}
            </p>
            <LandingCtaPair />
          </section>

          <section className="mb-10 rounded-2xl p-6 sm:p-8 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface-2)' }}>
            <h2 className="text-xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              {t('landing.privacyTitle')}
            </h2>
            <p className="leading-relaxed text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
              <Trans
                i18nKey="landing.privacyBody"
                components={{
                  privacyLink: (
                    <Link to="/privacy" className="underline font-medium" style={{ color: 'var(--wine-600)' }} />
                  ),
                  termsLink: (
                    <Link to="/terms" className="underline font-medium" style={{ color: 'var(--wine-600)' }} />
                  ),
                }}
              />
            </p>
          </section>

          <section
            className="mb-10 rounded-2xl border p-6 sm:p-8 text-center"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'linear-gradient(180deg, var(--bg-surface-2) 0%, var(--bg-surface) 100%)',
              boxShadow: 'var(--shadow-card, 0 4px 24px rgba(0,0,0,0.06))',
            }}
            aria-labelledby="landing-cta-bottom"
          >
            <p
              id="landing-cta-bottom"
              className="text-base sm:text-lg font-medium mb-5 leading-snug"
              style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display)' }}
            >
              {t('landing.ctaBottomPrompt')}
            </p>
            <LandingCtaPair />
          </section>

          <p className="text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('landing.faqTeaser')}{' '}
            <Link to="/about" className="underline font-medium" style={{ color: 'var(--wine-600)' }}>
              {t('landing.faqLinkLabel')}
            </Link>
            .
          </p>
        </article>
      </main>

      {/* Mobile-only sticky CTA — desktop uses repeated in-page CTAs */}
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
            void trackCTAButtonClick({ placement: 'sticky' });
          }}
        >
          {t('landing.ctaOpen')}
        </Link>
      </aside>
    </>
  );
}
