// Feedback iteration (dev only)
/**
 * Community Discovery Page (DEV ONLY)
 * 
 * Shows sample shared cellars for testing community UX.
 * No real backend - uses mock data.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { generateMockSharedCellars, type ShareData } from '../services/shareService';
import { isDevEnvironment } from '../utils/devOnly';

export function CommunityPage() {
  const navigate = useNavigate();
  const [mockCellars, setMockCellars] = useState<ShareData[]>([]);

  useEffect(() => {
    // Guard: Dev only
    if (!isDevEnvironment()) {
      navigate('/cellar');
      return;
    }

    // Load mock cellars
    setMockCellars(generateMockSharedCellars());
  }, [navigate]);

  const handleViewCellar = (cellar: ShareData) => {
    // Encode and navigate to shared cellar view
    const jsonString = JSON.stringify(cellar);
    const base64Data = btoa(jsonString);
    const encodedData = encodeURIComponent(base64Data);
    navigate(`/share?data=${encodedData}`);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="app-page-title">
              🌍 Community Cellars
            </h1>
            <span 
              className="px-2.5 py-0.5 text-xs font-semibold rounded-full"
              style={{
                background: 'var(--sommi-gradient-gold)',
                color: 'var(--sommi-ink)',
              }}
            >
              DEV
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Explore wine collections from other enthusiasts (mock data for testing)
          </p>
        </div>

        {/* Info Banner */}
        <div 
          className="p-4 rounded-2xl mb-6"
          style={{
            background: 'var(--color-info-light)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                <strong>Dev-only community feature</strong> - This page uses mock data to test community UX before building real social features.
              </p>
            </div>
          </div>
        </div>

        {/* Shared Cellars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockCellars.map((cellar, index) => (
            <motion.div
              key={cellar.userId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="app-card p-5 cursor-pointer hover:shadow-[var(--shadow-card-hover)] transition-shadow"
              onClick={() => handleViewCellar(cellar)}
            >
              {/* User Header */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
                  style={{
                    background: 'var(--sommi-gradient-primary)',
                    color: 'white',
                  }}
                >
                  {cellar.userName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {cellar.userName}
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {cellar.stats.totalBottles} bottles • {cellar.bottles.length} wines
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="text-center">
                  <div className="text-lg">🍷</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {cellar.stats.redCount}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg">🥂</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {cellar.stats.whiteCount}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg">🌸</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {cellar.stats.roseCount}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg">✨</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {cellar.stats.sparklingCount}
                  </div>
                </div>
              </div>

              {/* Top Regions */}
              {cellar.stats.topRegions.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Top Regions:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {cellar.stats.topRegions.slice(0, 3).map((region) => (
                      <span
                        key={region}
                        className="px-2.5 py-1 rounded-full text-xs"
                        style={{
                          background: 'var(--wine-50)',
                          color: 'var(--accent-text)',
                        }}
                      >
                        {region}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* View Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewCellar(cellar);
                }}
                className="w-full mt-4 btn-luxury-secondary text-sm"
              >
                👀 View Cellar
              </button>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div 
          className="app-card-muted mt-8 p-6 sm:p-8 text-center"
        >
          <div className="text-4xl mb-3">🍷🔗</div>
          <h3 className="app-section-title mb-2">
            Share Your Collection
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Create your own shareable cellar link from the cellar page
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

