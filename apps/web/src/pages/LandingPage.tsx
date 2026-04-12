/**
 * Public marketing home — indexable by Google & cited by AI tools (with llms.txt).
 * Logged-in users are redirected to /cellar from App.tsx before this mounts.
 */

import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MetaHead } from '../components/MetaHead';
import {
  SITE_URL,
  organizationSchema,
  webSiteSchema,
  softwareApplicationSchema,
  webPageSchema,
} from '../lib/seoSchemas';

const LANDING_DESC =
  'Sommi is your AI sommelier for your home wine cellar: track bottles, drink windows, label scan, Vivino CSV import, and smart pairings from what you actually own. Free to start. Web app & PWA for iPhone and Android.';

export function LandingPage() {
  const jsonLd = [
    organizationSchema(),
    webSiteSchema(),
    softwareApplicationSchema(),
    webPageSchema('/', 'Sommi — AI sommelier & wine cellar app', LANDING_DESC),
  ];

  return (
    <>
      <MetaHead
        title={undefined}
        description={LANDING_DESC}
        url="/"
        jsonLd={jsonLd}
      />
      <Helmet>
        <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}/`} />
        <link rel="alternate" hrefLang="en" href={`${SITE_URL}/`} />
        <meta
          name="keywords"
          content="Sommi, AI sommelier, wine cellar app, wine collection tracker, drink window, wine pairing app, PWA wine, Vivino import, home cellar"
        />
      </Helmet>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <article>
          <header className="mb-12 text-center sm:text-start">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-4"
              style={{ color: 'var(--wine-500)' }}
            >
              Wine cellar app · AI sommelier
            </p>
            <h1
              className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-6"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-heading)' }}
            >
              Sommi — your AI sommelier for the wines you own
            </h1>
            <p className="text-lg sm:text-xl leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
              Stop guessing what to open tonight. Sommi knows your cellar: regions, vintages, drink windows,
              and mood — so recommendations stay personal, not generic wine-blog noise.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                to="/login"
                className="inline-flex justify-center px-8 py-3.5 rounded-full text-base font-semibold text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))' }}
              >
                Open Sommi — sign in free
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
                About &amp; FAQ
              </Link>
            </div>
          </header>

          <section className="mb-14" aria-labelledby="why-sommi">
            <h2 id="why-sommi" className="text-2xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
              Built for collectors, not another Vivino clone
            </h2>
            <ul className="space-y-4 text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Your cellar, your rules.</strong> Recommendations
                use bottles you actually own — so “what should I drink tonight?” finally has a real answer.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Drink windows &amp; readiness.</strong> See what
                is in its prime, what to hold, and what to open before it fades.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Sommi, the AI sommelier.</strong> Ask for
                pairings, occasions, or “something impressive” — scoped to your collection.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Import &amp; capture.</strong> Vivino-friendly
                CSV import and label scan help you onboard fast.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Install like an app.</strong> Add Sommi to your
                home screen (PWA) on iPhone, Android, or desktop.
              </li>
            </ul>
          </section>

          <section className="mb-14" aria-labelledby="who-for">
            <h2 id="who-for" className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Who Sommi is for
            </h2>
            <p className="leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              Home collectors, dinner hosts, and anyone who wants a calmer way to choose wine — without
              spreadsheets or forgetting what is in the rack. If you search for{' '}
              <em>wine cellar app</em>, <em>AI sommelier</em>, or <em>track my wine collection</em>, Sommi is
              designed for exactly that job.
            </p>
          </section>

          <section className="mb-10 rounded-2xl p-6 sm:p-8 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface-2)' }}>
            <h2 className="text-xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              Privacy-first
            </h2>
            <p className="leading-relaxed text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
              Your cellar stays private unless you choose to share. Read our{' '}
              <Link to="/privacy" className="underline font-medium" style={{ color: 'var(--wine-600)' }}>
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link to="/terms" className="underline font-medium" style={{ color: 'var(--wine-600)' }}>
                Terms
              </Link>
              .
            </p>
          </section>

          <p className="text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Looking for the full FAQ?{' '}
            <Link to="/about" className="underline font-medium" style={{ color: 'var(--wine-600)' }}>
              Visit About
            </Link>
            .
          </p>
        </article>
      </main>
    </>
  );
}
