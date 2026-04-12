/**
 * Shared Schema.org JSON-LD for SEO / AEO (Google rich results, LLM citation).
 * Keep copy aligned with MetaHead descriptions and public/llms-full.txt.
 */

export const SITE_URL = 'https://sommi-ai.com';
export const SITE_NAME = 'Sommi';

const SUPPORT_EMAIL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_EMAIL
    ? String(import.meta.env.VITE_SUPPORT_EMAIL)
    : 'matan.shriki3@gmail.com';

const DEFAULT_ORG_DESCRIPTION =
  'Sommi is an AI sommelier and wine cellar app. Track bottles, drink windows, CSV import, label scan, and pairing ideas from your own collection. Progressive Web App (PWA).';

export function organizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    description: DEFAULT_ORG_DESCRIPTION,
    sameAs: [SITE_URL],
    contactPoint: {
      '@type': 'ContactPoint',
      email: SUPPORT_EMAIL,
      contactType: 'customer support',
    },
  };
}

export function webSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_ORG_DESCRIPTION,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  };
}

/** Software / product rich result–friendly (where supported). */
export function softwareApplicationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web Browser, iOS, Android (PWA)',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free tier available; paid plans optional.',
    },
    aggregateRating: undefined,
    description: DEFAULT_ORG_DESCRIPTION,
    url: SITE_URL,
    screenshot: `${SITE_URL}/icon-512.png`,
    featureList: [
      'Wine cellar inventory and drink windows',
      'AI sommelier chat (Sommi) for pairings and what to open',
      'Label scan and Vivino-compatible CSV import',
      'Share cellar or tasting lineup with guests',
      'Install as PWA on phone or desktop',
    ],
  };
}

export function webPageSchema(path: string, name: string, description: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url: `${SITE_URL}${path}`,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  };
}
