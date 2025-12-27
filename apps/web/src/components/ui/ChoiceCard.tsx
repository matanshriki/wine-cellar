/**
 * Luxury Choice Card Component
 * 
 * Premium selectable cards for the "Tonight?" flow with:
 * - Elegant hover/selected states
 * - Smooth animations
 * - Large touch targets for mobile
 * - Icon + label + description support
 * - RTL support
 * - Accessible
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface ChoiceCardProps {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  selected: boolean;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export const ChoiceCard: React.FC<ChoiceCardProps> = ({
  value,
  label,
  description,
  icon,
  selected,
  onSelect,
  disabled = false,
}) => {
  return (
    <motion.button
      type="button"
      onClick={() => !disabled && onSelect(value)}
      disabled={disabled}
      whileHover={!disabled && !selected ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`
        relative w-full p-5 rounded-xl text-start transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${
          selected
            ? 'shadow-lg'
            : 'shadow-sm hover:shadow-md'
        }
      `}
      style={{
        backgroundColor: selected ? 'var(--color-wine-50)' : 'white',
        border: `2px solid ${
          selected ? 'var(--color-wine-500)' : 'var(--color-stone-200)'
        }`,
        ...(selected && {
          boxShadow: 'var(--glow-wine)',
        }),
      }}
      aria-pressed={selected}
    >
      {/* Selected indicator */}
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 end-3 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-wine-600)' }}
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      )}

      <div className="flex items-start gap-4">
        {icon && (
          <div
            className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: selected
                ? 'var(--color-wine-100)'
                : 'transparent',
              color: selected ? 'var(--color-wine-700)' : 'var(--color-stone-700)',
            }}
          >
            {icon}
          </div>
        )}

        <div className="flex-1 min-w-0 mt-1">
          <h4
            className="font-semibold text-base mb-1"
            style={{
              color: selected ? 'var(--color-wine-900)' : 'var(--color-stone-900)',
            }}
          >
            {label}
          </h4>
          {description && (
            <p
              className="text-sm leading-relaxed"
              style={{
                color: selected ? 'var(--color-stone-700)' : 'var(--color-stone-600)',
              }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
};

