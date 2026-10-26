/**
 * Shared Cellar View Page
 * 
 * Read-only view of a shared cellar from a share link.
 * Feature flag controlled in production.
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Calendar, Link2Off, MapPin, Star, Wine } from 'lucide-react';
import { loadSharedCellar, parseShareLink, type ShareData } from '../services/shareService';
import { WineLoader } from '../components/WineLoader';
import { MetaHead } from '../components/MetaHead';
import { EmptyState } from '../components/ui/EmptyState';

type SharePageError = 'expired' | 'not_found' | 'invalid' | 'missing' | 'failed';

export function SharedCellarPage() {
  const { shareId } = useParams<{ shareId: string }>(); // New: /share/:shareId
  const [searchParams] = useSearchParams(); // Old: /share?data=...
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [error, setError] = useState<'' | SharePageError>('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');

      try {
        // New format: /share/:shareId (database-backed)
        if (shareId) {
          console.log('[SharedCellarPage] Loading from database, ID:', shareId);
          const result = await loadSharedCellar(shareId);

          if (!result.ok) {
            setError(result.reason === 'not_found' ? 'not_found' : result.reason);
            setLoading(false);
            return;
          }

          setShareData(result.data);
          setLoading(false);
          return;
        }

        // Old format: /share?data=... (backwards compatibility)
        const encodedData = searchParams.get('data');
        if (encodedData) {
          console.log('[SharedCellarPage] Loading from URL data (legacy)');
          const data = parseShareLink(encodedData);

          if (!data) {
            setError('expired');
            setLoading(false);
            return;
          }

          setShareData(data);
          setLoading(false);
          return;
        }

        setError('missing');
        setLoading(false);
      } catch (err: unknown) {
        console.error('[SharedCellarPage] Error loading shared cellar:', err);
        setError('failed');
        setLoading(false);
      }
    }

    load();
  }, [shareId, searchParams]);

  // Apply sorting to bottles - moved here so useMemo is always called
  // Note: Bottles array from shareService is already in the user's preferred order.
  // We only re-sort for fields that exist in SimplifiedBottle (vintage, rating, producer, wineName).
  // For other sorts (createdAt, readiness), we trust the original order from shareService.
  const sortedBottles = useMemo(() => {
    if (!shareData || !shareData.bottles) return [];
    
    const sortBy = shareData.sortBy || 'createdAt';
    const sortDir = shareData.sortDir || 'desc';
    
    // If sorting by a field not in SimplifiedBottle, return original order
    if (sortBy === 'createdAt' || sortBy === 'readiness') {
      return shareData.bottles; // Already sorted by user's preference
    }
    
    const sorted = [...shareData.bottles];

    if (sortBy === 'vintage') {
      sorted.sort((a, b) => {
        const vintageA = a.vintage || 0;
        const vintageB = b.vintage || 0;
        return sortDir === 'asc' ? vintageA - vintageB : vintageB - vintageA;
      });
    } else if (sortBy === 'rating') {
      sorted.sort((a, b) => {
        const ratingA = a.rating || 0;
        const ratingB = b.rating || 0; // Fixed typo: was a.rating
        return sortDir === 'asc' ? ratingA - ratingB : ratingB - ratingA;
      });
    } else if (sortBy === 'producer') {
      sorted.sort((a, b) => {
        const producerA = a.producer.toLowerCase();
        const producerB = b.producer.toLowerCase();
        return sortDir === 'asc' 
          ? producerA.localeCompare(producerB)
          : producerB.localeCompare(producerA);
      });
    } else if (sortBy === 'wineName') {
      sorted.sort((a, b) => {
        const nameA = a.wineName.toLowerCase();
        const nameB = b.wineName.toLowerCase();
        return sortDir === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      });
    }

    return sorted;
  }, [shareData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <WineLoader variant="page" size="lg" message={t('sharedCellar.loading')} />
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <EmptyState
          className="max-w-md w-full"
          icon={<Link2Off className="h-7 w-7" strokeWidth={1.75} aria-hidden />}
          title={t(`sharedCellar.errors.${error || 'invalid'}`)}
          body={t(
            error === 'expired'
              ? 'sharedCellar.expiredBody'
              : 'sharedCellar.notFoundBody',
          )}
          actions={
            <button onClick={() => navigate('/cellar')} className="btn-luxury-primary">
              {t('sharedCellar.goToCellar')}
            </button>
          }
        />
      </div>
    );
  }

  const { userName, stats } = shareData;
  const bottles = sortedBottles;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <MetaHead
        title={shareData?.userName ? `${shareData.userName}'s Wine Cellar` : 'Shared Wine Cellar'}
        description={shareData?.userName
          ? `Browse ${shareData.userName}'s wine collection on Sommi.`
          : 'Browse a shared wine collection on Sommi.'}
        url={shareId ? `/share/${shareId}` : '/share'}
        noIndex
      />
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
        <header className="app-card p-5 sm:p-7 mb-6">
          <div className="flex items-center gap-4">
            {shareData.avatarUrl ? (
              <img
                src={shareData.avatarUrl}
                alt=""
                className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                style={{ boxShadow: '0 0 0 3px var(--bg-surface), 0 0 0 5px rgba(201, 162, 39, 0.55)' }}
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-semibold flex-shrink-0"
                style={{ background: 'var(--sommi-gradient-primary)', color: '#fff', fontFamily: 'var(--font-display)' }}
                aria-hidden
              >
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="app-eyebrow mb-1">{t('sharedCellar.eyebrow')}</p>
              <h1 className="app-page-title break-words">{t('sharedCellar.title', { name: userName })}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>{t('sharedCellar.readOnly')}</span>
                <span aria-hidden>·</span>
                <span>{t('sharedCellar.bottles', { count: stats.totalBottles })}</span>
                <span aria-hidden>·</span>
                <span>{t('sharedCellar.wines', { count: bottles.length })}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="app-card p-4">
            <span className="text-2xl" aria-hidden>🍷</span>
            <div className="app-display text-2xl mt-1">{stats.redCount}</div>
            <div className="app-meta mt-1">
              {t('sharedCellar.stats.red')}
            </div>
          </div>
          <div className="app-card p-4">
            <span className="text-2xl" aria-hidden>🥂</span>
            <div className="app-display text-2xl mt-1">{stats.whiteCount}</div>
            <div className="app-meta mt-1">
              {t('sharedCellar.stats.white')}
            </div>
          </div>
          <div className="app-card p-4">
            <span className="text-2xl" aria-hidden>🌸</span>
            <div className="app-display text-2xl mt-1">{stats.roseCount}</div>
            <div className="app-meta mt-1">
              {t('sharedCellar.stats.rose')}
            </div>
          </div>
          <div className="app-card p-4">
            <span className="text-2xl" aria-hidden>✨</span>
            <div className="app-display text-2xl mt-1">{stats.sparklingCount}</div>
            <div className="app-meta mt-1">
              {t('sharedCellar.stats.sparkling')}
            </div>
          </div>
        </div>

        {stats.topRegions.length > 0 && (
          <div className="app-card p-5 mb-8">
            <h2 className="app-field-label mb-3">
              {t('sharedCellar.topRegions')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {stats.topRegions.map((region) => (
                <span
                  key={region}
                  className="px-3 py-1 rounded-full text-sm"
                  style={{
                    background: 'var(--wine-50)',
                    color: 'var(--accent-text)',
                    border: '1px solid var(--wine-200)',
                  }}
                >
                  {region}
                </span>
              ))}
            </div>
          </div>
        )}

        <h2 className="app-section-title mb-4">
          {t('sharedCellar.collection', { count: bottles.length })}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bottles.map((bottle, index) => (
            <motion.div
              key={bottle.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.2 }}
              className="app-card p-5 border-s-4"
              style={{
                borderInlineStartColor:
                  bottle.color === 'red'
                    ? 'var(--wine-600)'
                    : bottle.color === 'white'
                    ? 'var(--color-gold-500)'
                    : bottle.color === 'rose'
                    ? '#e895aa'
                    : 'var(--color-sage-500)',
              }}
            >
              <h3 className="app-wine-name text-base mb-1">
                {bottle.wineName}
              </h3>
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                {bottle.producer}
              </p>
              <div className="space-y-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {bottle.vintage && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> {bottle.vintage}
                  </div>
                )}
                {bottle.region && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> {bottle.region}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Wine className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> {t('sharedCellar.bottles', { count: bottle.quantity })}
                </div>
                {bottle.rating && (
                  <div className="flex items-center gap-1.5" style={{ color: 'var(--text-warning)' }}>
                    <Star className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> {bottle.rating.toFixed(1)}/5
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <section className="app-band mt-10 p-7 sm:p-10 text-center">
          <h2 className="app-display text-2xl sm:text-3xl mb-2">{t('sharedCellar.ctaTitle')}</h2>
          <p className="app-band-muted mx-auto max-w-md text-sm sm:text-base mb-6">{t('sharedCellar.ctaBody')}</p>
          <button onClick={() => navigate('/cellar')} className="app-cta-gold">
            {t('sharedCellar.goToCellar')}
          </button>
        </section>
      </div>
    </div>
  );
}

