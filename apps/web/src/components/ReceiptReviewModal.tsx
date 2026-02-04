/**
 * Receipt Review Modal
 * 
 * Review and edit wine items detected from a receipt/invoice scan.
 * Similar to MultiBottleImport but for receipt items.
 * 
 * Features:
 * - List of detected wines with editable fields
 * - Stepper for quantity per item
 * - Remove item option
 * - Duplicate detection per item
 * - Primary action: "Add to cellar"
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { WineLoader } from './WineLoader';
import type { ReceiptItem } from '../services/receiptScanService';

interface ReceiptReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  items: ReceiptItem[];
  onConfirm: (items: ReceiptItem[]) => Promise<void>;
}

export function ReceiptReviewModal({
  isOpen,
  onClose,
  imageUrl,
  items: initialItems,
  onConfirm,
}: ReceiptReviewModalProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ReceiptItem[]>(initialItems);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleQuantityChange = (index: number, newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > 99) return;
    
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, quantity: newQuantity } : item
    ));
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    if (items.length === 0) {
      onClose();
      return;
    }
    
    setIsProcessing(true);
    try {
      await onConfirm(items);
      onClose();
    } catch (error) {
      console.error('[ReceiptReview] Error adding items:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const totalBottles = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalPrice = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{
            background: 'var(--bg-overlay)',
            backdropFilter: 'var(--blur-medium)',
            WebkitBackdropFilter: 'var(--blur-medium)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 
                className="text-2xl font-bold"
                style={{ 
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {t('receipt.review', 'Receipt Review')}
              </h2>
              <p 
                className="text-sm mt-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('receipt.detected', 'Detected {{count}} wines', { count: items.length })}
              </p>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 luxury-scrollbar">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {t('receipt.noItems', 'No items remaining')}
                  </p>
                </div>
              ) : (
                items.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl"
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Item Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 
                          className="font-semibold text-base truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {item.name || t('receipt.unknownWine', 'Unknown Wine')}
                        </h4>
                        {item.producer && (
                          <p 
                            className="text-sm truncate"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {item.producer}
                          </p>
                        )}
                      </div>
                      
                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="ml-2 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-medium)',
                        }}
                        aria-label={t('common.remove', 'Remove')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Item Details */}
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      {item.vintage && (
                        <span 
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: 'var(--wine-50)',
                            color: 'var(--wine-700)',
                          }}
                        >
                          {item.vintage}
                        </span>
                      )}
                      {item.style && (
                        <span 
                          className="text-xs px-2 py-1 rounded capitalize"
                          style={{
                            background: 'var(--bg-surface)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {item.style}
                        </span>
                      )}
                      {item.price && (
                        <span 
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: 'var(--gold-50)',
                            color: 'var(--gold-700)',
                          }}
                        >
                          ${item.price.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-3">
                      <span 
                        className="text-sm font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('receipt.quantity', 'Quantity')}:
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantityChange(index, (item.quantity || 1) - 1)}
                          disabled={(item.quantity || 1) <= 1}
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-medium)',
                            color: (item.quantity || 1) <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        
                        <span 
                          className="w-12 text-center font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {item.quantity || 1}
                        </span>
                        
                        <button
                          onClick={() => handleQuantityChange(index, (item.quantity || 1) + 1)}
                          disabled={(item.quantity || 1) >= 99}
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{
                            background: (item.quantity || 1) >= 99 ? 'var(--bg-surface)' : 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                            border: '1px solid var(--wine-700)',
                            color: 'white',
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex-shrink-0 space-y-4" style={{ borderColor: 'var(--border-subtle)' }}>
              {/* Summary */}
              <div 
                className="flex justify-between items-center px-4 py-3 rounded-xl"
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <p 
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('receipt.total', 'Total')}
                  </p>
                  <p 
                    className="text-lg font-bold"
                    style={{ 
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {totalBottles} {totalBottles === 1 ? 'bottle' : 'bottles'}
                  </p>
                </div>
                
                {totalPrice > 0 && (
                  <div className="text-right">
                    <p 
                      className="text-sm font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('receipt.totalPrice', 'Total Price')}
                    </p>
                    <p 
                      className="text-lg font-bold"
                      style={{ 
                        color: 'var(--gold-700)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      ${totalPrice.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={handleConfirm}
                  disabled={isProcessing || items.length === 0}
                  className="btn-luxury-primary w-full"
                  style={{ minHeight: '52px' }}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('receipt.adding', 'Adding...')}
                    </span>
                  ) : (
                    t('receipt.addToCellar', 'Add {{count}} to cellar', { count: items.length })
                  )}
                </button>
                
                <button
                  onClick={onClose}
                  disabled={isProcessing}
                  className="btn-luxury-secondary w-full"
                  style={{ minHeight: '48px' }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
