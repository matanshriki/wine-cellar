import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

interface FormFieldProps {
  label: ReactNode;
  /** Renders the control; spread the props onto the input/select/textarea. */
  children: (control: FieldControlProps) => ReactNode;
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  labelClassName?: string;
  id?: string;
}

/**
 * Label + control + help + error, wired with htmlFor / aria-describedby /
 * aria-invalid so assistive tech announces all of them with the field.
 */
export function FormField({
  label,
  children,
  required,
  optional,
  hint,
  error,
  className,
  labelClassName = 'block text-sm font-medium mb-1',
  id: idProp,
}: FormFieldProps) {
  const { t } = useTranslation();
  const autoId = useId();
  const id = idProp ?? `field-${autoId.replace(/:/g, '')}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className={labelClassName} style={{ color: 'var(--text-primary)' }}>
        {label}
        {required && (
          <>
            <span aria-hidden="true" style={{ color: 'var(--accent-text)' }}> *</span>
            <span className="sr-only"> ({t('form.required')})</span>
          </>
        )}
        {optional && (
          <span className="text-xs ms-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>
            ({t('bottleForm.optional')})
          </span>
        )}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(required ? { 'aria-required': true as const } : {}),
      })}
      {hint && (
        <p id={hintId} className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs mt-1 font-medium" style={{ color: 'var(--text-error)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
