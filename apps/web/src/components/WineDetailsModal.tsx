/**
 * Wine Details Modal
 * 
 * Displays comprehensive wine information in a beautiful bottle-themed modal
 */

import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { BottleWithWineInfo } from '../services/bottleService';

interface WineDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottle: BottleWithWineInfo | null;
}

export function WineDetailsModal({ isOpen, onClose, bottle }: WineDetailsModalProps) {
  const { t } = useTranslation();

  if (!bottle) return null;

  const wine = bottle.wine;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            style={{ backdropFilter: 'blur(4px)' }}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="luxury-card w-full max-w-2xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div 
                className="sticky top-0 z-10 p-6 pb-4"
                style={{
                  background: 'linear-gradient(180deg, var(--bg-surface) 0%, rgba(255,255,255,0) 100%)',
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 pe-4">
                    <h2 
                      className="text-2xl sm:text-3xl font-bold mb-1 leading-tight"
                      style={{ 
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {wine.wine_name}
                    </h2>
                    {wine.producer && (
                      <p 
                        className="text-base sm:text-lg"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {wine.producer}
                      </p>
                    )}
                  </div>
                  
                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-muted)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 pb-6 space-y-6">
                {/* Wine Image & Quick Stats */}
                <div className="flex gap-6">
                  {/* Wine Bottle Image */}
                  {wine.image_url && (
                    <div className="flex-shrink-0">
                      <img 
                        src={wine.image_url}
                        alt={wine.wine_name}
                        className="w-32 h-40 sm:w-40 sm:h-52 object-cover rounded-lg"
                        style={{
                          border: '2px solid var(--border-base)',
                          boxShadow: 'var(--shadow-lg)',
                        }}
                      />
                    </div>
                  )}

                  {/* Quick Stats */}
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    {/* Vintage */}
                    {wine.vintage && (
                      <div>
                        <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          {t('cellar.bottle.vintage')}
                        </div>
                        <div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {wine.vintage}
                        </div>
                      </div>
                    )}

                    {/* Wine Type */}
                    <div>
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('cellar.bottle.type')}
                      </div>
                      <span className="badge-luxury badge-luxury-wine">
                        {t(`cellar.wineStyles.${wine.color}`)}
                      </span>
                    </div>

                    {/* Quantity */}
                    <div>
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('cellar.bottle.quantity')}
                      </div>
                      <div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                        ×{bottle.quantity}
                      </div>
                    </div>

                    {/* Rating */}
                    {wine.rating && (
                      <div>
                        <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          Vivino Rating
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xl font-semibold" style={{ color: 'var(--wine-500)' }}>
                            ★
                          </span>
                          <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {wine.rating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid var(--border-subtle)' }} />

                {/* Location Info */}
                {(wine.region || wine.country) && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>📍</span>
                      {t('cellar.bottle.origin')}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {wine.region && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Region</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{wine.region}</div>
                        </div>
                      )}
                      {wine.country && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Country</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{wine.country}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Grapes */}
                {wine.grapes && wine.grapes.length > 0 && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>🍇</span>
                      {t('cellar.bottle.grapes')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {wine.grapes.map((grape, idx) => (
                        <span 
                          key={idx}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{
                            backgroundColor: 'var(--wine-50)',
                            color: 'var(--wine-700)',
                            border: '1px solid var(--wine-200)',
                          }}
                        >
                          {grape}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Storage Info */}
                {(bottle.storage_location || bottle.purchase_date || bottle.purchase_price) && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>📦</span>
                      {t('cellar.bottle.storage')}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {bottle.storage_location && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Location</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{bottle.storage_location}</div>
                        </div>
                      )}
                      {bottle.purchase_date && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Purchased</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {new Date(bottle.purchase_date).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                      {bottle.purchase_price && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Price Paid</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            ${bottle.purchase_price.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Analysis */}
                {bottle.readiness_status && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>🔬</span>
                      {t('cellar.bottle.analysis')}
                    </h3>
                    <div 
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor: 'var(--wine-50)',
                        border: '1px solid var(--wine-200)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: 'var(--wine-600)',
                            color: 'white',
                          }}
                        >
                          {bottle.readiness_status}
                        </span>
                      </div>
                      {bottle.tasting_notes && (
                        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                          {bottle.tasting_notes}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {bottle.notes && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>📝</span>
                      {t('cellar.bottle.notes')}
                    </h3>
                    <p 
                      className="text-sm p-4 rounded-lg"
                      style={{
                        backgroundColor: 'var(--bg-muted)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {bottle.notes}
                    </p>
                  </div>
                )}

                {/* Vivino Link */}
                {wine.vivino_url && (
                  <div className="pt-4">
                    <a
                      href={wine.vivino_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-luxury-secondary w-full justify-center gap-2"
                    >
                      <span>View on Vivino</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

