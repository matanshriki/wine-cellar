/**
 * Prompt when a replacement service worker is waiting.
 * Backdrop / Escape do not dismiss — user must choose Update now or Later.
 */

import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ModalLayer } from './ui/ModalLayer';
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate';

export function AppUpdateModal() {
  const { t } = useTranslation();
  const ids = {
    title: useId(),
    body: useId(),
  };
  const primaryRef = useRef<HTMLButtonElement>(null);
  const {
    phase,
    error,
    unsaved,
    dismissForSession,
    requestUpdate,
    retryActivate,
  } = useServiceWorkerUpdate();

  const open =
    phase === 'available' ||
    phase === 'confirm_unsaved' ||
    phase === 'updating' ||
    phase === 'error';

  const busy = phase === 'updating';

  // ModalLayer requires onClose; required-choice dialog ignores Escape/backdrop.
  const noopClose = () => {
    /* intentional no-op — user must pick a button */
  };

  return (
    <ModalLayer
      open={open}
      onClose={noopClose}
      labelledBy={ids.title}
      describedBy={ids.body}
      size="md"
      closeOnBackdrop={false}
      closeOnEscape={false}
      ignoreUnsavedScan
      initialFocusRef={primaryRef}
      testId="app-update-dialog"
    >
      <header className="modal-header">
        <h2 id={ids.title} className="app-dialog-title">
          {phase === 'confirm_unsaved'
            ? t('appUpdate.unsavedTitle')
            : phase === 'error'
              ? t('appUpdate.errorTitle')
              : t('appUpdate.title')}
        </h2>
      </header>

      <div className="modal-body">
        <p id={ids.body} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {phase === 'confirm_unsaved'
            ? t('appUpdate.unsavedBody')
            : phase === 'error'
              ? error === 'activation_timeout'
                ? t('appUpdate.errorTimeout')
                : t('appUpdate.errorBody')
              : phase === 'updating'
                ? t('appUpdate.updatingBody')
                : t('appUpdate.body')}
        </p>
        {phase === 'confirm_unsaved' && unsaved?.reason && (
          <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t(`appUpdate.unsavedReason.${unsaved.reason}`, {
              defaultValue: t('appUpdate.unsavedReason.generic'),
            })}
          </p>
        )}
        {phase === 'updating' && (
          <div className="mt-4 flex items-center justify-center gap-2" role="status" aria-live="polite">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
            <span className="text-sm font-medium">{t('appUpdate.updating')}</span>
          </div>
        )}
      </div>

      <footer className="modal-footer">
        {phase === 'available' && (
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
            <button
              type="button"
              className="btn-luxury-secondary flex-1"
              onClick={() => dismissForSession()}
              disabled={busy}
            >
              {t('appUpdate.later')}
            </button>
            <button
              ref={primaryRef}
              type="button"
              className="btn-luxury-primary flex-1"
              onClick={() => void requestUpdate()}
              disabled={busy}
            >
              {t('appUpdate.updateNow')}
            </button>
          </div>
        )}

        {phase === 'confirm_unsaved' && (
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
            <button
              type="button"
              className="btn-luxury-secondary flex-1"
              onClick={() => {
                // Return to work: dismiss this update for the session (same as Later),
                // do not leave the user stuck in the update dialog stack.
                dismissForSession();
              }}
            >
              {t('appUpdate.keepEditing')}
            </button>
            <button
              ref={primaryRef}
              type="button"
              className="btn-luxury-primary flex-1"
              onClick={() => void requestUpdate({ force: true })}
            >
              {t('appUpdate.updateAnyway')}
            </button>
          </div>
        )}

        {phase === 'updating' && (
          <button type="button" className="btn-luxury-primary w-full" disabled aria-busy="true">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            {t('appUpdate.updating')}
          </button>
        )}

        {phase === 'error' && (
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
            <button
              type="button"
              className="btn-luxury-secondary flex-1"
              onClick={() => dismissForSession()}
            >
              {t('appUpdate.continueWithout')}
            </button>
            <button
              ref={primaryRef}
              type="button"
              className="btn-luxury-primary flex-1"
              onClick={() => void retryActivate()}
            >
              {t('appUpdate.retry')}
            </button>
          </div>
        )}
      </footer>
    </ModalLayer>
  );
}
