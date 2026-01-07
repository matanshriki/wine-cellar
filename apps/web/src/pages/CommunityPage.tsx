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
            <h1 
              className="text-3xl font-bold"
              style={{ 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
              }}
            >
              🌍 Community Cellars
            </h1>
            <span 
              className="px-2 py-0.5 text-xs font-semibold rounded"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
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
          className="p-4 rounded-lg mb-6"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(37, 99, 235, 0.12) 100%)',
            border: '1px solid var(--color-blue-200)',
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-blue-800)' }}>
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
              className="luxury-card cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleViewCellar(cellar)}
            >
              {/* User Header */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-400) 0%, var(--wine-600) 100%)',
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
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          background: 'var(--wine-50)',
                          color: 'var(--wine-700)',
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
          className="mt-8 p-6 rounded-lg text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(164, 77, 90, 0.08) 0%, rgba(212, 175, 55, 0.12) 100%)',
            border: '1px solid var(--wine-200)',
          }}
        >
          <div className="text-4xl mb-3">🍷🔗</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
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

