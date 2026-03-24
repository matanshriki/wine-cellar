import { useEffect, useRef, useState } from 'react';

export type NavMode = 'expanded' | 'compact';

const TOP_EXPAND_THRESHOLD = 40;
const SHRINK_DELTA = 24;
const EXPAND_UP_DELTA = 16;

function getScrollY(): number {
  const root = document.scrollingElement;
  if (root && typeof root.scrollTop === 'number') {
    return root.scrollTop;
  }
  return window.scrollY || document.documentElement.scrollTop || 0;
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

    window.addEventListener('scroll', onScroll, { passive: true });
    tick();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [enabled]);

  return navMode;
}
