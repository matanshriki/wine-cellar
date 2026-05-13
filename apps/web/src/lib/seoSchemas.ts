/**
 * Shared Schema.org JSON-LD for SEO / AEO (Google rich results, LLM citation).
 * Keep copy aligned with MetaHead descriptions and public/llms-full.txt.
 *
 * All schemas use the canonical www domain (https://www.sommi-ai.com).
 */

export const SITE_URL = 'https://www.sommi-ai.com';
export const SITE_NAME = 'Sommi';

const SUPPORT_EMAIL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_EMAIL
    ? String(import.meta.env.VITE_SUPPORT_EMAIL)
    : 'matan.shriki3@gmail.com';

const DEFAULT_ORG_DESCRIPTION =
  'Sommi is an AI sommelier and personal wine cellar app. Track the bottles you own, understand drink windows, get AI-powered pairing suggestions from your collection, import via Vivino-compatible CSV, scan labels, and share read-only cellar previews. Installable as a PWA on iPhone, Android, and desktop.';

/**
 * Organization — represents the Sommi brand entity.
 * @id enables knowledge-graph entity linking across pages.
 */
export function organizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/icon-512.png`,
      width: 512,
      height: 512,
    },
    description: DEFAULT_ORG_DESCRIPTION,
    sameAs: [SITE_URL],
    contactPoint: {
      '@type': 'ContactPoint',
      email: SUPPORT_EMAIL,
      contactType: 'customer support',
    },
  };
}

/**
 * WebSite — enables potential Sitelinks search box in Google if internal
 * search is ever exposed publicly. Also establishes entity relationship.
 */
export function webSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_ORG_DESCRIPTION,
    publisher: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

/** Software / product rich result–friendly (where supported by Google). */
export function softwareApplicationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#software`,
    name: SITE_NAME,
    applicationCategory: 'LifestyleApplication',
    applicationSubCategory: 'Wine & Drinks',
    operatingSystem: 'Web Browser, iOS (PWA), Android (PWA)',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free tier available; premium plans with additional AI features available.',
    },
    description: DEFAULT_ORG_DESCRIPTION,
    url: SITE_URL,
    featureList: [
      'Personal wine cellar inventory and drink window tracking',
      'AI sommelier (Sommi) for pairings, occasion picks, and what to open tonight',
      'Wine label scan with AI extraction',
      'Vivino-compatible CSV import for bulk collection onboarding',
      'Read-only cellar share links for guests',
      'Wine evening lineup with guest voting',
      'Progressive Web App (PWA) — install on iPhone, Android, or desktop',
      'English and Hebrew interface',
    ],
    publisher: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
    },
  };
}

export function webPageSchema(path: string, name: string, description: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}${path}/#webpage`,
    name,
    description,
    url: `${SITE_URL}${path}`,
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

/**
 * FAQPage for AEO / AI Overview citation targeting.
 *
 * Answers are 40-60 words — optimised for AI extraction and Featured Snippets.
 * Questions mirror real search queries for "AI sommelier" and "wine cellar app".
 * Keep aligned with the FAQ content in AboutPage and llms-full.txt.
 */
export function landingFaqSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/#faq`,
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is Sommi AI?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sommi is a personal AI sommelier and wine cellar web app. It helps home collectors track the bottles they own, understand when each wine reaches its optimal drink window, and get AI-powered pairing and occasion-based recommendations scoped to their actual collection — not generic wine reviews.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does Sommi choose which wine to open tonight?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sommi analyses the bottles in your personal cellar, checks each wine\'s drink window status (ready, needs aging, past peak), and lets you ask the built-in AI sommelier for occasion-based picks. Recommendations are always grounded in bottles you actually own, not random wine ratings from a public database.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is Sommi different from Vivino?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Vivino is a public wine review and rating community. Sommi is a personal cellar management tool: it tracks bottles you own, shows their individual drink windows, and gives AI pairing advice based on your specific inventory. Sommi supports Vivino-compatible CSV import so you can migrate your existing collection easily.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can Sommi manage my personal wine cellar?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Sommi is designed specifically for personal wine cellar management. You can add bottles manually, scan labels with AI, or import your collection via Vivino-compatible CSV. Each bottle tracks name, producer, region, vintage, quantity, notes, and drink window status.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does Sommi help with decanting and serving temperature?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sommi\'s AI sommelier can provide serving guidance — including decanting suggestions and serving temperature — when you ask about a specific wine in your cellar. The AI is scoped to your collection, so advice is relevant to the actual bottles you own.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does Sommi recommend food pairings?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. You can ask Sommi for food pairing suggestions based on wines in your cellar. For example: "What should I pair with this Barolo?" or "Which of my bottles goes best with salmon?" The AI uses your inventory as context for its pairing recommendations.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Sommi useful for casual wine drinkers or only serious collectors?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sommi works for both. Casual drinkers use it to avoid forgetting what is in the rack and to get quick pairing ideas. Serious collectors use the drink window tracking and AI sommelier to make more informed decisions about aging and when to open prized bottles.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Sommi a Progressive Web App (PWA)?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Sommi can be installed directly to your iPhone, Android, or desktop home screen from the browser — no App Store required. Once installed, it works like a native app with offline support for previously loaded cellar data.',
        },
      },
    ],
  };
}
