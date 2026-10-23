/**
 * Public marketing home — indexable by Google & cited by AI tools (with llms.txt).
 * Logged-in users are redirected to /cellar from App.tsx before this mounts.
 *
 * Art direction: warm painterly wine world — burgundy, ivory, sage, gold.
 * Story: illustrated hero → familiar pains → everything included → 1-2-3 on real
 * app screens → app tour video → interactive example → FAQ → closing scene.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useTranslation, Trans } from 'react-i18next';
import { Play } from 'lucide-react';
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
import { trackCTAButtonClick } from '../lib/metaPixel';
import { LandingInteractiveDemo } from '../components/landing/LandingInteractiveDemo';
import { LandingFaq } from '../components/landing/LandingFaq';
import { LandingDemoStage, LandingWideVideo } from '../components/landing/LandingDemoVideo';
import { LandingPainCards } from '../components/landing/LandingPainCards';
import { LandingFeatureBlobs } from '../components/landing/LandingFeatureBlobs';
import { LandingHowBand } from '../components/landing/LandingHowBand';
import { fadeUp, heroItem, heroStagger } from '../components/landing/landingMotion';

/** Older bundled demo files are superseded by the per-locale app tour. */
const LEGACY_DEMO_FILES = ['sommi-demo.mp4', 'sommi-landing-demo.mp4', 'sommi-ai-smarter.mp4'];

function demoVideoOverride(): string | null {
  const raw = import.meta.env.VITE_LANDING_DEMO_VIDEO_URL?.trim();
  if (!raw || LEGACY_DEMO_FILES.some((f) => raw.endsWith(`/videos/${f}`))) return null;
  return raw;
}

