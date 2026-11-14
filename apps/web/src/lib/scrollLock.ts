/**
 * Reference-counted page scroll lock.
 *
 * `body` is the app's scroll container (see index.css), so `overflow: hidden`
 * on it is enough to stop background scrolling. Every overlay must lock
 * through here: the page unlocks only when the last holder releases, so
 * overlapping modals can never restore a stale style and leave the page frozen.
 */

let holders = 0;
let savedOverflow = '';

export function acquireScrollLock(): () => void {
  if (holders === 0) {
    savedOverflow = document.body.style.overflow === 'hidden' ? '' : document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  holders += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0) {
      document.body.style.overflow = savedOverflow;
      savedOverflow = '';
    }
  };
}

export function isScrollLocked(): boolean {
  return holders > 0;
}

/**
 * Temporarily lets the page scroll while locks are held (e.g. while an OS file
 * chooser pauses JS on Android). Returns a function that re-applies the lock
 * if it is still held.
 */
export function suspendScrollLock(): () => void {
  if (holders === 0) return () => {};
  document.body.style.overflow = savedOverflow;
  return () => {
    if (holders > 0) document.body.style.overflow = 'hidden';
  };
}

/**
 * Clears scroll-lock styles left on `body` when no lock is held. Also clears
 * the legacy `position: fixed` pinning older overlays used.
 */
export function releaseOrphanedScrollLock(): boolean {
  if (holders > 0) return false;
  const style = document.body.style;
  const stuck = style.overflow === 'hidden' || style.position === 'fixed';
  if (!stuck) return false;
  style.overflow = '';
  if (style.position === 'fixed') {
    style.position = '';
    style.top = '';
    style.width = '';
  }
  return true;
}

/** Test seam: reset module state between tests. */
export function resetScrollLockForTests(): void {
  holders = 0;
  savedOverflow = '';
  document.body.style.overflow = '';
}
