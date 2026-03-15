/**
 * MetaHead — per-route <head> management for AEO / SEO.
 *
 * Injects Open Graph, Twitter Card, canonical URL, and optional JSON-LD
 * structured-data scripts on every route change.
 *
 * Usage:
 *   <MetaHead title="Cellar" description="..." url="/cellar" />
 *   <MetaHead title="About" url="/about" jsonLd={[orgSchema, faqSchema]} />
 */

import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://wine-cellar-brain.vercel.app';
const SITE_NAME = 'Wine Cellar Brain';
const DEFAULT_DESCRIPTION =
  'Your personal wine collection manager with AI-powered recommendations. Track bottles, discover drink windows, and get smart pairing suggestions.';
const DEFAULT_IMAGE = `${SITE_URL}/icon-512.png`;

interface MetaHeadProps {
  /** Page-specific title (will be appended with " — Wine Cellar Brain") */
  title?: string;
  description?: string;
  image?: string;
  /** Relative URL path, e.g. "/about" */
  url?: string;
  type?: 'website' | 'article';
  /** Prevent indexing (auth-gated pages) */
  noIndex?: boolean;
  /** Array of JSON-LD objects to inject as <script type="application/ld+json"> */
  jsonLd?: object[];
}

export function MetaHead({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url = '/',
  type = 'website',
  noIndex = false,
  jsonLd,
}: MetaHeadProps) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
  const canonicalUrl = `${SITE_URL}${url}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD Structured Data */}
      {jsonLd?.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
