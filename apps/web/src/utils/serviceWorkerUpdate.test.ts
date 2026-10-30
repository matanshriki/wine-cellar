import { afterEach, describe, expect, it } from 'vitest';
import {
  decideChunkLoadRecovery,
  shouldOfferUpdatePrompt,
  shouldReloadOnControllerChange,
  SW_UPDATE_DISMISSED_KEY,
  clearSessionValue,
} from './serviceWorkerUpdate';
import {
  clearUnsavedBlockers,
  detectUnsavedWork,
  registerUnsavedBlocker,
  shouldDeferUpdatePrompt,
} from './unsavedWork';

afterEach(() => {
  clearUnsavedBlockers();
  clearSessionValue(SW_UPDATE_DISMISSED_KEY);
});

describe('shouldOfferUpdatePrompt', () => {
  const base = {
    hasController: true,
    waitingUpdateId: 'sw:100:111',
    dismissedUpdateId: null as string | null,
    deferredByCriticalWork: false,
    deferredByOpenModal: false,
    alreadyOffering: false,
  };

  it('offers when a waiting worker replaces an existing controller', () => {
    expect(shouldOfferUpdatePrompt(base)).toBe(true);
  });

  it('does not offer on first install (no controller yet)', () => {
    expect(shouldOfferUpdatePrompt({ ...base, hasController: false })).toBe(false);
  });

  it('does not offer when nothing is waiting', () => {
    expect(shouldOfferUpdatePrompt({ ...base, waitingUpdateId: null })).toBe(false);
  });

  it('does not offer when this waiting worker was dismissed this session', () => {
    expect(
      shouldOfferUpdatePrompt({
        ...base,
        dismissedUpdateId: base.waitingUpdateId,
      }),
    ).toBe(false);
  });

  it('offers again for a different waiting worker after dismiss', () => {
    expect(
      shouldOfferUpdatePrompt({
        ...base,
        waitingUpdateId: 'sw:200:222',
        dismissedUpdateId: 'sw:100:111',
      }),
    ).toBe(true);
  });

  it('defers while critical work or another modal is open', () => {
    expect(shouldOfferUpdatePrompt({ ...base, deferredByCriticalWork: true })).toBe(false);
    expect(shouldOfferUpdatePrompt({ ...base, deferredByOpenModal: true })).toBe(false);
  });

  it('does not re-offer when already showing', () => {
    expect(shouldOfferUpdatePrompt({ ...base, alreadyOffering: true })).toBe(false);
  });
});

describe('fingerprintServiceWorkerScript', () => {
  it('changes when CACHE_NAME changes', async () => {
    const { fingerprintServiceWorkerScript } = await import('./serviceWorkerUpdate');
    const a = fingerprintServiceWorkerScript("const CACHE_NAME = 'wine-cellar-precache-aaa';");
    const b = fingerprintServiceWorkerScript("const CACHE_NAME = 'wine-cellar-precache-bbb';");
    expect(a).not.toBe(b);
  });
});

describe('shouldReloadOnControllerChange', () => {
  it('reloads only for the tab that requested activation', () => {
    expect(
      shouldReloadOnControllerChange({
        awaitingActivationReload: true,
        reloadAlreadyTriggered: false,
      }),
    ).toBe(true);
  });

  it('ignores controllerchange from other tabs / first claim', () => {
    expect(
      shouldReloadOnControllerChange({
        awaitingActivationReload: false,
        reloadAlreadyTriggered: false,
      }),
    ).toBe(false);
  });

  it('prevents reload loops', () => {
    expect(
      shouldReloadOnControllerChange({
        awaitingActivationReload: true,
        reloadAlreadyTriggered: true,
      }),
    ).toBe(false);
  });
});

describe('decideChunkLoadRecovery', () => {
  const now = 1_000_000;

  it('prefers the update prompt when a waiting worker exists', () => {
    expect(
      decideChunkLoadRecovery({
        now,
        lastChunkReloadAt: 0,
        lastUpdateReloadAt: 0,
        hasWaitingWorker: true,
      }),
    ).toBe('prefer_update');
  });

  it('allows a single auto-reload when no update is waiting', () => {
    expect(
      decideChunkLoadRecovery({
        now,
        lastChunkReloadAt: 0,
        lastUpdateReloadAt: 0,
        hasWaitingWorker: false,
      }),
    ).toBe('reload');
  });

  it('shows error instead of looping after a recent chunk reload', () => {
    expect(
      decideChunkLoadRecovery({
        now,
        lastChunkReloadAt: now - 5_000,
        lastUpdateReloadAt: 0,
        hasWaitingWorker: false,
      }),
    ).toBe('show_error');
  });

  it('shows error after a recent approved SW update reload', () => {
    expect(
      decideChunkLoadRecovery({
        now,
        lastChunkReloadAt: 0,
        lastUpdateReloadAt: now - 5_000,
        hasWaitingWorker: false,
      }),
    ).toBe('show_error');
  });
});

describe('unsaved work detection', () => {
  it('reports registered blockers', () => {
    registerUnsavedBlocker('scan', () => true, { kind: 'scanning', reason: 'scanning' });
    expect(detectUnsavedWork()).toEqual({
      hasUnsaved: true,
      kind: 'scanning',
      reason: 'scanning',
    });
    expect(shouldDeferUpdatePrompt()).toBe(true);
  });

  it('does not defer for ordinary form dirtiness', () => {
    registerUnsavedBlocker('form', () => true, { kind: 'form', reason: 'open_dialog_form' });
    expect(detectUnsavedWork().hasUnsaved).toBe(true);
    expect(shouldDeferUpdatePrompt()).toBe(false);
  });
});
