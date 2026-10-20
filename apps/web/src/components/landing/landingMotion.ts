/**
 * Shared motion presets for the public landing page.
 * Respects prefers-reduced-motion; safe if motion never initializes.
 */

export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeOut = [0.22, 1, 0.36, 1] as const;

export const fadeUp = prefersReducedMotion
  ? {}
  : {
      initial: { opacity: 0, y: 20 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: '-48px' },
      transition: { duration: 0.45, ease: easeOut },
    };

export const fadeIn = prefersReducedMotion
  ? {}
  : {
      initial: { opacity: 0 },
      whileInView: { opacity: 1 },
      viewport: { once: true, margin: '-48px' },
      transition: { duration: 0.5, ease: easeOut },
    };

export const heroStagger = prefersReducedMotion
  ? {}
  : {
      initial: 'hidden',
      animate: 'show',
      variants: {
        hidden: {},
        show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
      },
    };

export const heroItem = prefersReducedMotion
  ? {}
  : {
      variants: {
        hidden: { opacity: 0, y: 18 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.42, ease: easeOut },
        },
      },
    };
