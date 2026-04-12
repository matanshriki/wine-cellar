/**
 * Public marketing home — indexable by Google & cited by AI tools (with llms.txt).
 * Logged-in users are redirected to /cellar from App.tsx before this mounts.
 */

import { useMemo } from 'react';
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

export function LandingPage() {
  const { t, i18n } = useTranslation();

  const demoUrl = import.meta.env.VITE_LANDING_DEMO_VIDEO_URL?.trim();
  const demoPoster = import.meta.env.VITE_LANDING_DEMO_VIDEO_POSTER?.trim();
  const demo = useMemo(() => (demoUrl ? resolveLandingDemoVideo(demoUrl) : null), [demoUrl]);

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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
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
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                to="/login"
                className="inline-flex justify-center px-8 py-3.5 rounded-full text-base font-semibold text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))' }}
              >
                {t('landing.ctaOpen')}
              </Link>
              <Link
                to="/about"
                className="inline-flex justify-center px-8 py-3.5 rounded-full text-base font-semibold border"
                style={{
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-surface)',
                }}
              >
                {t('landing.ctaAbout')}
              </Link>
            </div>
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
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <video
                    className="absolute inset-0 h-full w-full object-contain bg-black/5"
                    controls
                    playsInline
                    preload="metadata"
                    poster={demoPoster || undefined}
                  >
                    <source src={demo.src} />
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

          <p className="text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('landing.faqTeaser')}{' '}
            <Link to="/about" className="underline font-medium" style={{ color: 'var(--wine-600)' }}>
              {t('landing.faqLinkLabel')}
            </Link>
            .
          </p>
        </article>
      </main>
    </>
  );
}
