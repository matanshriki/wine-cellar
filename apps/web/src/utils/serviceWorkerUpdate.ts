/**
 * Service-worker update lifecycle — no automatic document reloads on updates.
 *
 * Waiting workers are offered via UI; only the initiating tab reloads after
 * an explicit "Update now". Other open clients must not auto-reload (guarded
 * on awaitingActivationReload). Note: Chromium may still fire controllerchange
 * on those clients after skipWaiting even without clients.claim(); we ignore
 * that for reload purposes so unsaved work in other tabs is not discarded.
 */

import { openModalLayerCount, subscribeModalStack } from '../lib/modalStack';
import { detectUnsavedWork, shouldDeferUpdatePrompt, type UnsavedWorkStatus } from './unsavedWork';

export const SW_UPDATE_DISMISSED_KEY = 'sommi_sw_update_dismissed';
export const SW_UPDATE_RELOAD_KEY = 'sommi_sw_update_reload_at';
export const CHUNK_RELOAD_KEY = 'sommi_chunk_error_reload_at';

export const ACTIVATION_TIMEOUT_MS = 12_000;
export const CHUNK_RELOAD_MIN_INTERVAL_MS = 30_000;
export const UPDATE_RELOAD_COOLDOWN_MS = 20_000;

export type UpdateUiPhase =
  | 'hidden'
  | 'available'
  | 'confirm_unsaved'
  | 'updating'
  | 'error';

export interface UpdateSnapshot {
  phase: UpdateUiPhase;
  waitingScriptUrl: string | null;
  waitingUpdateId: string | null;
  error: string | null;
  unsaved: UnsavedWorkStatus | null;
}

export interface OfferUpdateDecisionInput {
  hasController: boolean;
  /** Identity of the waiting worker (content fingerprint), not just script URL. */
  waitingUpdateId: string | null;
  dismissedUpdateId: string | null;
  deferredByCriticalWork: boolean;
  deferredByOpenModal: boolean;
  alreadyOffering: boolean;
}

export function shouldOfferUpdatePrompt(input: OfferUpdateDecisionInput): boolean {
  if (!input.hasController) return false;
  if (!input.waitingUpdateId) return false;
  if (input.dismissedUpdateId && input.dismissedUpdateId === input.waitingUpdateId) {
    return false;
  }
  if (input.deferredByCriticalWork || input.deferredByOpenModal) return false;
  if (input.alreadyOffering) return false;
  return true;
}

/** Stable fingerprint of SW script bytes so Later dismisses one deploy, not all future ones. */
export function fingerprintServiceWorkerScript(source: string): string {
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0;
  }
  return `sw:${source.length}:${hash}`;
}

