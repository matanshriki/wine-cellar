/**
 * Shared Cellar View Page
 * 
 * Read-only view of a shared cellar from a share link.
 * Feature flag controlled in production.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { parseShareLink, type ShareData } from '../services/shareService';
import { WineLoader } from '../components/WineLoader';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

export function SharedCellarPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const encodedData = searchParams.get('data');
    
    if (!encodedData) {
      setError('Invalid share link - missing data');
      setLoading(false);
      return;
    }

    try {
      const data = parseShareLink(encodedData);
      
      if (!data) {
        setError('Invalid or expired share link');
        setLoading(false);
        return;
      }

      setShareData(data);
    } catch (err: any) {
      console.error('[SharedCellarPage] Error parsing share link:', err);
      setError('Failed to load shared cellar');
    } finally {
      setLoading(false);
    }
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <WineLoader variant="page" size="lg" message="Loading shared cellar..." />
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">🔗❌</div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {error || 'Shared cellar not found'}
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            The share link may be invalid, expired, or corrupted.
          </p>
          <button
            onClick={() => navigate('/cellar')}
            className="btn-luxury-primary"
          >
            Go to My Cellar
          </button>
        </div>
      </div>
    );
  }

  const { userName, bottles, stats } = shareData;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header with User Profile */}
        <div className="mb-6">
          {/* User Card */}
          <div 
            className="p-6 rounded-lg mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(164, 77, 90, 0.08) 0%, rgba(212, 175, 55, 0.12) 100%)',
              border: '1px solid var(--wine-200)',
            }}
          >
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, var(--wine-400) 0%, var(--wine-600) 100%)',
                  color: 'white',
                }}
              >
                {userName.charAt(0).toUpperCase()}
              </div>
              
              {/* Name and Stats */}
              <div className="flex-1">
                <h1 
                  className="text-2xl sm:text-3xl font-bold mb-1"
                  style={{ 
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {userName}'s Wine Cellar
                </h1>
                <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>📖 Read-only view</span>
                  <span>•</span>
                  <span>🍾 {stats.totalBottles} bottle{stats.totalBottles !== 1 ? 's' : ''}</span>
                  <span>•</span>
                  <span>🍷 {bottles.length} wine{bottles.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div 
            className="p-4 rounded-lg"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-base)' }}
          >
            <div className="text-2xl mb-1">🍷</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-red-600)' }}>
              {stats.redCount}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Red wines
            </div>
          </div>

          <div 
            className="p-4 rounded-lg"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-base)' }}
          >
            <div className="text-2xl mb-1">🥂</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-amber-600)' }}>
              {stats.whiteCount}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              White wines
            </div>
          </div>

          <div 
            className="p-4 rounded-lg"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-base)' }}
          >
            <div className="text-2xl mb-1">🌸</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-pink-600)' }}>
              {stats.roseCount}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Rosé wines
            </div>
          </div>

          <div 
            className="p-4 rounded-lg"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-base)' }}
          >
            <div className="text-2xl mb-1">✨</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-blue-600)' }}>
              {stats.sparklingCount}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Sparkling
            </div>
          </div>
        </div>

        {/* Top Regions */}
        {stats.topRegions.length > 0 && (
          <div 
            className="p-4 rounded-lg mb-6"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-base)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              🌍 Top Regions
            </h3>
            <div className="flex flex-wrap gap-2">
              {stats.topRegions.map((region) => (
                <span
                  key={region}
                  className="px-3 py-1 rounded-full text-sm"
                  style={{
                    background: 'var(--wine-50)',
                    color: 'var(--wine-700)',
                    border: '1px solid var(--wine-200)',
                  }}
                >
                  {region}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bottle List */}
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          📋 Wine Collection ({bottles.length})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bottles.map((bottle, index) => (
            <motion.div
              key={bottle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-lg"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-base)',
              }}
            >
              {/* Color indicator */}
              <div
                className="w-full h-1 rounded-full mb-3"
                style={{
                  background:
                    bottle.color === 'red'
                      ? '#8B1538' // Bordeaux wine red
                      : bottle.color === 'white'
                      ? 'var(--color-amber-500)'
                      : bottle.color === 'rose'
                      ? 'var(--color-pink-500)'
                      : 'var(--color-blue-500)',
                }}
              />

              {/* Wine info */}
              <h4 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                {bottle.wineName}
              </h4>
              <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                {bottle.producer}
              </p>

              {/* Details */}
              <div className="space-y-1 text-sm">
                {bottle.vintage && (
                  <div style={{ color: 'var(--text-tertiary)' }}>
                    📅 {bottle.vintage}
                  </div>
                )}
                {bottle.region && (
                  <div style={{ color: 'var(--text-tertiary)' }}>
                    🌍 {bottle.region}
                  </div>
                )}
                <div style={{ color: 'var(--text-tertiary)' }}>
                  🍾 {bottle.quantity} bottle{bottle.quantity !== 1 ? 's' : ''}
                </div>
                {bottle.rating && (
                  <div style={{ color: 'var(--color-amber-600)' }}>
                    ⭐ {bottle.rating.toFixed(1)}/5.0
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer CTA */}
        <div 
          className="mt-8 p-6 rounded-lg text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(164, 77, 90, 0.08) 0%, rgba(212, 175, 55, 0.12) 100%)',
            border: '1px solid var(--wine-200)',
          }}
        >
          <div className="text-4xl mb-3">🍷</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Start Your Own Cellar
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Track your wine collection, get AI recommendations, and share with friends
          </p>
          <button
            onClick={() => navigate('/cellar')}
            className="btn-luxury-primary"
          >
            Go to My Cellar
          </button>
        </div>
      </div>
    </div>
  );
}

