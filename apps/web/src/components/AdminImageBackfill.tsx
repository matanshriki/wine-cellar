/**
 * Admin Image Backfill Tool
 * 
 * Converts stored signed URLs to stable storage paths for permanent image access.
 * 
 * Problem: Signed URLs expire, causing images to break
 * Solution: Extract paths from URLs, store paths, generate URLs at runtime
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { WineLoader } from './WineLoader';

interface BackfillCounts {
  bottles: { image: number; label: number };
  wines: { image: number; label: number };
  total: number;
}

export function AdminImageBackfill() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<BackfillCounts | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, errors: 0, remaining: 0 });

  useEffect(() => {
    checkAdminStatus();
  }, []);

  async function checkAdminStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (profile?.is_admin) {
        setIsAdmin(true);
        await loadCounts();
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setLoading(false);
    }
  }

  async function loadCounts() {
    try {
      const { data, error } = await supabase.functions.invoke('backfill-image-paths', {
        body: { action: 'get-counts' },
      });

      if (error) throw error;

      if (data?.counts) {
        setCounts(data.counts);
      }
    } catch (error: any) {
      console.error('Error loading counts:', error);
      toast.error(`Failed to load counts: ${error.message}`);
    }
  }

  async function runBackfill() {
    if (!counts || counts.total === 0) {
      toast.info('No images need backfilling');
      return;
    }

    setIsProcessing(true);
    setProgress({ processed: 0, errors: 0, remaining: counts.total });

    try {
      let totalProcessed = 0;
      let totalErrors = 0;
      let remaining = counts.total;

      // Process in batches until complete
      while (remaining > 0) {
        console.log(`[AdminImageBackfill] Processing batch (${remaining} remaining)`);
        
        const { data, error } = await supabase.functions.invoke('backfill-image-paths', {
          body: { action: 'process-batch', batchSize: 100 },
        });

        if (error) {
          throw error;
        }

        if (!data || !data.success) {
          throw new Error('Batch processing failed');
        }

        totalProcessed += data.processed || 0;
        totalErrors += data.errors || 0;
        remaining = data.remaining || 0;

        setProgress({
          processed: totalProcessed,
          errors: totalErrors,
          remaining,
        });

        // Short delay between batches to avoid overwhelming the database
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Break if no progress (safety)
        if (data.processed === 0 && data.remaining === remaining) {
          console.warn('[AdminImageBackfill] No progress made, stopping');
          break;
        }
      }

      toast.success(`Backfill complete! Processed: ${totalProcessed}, Errors: ${totalErrors}`);
      
      // Reload counts
      await loadCounts();
    } catch (error: any) {
      console.error('[AdminImageBackfill] Error:', error);
      toast.error(`Backfill failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="luxury-card p-6">
        <WineLoader size="md" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="luxury-card p-6">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>
            Image Path Backfill
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Convert expired signed URLs to stable storage paths
          </p>
        </div>

        {/* Counts */}
        {counts && (
          <div 
            className="p-4 rounded-lg" 
            style={{ 
              backgroundColor: 'var(--bg-muted)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div style={{ color: 'var(--text-tertiary)' }}>Bottles</div>
                <div style={{ color: 'var(--text-primary)' }}>
                  {counts.bottles.image} images, {counts.bottles.label} labels
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)' }}>Wines</div>
                <div style={{ color: 'var(--text-primary)' }}>
                  {counts.wines.image} images, {counts.wines.label} labels
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-current/10">
              <div className="text-base font-semibold" style={{ color: 'var(--wine-600)' }}>
                Total Needing Backfill: {counts.total}
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {progress.processed} processed · {progress.errors} errors · {progress.remaining} remaining
              </span>
            </div>
            <div 
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--bg-muted)' }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${counts ? ((counts.total - progress.remaining) / counts.total) * 100 : 0}%`,
                  backgroundColor: 'var(--wine-600)',
                }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={loadCounts}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
            }}
          >
            Refresh Counts
          </button>
          
          <button
            onClick={runBackfill}
            disabled={isProcessing || !counts || counts.total === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: isProcessing || !counts || counts.total === 0 
                ? 'var(--bg-muted)' 
                : 'var(--wine-600)',
              color: 'var(--text-inverse)',
              opacity: isProcessing || !counts || counts.total === 0 ? 0.5 : 1,
            }}
          >
            {isProcessing ? 'Processing...' : 'Start Backfill'}
          </button>
        </div>

        {/* Info */}
        <div 
          className="text-xs p-3 rounded-lg"
          style={{
            backgroundColor: 'var(--bg-muted)',
            color: 'var(--text-tertiary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <strong>What this does:</strong> Extracts storage paths from expired signed URLs and saves them.
          Images will then generate fresh URLs at runtime, preventing future expiration.
        </div>
      </div>
    </div>
  );
}
