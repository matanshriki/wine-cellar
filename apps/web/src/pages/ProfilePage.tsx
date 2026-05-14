/**
 * Profile Page
 * 
 * Allows users to view and edit their profile information.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/SupabaseAuthContext';
// import { useTheme } from '../contexts/ThemeContext'; // Dark mode disabled
import { toast } from '../lib/toast';
import { WineLoader } from '../components/WineLoader';
import * as profileService from '../services/profileService';
import { AvatarUpload } from '../components/AvatarUpload';
// import { ThemeToggle } from '../components/ThemeToggle'; // Dark mode disabled
import { AdminWineProfileBackfill } from '../components/AdminWineProfileBackfill';
import { AdminReadinessBackfill } from '../components/AdminReadinessBackfill';
import { AdminImageBackfill } from '../components/AdminImageBackfill';
import { TasteProfileCard } from '../components/TasteProfileCard';
import { WeeklySummaryCard } from '../components/WeeklySummaryCard';
import { useMonetizationAccess } from '../hooks/useMonetizationAccess';
import { getPortalUrl } from '../lib/paddle';
import { supabase } from '../lib/supabase';

export function ProfilePage() {
  const { t } = useTranslation();
  const { user, profile: contextProfile } = useAuth();
  const { monetizationEnabled, planKey, isFreshFromDB } = useMonetizationAccess();
  const [profile, setProfile] = useState(contextProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: contextProfile?.display_name || '',
    first_name: contextProfile?.first_name || '',
    last_name: contextProfile?.last_name || '',
    email: contextProfile?.email || '',
    avatar_url: contextProfile?.avatar_url || '',
    preferred_language: contextProfile?.preferred_language || 'en',
    preferred_currency: contextProfile?.preferred_currency || 'USD',
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
        preferred_currency: contextProfile.preferred_currency || 'USD',
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
        preferred_currency: formData.preferred_currency as 'USD' | 'ILS',
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

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? '';
      const url = await getPortalUrl(token);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err?.message ?? t('sommelierCredits.toast.portalError'));
    } finally {
      setPortalLoading(false);
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
      preferred_currency: profile?.preferred_currency || 'USD',
    });
    setIsEditing(false);
  }

  if (!profile) {
    return <WineLoader variant="page" size="lg" message={t('common.loading')} />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('profile.title')}</h1>
        <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>{t('profile.subtitle')}</p>
      </div>

      <div className="card">
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-6 pb-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4" style={{ backgroundColor: 'var(--wine-100)', color: 'var(--wine-600)' }}>
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
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{profile.display_name}</h2>
          {profile.email && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{profile.email}</p>
          )}
        </div>

        {/* Profile Form */}
        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
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
                <label htmlFor="last_name" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
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
              <label htmlFor="display_name" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
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
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('profile.displayNameHint')}</p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                {t('profile.email')}
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                className="input"
                style={{ backgroundColor: 'var(--bg-muted)' }}
                disabled
                readOnly
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('profile.emailReadOnly')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                {t('profile.avatar.title')}
              </label>
              <AvatarUpload
                currentAvatarUrl={formData.avatar_url}
                onUploadSuccess={(newUrl) => setFormData({ ...formData, avatar_url: newUrl })}
                userId={user?.id || ''}
              />
            </div>

            <div>
              <label htmlFor="preferred_language" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
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

            <div>
              <label htmlFor="preferred_currency" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                {t('profile.preferredCurrency')}
              </label>
              <select
                id="preferred_currency"
                value={formData.preferred_currency}
                onChange={(e) => setFormData({ ...formData, preferred_currency: e.target.value })}
                className="input"
                disabled={loading}
              >
                <option value="USD">USD ($)</option>
                <option value="ILS">NIS ₪</option>
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
                <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('profile.firstName')}</h3>
                <p className="text-base" style={{ color: 'var(--text-primary)' }}>{profile.first_name || t('profile.notProvided')}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('profile.lastName')}</h3>
                <p className="text-base" style={{ color: 'var(--text-primary)' }}>{profile.last_name || t('profile.notProvided')}</p>
              </div>

              <div className="sm:col-span-2">
                <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('profile.displayName')}</h3>
                <p className="text-base" style={{ color: 'var(--text-primary)' }}>{profile.display_name}</p>
              </div>

              <div className="sm:col-span-2">
                <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('profile.email')}</h3>
                <p className="text-base" style={{ color: 'var(--text-primary)' }}>{profile.email || t('profile.notProvided')}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('profile.preferredLanguage')}</h3>
                <p className="text-base" style={{ color: 'var(--text-primary)' }}>
                  {profile.preferred_language === 'he' ? 'עברית (Hebrew)' : 'English'}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('profile.preferredCurrency')}</h3>
                <p className="text-base" style={{ color: 'var(--text-primary)' }}>
                  {profile.preferred_currency === 'ILS' ? 'NIS ₪' : 'USD $'}
                </p>
              </div>

              {/* Theme Preference - disabled for production */}
              {/* <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>Theme Preference</h3>
                <ThemeToggle />
              </div> */}

              <div>
                <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('profile.memberSince')}</h3>
                <p className="text-base" style={{ color: 'var(--text-primary)' }}>
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

      {/* Taste Profile */}
      <TasteProfileCard />

      {/* Weekly Summary — reflective taste snapshot for last 7 days */}
      <WeeklySummaryCard />

      {/* Account Information */}
      <div className="card mt-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('profile.accountInfo')}</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>{t('profile.userId')}</span>
            <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{user?.id.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>{t('profile.authProvider')}</span>
            <span style={{ color: 'var(--text-primary)' }}>{user?.app_metadata?.provider || 'email'}</span>
          </div>
        </div>
      </div>

      {/* Subscription */}
      {monetizationEnabled && isFreshFromDB && (
        <div className="card mt-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('profile.billing.title')}</h2>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('profile.billing.currentPlan')}</span>
            {planKey && planKey !== 'free' ? (
              <span
                className="rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wider"
                style={
                  planKey === 'premium'
                    ? {
                        background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(217,119,6,0.08))',
                        color: '#F59E0B',
                        border: '1px solid rgba(251,191,36,0.25)',
                      }
                    : {
                        background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(109,40,217,0.08))',
                        color: '#A78BFA',
                        border: '1px solid rgba(167,139,250,0.25)',
                      }
                }
              >
                ✦ {planKey === 'premium' ? 'Premium' : 'Collector'}
              </span>
            ) : (
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {t('profile.billing.free')}
              </span>
            )}
          </div>
          {planKey && planKey !== 'free' ? (
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="w-full btn btn-secondary text-sm"
            >
              {portalLoading ? t('profile.billing.manageBillingLoading') : t('profile.billing.manageBilling')}
            </button>
          ) : (
            <Link to="/upgrade" className="w-full btn btn-primary text-sm text-center block">
              {t('profile.billing.upgradePlan')}
            </Link>
          )}
        </div>
      )}

      {/* Admin Tools */}
      <AdminWineProfileBackfill />
      <AdminReadinessBackfill />
      <AdminImageBackfill />
    </div>
  );
}

