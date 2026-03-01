/**
 * User Menu Component
 * 
 * Dropdown menu showing user info and profile actions.
 * Replaces the separate Profile navigation tab.
 */

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useFeatureFlags as useContextFeatureFlags } from '../contexts/FeatureFlagsContext';
import { useFeatureFlags as useBetaFeatureFlags } from '../hooks/useFeatureFlags';
import { ShareCellarModal } from './ShareCellarModal';
import { toast } from '../lib/toast';
import { trackAuth } from '../services/analytics';
import * as bottleService from '../services/bottleService';

export function UserMenu() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const { flags } = useContextFeatureFlags(); // For wishlist, cellar agent, csv import
  const betaFlags = useBetaFeatureFlags(); // For share cellar, multi-bottle import
  const [isOpen, setIsOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [bottles, setBottles] = useState<bottleService.BottleWithWineInfo[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close menu when clicking outside
  // Delay adding the listener to prevent the opening click from immediately closing the menu
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    // Wait for next event loop before adding click-outside listener
    // This prevents the opening click from being detected as "outside"
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // Load bottles for share functionality
  useEffect(() => {
    async function loadBottles() {
      try {
        const userBottles = await bottleService.listBottles();
        setBottles(userBottles);
      } catch (error) {
        console.error('Failed to load bottles for sharing:', error);
      }
    }
    
    if (user && betaFlags.canShareCellar) {
      loadBottles();
    }
  }, [user, betaFlags.canShareCellar]);

  async function handleLogout() {
    try {
      await signOut();
      trackAuth.logout(); // Track successful logout
      toast.success(t('auth.loggedOut'));
      navigate('/login');
    } catch (error: any) {
      toast.error('Logout failed');
    }
  }

  function handleShareCellar() {
    setIsOpen(false);
    setShowShareModal(true);
  }

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={menuRef}>
      {/* User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity min-h-[44px] px-2 sm:px-3 py-2 rounded-lg"
        style={{ background: 'var(--interactive-hover)' }}
        aria-label={t('profile.menu.openMenu')}
        aria-expanded={isOpen}
      >
        {/* Avatar */}
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold shadow-sm">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>

        {/* Name (hidden on mobile) */}
        <span 
          className="hidden lg:inline text-sm font-medium max-w-[120px] truncate"
          style={{ color: 'var(--text-secondary)' }}
        >
          {displayName}
        </span>

        {/* Dropdown arrow */}
        <svg
          className={`hidden sm:block w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-tertiary)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-64 sm:w-72 rounded-lg py-2 z-50"
          style={{
            background: 'var(--bg-dropdown)',
            boxShadow: 'var(--shadow-dropdown)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* User Info Header */}
          <div 
            className="px-4 py-3"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <p 
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-heading)' }}
            >
              {displayName}
            </p>
            {profile?.email && (
              <p 
                className="text-xs truncate mt-0.5"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {profile.email}
              </p>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <Link
              to="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{t('profile.menu.viewProfile')}</span>
            </Link>

            {/* Cellar Sommelier - AI chat assistant */}
            {flags?.cellarAgentEnabled && (
              <Link
                to="/agent"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <svg className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span>{t('cellarSommelier.menuButton')}</span>
              </Link>
            )}

            {/* Share Cellar - Only show if user has bottles and feature enabled */}
            {betaFlags.canShareCellar && bottles.length > 0 && (
              <button
                onClick={handleShareCellar}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <svg className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span>{t('cellar.shareCellar.button')}</span>
              </button>
            )}

            <button
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors"
              style={{ color: 'var(--color-error)' }}
            >
              <svg className="w-5 h-5 flip-rtl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Share Cellar Modal */}
      {betaFlags.canShareCellar && (
        <ShareCellarModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          bottles={bottles}
        />
      )}
    </div>
  );
}

