/**
 * About Page — Premium editorial redesign
 *
 * Layout: Hero → Founder story (prose) → FAQ → Support action rows → Footer note
 * Supports White + Red themes via CSS variables. RTL-safe.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { MetaHead } from '../components/MetaHead';
import { organizationSchema, webSiteSchema } from '../lib/seoSchemas';

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

function IconPlus({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      style={{
        transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        transition: rm ? 'none' : 'transform 0.22s ease',
        flexShrink: 0,
      }}
    >
      <line x1="7" y1="1" x2="7" y2="13" />
      <line x1="1" y1="7" x2="13" y2="7" />
    </svg>
  );
}

// ── FAQ translation keys ──────────────────────────────────────────────────────

const FAQ_KEYS = [
  'whatIs',
  'addBottles',
  'pwa',
  'drinkWindow',
  'privacy',
  'contactSupport',
  'import',
  'aiRecs',
] as const;

// faqSchema is built inside the component using translated strings

// ── Component ─────────────────────────────────────────────────────────────────

const PARAGRAPHS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'] as const;

type AboutPageProps = {
  /** True when rendered inside app Layout (main provides horizontal padding). */
  appShell?: boolean;
};

export function AboutPage({ appShell = false }: AboutPageProps = {}) {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqItems = FAQ_KEYS.map(key => ({
    question: t(`about.faq.${key}.question`),
    answer: t(`about.faq.${key}.answer`),
  }));

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };

  const supportHref = buildMailto(
    t('about.emailSupportSubject'),
    t('about.emailSupportBody'),
  );
  const bugHref = buildMailto(
    t('about.bugSubject'),
    t('about.bugBody'),
  );

  return (
    <motion.div
      className={
        appShell
          ? 'max-w-2xl mx-auto pb-8 sm:pb-10'
          : 'max-w-2xl mx-auto pb-8 sm:pb-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]'
      }
      {...container}
    >

      <MetaHead
        title="About"
        description="Learn about Sommi — a personal wine collection manager built with passion. Track bottles, discover drink windows, and get AI-powered recommendations."
        url="/about"
        jsonLd={[organizationSchema(), webSiteSchema(), faqSchema]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.header className="pt-2 pb-10 sm:pb-12" {...item}>
        {/* App name eyebrow */}
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-5"
          style={{ color: 'var(--wine-500)' }}
        >
          Sommi
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
              // p5 ("That's how Sommi was born.") gets a subtle emphasis
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
          {t('about.faqTitle')}
        </p>

        <div>
          {faqItems.map(({ question, answer }, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i}>
                {i > 0 && (
                  <div style={{ height: '1px', background: 'var(--border-subtle)' }} />
                )}
                <button
                  className="w-full flex items-center justify-between gap-3 py-5 px-1 text-left"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <h2
                    className="text-sm font-semibold leading-snug"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {question}
                  </h2>
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{
                      background: isOpen ? 'var(--wine-100)' : 'var(--bg-subtle)',
                      color: isOpen ? 'var(--wine-600)' : 'var(--text-tertiary)',
                      transition: rm ? 'none' : 'background 0.2s, color 0.2s',
                    }}
                  >
                    <IconPlus open={isOpen} />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: rm ? 0 : 0.22, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <p
                        className="text-sm leading-relaxed pb-5 px-1"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
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

      {/* ── Legal links ──────────────────────────────────────────────────── */}
      <motion.div
        {...item}
        className="flex items-center justify-center gap-3 mt-10 mb-1"
      >
        <a
          href="/privacy"
          className="text-xs underline hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Privacy Policy
        </a>
        <span className="text-xs" style={{ color: 'var(--border-medium)' }}>·</span>
        <a
          href="/terms"
          className="text-xs underline hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Terms &amp; Conditions
        </a>
      </motion.div>

      {/* ── Footer note ──────────────────────────────────────────────────── */}
      <motion.p
        {...item}
        className="text-center text-xs mt-3 mb-2"
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
