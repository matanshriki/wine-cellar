/**
 * Stack of open modal layers.
 *
 * While at least one layer is open the app root is made inert (no clicks,
 * focus or screen-reader access behind the dialog) and the scroll container is
 * locked. Only the topmost layer reacts to Escape.
 */

import { acquireScrollLock } from './scrollLock';

export interface ModalBackgroundAdapter {
  lock(): void;
  unlock(): void;
}

const APP_ROOT_ID = 'root';

const domAdapter: ModalBackgroundAdapter = (() => {
  let releaseScroll: (() => void) | null = null;
  return {
    lock() {
      const root = document.getElementById(APP_ROOT_ID);
      root?.setAttribute('inert', '');
      root?.setAttribute('aria-hidden', 'true');
      releaseScroll?.();
      releaseScroll = acquireScrollLock();
    },
    unlock() {
      const root = document.getElementById(APP_ROOT_ID);
      root?.removeAttribute('inert');
      root?.removeAttribute('aria-hidden');
      releaseScroll?.();
      releaseScroll = null;
    },
  };
})();

/**
 * Clears `inert` left on the app root when no modal layer is open, so the page
 * can never stay untappable after a dialog failed to clean up.
 */
export function releaseOrphanedAppInert(): boolean {
  if (stack.length > 0) return false;
  const root = document.getElementById(APP_ROOT_ID);
  if (!root?.hasAttribute('inert')) return false;
  root.removeAttribute('inert');
  root.removeAttribute('aria-hidden');
  return true;
}

let adapter: ModalBackgroundAdapter = domAdapter;
const stack: symbol[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function openModalLayer(): symbol {
  const id = Symbol('modal-layer');
  if (stack.length === 0) adapter.lock();
  stack.push(id);
  notify();
  return id;
}

export function closeModalLayer(id: symbol): void {
  const index = stack.indexOf(id);
  if (index === -1) return;
  stack.splice(index, 1);
  if (stack.length === 0) adapter.unlock();
  notify();
}

export function isTopmostModalLayer(id: symbol | null): boolean {
  return id !== null && stack[stack.length - 1] === id;
}

export function openModalLayerCount(): number {
  return stack.length;
}

export function subscribeModalStack(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam: swap the DOM side effects for a fake. Returns a restore function. */
export function setModalBackgroundAdapter(next: ModalBackgroundAdapter): () => void {
  const previous = adapter;
  adapter = next;
  return () => {
    adapter = previous;
  };
}
