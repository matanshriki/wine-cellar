/**
 * Open Bottle Quantity Modal
 * 
 * Luxury modal for selecting how many bottles to open when quantity > 1.
 * Matches the app's premium design aesthetic.
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
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl p-8 shadow-2xl relative overflow-hidden"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-base)',
            }}
          >
            {/* Decorative gradient overlay */}
            <div 
              className="absolute top-0 left-0 right-0 h-1"
              style={{
                background: 'linear-gradient(90deg, var(--wine-400), var(--gold-500), var(--wine-400))',
              }}
            />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mb-4 flex justify-center">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.12))',
                    border: '2px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <svg 
                    className="w-10 h-10" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              
              <h2
                className="text-2xl font-bold mb-4"
                style={{
                  color: 'white',
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '-0.02em',
                }}
              >
                {t('cellar.openBottle.howMany', 'How many bottles?')}
              </h2>
              
              <p
                className="text-base leading-relaxed px-2"
                style={{ 
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontWeight: '400',
                }}
              >
                {t('cellar.openBottle.selectQuantity', {
                  defaultValue: 'Select how many bottles of {{wineName}} you want to mark as opened.',
                  wineName,
                })}
              </p>
            </div>

            {/* Quantity Stepper */}
            <div className="mb-8">
              <div className="flex items-center justify-center gap-6">
                {/* Decrement Button */}
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={quantity <= 1}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                  style={{
                    background: quantity > 1 
                      ? 'linear-gradient(135deg, var(--wine-500), var(--wine-600))' 
                      : 'var(--bg-muted)',
                    color: quantity > 1 ? 'white' : 'var(--text-tertiary)',
                    boxShadow: quantity > 1 ? '0 4px 12px rgba(164, 76, 104, 0.25)' : 'none',
                  }}
                  aria-label={t('common.decrease', 'Decrease')}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>

                {/* Quantity Display */}
                <div className="flex-1 max-w-[140px]">
                  <div 
                    className="relative rounded-2xl p-6 text-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '2px solid rgba(255, 255, 255, 0.15)',
                    }}
                  >
                    <input
                      type="number"
                      min={1}
                      max={maxQuantity}
                      value={quantity}
                      onChange={handleInputChange}
                      className="w-full text-center text-5xl font-bold outline-none bg-transparent"
                      style={{
                        color: 'white',
                        fontFamily: 'var(--font-heading)',
                      }}
                      aria-label={t('cellar.openBottle.quantity', 'Quantity')}
                    />
                    <p
                      className="text-sm font-medium mt-2"
                      style={{ 
                        color: 'rgba(255, 255, 255, 0.6)',
                      }}
                    >
                      {t('cellar.openBottle.maxAvailable', {
                        defaultValue: 'Max: {{max}}',
                        max: maxQuantity,
                      })}
                    </p>
                  </div>
                </div>

                {/* Increment Button */}
                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={quantity >= maxQuantity}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                  style={{
                    background: quantity < maxQuantity
                      ? 'linear-gradient(135deg, var(--wine-500), var(--wine-600))'
                      : 'var(--bg-muted)',
                    color: quantity < maxQuantity ? 'white' : 'var(--text-tertiary)',
                    boxShadow: quantity < maxQuantity ? '0 4px 12px rgba(164, 76, 104, 0.25)' : 'none',
                  }}
                  aria-label={t('common.increase', 'Increase')}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {/* Confirm Button */}
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full py-4 px-6 rounded-xl font-semibold text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                  color: 'white',
                  boxShadow: '0 6px 20px rgba(164, 76, 104, 0.4)',
                }}
              >
                {t('cellar.openBottle.markAsOpened', {
                  defaultValue: 'Mark {{count}} as Opened',
                  count: quantity,
                })}
              </button>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-4 px-6 rounded-xl font-medium text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'rgba(255, 255, 255, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
