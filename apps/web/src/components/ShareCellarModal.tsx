// Feedback iteration (dev only)
/**
 * Share Cellar Modal (DEV ONLY)
 * 
 * Generates and displays a shareable link for the user's cellar.
 * Community-lite feature for testing UX.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from '../lib/toast';
import { generateShareLink } from '../services/shareService';
import type { BottleWithWineInfo } from '../services/bottleService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bottles: BottleWithWineInfo[];
}

export function ShareCellarModal({ isOpen, onClose, bottles }: Props) {
  const { t } = useTranslation();
  const [shareLink, setShareLink] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateShareLink(bottles);
      setShareLink(result.link);
      setUserName(result.userName);
      toast.success('✅ Share link generated!');
    } catch (error: any) {
      console.error('[ShareCellarModal] Error:', error);
      toast.error(`Failed to generate link: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success(t('cellar.shareCellar.linkCopied'));
    } catch (error) {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = shareLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      toast.success(t('cellar.shareCellar.linkCopied'));
    }
  };

  const handleClose = () => {
    setShareLink('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'var(--bg-overlay)',
        backdropFilter: 'var(--blur-medium)',
        WebkitBackdropFilter: 'var(--blur-medium)',
      }}
      onClick={handleClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="modal-luxury w-full"
        style={{
          maxWidth: 'min(90vw, 36rem)',
        }}
      >
        {/* Header */}
        <div 
          className="px-6 py-4"
          style={{ 
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 
                className="text-xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('cellar.shareCellar.title')}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {t('cellar.shareCellar.subtitle')}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-2xl opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-primary)' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Info Banner */}
          <div 
            className="p-4 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(37, 99, 235, 0.12) 100%)',
              border: '1px solid var(--color-blue-200)',
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium" style={{ color: 'var(--color-blue-800)' }}>
                  {t('cellar.shareCellar.infoTitle')}
                </p>
                <ul className="text-xs space-y-1" style={{ color: 'var(--color-blue-700)' }}>
                  <li>• {t('cellar.shareCellar.infoReadOnly')}</li>
                  <li>• {t('cellar.shareCellar.infoNoPrice')}</li>
                  <li>• {t('cellar.shareCellar.infoExpires')}</li>
                  <li>• {t('cellar.shareCellar.infoSecure')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div 
            className="p-4 rounded-lg"
            style={{ background: 'var(--bg-muted)' }}
          >
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              {t('cellar.shareCellar.whatShared')}
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-tertiary)' }}>{t('cellar.shareCellar.distinctWines')}:</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {bottles.filter(b => b.quantity > 0).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-tertiary)' }}>{t('cellar.shareCellar.totalBottles')}:</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {bottles.filter(b => b.quantity > 0).reduce((sum, b) => sum + b.quantity, 0)}
                </span>
              </div>
              {bottles.filter(b => b.quantity > 0).reduce((sum, b) => sum + b.quantity, 0) !== 
               bottles.filter(b => b.quantity > 0).length && (
                <p className="text-xs pt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {t('cellar.shareCellar.multipleBottlesNote')}
                </p>
              )}
            </div>
          </div>

          {/* Generate / Link Display */}
          {!shareLink ? (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full btn-luxury-primary py-4"
            >
              {generating ? t('cellar.shareCellar.generating') : t('cellar.shareCellar.generate')}
            </button>
          ) : (
            <div className="space-y-3">
              {/* Success Banner */}
              <div 
                className="p-4 rounded-lg border"
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.12) 100%)',
                  borderColor: 'var(--color-emerald-300)',
                }}
              >
                <div className="mb-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-emerald-800)' }}>
                    {t('cellar.shareCellar.generated')}
                  </p>
                </div>
                <p className="text-xs mb-2" style={{ color: 'var(--color-emerald-700)' }}>
                  {t('cellar.shareCellar.sharedAs', { name: userName })}
                </p>
              </div>
              
              {/* Action Buttons - Prominent */}
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 btn-luxury-primary py-4 font-semibold"
                  style={{ fontSize: 'clamp(0.875rem, 3vw, 1rem)' }}
                >
                  <span className="hidden sm:inline">{t('cellar.shareCellar.copyToClipboard')}</span>
                  <span className="sm:hidden">{t('cellar.shareCellar.copyLink')}</span>
                </button>
                <button
                  onClick={() => {
                    window.open(shareLink, '_blank');
                  }}
                  className="btn-luxury-secondary px-6 py-4"
                  title={t('cellar.shareCellar.preview')}
                >
                  {t('cellar.shareCellar.preview')}
                </button>
              </div>

              {/* Collapsible Link Details */}
              <details className="group">
                <summary 
                  className="cursor-pointer text-xs text-center py-2 rounded transition-colors"
                  style={{ 
                    color: 'var(--text-tertiary)',
                    listStyle: 'none',
                  }}
                >
                  <span className="hover:underline">
                    {t('cellar.shareCellar.showFullLink')} ▼
                  </span>
                </summary>
                <div 
                  className="mt-2 p-3 rounded-lg border max-h-32 overflow-auto"
                  style={{
                    background: 'var(--bg-muted)',
                    borderColor: 'var(--border-base)',
                  }}
                >
                  <p 
                    className="text-xs break-all font-mono"
                    style={{
                      color: 'var(--text-secondary)',
                      lineHeight: '1.4',
                    }}
                  >
                    {shareLink}
                  </p>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-4"
          style={{
            borderTop: '1px solid var(--border-light)',
          }}
        >
          <button
            onClick={handleClose}
            className="w-full btn-luxury-secondary"
          >
            {t('cellar.shareCellar.close')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

