/**
 * Taste Profile Card
 * 
 * Luxury UI component displaying user's wine taste profile
 * with calibration controls and visual representation.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from '../lib/toast';
import type { TasteProfile, TasteProfileVector } from '../types/supabase';
import * as tasteProfileService from '../services/tasteProfileService';
import { WineLoader } from './WineLoader';

interface TasteProfileCardProps {
  onProfileUpdated?: () => void;
}

export function TasteProfileCard({ onProfileUpdated }: TasteProfileCardProps) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [calibrationValues, setCalibrationValues] = useState<Partial<TasteProfileVector>>({});
  
  useEffect(() => {
    loadProfile();
  }, []);
  
  async function loadProfile() {
    setLoading(true);
    try {
      const loadedProfile = await tasteProfileService.getMyTasteProfile();
      setProfile(loadedProfile);
      
      if (loadedProfile?.overrides?.vector) {
        setCalibrationValues(loadedProfile.overrides.vector);
      }
    } catch (error) {
      console.error('Error loading taste profile:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleRecompute() {
    setRecomputing(true);
    try {
      const newProfile = await tasteProfileService.recomputeMyTasteProfile();
      setProfile(newProfile);
      toast.success(t('tasteProfile.recomputeSuccess', 'Taste profile updated!'));
      onProfileUpdated?.();
    } catch (error: any) {
      console.error('Error recomputing profile:', error);
      toast.error(error.message || t('tasteProfile.recomputeFailed', 'Failed to update profile'));
    } finally {
      setRecomputing(false);
    }
  }
  
  async function handleSaveCalibration() {
    try {
      const updatedProfile = await tasteProfileService.applyCalibration(calibrationValues);
      setProfile(updatedProfile);
      setShowCalibration(false);
      toast.success(t('tasteProfile.calibrationSaved', 'Preferences saved!'));
      onProfileUpdated?.();
    } catch (error: any) {
      console.error('Error saving calibration:', error);
      toast.error(error.message || t('tasteProfile.calibrationFailed', 'Failed to save preferences'));
    }
  }
  
  async function handleReset() {
    if (!confirm(t('tasteProfile.resetConfirm', 'Reset your taste profile and relearn from your ratings?'))) {
      return;
    }
    
    setRecomputing(true);
    try {
      const newProfile = await tasteProfileService.resetTasteProfile();
      setProfile(newProfile);
      setCalibrationValues({});
      toast.success(t('tasteProfile.resetSuccess', 'Profile reset successfully'));
      onProfileUpdated?.();
    } catch (error: any) {
      console.error('Error resetting profile:', error);
      toast.error(error.message || t('tasteProfile.resetFailed', 'Failed to reset profile'));
    } finally {
      setRecomputing(false);
    }
  }
  
  if (loading) {
    return (
      <div className="card mt-6">
        <div className="flex items-center justify-center py-8">
          <WineLoader variant="inline" size="md" />
        </div>
      </div>
    );
  }
  
  const descriptors = profile ? tasteProfileService.getTasteDescriptors(profile) : [];
  const topRegions = profile ? tasteProfileService.getTopRegions(profile, 3) : [];
  const topGrapes = profile ? tasteProfileService.getTopGrapes(profile, 3) : [];
  const effectiveVector = profile ? tasteProfileService.getEffectiveVector(profile) : null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card mt-6 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-elevated) 100%)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
              boxShadow: '0 4px 12px rgba(164, 77, 90, 0.3)',
            }}
          >
            <span className="text-xl">🍷</span>
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('tasteProfile.title', 'Your Taste Profile')}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {profile 
                ? t('tasteProfile.subtitle', 'Personalized to your palate')
                : t('tasteProfile.noProfile', 'Rate wines to build your profile')
              }
            </p>
          </div>
        </div>
        
        {/* Confidence badge */}
        {profile && (
          <div
            className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: profile.confidence === 'high' 
                ? 'linear-gradient(135deg, var(--wine-100), var(--wine-200))'
                : profile.confidence === 'med'
                ? 'linear-gradient(135deg, var(--gold-100), var(--gold-200))'
                : 'var(--bg-surface-elevated)',
              color: profile.confidence === 'high'
                ? 'var(--wine-700)'
                : profile.confidence === 'med'
                ? 'var(--gold-700)'
                : 'var(--text-secondary)',
              border: `1px solid ${
                profile.confidence === 'high'
                  ? 'var(--wine-300)'
                  : profile.confidence === 'med'
                  ? 'var(--gold-300)'
                  : 'var(--border-medium)'
              }`,
            }}
          >
            {profile.confidence === 'high' 
              ? t('tasteProfile.confident', 'Confident')
              : profile.confidence === 'med'
              ? t('tasteProfile.learning', 'Learning')
              : t('tasteProfile.gettingStarted', 'Getting started')
            }
          </div>
        )}
      </div>
      
      {/* No profile state */}
      {!profile && (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('tasteProfile.empty.title', 'Build Your Taste Profile')}
          </h3>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('tasteProfile.empty.description', 'Rate wines you\'ve opened to get personalized recommendations tailored to your palate.')}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setShowCalibration(true)}
              className="btn btn-secondary"
            >
              {t('tasteProfile.empty.calibrate', 'Set preferences manually')}
            </button>
          </div>
        </div>
      )}
      
      {/* Profile content */}
      {profile && (
        <>
          {/* Taste descriptors */}
          {descriptors.length > 0 && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {descriptors.map((descriptor, idx) => (
                  <motion.span
                    key={descriptor}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="px-4 py-2 rounded-full text-sm font-medium"
                    style={{
                      background: 'linear-gradient(135deg, var(--wine-50), var(--wine-100))',
                      color: 'var(--wine-700)',
                      border: '1px solid var(--wine-200)',
                    }}
                  >
                    {descriptor}
                  </motion.span>
                ))}
              </div>
            </div>
          )}
          
          {/* Taste vector visualization */}
          {effectiveVector && (
            <div className="mb-6 p-4 rounded-xl" style={{ background: 'var(--bg-surface-elevated)' }}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <TasteBar label={t('tasteProfile.body', 'Body')} value={effectiveVector.body} />
                <TasteBar label={t('tasteProfile.tannin', 'Tannin')} value={effectiveVector.tannin} />
                <TasteBar label={t('tasteProfile.acidity', 'Acidity')} value={effectiveVector.acidity} />
                <TasteBar label={t('tasteProfile.oak', 'Oak')} value={effectiveVector.oak} />
                <TasteBar label={t('tasteProfile.sweetness', 'Sweetness')} value={effectiveVector.sweetness} />
                <TasteBar label={t('tasteProfile.power', 'Power')} value={effectiveVector.power} />
              </div>
            </div>
          )}
          
          {/* Favorites */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {topRegions.length > 0 && (
              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface-elevated)' }}>
                <h4 className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  {t('tasteProfile.favoriteRegions', 'Favorite Regions')}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {topRegions.map(region => (
                    <span 
                      key={region}
                      className="px-2 py-1 rounded text-xs"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                    >
                      {region}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {topGrapes.length > 0 && (
              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface-elevated)' }}>
                <h4 className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  {t('tasteProfile.favoriteGrapes', 'Favorite Grapes')}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {topGrapes.map(grape => (
                    <span 
                      key={grape}
                      className="px-2 py-1 rounded text-xs"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                    >
                      {grape}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Data points */}
          <div className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
            {t('tasteProfile.dataPoints', 'Based on {{count}} rated wines', { count: profile.data_points.rated_count })}
            {profile.data_points.last_rated_at && (
              <span> • {t('tasteProfile.lastRated', 'Last rated')} {new Date(profile.data_points.last_rated_at).toLocaleDateString()}</span>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowCalibration(true)}
              className="btn btn-primary flex-1 sm:flex-none"
            >
              {t('tasteProfile.calibrate', 'Calibrate')}
            </button>
            
            <button
              onClick={handleRecompute}
              disabled={recomputing}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              {recomputing 
                ? t('tasteProfile.recomputing', 'Updating...')
                : t('tasteProfile.recompute', 'Refresh from ratings')
              }
            </button>
          </div>
        </>
      )}
      
      {/* Calibration Modal */}
      <AnimatePresence>
        {showCalibration && (
          <CalibrationModal
            initialValues={calibrationValues}
            onSave={(values) => {
              setCalibrationValues(values);
              handleSaveCalibration();
            }}
            onClose={() => setShowCalibration(false)}
            onReset={handleReset}
            hasExistingProfile={!!profile}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TasteBar({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(value * 100);
  
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {percentage}%
        </span>
      </div>
      <div 
        className="h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--bg-surface)' }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, var(--wine-400), var(--wine-600))`,
          }}
        />
      </div>
    </div>
  );
}

interface CalibrationModalProps {
  initialValues: Partial<TasteProfileVector>;
  onSave: (values: Partial<TasteProfileVector>) => void;
  onClose: () => void;
  onReset: () => void;
  hasExistingProfile: boolean;
}

function CalibrationModal({ initialValues, onSave, onClose, onReset, hasExistingProfile }: CalibrationModalProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Partial<TasteProfileVector>>({
    body: initialValues.body ?? 0.5,
    tannin: initialValues.tannin ?? 0.5,
    acidity: initialValues.acidity ?? 0.5,
    oak: initialValues.oak ?? 0.5,
    sweetness: initialValues.sweetness ?? 0.2,
  });
  
  const handleSliderChange = (key: keyof TasteProfileVector, value: number) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{
        background: 'var(--bg-overlay)',
        backdropFilter: 'var(--blur-medium)',
        WebkitBackdropFilter: 'var(--blur-medium)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibrate-taste-title"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-4 mb-4 sm:m-4 rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)',
          maxHeight: 'calc(100dvh - 2rem)',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 id="calibrate-taste-title" className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('tasteProfile.calibration.title', 'Calibrate Your Taste')}
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {t('tasteProfile.calibration.subtitle', 'Fine-tune your preferences')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--bg-surface-elevated)', color: 'var(--text-tertiary)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Sliders */}
        <div className="px-6 py-6 space-y-6 flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <CalibrationSlider
            label={t('tasteProfile.calibration.body', 'Body preference')}
            description={t('tasteProfile.calibration.bodyDesc', 'Light & delicate to full & bold')}
            value={values.body ?? 0.5}
            onChange={(v) => handleSliderChange('body', v)}
            leftLabel={t('tasteProfile.calibration.light', 'Light')}
            rightLabel={t('tasteProfile.calibration.bold', 'Bold')}
          />
          
          <CalibrationSlider
            label={t('tasteProfile.calibration.tannin', 'Tannin preference')}
            description={t('tasteProfile.calibration.tanninDesc', 'Silky smooth to structured')}
            value={values.tannin ?? 0.5}
            onChange={(v) => handleSliderChange('tannin', v)}
            leftLabel={t('tasteProfile.calibration.smooth', 'Smooth')}
            rightLabel={t('tasteProfile.calibration.structured', 'Structured')}
          />
          
          <CalibrationSlider
            label={t('tasteProfile.calibration.acidity', 'Acidity preference')}
            description={t('tasteProfile.calibration.acidityDesc', 'Soft & round to bright & fresh')}
            value={values.acidity ?? 0.5}
            onChange={(v) => handleSliderChange('acidity', v)}
            leftLabel={t('tasteProfile.calibration.soft', 'Soft')}
            rightLabel={t('tasteProfile.calibration.bright', 'Bright')}
          />
          
          <CalibrationSlider
            label={t('tasteProfile.calibration.oak', 'Oak preference')}
            description={t('tasteProfile.calibration.oakDesc', 'Unoaked to oaky & toasty')}
            value={values.oak ?? 0.5}
            onChange={(v) => handleSliderChange('oak', v)}
            leftLabel={t('tasteProfile.calibration.unoaked', 'Unoaked')}
            rightLabel={t('tasteProfile.calibration.oaky', 'Oaky')}
          />
          
          <CalibrationSlider
            label={t('tasteProfile.calibration.sweetness', 'Sweetness preference')}
            description={t('tasteProfile.calibration.sweetnessDesc', 'Bone dry to off-dry')}
            value={values.sweetness ?? 0.2}
            onChange={(v) => handleSliderChange('sweetness', v)}
            leftLabel={t('tasteProfile.calibration.dry', 'Dry')}
            rightLabel={t('tasteProfile.calibration.offDry', 'Off-dry')}
          />
        </div>
        
        {/* Footer */}
        <div className="flex-shrink-0 px-6 pt-3 pb-6 flex gap-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          {hasExistingProfile && (
            <button
              onClick={onReset}
              className="btn btn-secondary text-sm"
              style={{ color: 'var(--error-600)' }}
            >
              {t('tasteProfile.calibration.reset', 'Reset')}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="btn btn-secondary">
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={() => onSave(values)}
            className="btn btn-primary"
          >
            {t('tasteProfile.calibration.save', 'Save Preferences')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface CalibrationSliderProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  leftLabel: string;
  rightLabel: string;
}

function CalibrationSlider({ label, description, value, onChange, leftLabel, rightLabel }: CalibrationSliderProps) {
  return (
    <div>
      <div className="mb-2">
        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
          {label}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {description}
        </div>
      </div>
      
      <div className="relative">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--wine-500) 0%, var(--wine-500) ${value * 100}%, var(--bg-surface-elevated) ${value * 100}%, var(--bg-surface-elevated) 100%)`,
          }}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{leftLabel}</span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{rightLabel}</span>
        </div>
      </div>
    </div>
  );
}
