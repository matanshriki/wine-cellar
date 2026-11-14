import { useEffect } from 'react';
import { acquireScrollLock } from '../lib/scrollLock';

/** Locks page scrolling while `active` is true (shared, reference-counted lock). */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return acquireScrollLock();
  }, [active]);
}
