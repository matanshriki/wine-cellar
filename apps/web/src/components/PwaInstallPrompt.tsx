/**
 * PwaInstallPrompt
 *
 * Shown after the user adds their first bottle to encourage installing
 * the app as a PWA. Three platform variants:
 *
 *   iOS     → bottom sheet with 2-step "Add to Home Screen" Safari guide
 *   Android → bottom sheet with a single native install button
 *   Desktop → centered card with a QR code pointing to the app URL
 *
 * Supports EN + HE (RTL). Uses only app design tokens — no hard-coded colours.
 */

import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { PromptPlatform } from '../hooks/usePwaInstallPrompt';

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconShare() {
  // Represents the Safari / browser share button
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function IconAddToHomeScreen() {
  // Grid/plus — represents "Add to Home Screen"
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <line x1="17.5" y1="14" x2="17.5" y2="21" />
      <line x1="14" y1="17.5" x2="21" y2="17.5" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Shared backdrop ───────────────────────────────────────────────────────────

function Backdrop({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      className="fixed inset-0"
      style={{ background: 'rgba(0,0,0,0.45)', zIndex: 49 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
      aria-hidden="true"
    />
  );
}

// ── Step row (iOS guide) ──────────────────────────────────────────────────────

interface StepProps {
  number: number;
  icon: React.ReactNode;
  label: string;
  hint: string;
}

function Step({ number, icon, label, hint }: StepProps) {
  return (
    <div className="flex items-start gap-3">
      {/* Step number */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
        style={{
          background: 'var(--wine-50)',
          color: 'var(--wine-600)',
          border: '1.5px solid var(--wine-300)',
        }}
      >
        {number}
      </div>

      {/* Icon badge */}
      <div
        className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5"
        style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
          {label}
        </p>
        <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-tertiary)' }}>
          {hint}
        </p>
      </div>
    </div>
  );
}

// ── iOS sheet ─────────────────────────────────────────────────────────────────

function IosSheet({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.div
      className="fixed bottom-0 inset-x-0 rounded-t-3xl z-50 pb-safe"
      style={{
        background: 'var(--bg-surface)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      role="dialog"
      aria-modal="true"
      aria-label={t('pwaPrompt.ios.title')}
    >
      {/* Handle bar */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-medium)' }} />
      </div>

      <div className="px-6 pt-3 pb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt="Wine Cellar Brain"
              className="w-12 h-12 rounded-2xl shadow-sm flex-shrink-0"
            />
            <div>
              <h2 className="text-base font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>
                {t('pwaPrompt.ios.title')}
              </h2>
              <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                Wine Cellar Brain
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            style={{ background: 'var(--bg-muted)', color: 'var(--text-tertiary)' }}
            aria-label={t('pwaPrompt.ios.dismiss')}
          >
            <IconClose />
          </button>
        </div>

        {/* Subtitle */}
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
          {t('pwaPrompt.ios.subtitle')}
        </p>

        {/* Steps */}
        <div className="space-y-4">
          <Step
            number={1}
            icon={<IconShare />}
            label={t('pwaPrompt.ios.step1Label')}
            hint={t('pwaPrompt.ios.step1Hint')}
          />
          <Step
            number={2}
            icon={<IconAddToHomeScreen />}
            label={t('pwaPrompt.ios.step2Label')}
            hint={t('pwaPrompt.ios.step2Hint')}
          />
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="mt-6 w-full text-sm font-medium py-2 rounded-xl transition-colors"
          style={{ color: 'var(--text-tertiary)', background: 'var(--bg-muted)' }}
        >
          {t('pwaPrompt.ios.dismiss')}
        </button>
      </div>
    </motion.div>
  );
}

// ── Android sheet ─────────────────────────────────────────────────────────────

function AndroidSheet({ onInstall, onDismiss }: { onInstall: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.div
      className="fixed bottom-0 inset-x-0 rounded-t-3xl z-50"
      style={{
        background: 'var(--bg-surface)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      role="dialog"
      aria-modal="true"
      aria-label={t('pwaPrompt.android.title')}
    >
      {/* Handle bar */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-medium)' }} />
      </div>

      <div className="px-6 pt-3 pb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt="Wine Cellar Brain"
              className="w-12 h-12 rounded-2xl shadow-sm flex-shrink-0"
            />
            <div>
              <h2 className="text-base font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>
                {t('pwaPrompt.android.title')}
              </h2>
              <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                Wine Cellar Brain
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            style={{ background: 'var(--bg-muted)', color: 'var(--text-tertiary)' }}
            aria-label={t('pwaPrompt.android.dismiss')}
          >
            <IconClose />
          </button>
        </div>

        <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
          {t('pwaPrompt.android.subtitle')}
        </p>

        {/* Install CTA */}
        <motion.button
          onClick={onInstall}
          whileTap={{ scale: 0.97 }}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          <IconDownload />
          {t('pwaPrompt.android.install')}
        </motion.button>

        <button
          onClick={onDismiss}
          className="mt-3 w-full text-sm font-medium py-2 rounded-xl transition-colors"
          style={{ color: 'var(--text-tertiary)', background: 'var(--bg-muted)' }}
        >
          {t('pwaPrompt.android.dismiss')}
        </button>
      </div>
    </motion.div>
  );
}

// ── Desktop QR modal ──────────────────────────────────────────────────────────

function DesktopModal({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  // Use qrserver.com (no library needed). Wine-900 colour for the QR modules.
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(appUrl)}&format=png&ecc=M&qzone=2&color=4a1722`;

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center px-4 z-50"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-8 text-center"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* Close */}
        <button
          onClick={onDismiss}
          className="absolute top-4 end-4 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'var(--bg-muted)', color: 'var(--text-tertiary)' }}
          aria-label={t('pwaPrompt.desktop.dismiss')}
        >
          <IconClose />
        </button>

        {/* App icon */}
        <img
          src="/icon-192.png"
          alt="Wine Cellar Brain"
          className="w-16 h-16 rounded-2xl shadow-md mx-auto mb-4"
        />

        <h2
          className="text-lg font-bold mb-2"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display)' }}
        >
          {t('pwaPrompt.desktop.title')}
        </h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
          {t('pwaPrompt.desktop.subtitle')}
        </p>

        {/* QR code */}
        <div
          className="inline-block p-3 rounded-2xl mx-auto"
          style={{ background: '#fff', border: '1px solid var(--border-subtle)' }}
        >
          <img
            src={qrSrc}
            alt="QR code"
            width={180}
            height={180}
            className="block"
            loading="lazy"
          />
        </div>

        <button
          onClick={onDismiss}
          className="mt-6 w-full text-sm font-medium py-2 rounded-xl"
          style={{ color: 'var(--text-tertiary)', background: 'var(--bg-muted)' }}
        >
          {t('pwaPrompt.desktop.dismiss')}
        </button>
      </div>
    </motion.div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

interface PwaInstallPromptProps {
  isVisible: boolean;
  platform: PromptPlatform;
  hasNativePrompt: boolean;
  handleInstall: () => void;
  handleDismiss: () => void;
}

export function PwaInstallPrompt({
  isVisible,
  platform,
  hasNativePrompt,
  handleInstall,
  handleDismiss,
}: PwaInstallPromptProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <Backdrop onDismiss={handleDismiss} />

          {platform === 'ios' && (
            <IosSheet onDismiss={handleDismiss} />
          )}

          {platform === 'android' && hasNativePrompt && (
            <AndroidSheet onInstall={handleInstall} onDismiss={handleDismiss} />
          )}

          {platform === 'desktop' && (
            <DesktopModal onDismiss={handleDismiss} />
          )}
        </>
      )}
    </AnimatePresence>
  );
}
