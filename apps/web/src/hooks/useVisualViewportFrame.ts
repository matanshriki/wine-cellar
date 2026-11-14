import { useEffect, useState } from 'react';
import { acquireScrollLock } from '../lib/scrollLock';

export type VisualViewportFrame = {
  /** Visible viewport height (shrinks when the soft keyboard is open). */
  height: number;
  /** iOS may shift the visual viewport; pin the shell with this offset. */
  offsetTop: number;
  /** True when the visual viewport is meaningfully shorter than the layout viewport. */
  keyboardOpen: boolean;
};

function readFrame(): VisualViewportFrame {
  if (typeof window === 'undefined') {
    return { height: 0, offsetTop: 0, keyboardOpen: false };
  }
  const vv = window.visualViewport;
  const height = Math.round(vv?.height ?? window.innerHeight);
  const offsetTop = Math.round(vv?.offsetTop ?? 0);
  // ~80px filters URL-bar chrome changes; keyboards are typically much taller.
  const keyboardOpen = height < window.innerHeight - 80;
  return { height, offsetTop, keyboardOpen };
}

/**
 * Locks document scrolling and exposes the visual viewport frame so a full-screen
 * chat shell can sit above the iOS keyboard without double-offset gaps.
 */
export function useVisualViewportFrame(): VisualViewportFrame {
  const [frame, setFrame] = useState<VisualViewportFrame>(readFrame);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;

    html.style.overflow = 'hidden';
    const releaseScrollLock = acquireScrollLock();

    const sync = () => {
      // iOS often scrolls the document to keep a focused field visible — undo that.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      if (body.scrollTop !== 0) body.scrollTop = 0;
      setFrame(readFrame());
    };

    sync();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);

    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      html.style.overflow = prevHtmlOverflow;
      releaseScrollLock();
    };
  }, []);

  return frame;
}
