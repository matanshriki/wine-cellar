import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

interface ChoiceChipProps {
  type: 'radio' | 'checkbox';
  /** Radio group name; ignored for checkboxes. */
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  /** Secondary line inside the chip (e.g. "3 wines"). */
  hint?: ReactNode;
  /** Decorative leading glyph; hidden from assistive tech. */
  icon?: ReactNode;
  /** Full-width row with a visible checkbox (preferences). */
  row?: boolean;
  describedBy?: string;
  disabled?: boolean;
  className?: string;
}

/** Pill-shaped native radio/checkbox. Selected state is filled and shows a check icon in both themes. */
export function ChoiceChip({
  type,
  name,
  checked,
  onChange,
  label,
  hint,
  icon,
  row = false,
  describedBy,
  disabled,
  className = '',
}: ChoiceChipProps) {
  return (
    <label className={`app-choice${row ? ' app-choice--row' : hint ? ' app-choice--stacked' : ''} ${className}`}>
      <input
        type={type}
        name={type === 'radio' ? name : undefined}
        className="app-choice__input"
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="app-choice__box">
        {row ? (
          <span className="app-choice__tick" aria-hidden="true">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        ) : hint ? null : (
          <Check className="app-choice__check h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        )}
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <span className={row ? 'flex flex-col' : 'flex flex-col items-center'}>
          <span>{label}</span>
          {hint ? (
            <span className="app-choice__hint inline-flex items-center gap-1">
              {!row && <Check className="app-choice__check h-3 w-3" strokeWidth={3} aria-hidden="true" />}
              {hint}
            </span>
          ) : null}
        </span>
      </span>
    </label>
  );
}
