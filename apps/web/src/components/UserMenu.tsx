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
import { toast } from '../lib/toast';
import { trackAuth } from '../services/analytics';

export function UserMenu() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
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
        className="flex items-center gap-2 hover:opacity-80 transition-opacity min-h-[44px] px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-100"
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
        <span className="hidden lg:inline text-sm font-medium text-gray-700 max-w-[120px] truncate">
          {displayName}
        </span>

        {/* Dropdown arrow */}
        <svg
          className={`hidden sm:block w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-64 sm:w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {displayName}
            </p>
            {profile?.email && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {profile.email}
              </p>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <Link
              to="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{t('profile.menu.viewProfile')}</span>
            </Link>

            <button
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg className="w-5 h-5 flip-rtl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