function trackDemoAnchorClick(placement: string) {
  void trackCTAButtonClick({ placement, cta: 'watch_demo' });
}

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const loc = i18n.language?.startsWith('he') ? 'he' : 'en';

  const override = useMemo(() => {
    const raw = demoVideoOverride();
    return raw ? resolveLandingDemoVideo(raw) : null;
  }, []);
  const tourSrc = `/videos/sommi-tour-${loc}.mp4`;
  const tourPoster = `/videos/sommi-tour-${loc}-poster.jpg`;

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

      <main className="pb-24 md:pb-0" aria-labelledby="landing-hero-heading">
        {/* ── Hero: full-bleed illustrated scene ───────────────── */}
        <section className="lp-hero relative overflow-hidden flex flex-col">
          <div className="relative z-[2] w-full max-w-6xl mx-auto px-5 sm:px-6 pt-10 sm:pt-16 lg:pt-28 pb-2 lg:pb-28">
            <motion.div className="max-w-xl text-center lg:text-start mx-auto lg:mx-0" {...heroStagger}>
              <motion.p
                className="lp-display text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] mb-4"
                style={{ color: 'var(--lp-gold)' }}
                {...heroItem}
              >
                {t('landing.eyebrow')}
              </motion.p>
              <motion.h1
                id="landing-hero-heading"
                className="text-[2.5rem] sm:text-6xl lg:text-[4.25rem] leading-[1.02] mb-5"
                style={{ color: 'var(--lp-burgundy)', fontWeight: 650 }}
                {...heroItem}
              >
                <span className="app-wordmark-hero block text-[0.62em] mb-2" style={{ color: 'var(--lp-burgundy-bright)' }}>
                  <bdi>Sommi.</bdi>
                </span>
                <span className="block">{t('landing.heroTitle')}</span>
              </motion.h1>
              <motion.p
                className="text-base sm:text-lg leading-relaxed mb-8 max-w-md mx-auto lg:mx-0"
                style={{ color: 'var(--lp-stone)' }}
                {...heroItem}
              >
                {t('landing.heroSubtitle')}
              </motion.p>
              <motion.div
                className="flex flex-col items-center lg:items-start gap-4 mb-6"
                {...heroItem}
              >
                <Link
                  to="/login"
                  className="lp-cta-primary lp-cta-xl"
                  onClick={() => {
                    void trackCTAButtonClick({ placement: 'hero', cta: 'start_free' });
                  }}
                >
                  {t('landing.ctaStartFree')}
                </Link>
                <a
                  href="#app-video"
                  className="lp-play-link"
                  onClick={() => trackDemoAnchorClick('hero_tour')}
                >
                  <span className="lp-play-dot" aria-hidden>
                    <Play className="h-3.5 w-3.5 rtl:-scale-x-100" fill="currentColor" strokeWidth={0} />
                  </span>
                  {t('landing.heroWatchTour')}
                </a>
              </motion.div>
              <motion.p className="text-xs sm:text-sm" style={{ color: 'var(--lp-stone-muted)' }} {...heroItem}>
                {t('landing.heroTrust')}
              </motion.p>
            </motion.div>
          </div>
          <img
            src="/assets/landing/hero-table.jpg"
            alt=""
            width={1600}
            height={1066}
            className="lp-hero-art"
            decoding="async"
            fetchPriority="high"
            aria-hidden
          />
          <div className="lp-hero-wash hidden lg:block absolute inset-0" aria-hidden />
        </section>

        <LandingPainCards />
        <LandingFeatureBlobs />
        <LandingHowBand />

        {/* ── App tour video ───────────────────────────────────── */}
        <section
          id="app-video"
          className="lp-section-anchor lp-tour relative overflow-hidden py-16 sm:py-24"
          aria-labelledby="landing-video-heading"
        >
          <div className="relative z-[1] max-w-5xl mx-auto px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center mb-10 sm:mb-12">
              <p
                className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] mb-3"
                style={{ color: 'var(--lp-gold-soft)' }}
              >
                {t('landing.tourEyebrow')}
              </p>
              <h2
                id="landing-video-heading"
                className="text-[1.9rem] sm:text-4xl lg:text-[2.75rem] font-semibold leading-tight mb-3"
                style={{ color: 'var(--lp-ivory)' }}
              >
                {t('landing.tourTitle')}
              </h2>
              <p
                className="text-base sm:text-lg leading-relaxed max-w-2xl mx-auto"
                style={{ color: 'rgba(247, 241, 232, 0.72)' }}
              >
                {t('landing.tourCaption')}
              </p>
            </motion.div>
            <motion.div {...fadeUp}>
              {override?.kind === 'iframe' ? (
                <LandingDemoStage demo={override} demoTitle={t('landing.tourTitle')} />
              ) : (
                <LandingWideVideo src={override?.src ?? tourSrc} poster={override ? undefined : tourPoster} />
              )}
            </motion.div>
            <p className="mt-5 text-center text-xs sm:text-sm" style={{ color: 'rgba(245, 240, 232, 0.5)' }}>
              {t('landing.demoAutoplayHint')}
            </p>
            {override ? null : (
              <p className="mt-1 text-center text-[11px]" style={{ color: 'rgba(245, 240, 232, 0.38)' }}>
                {t('landing.tourMusicCredit')}
              </p>
            )}
          </div>
        </section>

        {/* ── Interactive example ──────────────────────────────── */}
        <section
          id="sommi-demo"
          className="lp-section-anchor py-16 sm:py-24"
          style={{ background: 'var(--lp-surface)' }}
          aria-labelledby="landing-interactive-heading"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <motion.div {...fadeUp} className="lg:col-span-5 text-center lg:text-start">
                <h2
                  id="landing-interactive-heading"
                  className="text-[1.75rem] sm:text-4xl font-semibold leading-tight mb-3"
                  style={{ color: 'var(--lp-ink)' }}
                >
                  {t('landing.interactiveTitle')}
                </h2>
                <p className="text-base sm:text-lg leading-relaxed mb-7" style={{ color: 'var(--lp-stone-muted)' }}>
                  {t('landing.interactiveSubtitle')}
                </p>
                <Link
                  to="/login"
                  className="lp-cta-primary"
                  onClick={() => {
                    void trackCTAButtonClick({ placement: 'demo', cta: 'start_free' });
                  }}
                >
                  {t('landing.ctaStartFree')}
                </Link>
              </motion.div>
              <motion.div {...fadeUp} className="lg:col-span-7">
                <LandingInteractiveDemo />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── FAQ beside an illustration ───────────────────────── */}
        <section
          id="faq"
          className="lp-section-anchor py-16 sm:py-24"
          style={{ background: 'var(--lp-ivory)' }}
          aria-labelledby="landing-faq-heading"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <motion.h2
              {...fadeUp}
              id="landing-faq-heading"
              className="text-center text-[1.75rem] sm:text-4xl font-semibold leading-tight mb-10 sm:mb-14"
              style={{ color: 'var(--lp-ink)' }}
            >
              {t('landing.faqLoveTitle')}
            </motion.h2>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              <motion.div {...fadeUp} className="hidden lg:block lg:col-span-5">
                <div className="relative overflow-hidden rounded-[1.75rem]" style={{ aspectRatio: '4 / 5' }}>
                  <img
                    src="/assets/landing/decision.jpg"
                    alt=""
                    width={1200}
                    height={900}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    aria-hidden
                  />
                </div>
              </motion.div>
              <div className="lg:col-span-7">
                <LandingFaq />
                <p className="mt-8 text-sm leading-relaxed" style={{ color: 'var(--lp-stone-muted)' }}>
                  <Trans
                    i18nKey="landing.privacyBody"
                    components={{
                      privacyLink: (
                        <Link to="/privacy" className="underline font-medium" style={{ color: '#8b2741' }} />
                      ),
                      termsLink: <Link to="/terms" className="underline font-medium" style={{ color: '#8b2741' }} />,
                    }}
                  />{' '}
                  {t('landing.faqSubtitle')}{' '}
                  <Link to="/about" className="underline font-medium" style={{ color: '#8b2741' }}>
                    {t('landing.faqLinkLabel')}
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Closing scene ────────────────────────────────────── */}
        <section className="lp-closing relative overflow-hidden" aria-labelledby="landing-final-cta">
          <img
            src="/assets/landing/closing-terrace.jpg"
            alt=""
            width={1920}
            height={1280}
            className="absolute inset-0 h-full w-full object-cover object-[50%_70%]"
            loading="lazy"
            decoding="async"
            aria-hidden
          />
          <div className="lp-closing-wash absolute inset-0" aria-hidden />
          <motion.div
            {...fadeUp}
            className="relative z-[1] max-w-3xl mx-auto px-5 sm:px-6 pt-16 sm:pt-24 pb-[46vw] sm:pb-[30vw] lg:pb-[22rem] text-center"
          >
            <h2
              id="landing-final-cta"
              className="text-[2rem] sm:text-5xl font-semibold leading-tight mb-4"
              style={{ color: 'var(--lp-ivory)' }}
            >
              {t('landing.closingTitle')}
            </h2>
            <p className="text-base sm:text-lg leading-relaxed mb-8" style={{ color: 'rgba(247, 241, 232, 0.85)' }}>
              {t('landing.ctaFinalSub')}
            </p>
            <Link
              to="/login"
              className="lp-cta-gold lp-cta-xl"
              onClick={() => {
                void trackCTAButtonClick({ placement: 'final', cta: 'start_free' });
              }}
            >
              {t('landing.ctaStartFree')}
            </Link>
          </motion.div>
        </section>
      </main>

      <aside
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t px-4 pt-3"
        style={{
          background: 'rgba(247, 241, 232, 0.96)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: 'rgba(74, 23, 34, 0.1)',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.06)',
        }}
        aria-label={t('landing.stickyCtaAriaLabel')}
      >
        <Link
          to="/login"
          className="lp-cta-primary w-full"
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
