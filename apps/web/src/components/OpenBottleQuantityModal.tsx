/**
 * Open Bottle Quantity Modal
 * 
 * Allows user to select how many bottles to open when quantity > 1.
 * Features:
 * - Numeric stepper (-, input, +)
 * - Min = 1, Max = current quantity
 * - Default = 1
 * - Confirm/Cancel actions
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface OpenBottleQuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  maxQuantity: number;
  wineName: string;
}

export function OpenBottleQuantityModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  maxQuantity,
  wineName 
}: OpenBottleQuantityModalProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);

  // Reset quantity when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleDecrement = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleIncrement = () => {
    setQuantity((prev) => Math.min(maxQuantity, prev + 1));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setQuantity(Math.max(1, Math.min(maxQuantity, value)));
    }
  };

  const handleConfirm = () => {
    onConfirm(quantity);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* Header */}
            <div className="mb-6">
              <h2
                className="text-xl font-semibold mb-2"
                style={{
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {t('cellar.openBottle.howMany', 'How many bottles?')}
              </h2>
              <p
                className="text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('cellar.openBottle.selectQuantity', {
                  defaultValue: 'Select how many bottles of {{wineName}} you want to mark as opened.',
                  wineName,
                })}
              </p>
            </div>

            {/* Quantity Stepper */}
            <div className="mb-6">
              <div className="flex items-center justify-center gap-4">
                {/* Decrement Button */}
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={quantity <= 1}
                  className="w-12 h-12 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: quantity > 1 ? 'var(--wine-50)' : 'var(--bg-muted)',
                    color: quantity > 1 ? 'var(--wine-600)' : 'var(--text-tertiary)',
                    border: `1px solid ${quantity > 1 ? 'var(--wine-200)' : 'var(--border-base)'}`,
                  }}
                  aria-label={t('common.decrease', 'Decrease')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>

                {/* Quantity Input */}
                <div className="flex-1 max-w-[120px]">
                  <input
                    type="number"
                    min={1}
                    max={maxQuantity}
                    value={quantity}
                    onChange={handleInputChange}
                    className="w-full text-center text-3xl font-bold py-3 rounded-lg outline-none"
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '2px solid var(--wine-300)',
                    }}
                    aria-label={t('cellar.openBottle.quantity', 'Quantity')}
                  />
                  <p
                    className="text-xs text-center mt-2"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('cellar.openBottle.maxAvailable', {
                      defaultValue: 'Max: {{max}}',
                      max: maxQuantity,
                    })}
                  </p>
                </div>

                {/* Increment Button */}
                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={quantity >= maxQuantity}
                  className="w-12 h-12 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: quantity < maxQuantity ? 'var(--wine-50)' : 'var(--bg-muted)',
                    color: quantity < maxQuantity ? 'var(--wine-600)' : 'var(--text-tertiary)',
                    border: `1px solid ${quantity < maxQuantity ? 'var(--wine-200)' : 'var(--border-base)'}`,
                  }}
                  aria-label={t('common.increase', 'Increase')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {/* Cancel Button */}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-lg font-medium transition-all"
                style={{
                  background: 'var(--bg-muted)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-base)',
                }}
              >
                {t('common.cancel', 'Cancel')}
              </button>

              {/* Confirm Button */}
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3 px-4 rounded-lg font-medium transition-all"
                style={{
                  background: 'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(212, 175, 55, 0.25)',
                }}
              >
                {t('cellar.openBottle.markAsOpened', {
                  defaultValue: 'Mark {{count}} as Opened',
                  count: quantity,
                })}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
