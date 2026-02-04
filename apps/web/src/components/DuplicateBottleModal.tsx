/**
 * Duplicate Bottle Modal
 * 
 * Shown when adding a bottle that already exists in the cellar.
 * Allows user to increase quantity with a stepper control.
 * 
 * Features:
 * - Display existing wine info (mini-card)
 * - Stepper to select quantity to add (1-99)
 * - Primary action: Add bottles to existing entry
 * - Secondary action: Create separate entry (optional)
 * - Tertiary: Cancel
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface ExistingWine {
  id: string;
  name: string; // Display name (passed from parent, can be wine_name)
  producer?: string;
  vintage?: number;
  style: 'red' | 'white' | 'rose' | 'sparkling';
  rating?: number;
  quantity: number;
  label_image_url?: string;
}

interface DuplicateBottleModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingWine: ExistingWine;
  onAddQuantity: (quantity: number) => void;
  onCreateSeparate?: () => void; // Optional: create separate entry
}

export function DuplicateBottleModal({
  isOpen,
  onClose,
  existingWine,
  onAddQuantity,
  onCreateSeparate,
}: DuplicateBottleModalProps) {
  const { t } = useTranslation();
  const [quantityToAdd, setQuantityToAdd] = useState(1);

  const handleIncrement = () => {
    if (quantityToAdd < 99) {
      setQuantityToAdd(prev => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (quantityToAdd > 1) {
      setQuantityToAdd(prev => prev - 1);
    }
  };

  const handleConfirm = () => {
    onAddQuantity(quantityToAdd);
    setQuantityToAdd(1); // Reset for next time
  };

  const handleCancel = () => {
    onClose();
    setQuantityToAdd(1); // Reset
  };

  if (!isOpen) return null;

  const newTotal = existingWine.quantity + quantityToAdd;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{
          background: 'var(--bg-overlay)',
          backdropFilter: 'var(--blur-medium)',
          WebkitBackdropFilter: 'var(--blur-medium)',
        }}
        onClick={handleCancel}
      >
        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md rounded-2xl overflow-hidden"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-xl)',
            maxHeight: '90vh',
          }}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 
              className="text-2xl font-bold"
              style={{ 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {t('duplicate.title', 'Already in your cellar')}
            </h2>
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('duplicate.subtitle', 'This wine is already in your collection')}
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            {/* Existing Wine Card */}
            <div 
              className="p-4 rounded-xl flex gap-4"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {/* Wine Image */}
              {existingWine.label_image_url ? (
                <img
                  src={existingWine.label_image_url}
                  alt={existingWine.name}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  style={{ border: '1px solid var(--border-subtle)' }}
                />
              ) : (
                <div 
                  className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-100), var(--wine-200))',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--wine-600)' }}>
                    <path fill="currentColor" d="M6 2h12v2H6V2zm0 18c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6H6v14zM8 8h8v12H8V8z"/>
                  </svg>
                </div>
              )}

              {/* Wine Info */}
              <div className="flex-1 min-w-0">
                <h3 
                  className="font-semibold text-base truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {existingWine.name}
                </h3>
                {existingWine.producer && (
                  <p 
                    className="text-sm truncate"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {existingWine.producer}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {existingWine.vintage && (
                    <span 
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        background: 'var(--wine-50)',
                        color: 'var(--wine-700)',
                      }}
                    >
                      {existingWine.vintage}
                    </span>
                  )}
                  <span 
                    className="text-xs px-2 py-0.5 rounded capitalize"
                    style={{
                      background: 'var(--bg-surface)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {existingWine.style}
                  </span>
                  <span 
                    className="text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {existingWine.quantity} {existingWine.quantity === 1 ? 'bottle' : 'bottles'}
                  </span>
                </div>
              </div>
            </div>

            {/* Stepper */}
            <div>
              <label 
                className="block text-sm font-medium mb-3"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('duplicate.howMany', 'How many bottles to add?')}
              </label>
              
              <div className="flex items-center gap-4">
                {/* Decrement Button */}
                <button
                  onClick={handleDecrement}
                  disabled={quantityToAdd <= 1}
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-all"
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-medium)',
                    color: quantityToAdd <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: quantityToAdd <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>

                {/* Quantity Display */}
                <div 
                  className="flex-1 h-12 rounded-xl flex items-center justify-center font-bold text-2xl"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-50), var(--wine-100))',
                    border: '2px solid var(--wine-200)',
                    color: 'var(--wine-700)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {quantityToAdd}
                </div>

                {/* Increment Button */}
                <button
                  onClick={handleIncrement}
                  disabled={quantityToAdd >= 99}
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-all"
                  style={{
                    background: quantityToAdd >= 99 ? 'var(--bg-surface-elevated)' : 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                    border: '1px solid var(--wine-700)',
                    color: 'white',
                    cursor: quantityToAdd >= 99 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* New Total Preview */}
              <p 
                className="text-sm mt-3 text-center"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('duplicate.newTotal', 'New total: {{count}} bottles', { count: newTotal })}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 space-y-3">
            {/* Primary: Add to Existing */}
            <button
              onClick={handleConfirm}
              className="btn-luxury-primary w-full"
              style={{ minHeight: '52px' }}
            >
              {t('duplicate.addBottles', 'Add {{count}} {{bottles}}', { 
                count: quantityToAdd,
                bottles: quantityToAdd === 1 ? 'bottle' : 'bottles'
              })}
            </button>

            {/* Secondary: Create Separate (Optional) */}
            {onCreateSeparate && (
              <button
                onClick={() => {
                  onCreateSeparate();
                  setQuantityToAdd(1);
                }}
                className="btn-luxury-secondary w-full"
                style={{ minHeight: '48px' }}
              >
                {t('duplicate.createSeparate', 'Create separate entry')}
              </button>
            )}

            {/* Tertiary: Cancel */}
            <button
              onClick={handleCancel}
              className="w-full text-center py-3 text-sm font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
