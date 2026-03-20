/**
 * Scroll the main app document to the top.
 *
 * The app uses `body { overflow-y: auto; height: 100% }` with a fixed header,
 * so the real scroll container is often `body` / `document.scrollingElement`, not
 * only `window`. Using every safe target matches CellarPage / BottomNav fixes
 * for iOS Safari and PWA.
 */

import { shouldReduceMotion } from './pwaAnimationFix';

export type ScrollAppToTopOptions = {
  /** Override default (smooth unless reduced-motion, then instant) */
  behavior?: ScrollBehavior;
};

export function scrollAppToTop(options?: ScrollAppToTopOptions): void {
  const behavior: ScrollBehavior =
    options?.behavior ?? (shouldReduceMotion() ? 'auto' : 'smooth');
  const opts: ScrollToOptions = { top: 0, left: 0, behavior };

  try {
    const root = document.scrollingElement;
    if (root) {
      root.scrollTo(opts);
    }
    window.scrollTo(opts);
    document.documentElement.scrollTo?.(opts);
    document.body.scrollTo?.(opts);
  } catch {
    window.scrollTo(0, 0);
  }

  if (behavior === 'auto') {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}
