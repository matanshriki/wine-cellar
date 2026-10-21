import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { shouldReduceMotion } from '../../utils/pwaAnimationFix';

interface EmptyStateProps {
  title: ReactNode;
  body?: ReactNode;
  /** Painterly 4:3 illustration from /assets/app. */
  art?: string;
  /** Fallback when there is no art: an icon rendered inside a blob tile. */
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Illustrated empty / zero-data state card shared by in-app screens. */
export function EmptyState({ title, body, art, icon, actions, children, className = '' }: EmptyStateProps) {
  const reduce = shouldReduceMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={`app-empty px-5 py-7 sm:px-10 sm:py-10 ${className}`}
    >
      {art ? (
        <img src={art} alt="" aria-hidden className="app-empty-art mb-6" loading="lazy" decoding="async" />
      ) : icon ? (
        <div className="lp-blob lp-blob-burgundy lp-blob-shape-0 mx-auto mb-5 !h-20 !w-20">{icon}</div>
      ) : null}
      <h2 className="app-display text-2xl sm:text-[1.75rem] leading-tight mb-2">{title}</h2>
      {body ? (
        <p className="mx-auto max-w-md text-[0.975rem] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {body}
        </p>
      ) : null}
      {actions ? <div className="mt-7 flex flex-col items-center gap-3">{actions}</div> : null}
      {children}
    </motion.section>
  );
}
