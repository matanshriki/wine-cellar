import { useEffect, useRef, useState } from 'react';

export type NavMode = 'expanded' | 'compact';

const TOP_EXPAND_THRESHOLD = 40;
const SHRINK_DELTA = 24;
const EXPAND_UP_DELTA = 16;

/**
 * Global CSS uses `body { height: 100%; overflow-y: auto }` so the viewport scrolls
 * on **body**, not on `html`. In that case `window.scrollY` and `html.scrollTop`
 * often stay 0 while `body.scrollTop` moves — we must read all sources.
 */
function getScrollY(): number {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 0;
  const w = window.scrollY ?? window.pageYOffset ?? 0;
  const html = document.documentElement?.scrollTop ?? 0;
  const body = document.body?.scrollTop ?? 0;
  return Math.max(w, html, body);
}

function getScrollEventTargets(): EventTarget[] {
  if (typeof document === 'undefined' || typeof window === 'undefined') return [];
  const list: EventTarget[] = [window];
  list.push(document);
  list.push(document.documentElement);
  if (document.body) list.push(document.body);
  return list;
}

export type UseScrollDirectionNavOptions = {
  /** When false, scroll is ignored and mode stays expanded (e.g. modal open). */
  enabled?: boolean;
};

/**
 * Instagram-style scroll direction for bottom nav: expanded at top / on scroll up,
 * compact after sufficient scroll down, with hysteresis to avoid flicker.
 */
export function useScrollDirectionNav(options?: UseScrollDirectionNavOptions): NavMode {
  const enabled = options?.enabled ?? true;
  const [navMode, setNavMode] = useState<NavMode>('expanded');
  const lastScrollY = useRef(0);
  const modeAnchorY = useRef(0);
  const navModeRef = useRef<NavMode>('expanded');
  const rafId = useRef<number | null>(null);

  navModeRef.current = navMode;

  useEffect(() => {
    if (!enabled) {
      if (navModeRef.current !== 'expanded') {
        navModeRef.current = 'expanded';
        setNavMode('expanded');
      }
      return undefined;
    }

    lastScrollY.current = getScrollY();
    modeAnchorY.current = lastScrollY.current;

    const tick = () => {
      const y = getScrollY();
      const prev = lastScrollY.current;
      lastScrollY.current = y;

      const mode = navModeRef.current;
      const anchor = modeAnchorY.current;

      if (y < TOP_EXPAND_THRESHOLD) {
        if (mode !== 'expanded') {
          navModeRef.current = 'expanded';
          setNavMode('expanded');
        }
        modeAnchorY.current = y;
        return;
      }

      if (mode === 'expanded') {
        if (y > prev && y >= anchor + SHRINK_DELTA) {
          navModeRef.current = 'compact';
          setNavMode('compact');
          modeAnchorY.current = y;
        }
        return;
      }

      // compact
      if (y < prev && y <= anchor - EXPAND_UP_DELTA) {
        navModeRef.current = 'expanded';
        setNavMode('expanded');
        modeAnchorY.current = y;
      }
    };

    const onScroll = () => {
      if (rafId.current != null) return;
      rafId.current = window.requestAnimationFrame(() => {
        rafId.current = null;
        tick();
      });
    };

    const targets = getScrollEventTargets();
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    for (const t of targets) {
      t.addEventListener('scroll', onScroll, opts);
    }
    tick();

    return () => {
      for (const t of targets) {
        t.removeEventListener('scroll', onScroll, opts);
      }
      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [enabled]);

  return navMode;
}
