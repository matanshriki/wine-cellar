/**
 * Admin Readiness Backfill Tool
 * 
 * Global backfill for computing readiness/drink-window scores for ALL bottles.
 * Admin-only feature - gated by is_admin flag.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../lib/toast';
import { supabase } from '../lib/supabase';

interface BackfillProgress {
  jobId: string | null;
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  isRunning: boolean;
  isComplete: boolean;
  mode: 'missing_only' | 'stale_or_missing' | 'force_all';
  currentWine: string | null;
}

export function AdminReadinessBackfill() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [progress, setProgress] = useState<BackfillProgress>({
    jobId: null,
    total: 0,
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    isRunning: false,
    isComplete: false,
    mode: 'missing_only',
    currentWine: null,
  });
  const [selectedMode, setSelectedMode] = useState<'missing_only' | 'stale_or_missing' | 'force_all'>('missing_only');
  const [batchSize, setBatchSize] = useState(200);
  const [missingCount, setMissingCount] = useState<number | null>(null);

  // Check if user is admin
  useEffect(() => {
    async function checkAdminStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCheckingAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      setIsAdmin(profile?.is_admin === true);
      setCheckingAdmin(false);
    }

    checkAdminStatus();
  }, []);

  // Check for bottles missing readiness
  useEffect(() => {
    async function checkMissingCount() {
      if (!isAdmin) return;

      const { data, error } = await supabase
        .rpc('count_bottles_needing_readiness', {
          p_mode: selectedMode,
          p_current_version: 2,
        });

      if (!error && data !== null) {
        setMissingCount(data);
      }
    }

    checkMissingCount();
  }, [isAdmin, selectedMode]);

  // Load existing job if any
  useEffect(() => {
    async function loadExistingJob() {
      if (!isAdmin) return;

      const { data } = await supabase
        .from('readiness_backfill_jobs')
        .select('*')
        .eq('status', 'running')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setProgress({
          jobId: data.id,
          total: data.estimated_total || 0,
          processed: data.processed,
          updated: data.updated,
          skipped: data.skipped,
          failed: data.failed,
          isRunning: true,
          isComplete: false,
          mode: data.mode,
          currentWine: null,
        });
        toast.info('Resuming existing backfill job...');
        resumeBackfill(data.id);
      }
    }

    loadExistingJob();
  }, [isAdmin]);

  const startBackfill = async () => {
    try {
      console.log('[AdminReadinessBackfill] Starting backfill...');
      setProgress({
        jobId: null,
        total: missingCount || 0,
        processed: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        isRunning: true,
        isComplete: false,
        mode: selectedMode,
        currentWine: null,
      });

      await runBackfillLoop(null);

    } catch (error) {
      console.error('[AdminReadinessBackfill] Error:', error);
      toast.error('Failed to start backfill');
      setProgress(prev => ({ ...prev, isRunning: false }));
    }
  };

  const resumeBackfill = async (jobId: string) => {
    try {
      await runBackfillLoop(jobId);
    } catch (error) {
      console.error('[AdminReadinessBackfill] Resume error:', error);
      setProgress(prev => ({ ...prev, isRunning: false }));
    }
  };

  const runBackfillLoop = async (existingJobId: string | null) => {
    let currentJobId = existingJobId;
    let cursor: string | null = null;
    let iterations = 0;
    const maxIterations = 500; // Safety limit

    while (iterations < maxIterations) {
      try {
        // Call Edge Function
        const { data, error } = await supabase.functions.invoke('backfill-readiness', {
          body: {
            jobId: currentJobId,
            mode: selectedMode,
            batchSize,
            maxBatches: 1, // Process one batch per call
          },
        });

        if (error) {
          console.error('[AdminReadinessBackfill] Edge function error:', error);
          toast.error('Backfill error: ' + error.message);
          setProgress(prev => ({ ...prev, isRunning: false }));
          break;
        }

        if (!data) {
          console.error('[AdminReadinessBackfill] No data returned');
          break;
        }

        // Update progress
        currentJobId = data.jobId;
        cursor = data.nextCursor;

        setProgress(prev => ({
          ...prev,
          jobId: currentJobId,
          processed: data.processed,
          updated: data.updated,
          skipped: data.skipped,
          failed: data.failed,
          isComplete: data.isComplete,
        }));

        console.log('[AdminReadinessBackfill] Progress:', {
          processed: data.processed,
          updated: data.updated,
          failed: data.failed,
          isComplete: data.isComplete,
        });

        // Check if complete
        if (data.isComplete) {
          console.log('[AdminReadinessBackfill] ✅ Backfill complete!');
          toast.success(`✅ Readiness backfill complete! Updated ${data.updated} bottles`);
          setProgress(prev => ({ ...prev, isRunning: false, isComplete: true }));
          
          // Refresh missing count
          const { data: newCount } = await supabase
            .rpc('count_bottles_needing_readiness', {
              p_mode: selectedMode,
              p_current_version: 2,
            });
          if (newCount !== null) setMissingCount(newCount);
          
          break;
        }

        // Small delay between batches to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 500));
        iterations++;

      } catch (error: any) {
        console.error('[AdminReadinessBackfill] Loop error:', error);
        toast.error('Backfill error: ' + error.message);
        setProgress(prev => ({ ...prev, isRunning: false }));
        break;
      }
    }

    if (iterations >= maxIterations) {
      console.warn('[AdminReadinessBackfill] Hit max iterations, stopping');
      toast.warning('Backfill paused after many batches. Click Resume to continue.');
      setProgress(prev => ({ ...prev, isRunning: false }));
    }
  };

  const cancelBackfill = async () => {
    if (progress.jobId) {
      await supabase
        .from('readiness_backfill_jobs')
        .update({ status: 'cancelled' })
        .eq('id', progress.jobId);
    }
    setProgress(prev => ({ ...prev, isRunning: false, isComplete: true }));
    toast.info('Backfill cancelled');
  };

  if (checkingAdmin) {
    return null;
  }

  if (!isAdmin) {
    return null;
  }

  const percentComplete = progress.total > 0 
    ? Math.round((progress.processed / progress.total) * 100)
    : progress.processed > 0 ? Math.min(99, Math.round(progress.processed / 10)) : 0;

  return (
    <div className="mt-8 p-6 rounded-xl" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            🍷 Admin: Readiness Backfill
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Compute drink windows and readiness scores for all bottles
          </p>
          {missingCount !== null && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {missingCount} bottles need processing
            </p>
          )}
        </div>
        
        {!progress.isRunning && (
          <div className="flex gap-2">
            {progress.jobId && !progress.isComplete && (
              <motion.button
                onClick={() => resumeBackfill(progress.jobId!)}
                className="px-4 py-2 rounded-lg font-medium transition-all"
                style={{
                  background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                  color: 'white',
                  border: '1px solid var(--wine-600)',
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Resume Backfill
              </motion.button>
            )}
            <motion.button
              onClick={startBackfill}
              className="px-4 py-2 rounded-lg font-medium transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                color: 'white',
                border: '1px solid var(--wine-700)',
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Start Backfill
            </motion.button>
          </div>
        )}
        
        {progress.isRunning && (
          <motion.button
            onClick={cancelBackfill}
            className="px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-medium)',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Cancel
          </motion.button>
        )}
      </div>

      {/* Mode selector */}
      {!progress.isRunning && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Backfill Mode
          </label>
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as any)}
            className="w-full px-3 py-2 rounded-lg"
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <option value="missing_only">Missing Only (bottles without readiness data)</option>
            <option value="stale_or_missing">Stale or Missing (outdated version + missing)</option>
            <option value="force_all">Force All (recompute everything)</option>
          </select>
        </div>
      )}
      
      <AnimatePresence>
        {progress.isRunning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span style={{ color: 'var(--text-secondary)' }}>
                  {progress.processed} {progress.total > 0 ? `of ${progress.total}` : ''} bottles
                </span>
                <span style={{ color: 'var(--text-primary)' }} className="font-medium">
                  {percentComplete}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, var(--wine-500), var(--wine-600))' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentComplete}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Updated:</span>{' '}
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {progress.updated}
                </span>
              </div>
              {progress.skipped > 0 && (
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Skipped:</span>{' '}
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {progress.skipped}
                  </span>
                </div>
              )}
              {progress.failed > 0 && (
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Failed:</span>{' '}
                  <span className="font-medium text-red-500">
                    {progress.failed}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {!progress.isRunning && progress.processed > 0 && (
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Last run: Updated {progress.updated} bottles
            {progress.skipped > 0 && `, skipped ${progress.skipped}`}
            {progress.failed > 0 && `, ${progress.failed} failed`}
          </p>
        </div>
      )}
    </div>
  );
}
