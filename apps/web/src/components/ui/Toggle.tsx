/**
 * Luxury Toggle/Switch Component
 * 
 * Premium switch with:
 * - Smooth animations (Framer Motion)
 * - Elegant styling
 * - Large touch targets for mobile
 * - Accessible (keyboard, aria)
 * - RTL support
 * - Helper text support
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  helperText,
  disabled = false,
  size = 'md',
  id,
}) => {
  /**
   * Size configurations with RTL-aware positioning
   * 
   * For unchecked state:
   * - LTR: Uses small positive offset (0.25rem or 0.125rem)
   * - RTL: Uses slightly smaller negative offset (-0.2rem or -0.1rem)
   *   to account for visual weight and ensure perfect alignment
   * 
   * For checked state:
   * - Both LTR/RTL use same translate-x value
   * - The `start-0` positioning handles the direction flip
   */
  const sizes = {
    sm: {
      container: 'w-10 h-6',
      thumb: 'w-4 h-4',
      checkedClass: 'translate-x-4',
      // LTR: 0.125rem, RTL: -0.1rem
      uncheckedClass: 'translate-x-[0.125rem] rtl:translate-x-[-0.1rem]',
    },
    md: {
      container: 'w-14 h-8',
      thumb: 'w-6 h-6',
      checkedClass: 'translate-x-6',
      // LTR: 0.25rem, RTL: -0.2rem (fixes the reported bug)
      uncheckedClass: 'translate-x-[0.25rem] rtl:translate-x-[-0.2rem]',
    },
    lg: {
      container: 'w-16 h-10',
      thumb: 'w-8 h-8',
      checkedClass: 'translate-x-6',
      // LTR: 0.25rem, RTL: -0.2rem
      uncheckedClass: 'translate-x-[0.25rem] rtl:translate-x-[-0.2rem]',
    },
  };

  const sizeConfig = sizes[size];

  const toggleId = id || `toggle-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className="flex items-center gap-3 min-h-[44px]">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={label ? `${toggleId}-label` : undefined}
        aria-describedby={helperText ? `${toggleId}-helper` : undefined}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-wine-500
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${sizeConfig.container}
        `}
        style={{
          backgroundColor: checked
            ? 'var(--color-wine-500)'
            : 'var(--color-stone-300)',
        }}
      >
        <span className="sr-only">{label || 'Toggle'}</span>
        <span 
          className={`
            ${sizeConfig.thumb}
            rounded-full bg-white shadow-md
            absolute top-1/2 -translate-y-1/2 start-0
            transition-transform duration-200 ease-in-out
            ${checked ? sizeConfig.checkedClass : sizeConfig.uncheckedClass}
          `}
        />
      </button>

      {(label || helperText) && (
        <div 
          className="flex-1 min-w-0 cursor-pointer" 
          onClick={() => !disabled && onChange(!checked)}
        >
          {label && (
            <div
              id={`${toggleId}-label`}
              className={`
                block font-medium text-base leading-snug
                ${disabled ? 'text-gray-400' : 'text-gray-900'}
              `}
              style={{ color: disabled ? 'var(--color-stone-400)' : 'var(--color-stone-900)' }}
            >
              {label}
            </div>
          )}
          {helperText && (
            <p
              id={`${toggleId}-helper`}
              className="mt-1 text-xs leading-tight"
              style={{ color: 'var(--color-stone-600)' }}
            >
              {helperText}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

