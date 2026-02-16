/**
 * Profile Page
 * 
 * Allows users to view and edit their profile information.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from '../lib/toast';
import { WineLoader } from '../components/WineLoader';
import * as profileService from '../services/profileService';
import { AvatarUpload } from '../components/AvatarUpload';
import { ThemeToggle } from '../components/ThemeToggle';
import { AdminWineProfileBackfill } from '../components/AdminWineProfileBackfill';
import { AdminReadinessBackfill } from '../components/AdminReadinessBackfill';

export function ProfilePage() {
  const { t } = useTranslation();
  const { user, profile: contextProfile } = useAuth();
  const [profile, setProfile] = useState(contextProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: contextProfile?.display_name || '',
    first_name: contextProfile?.first_name || '',
    last_name: contextProfile?.last_name || '',
    email: contextProfile?.email || '',
    avatar_url: contextProfile?.avatar_url || '',
    preferred_language: contextProfile?.preferred_language || 'en',
  });

  useEffect(() => {
    if (contextProfile) {
      setProfile(contextProfile);
      setFormData({
        display_name: contextProfile.display_name || '',
        first_name: contextProfile.first_name || '',
        last_name: contextProfile.last_name || '',
        email: contextProfile.email || '',
        avatar_url: contextProfile.avatar_url || '',
        preferred_language: contextProfile.preferred_language || 'en',
      });
    }
  }, [contextProfile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.display_name.trim()) {
      toast.error(t('profile.complete.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      const updated = await profileService.updateMyProfile({
        display_name: formData.display_name.trim(),
        first_name: formData.first_name.trim() || null,
        last_name: formData.last_name.trim() || null,
        avatar_url: formData.avatar_url || null,
        preferred_language: formData.preferred_language as 'en' | 'he',
      });
      setProfile(updated);
      setIsEditing(false);
      toast.success(t('profile.updateSuccess'));
      
      // Reload page to update context
      window.location.reload();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || t('profile.updateFailed'));
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setFormData({
      display_name: profile?.display_name || '',
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      email: profile?.email || '',
      avatar_url: profile?.avatar_url || '',
      preferred_language: profile?.preferred_language || 'en',
    });
    setIsEditing(false);
  }

  if (!profile) {
    return <WineLoader variant="page" size="lg" message={t('common.loading')} />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{t('profile.title')}</h1>
        <p className="text-gray-600 mt-2">{t('profile.subtitle')}</p>
      </div>

      <div className="card">
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-6 pb-6 border-b border-gray-200">
          <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-3xl font-bold mb-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url || ''}
                alt={profile.display_name || 'User avatar'}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              profile.display_name?.charAt(0).toUpperCase() || '?'
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{profile.display_name}</h2>
          {profile.email && (
            <p className="text-sm text-gray-600 mt-1">{profile.email}</p>
          )}
        </div>

        {/* Profile Form */}
        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.firstName')}
                </label>
                <input
                  id="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="input"
                  maxLength={50}
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.lastName')}
                </label>
                <input
                  id="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="input"
                  maxLength={50}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-1">
                {t('profile.displayName')} *
              </label>
              <input
                id="display_name"
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="input"
                required
                minLength={1}
                maxLength={100}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">{t('profile.displayNameHint')}</p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                {t('profile.email')}
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                className="input bg-gray-50"
                disabled
                readOnly
              />
              <p className="text-xs text-gray-500 mt-1">{t('profile.emailReadOnly')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('profile.avatar.title')}
              </label>
              <AvatarUpload
                currentAvatarUrl={formData.avatar_url}
                onUploadSuccess={(newUrl) => setFormData({ ...formData, avatar_url: newUrl })}
                userId={user?.id || ''}
              />
            </div>

            <div>
              <label htmlFor="preferred_language" className="block text-sm font-medium text-gray-700 mb-1">
                {t('profile.preferredLanguage')}
              </label>
              <select
                id="preferred_language"
                value={formData.preferred_language}
                onChange={(e) => setFormData({ ...formData, preferred_language: e.target.value })}
                className="input"
                disabled={loading}
              >
                <option value="en">English</option>
                <option value="he">עברית (Hebrew)</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 btn btn-primary"
              >
                {loading ? t('common.saving') : t('common.save')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 btn btn-secondary"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('profile.firstName')}</h3>
                <p className="text-base text-gray-900">{profile.first_name || t('profile.notProvided')}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('profile.lastName')}</h3>
                <p className="text-base text-gray-900">{profile.last_name || t('profile.notProvided')}</p>
              </div>

              <div className="sm:col-span-2">
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('profile.displayName')}</h3>
                <p className="text-base text-gray-900">{profile.display_name}</p>
              </div>

              <div className="sm:col-span-2">
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('profile.email')}</h3>
                <p className="text-base text-gray-900">{profile.email || t('profile.notProvided')}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('profile.preferredLanguage')}</h3>
                <p className="text-base text-gray-900">
                  {profile.preferred_language === 'he' ? 'עברית (Hebrew)' : 'English'}
                </p>
              </div>

              {/* Theme Preference */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Theme Preference</h3>
                <ThemeToggle />
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('profile.memberSince')}</h3>
                <p className="text-base text-gray-900">
                  {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={() => setIsEditing(true)}
                className="w-full btn btn-primary"
              >
                {t('profile.editProfile')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account Information */}
      <div className="card mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.accountInfo')}</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">{t('profile.userId')}</span>
            <span className="text-gray-900 font-mono text-xs">{user?.id.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{t('profile.authProvider')}</span>
            <span className="text-gray-900">{user?.app_metadata?.provider || 'email'}</span>
          </div>
        </div>
      </div>
      
      {/* Admin Tools */}
      <AdminWineProfileBackfill />
      <AdminReadinessBackfill />
    </div>
  );
}

