/**
 * About Page
 *
 * A single luxury page describing the app and creator, with an
 * embedded "Contact us" section using mailto links. Supports both
 * White and Red themes and EN / HE (RTL) layouts.
 */

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

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

function getVersion(): string {
  return import.meta.env.VITE_APP_VERSION ?? '—';
}

function buildMailto(subject: string, body: string): string {
  const version = getVersion();
  const platform = getPlatform();
  const filledBody = body
    .replace('{{version}}', version)
    .replace('{{platform}}', platform);
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(filledBody)}`;
}

// Reduced-motion check (inline, no extra import needed)
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fadeUp = prefersReducedMotion
  ? {}
  : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

const staggerContainer = prefersReducedMotion
  ? {}
  : { animate: { transition: { staggerChildren: 0.08 } } };

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
    <motion.div
      className="max-w-2xl mx-auto"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* ── Hero ───────────────────────────────────────────── */}
      <motion.div className="mb-8" variants={fadeUp} transition={{ duration: 0.3 }}>
        {/* Eyebrow label */}
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--wine-500)' }}
        >
          {t('about.heroLabel')}
        </p>

        <h1
          className="text-3xl sm:text-4xl font-bold mb-5 leading-tight"
          style={{
            color: 'var(--text-heading)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {t('about.heroTitle')}
        </h1>

        <div
          className="space-y-4 text-base leading-relaxed"
          style={{ color: 'var(--text-secondary)', maxWidth: '60ch' }}
        >
          <p>{t('about.heroParagraph1')}</p>
          <p>{t('about.heroParagraph2')}</p>
        </div>
      </motion.div>

      {/* ── Divider ────────────────────────────────────────── */}
      <motion.hr
        variants={fadeUp}
        transition={{ duration: 0.3 }}
        style={{ borderColor: 'var(--border-subtle)' }}
        className="mb-8"
      />

      {/* ── Why I built this ───────────────────────────────── */}
      <motion.div
        className="card mb-6"
        variants={fadeUp}
        transition={{ duration: 0.3 }}
      >
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display)' }}
        >
          {t('about.whyTitle')}
        </h2>

        <ul className="space-y-3">
          {(['why1', 'why2', 'why3'] as const).map((key) => (
            <li key={key} className="flex items-start gap-3">
              {/* Decorative wine dot */}
              <span
                className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--wine-500)' }}
              />
              <span
                className="text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t(`about.${key}`)}
              </span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* ── Contact ────────────────────────────────────────── */}
      <motion.div
        className="card"
        variants={fadeUp}
        transition={{ duration: 0.3 }}
      >
        <h2
          className="text-lg font-semibold mb-1"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display)' }}
        >
          {t('about.contactTitle')}
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('about.contactSubtitle')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Primary — Email support */}
          <motion.a
            href={supportHref}
            whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
            className="btn btn-primary flex items-center justify-center gap-2 flex-1"
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            {t('about.emailSupport')}
          </motion.a>

          {/* Secondary — Report a bug */}
          <motion.a
            href={bugHref}
            whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
            className="btn btn-secondary flex items-center justify-center gap-2 flex-1"
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
            {t('about.reportBug')}
          </motion.a>
        </div>
      </motion.div>
    </motion.div>
  );
}