export async function fetchWaitingUpdateId(): Promise<string | null> {
  try {
    // Bust HTTP caches; /sw.js must also bypass the controlling worker (see sw.js fetch).
    const res = await fetch(`/sw.js?sommi_sw_fp=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const text = await res.text();
    return fingerprintServiceWorkerScript(text);
  } catch {
    return null;
  }
}

export interface ControllerChangeReloadInput {
  /** This tab sent SKIP_WAITING and expects exactly one reload. */
  awaitingActivationReload: boolean;
  /** Guard against double controllerchange → double reload. */
  reloadAlreadyTriggered: boolean;
}

export function shouldReloadOnControllerChange(input: ControllerChangeReloadInput): boolean {
  return input.awaitingActivationReload && !input.reloadAlreadyTriggered;
}

export type ChunkRecoveryAction = 'reload' | 'show_error' | 'prefer_update';

export interface ChunkRecoveryInput {
  now: number;
  lastChunkReloadAt: number;
  lastUpdateReloadAt: number;
  hasWaitingWorker: boolean;
  minIntervalMs?: number;
  updateCooldownMs?: number;
}

/**
 * Decide how ErrorBoundary should handle a stale-chunk / module-load failure.
 * Never loops with a recent SW-update reload; prefers the update prompt when a
 * waiting worker is already installed.
 */
export function decideChunkLoadRecovery(input: ChunkRecoveryInput): ChunkRecoveryAction {
  const minInterval = input.minIntervalMs ?? CHUNK_RELOAD_MIN_INTERVAL_MS;
  const updateCooldown = input.updateCooldownMs ?? UPDATE_RELOAD_COOLDOWN_MS;

  if (input.hasWaitingWorker) {
    return 'prefer_update';
  }
  if (input.now - input.lastUpdateReloadAt < updateCooldown) {
    return 'show_error';
  }
  if (input.now - input.lastChunkReloadAt < minInterval) {
    return 'show_error';
  }
  return 'reload';
}

export function readSessionValue(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSessionValue(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // private mode / quota — ignore
  }
}

export function clearSessionValue(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

type Listener = () => void;

export class ServiceWorkerUpdateController {
  private registration: ServiceWorkerRegistration | null = null;
  private phase: UpdateUiPhase = 'hidden';
  private waitingScriptUrl: string | null = null;
  private waitingUpdateId: string | null = null;
  private error: string | null = null;
  private unsaved: UnsavedWorkStatus | null = null;
  private awaitingActivationReload = false;
  private reloadAlreadyTriggered = false;
  private activationTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();
  private unsubModal: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private controllerChangeHandler: (() => void) | null = null;
  private deferPollTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private offerRefreshInFlight = false;
  /** Stable snapshot for useSyncExternalStore (must be referentially equal when unchanged). */
  private snapshot: UpdateSnapshot = {
    phase: 'hidden',
    waitingScriptUrl: null,
    waitingUpdateId: null,
    error: null,
    unsaved: null,
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): UpdateSnapshot => this.snapshot;

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private setState(patch: Partial<UpdateSnapshot> & { phase?: UpdateUiPhase }) {
    if (patch.phase !== undefined) this.phase = patch.phase;
    if (patch.waitingScriptUrl !== undefined) this.waitingScriptUrl = patch.waitingScriptUrl;
    if (patch.waitingUpdateId !== undefined) this.waitingUpdateId = patch.waitingUpdateId;
    if (patch.error !== undefined) this.error = patch.error;
    if (patch.unsaved !== undefined) this.unsaved = patch.unsaved;
    this.snapshot = {
      phase: this.phase,
      waitingScriptUrl: this.waitingScriptUrl,
      waitingUpdateId: this.waitingUpdateId,
      error: this.error,
      unsaved: this.unsaved,
    };
    this.emit();
  }

  private dismissedUpdateId(): string | null {
    return readSessionValue(SW_UPDATE_DISMISSED_KEY);
  }

  private currentWaiting(): ServiceWorker | null {
    return this.registration?.waiting ?? null;
  }

  private refreshOfferFromRegistration() {
    if (this.offerRefreshInFlight) return;
    this.offerRefreshInFlight = true;
    void this.refreshOfferFromRegistrationAsync().finally(() => {
      this.offerRefreshInFlight = false;
    });
  }

  private async refreshOfferFromRegistrationAsync() {
    const waiting = this.currentWaiting();
    const waitingUrl = waiting?.scriptURL ?? null;
    this.waitingScriptUrl = waitingUrl;

    if (!waitingUrl) {
      this.waitingUpdateId = null;
      if (this.phase === 'available' || this.phase === 'confirm_unsaved') {
        this.setState({
          phase: 'hidden',
          waitingScriptUrl: null,
          waitingUpdateId: null,
          unsaved: null,
          error: null,
        });
      }
      return;
    }

    const updateId = (await fetchWaitingUpdateId()) ?? waitingUrl;
    this.waitingUpdateId = updateId;

    // Don't interrupt updating / error flows
    if (this.phase === 'updating' || this.phase === 'error' || this.phase === 'confirm_unsaved') {
      this.setState({ waitingScriptUrl: waitingUrl, waitingUpdateId: updateId });
      return;
    }

    const decision = shouldOfferUpdatePrompt({
      hasController: !!navigator.serviceWorker.controller,
      waitingUpdateId: updateId,
      dismissedUpdateId: this.dismissedUpdateId(),
      deferredByCriticalWork: shouldDeferUpdatePrompt(),
      deferredByOpenModal: openModalLayerCount() > 0,
      alreadyOffering: this.phase === 'available',
    });

    if (decision) {
      this.setState({
        phase: 'available',
        waitingScriptUrl: waitingUrl,
        waitingUpdateId: updateId,
        error: null,
        unsaved: null,
      });
    } else if (this.phase === 'available') {
      // Only withdraw an already-open prompt if the user dismissed this waiting worker.
      // Do NOT hide because openModalLayerCount > 0 — the update modal itself is a layer.
      if (this.dismissedUpdateId() === updateId) {
        this.setState({ phase: 'hidden', waitingScriptUrl: waitingUrl, waitingUpdateId: updateId });
      }
    } else if (
      updateId &&
      this.dismissedUpdateId() !== updateId &&
      navigator.serviceWorker.controller &&
      (shouldDeferUpdatePrompt() || openModalLayerCount() > 0)
    ) {
      // Pending offer while deferred (critical work or another dialog is open)
      this.setState({ waitingScriptUrl: waitingUrl, waitingUpdateId: updateId });
    }
  }

  private watchWorker(worker: ServiceWorker) {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        this.refreshOfferFromRegistration();
      }
      if (worker.state === 'activated' && this.awaitingActivationReload) {
        this.triggerApprovedReload();
      }
    });
  }

  private onUpdateFound = () => {
    const installing = this.registration?.installing;
    if (!installing) return;
    console.log('[PWA] Update found');
    this.watchWorker(installing);
  };

  private triggerApprovedReload() {
    if (!shouldReloadOnControllerChange({
      awaitingActivationReload: this.awaitingActivationReload,
      reloadAlreadyTriggered: this.reloadAlreadyTriggered,
    })) {
      return;
    }
    this.reloadAlreadyTriggered = true;
    if (this.activationTimer) {
      clearTimeout(this.activationTimer);
      this.activationTimer = null;
    }
    writeSessionValue(SW_UPDATE_RELOAD_KEY, String(Date.now()));
    console.log('[PWA] Approved update — reloading initiating tab once');
    window.location.reload();
  }

  private onControllerChange = () => {
    // First install claim or another tab's activation: never auto-reload unless
    // this tab explicitly requested activation.
    if (!this.awaitingActivationReload) {
      console.log('[PWA] controllerchange ignored (no local activation request)');
      this.refreshOfferFromRegistration();
      return;
    }
    this.triggerApprovedReload();
  };

  async start(): Promise<void> {
    if (this.started) return;
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Service worker not supported');
      return;
    }
    if (!(import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW === 'true')) {
      console.log('[PWA] Service worker not in production mode');
      return;
    }

    this.started = true;

    try {
      console.log('[PWA] Registering service worker...');
      this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[PWA] Service worker registered:', this.registration.scope);

      this.registration.addEventListener('updatefound', this.onUpdateFound);
      if (this.registration.installing) {
        this.watchWorker(this.registration.installing);
      }
      if (this.registration.waiting) {
        this.refreshOfferFromRegistration();
      }

      this.controllerChangeHandler = this.onControllerChange;
      navigator.serviceWorker.addEventListener('controllerchange', this.controllerChangeHandler);

      this.unsubModal = subscribeModalStack(() => {
        // When stacked dialogs close, reconsider a deferred offer
        if (this.phase === 'hidden' && this.currentWaiting()) {
          this.refreshOfferFromRegistration();
        }
      });

      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          void this.registration?.update().catch(() => {});
          this.refreshOfferFromRegistration();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);

      // Reconsider deferred offers after scans / other modals finish
      this.deferPollTimer = setInterval(() => {
        if (this.phase === 'hidden' && this.currentWaiting()) {
          this.refreshOfferFromRegistration();
        }
      }, 2500);

      // Periodic soft check (does not reload)
      void this.registration.update().catch(() => {});
    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
    }
  }

  /** User chose Later — hide for this tab session for this waiting worker (by content id). */
  dismissForSession = (): void => {
    void this.dismissForSessionAsync();
  };

  private async dismissForSessionAsync() {
    const updateId =
      this.waitingUpdateId ??
      (await fetchWaitingUpdateId()) ??
      this.waitingScriptUrl ??
      this.currentWaiting()?.scriptURL ??
      null;
    if (updateId) {
      writeSessionValue(SW_UPDATE_DISMISSED_KEY, updateId);
      this.waitingUpdateId = updateId;
    }
    this.awaitingActivationReload = false;
    if (this.activationTimer) {
      clearTimeout(this.activationTimer);
      this.activationTimer = null;
    }
    this.setState({
      phase: 'hidden',
      error: null,
      unsaved: null,
      waitingScriptUrl: this.waitingScriptUrl,
      waitingUpdateId: this.waitingUpdateId,
    });
  }

  /** From unsaved confirm — return to the Update now / Later prompt without dismissing. */
  returnToPrompt = (): void => {
    const waiting = this.currentWaiting();
    if (!waiting) {
      this.setState({ phase: 'hidden', unsaved: null, error: null });
      return;
    }
    this.setState({
      phase: 'available',
      waitingScriptUrl: waiting.scriptURL,
      waitingUpdateId: this.waitingUpdateId,
      unsaved: null,
      error: null,
    });
  };

  /**
   * User chose Update now. Checks unsaved work first unless `force` after confirm.
   */
  requestUpdate = async (opts: { force?: boolean } = {}): Promise<void> => {
    if (this.phase === 'updating') return;

    const waiting = this.currentWaiting();
    if (!waiting) {
      this.setState({
        phase: 'error',
        error: 'no_waiting_worker',
        unsaved: null,
      });
      return;
    }

    if (!opts.force) {
      const unsaved = detectUnsavedWork();
      if (unsaved.hasUnsaved) {
        this.setState({
          phase: 'confirm_unsaved',
          unsaved,
          waitingScriptUrl: waiting.scriptURL,
          error: null,
        });
        return;
      }
    }

    await this.activateWaitingWorker(waiting);
  };

  retryActivate = async (): Promise<void> => {
    const waiting = this.currentWaiting();
    if (!waiting) {
      this.setState({ phase: 'error', error: 'no_waiting_worker' });
      return;
    }
    await this.activateWaitingWorker(waiting);
  };

  private async activateWaitingWorker(waiting: ServiceWorker): Promise<void> {
    this.setState({
      phase: 'updating',
      error: null,
      unsaved: null,
      waitingScriptUrl: waiting.scriptURL,
    });

    this.awaitingActivationReload = true;
    this.reloadAlreadyTriggered = false;

    if (this.activationTimer) clearTimeout(this.activationTimer);
    this.activationTimer = setTimeout(() => {
      if (!this.reloadAlreadyTriggered && this.awaitingActivationReload) {
        console.warn('[PWA] Activation timed out');
        this.awaitingActivationReload = false;
        this.setState({
          phase: 'error',
          error: 'activation_timeout',
        });
      }
    }, ACTIVATION_TIMEOUT_MS);

    try {
      waiting.postMessage({ type: 'SKIP_WAITING' });
      // If already activated between click and message
      if (waiting.state === 'activated' || waiting.state === 'activating') {
        // controllerchange / statechange will reload
      }
    } catch (err) {
      console.error('[PWA] Failed to post SKIP_WAITING', err);
      this.awaitingActivationReload = false;
      if (this.activationTimer) {
        clearTimeout(this.activationTimer);
        this.activationTimer = null;
      }
      this.setState({ phase: 'error', error: 'activation_failed' });
    }
  }

  /** Expose waiting state for ErrorBoundary recovery. */
  hasWaitingWorker(): boolean {
    return !!this.currentWaiting();
  }

  /** Prompt from ErrorBoundary when chunk load failed and an update is waiting. */
  offerFromChunkRecovery(): void {
    const waiting = this.currentWaiting();
    if (!waiting) return;
    // Bypass session dismiss for recovery — user hit a hard failure
    clearSessionValue(SW_UPDATE_DISMISSED_KEY);
    this.setState({
      phase: 'available',
      waitingScriptUrl: waiting.scriptURL,
      waitingUpdateId: this.waitingUpdateId,
      error: null,
      unsaved: null,
    });
    void fetchWaitingUpdateId().then((id) => {
      if (id && this.currentWaiting()) {
        this.setState({
          phase: 'available',
          waitingScriptUrl: waiting.scriptURL,
          waitingUpdateId: id,
          error: null,
          unsaved: null,
        });
      }
    });
  }

  /** Test/harness only: surface recoverable activation failure UI. */
  forceErrorStateForTests(error: string = 'activation_timeout'): void {
    this.awaitingActivationReload = false;
    if (this.activationTimer) {
      clearTimeout(this.activationTimer);
      this.activationTimer = null;
    }
    this.setState({ phase: 'error', error, unsaved: null });
  }
}

/** Process-wide controller (one registration per page). */
export const serviceWorkerUpdateController = new ServiceWorkerUpdateController();

export async function registerServiceWorker(): Promise<void> {
  await serviceWorkerUpdateController.start();
  if (typeof window !== 'undefined') {
    (window as unknown as { __sommiSwUpdate?: unknown }).__sommiSwUpdate = {
      getSnapshot: () => serviceWorkerUpdateController.getSnapshot(),
      dismissForSession: () => serviceWorkerUpdateController.dismissForSession(),
      requestUpdate: (opts?: { force?: boolean }) =>
        serviceWorkerUpdateController.requestUpdate(opts),
      forceError: (code?: string) => serviceWorkerUpdateController.forceErrorStateForTests(code),
      hasWaitingWorker: () => serviceWorkerUpdateController.hasWaitingWorker(),
    };
  }
}

export async function unregisterServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    await registration.unregister();
  }
  console.log('[PWA] Service worker unregistered');
}
