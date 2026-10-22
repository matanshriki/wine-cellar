/**
 * Stack of open modal layers.
 *
 * While at least one layer is open the app root is made inert (no clicks,
 * focus or screen-reader access behind the dialog) and the scroll container is
 * locked. Only the topmost layer reacts to Escape.
 */

export interface ModalBackgroundAdapter {
  lock(): void;
  unlock(): void;
}

const APP_ROOT_ID = 'root';

const domAdapter: ModalBackgroundAdapter = (() => {
  let savedOverflow = '';
  return {
    lock() {
      const root = document.getElementById(APP_ROOT_ID);
      root?.setAttribute('inert', '');
      root?.setAttribute('aria-hidden', 'true');
      // `body` is the app's scroll container (see index.css), not `window`.
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    },
    unlock() {
      const root = document.getElementById(APP_ROOT_ID);
      root?.removeAttribute('inert');
      root?.removeAttribute('aria-hidden');
      document.body.style.overflow = savedOverflow;
    },
  };
})();

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
