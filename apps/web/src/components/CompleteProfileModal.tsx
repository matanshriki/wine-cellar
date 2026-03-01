/**
 * Complete Profile Modal
 * 
 * Forces user to provide a display name if missing.
 * Cannot be dismissed until a valid name is provided.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '../lib/toast';
import * as profileService from '../services/profileService';

interface Props {
  isOpen: boolean;
  onComplete: () => void;
  currentName?: string;
}

export function CompleteProfileModal({ isOpen, onComplete, currentName = '' }: Props) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(currentName);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!displayName.trim()) {
      toast.error(t('profile.complete.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      await profileService.completeProfile(displayName);
      toast.success(t('profile.complete.success'));
      onComplete();
    } catch (error: any) {
      console.error('Error completing profile:', error);
      toast.error(error.message || t('profile.complete.failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 ios-modal-scroll"
      style={{
        height: '100dvh',
      }}
    >
      <div 
        className="rounded-lg max-w-md w-full p-6 shadow-xl touch-scroll safe-area-inset-bottom max-h-mobile-modal"
        style={{
          background: 'var(--bg-surface)',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="text-center mb-6">
          <div 
            className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'var(--wine-50)' }}
          >
            <svg className="w-6 h-6" style={{ color: 'var(--wine-600)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 
            className="text-2xl font-bold mb-2"
            style={{ color: 'var(--text-heading)' }}
          >
            {t('profile.complete.title')}
          </h2>
          <p 
            className="text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('profile.complete.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label 
              htmlFor="displayName" 
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('profile.displayName')} *
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input"
              placeholder={t('profile.displayNamePlaceholder')}
              required
              autoFocus
              minLength={1}
              maxLength={100}
              disabled={loading}
            />
            <p 
              className="mt-1 text-xs"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('profile.complete.hint')}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !displayName.trim()}
            className="w-full btn btn-primary"
          >
            {loading ? t('common.saving') : t('profile.complete.continue')}
          </button>
        </form>

        <p 
          className="mt-4 text-xs text-center"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {t('profile.complete.required')}
        </p>
      </div>
    </div>
  );
}

