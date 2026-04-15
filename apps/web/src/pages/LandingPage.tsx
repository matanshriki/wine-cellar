/**
 * Public marketing home — indexable by Google & cited by AI tools (with llms.txt).
 * Logged-in users are redirected to /cellar from App.tsx before this mounts.
 */

import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
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

function LandingCtaPair({ variant = 'center' }: { variant?: 'hero' | 'center' }) {
  const { t } = useTranslation();
  const row =
    variant === 'hero'
      ? 'flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center sm:justify-start items-stretch sm:items-center w-full'
      : 'flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center w-full max-w-xl mx-auto';
  return (
    <div className={row}>
      <Link to="/login" className={ctaPrimaryClass} style={ctaPrimaryStyle}>
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
  const demoUrl =
    import.meta.env.VITE_LANDING_DEMO_VIDEO_URL?.trim() ||
    '/videos/sommi-landing-demo.mp4';
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
                className="text-sm sm:text-base mb-4 text-center sm:text-start leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('landing.demoCaption')}
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
                  <video
                    className="absolute inset-0 h-full w-full object-contain bg-black/5"
                    controls
                    playsInline
                    preload="auto"
                    poster={demoPoster || undefined}
                    onError={() => {
                      console.error(
                        '[Landing demo] Video failed to load:',
                        demo.src,
                        '— If this is /videos/…, the file must exist under apps/web/public/videos and be deployed. A missing file returns the SPA HTML and playback never starts.',
                      );
                    }}
                  >
                    <source src={demo.src} type={videoSourceType(demo.src)} />
                  </video>
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
        >
          {t('landing.ctaOpen')}
        </Link>
      </aside>
    </>
  );
}
