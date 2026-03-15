/**
 * About Page — Premium editorial redesign
 *
 * Layout: Hero → Founder story (prose) → FAQ → Support action rows → Footer note
 * Supports White + Red themes via CSS variables. RTL-safe.
 */

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MetaHead } from '../components/MetaHead';

// ── Environment helpers ───────────────────────────────────────────────────────

const SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL ?? 'matan.shriki3@gmail.com';

function getPlatform(): string {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
  if (isPWA) return isIOS ? 'iOS PWA' : isAndroid ? 'Android PWA' : 'PWA';
  if (isIOS) return 'iOS Safari';
  if (isAndroid) return 'Android';
  return 'Desktop';
}

function buildMailto(subject: string, body: string): string {
  const version = import.meta.env.VITE_APP_VERSION ?? '—';
  const filled = body
    .replace('{{version}}', version)
    .replace('{{platform}}', getPlatform());
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(filled)}`;
}

// ── Motion helpers (respect prefers-reduced-motion) ───────────────────────────

const rm =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const container = rm
  ? {}
  : {
      initial: 'hidden',
      animate: 'show',
      variants: {
        hidden: {},
        show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
      },
    };

const item = rm
  ? {}
  : {
      variants: {
        hidden: { opacity: 0, y: 18 },
        show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
      },
    };

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconEnvelope() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconBug() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6a4 4 0 018 0M4 10h16M4 10a2 2 0 00-2 2v2a6 6 0 0012 0v-2a2 2 0 00-2-2M4 10l-2-3M20 10l2-3M6 18l-2 2M18 18l2 2" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true" className="flip-rtl flex-shrink-0">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// ── FAQ data ──────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    question: 'What is Wine Cellar Brain?',
    answer:
      'Wine Cellar Brain is a personal wine collection manager with AI-powered recommendations. It helps you catalog your bottles, track drink windows, and decide what to open next — all in a beautifully simple interface.',
  },
  {
    question: 'How do I add bottles to my cellar?',
    answer:
      'Tap the "+" button from your cellar view. You can add bottles manually by filling in the details, or use the smart scan feature to import from a photo or CSV file. Wine data is enriched automatically where possible.',
  },
  {
    question: 'Does it work as an app (PWA)?',
    answer:
      'Yes. Wine Cellar Brain is a Progressive Web App (PWA). You can install it on your iPhone, Android device, or desktop by using "Add to Home Screen" from your browser menu. Once installed, it works smoothly offline.',
  },
  {
    question: "How does the 'Drink Window' feature work?",
    answer:
      "A drink window is the optimal period to enjoy a wine. When you add a bottle with a vintage year, the app estimates the ideal drinking window based on the wine's style and structure — helping you avoid opening bottles too early or too late.",
  },
  {
    question: 'Is my cellar private?',
    answer:
      'Yes, your cellar is private by default. Only you can see your bottles. You can optionally share a read-only view with others using the share feature, but nothing is public without your explicit action.',
  },
  {
    question: 'How do I contact support?',
    answer: `You can reach us via the "Email support" button on this page, or write directly to ${SUPPORT_EMAIL}. We typically respond within 1–2 business days.`,
  },
  {
    question: 'Can I import my existing wine list?',
    answer:
      'Yes. Wine Cellar Brain supports CSV import (Vivino-compatible format). Download the template from the import screen, fill in your wines, and upload it to bulk-add your collection in seconds.',
  },
  {
    question: 'How are AI recommendations generated?',
    answer:
      'The app analyses your cellar — bottle styles, regions, vintages, and drink windows — and suggests what to open tonight based on the occasion, food pairing, and which bottles are at their peak.',
  },
] as const;

// ── Schema.org structured data ────────────────────────────────────────────────

const SITE_URL = 'https://wine-cellar-brain.vercel.app';

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Wine Cellar Brain',
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  description:
    'Personal wine collection manager with AI-powered recommendations, drink-window tracking, and smart pairing suggestions.',
  contactPoint: {
    '@type': 'ContactPoint',
    email: SUPPORT_EMAIL,
    contactType: 'customer support',
  },
};

const webSiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Wine Cellar Brain',
  url: SITE_URL,
  description:
    'Personal wine collection manager with AI-powered recommendations, drink-window tracking, and smart pairing suggestions.',
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: answer,
    },
  })),
};

// ── Component ─────────────────────────────────────────────────────────────────

const PARAGRAPHS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'] as const;

export function AboutPage() {
  const { t } = useTranslation();

  const supportHref = buildMailto(
    t('about.emailSupportSubject'),
    t('about.emailSupportBody'),
  );
  const bugHref = buildMailto(
    t('about.bugSubject'),
    t('about.bugBody'),
  );

  return (
    <motion.div className="max-w-2xl mx-auto pb-4" {...container}>

      <MetaHead
        title="About"
        description="Learn about Wine Cellar Brain — a personal wine collection manager built with passion. Track bottles, discover drink windows, and get AI-powered recommendations."
        url="/about"
        noIndex={true}
        jsonLd={[organizationSchema, webSiteSchema, faqSchema]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.header className="pt-2 pb-10 sm:pb-12" {...item}>
        {/* App name eyebrow */}
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-5"
          style={{ color: 'var(--wine-500)' }}
        >
          Wine Cellar Brain
        </p>

        {/* Title */}
        <h1
          className="text-[2.6rem] sm:text-5xl font-bold tracking-tight leading-[1.1] mb-4"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display)' }}
        >
          {t('about.title')}
        </h1>

        {/* Subtitle */}
        <p
          className="text-[1.1rem] sm:text-xl leading-relaxed"
          style={{
            color: 'var(--text-tertiary)',
            fontStyle: 'italic',
            letterSpacing: '0.01em',
          }}
        >
          {t('about.subtitle')}
        </p>
      </motion.header>

      {/* ── Thin divider ─────────────────────────────────────────────────── */}
      <motion.div
        {...item}
        className="mb-10"
        style={{ height: '1px', background: 'var(--border-subtle)' }}
      />

      {/* ── Founder story ────────────────────────────────────────────────── */}
      <motion.section className="mb-12 sm:mb-14" {...item}>
        {PARAGRAPHS.map((key, i) => (
          <p
            key={key}
            className={i === 0 ? 'mb-7' : 'mt-6'}
            style={{
              color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: i === 0 ? '1.15rem' : '1rem',
              fontWeight: i === 0 ? 600 : 400,
              lineHeight: i === 0 ? 1.5 : 1.85,
              // p5 ("That's how Wine Cellar Brain was born.") gets a subtle emphasis
              ...(i === 4 && {
                color: 'var(--text-primary)',
                fontWeight: 500,
              }),
            }}
          >
            {t(`about.${key}`)}
          </p>
        ))}
      </motion.section>

      {/* ── Thin divider ─────────────────────────────────────────────────── */}
      <motion.div
        {...item}
        className="mb-10"
        style={{ height: '1px', background: 'var(--border-subtle)' }}
      />

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <motion.section className="mb-12 sm:mb-14" {...item}>
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-6 px-1"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Frequently Asked Questions
        </p>

        <div className="space-y-0">
          {FAQ_ITEMS.map(({ question, answer }, i) => (
            <div key={i}>
              {i > 0 && (
                <div style={{ height: '1px', background: 'var(--border-subtle)' }} />
              )}
              <div className="py-5 px-1">
                <h2
                  className="text-sm font-semibold leading-snug mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {question}
                </h2>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ── Support section ──────────────────────────────────────────────── */}
      <motion.section {...item}>
        {/* Section label */}
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-3 px-1"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {t('about.supportTitle')}
        </p>

        {/* Action card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {/* Row 1 — Email support */}
          <ActionRow
            href={supportHref}
            icon={<IconEnvelope />}
            label={t('about.emailSupport')}
            desc={t('about.emailSupportDesc')}
          />

          {/* Separator */}
          <div
            className="mx-5"
            style={{ height: '1px', background: 'var(--border-subtle)' }}
          />

          {/* Row 2 — Report a bug */}
          <ActionRow
            href={bugHref}
            icon={<IconBug />}
            label={t('about.reportBug')}
            desc={t('about.reportBugDesc')}
          />
        </div>
      </motion.section>

      {/* ── Footer note ──────────────────────────────────────────────────── */}
      <motion.p
        {...item}
        className="text-center text-xs mt-12 mb-2"
        style={{ color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}
      >
        {t('about.footerNote')}
      </motion.p>
    </motion.div>
  );
}

// ── ActionRow sub-component ───────────────────────────────────────────────────

interface ActionRowProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
}

function ActionRow({ href, icon, label, desc }: ActionRowProps) {
  return (
    <motion.a
      href={href}
      whileTap={rm ? {} : { scale: 0.985, opacity: 0.85 }}
      className="flex items-center gap-4 px-5 py-4 w-full transition-colors"
      style={{
        WebkitTapHighlightColor: 'transparent',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--interactive-hover)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = '';
      }}
    >
      {/* Icon badge */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background: 'var(--wine-50)',
          color: 'var(--wine-600)',
        }}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold leading-snug"
          style={{ color: 'var(--text-primary)' }}
        >
          {label}
        </p>
        <p
          className="text-xs mt-0.5 leading-snug"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {desc}
        </p>
      </div>

      {/* Chevron */}
      <span style={{ color: 'var(--text-tertiary)' }}>
        <IconChevron />
      </span>
    </motion.a>
  );
}
