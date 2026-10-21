import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  /** Primary/secondary actions shown at the end side on wide screens. */
  actions?: ReactNode;
  className?: string;
  id?: string;
}

/**
 * Standard in-app page intro: gold eyebrow → Fraunces title → stone subtitle,
 * with actions aligned to the end side (stacked under the copy on mobile).
 */
export function PageHeader({ title, eyebrow, subtitle, actions, className = '', id }: PageHeaderProps) {
  return (
    <header className={`mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow ? <p className="app-eyebrow mb-2">{eyebrow}</p> : null}
        <h1 id={id} className="app-page-title">
          {title}
        </h1>
        {subtitle ? <p className="app-page-subtitle mt-2 max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-col xs:flex-row gap-2 sm:flex-shrink-0">{actions}</div> : null}
    </header>
  );
}
