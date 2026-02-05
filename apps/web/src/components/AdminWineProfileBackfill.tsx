/**
 * Admin Wine Profile Backfill Tool
 * 
 * Bulk generates wine profiles for existing wines that don't have them.
 * Admin-only feature - gated by is_admin flag.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import * as wineProfileService from '../services/wineProfileService';

interface BackfillProgress {
  total: number;
  processed: number;
  failed: number;
  currentWine: string | null;
  isRunning: boolean;
}

export function AdminWineProfileBackfill() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [progress, setProgress] = useState<BackfillProgress>({
    total: 0,
    processed: 0,
    failed: 0,
    currentWine: null,
    isRunning: false,
  });
  const [jobId, setJobId] = useState<string | null>(null);

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

  // Load existing job if any
  useEffect(() => {
    async function loadExistingJob() {
      if (!isAdmin) return;

      const { data } = await supabase
        .from('profile_backfill_jobs')
        .select('*')
        .eq('status', 'running')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setJobId(data.id);
        setProgress({
          total: data.total,
          processed: data.processed,
          failed: data.failed,
          currentWine: null,
          isRunning: true,
        });
        toast.info('Resuming existing backfill job...');
        resumeBackfill(data.id, data.processed);
      }
    }

    loadExistingJob();
  }, [isAdmin]);

  const startBackfill = async () => {
    try {
      console.log('[AdminBackfill] Starting backfill...');
      setProgress({ total: 0, processed: 0, failed: 0, currentWine: null, isRunning: true });

      // Get all wines without profiles
      const { data: wines, error } = await supabase
        .from('wines')
        .select('id, wine_name, producer, region, country, grapes, color, regional_wine_style, vintage')
        .is('wine_profile', null);

      if (error) throw error;

      if (!wines || wines.length === 0) {
        toast.success('All wines already have profiles!');
        setProgress(prev => ({ ...prev, isRunning: false }));
        return;
      }

      console.log('[AdminBackfill] Found', wines.length, 'wines without profiles');

      // Create backfill job
      const { data: job, error: jobError } = await supabase
        .from('profile_backfill_jobs')
        .insert({
          status: 'running',
          total: wines.length,
          processed: 0,
          failed: 0,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      setJobId(job.id);
      setProgress({ total: wines.length, processed: 0, failed: 0, currentWine: null, isRunning: true });

      // Process wines in batches
      await processWinesBatch(wines, job.id);

    } catch (error) {
      console.error('[AdminBackfill] Error:', error);
      toast.error('Failed to start backfill');
      setProgress(prev => ({ ...prev, isRunning: false }));
    }
  };

  const resumeBackfill = async (existingJobId: string, startFrom: number) => {
    try {
      // Get remaining wines
      const { data: wines } = await supabase
        .from('wines')
        .select('id, wine_name, producer, region, country, grapes, color, regional_wine_style, vintage')
        .is('wine_profile', null);

      if (!wines || wines.length === 0) {
        await completeJob(existingJobId, 'completed');
        return;
      }

      await processWinesBatch(wines, existingJobId);

    } catch (error) {
      console.error('[AdminBackfill] Resume error:', error);
      setProgress(prev => ({ ...prev, isRunning: false }));
    }
  };

  const processWinesBatch = async (wines: any[], currentJobId: string) => {
    let processed = progress.processed;
    let failed = progress.failed;

    // Process with concurrency limit of 2
    const concurrency = 2;
    
    for (let i = 0; i < wines.length; i += concurrency) {
      const batch = wines.slice(i, Math.min(i + concurrency, wines.length));
      
      await Promise.all(
        batch.map(async (wine) => {
          try {
            setProgress(prev => ({ ...prev, currentWine: wine.wine_name }));
            
            // Generate profile
            await wineProfileService.generateWineProfile(wine);
            
            processed++;
            console.log(`[AdminBackfill] ✅ Generated profile for ${wine.wine_name} (${processed}/${progress.total})`);
            
          } catch (error) {
            console.error(`[AdminBackfill] ❌ Failed for ${wine.wine_name}:`, error);
            failed++;
          }
          
          // Update progress
          setProgress(prev => ({
            ...prev,
            processed,
            failed,
          }));
          
          // Update job in DB
          await supabase
            .from('profile_backfill_jobs')
            .update({ processed, failed })
            .eq('id', currentJobId);
        })
      );
      
      // Small delay between batches to avoid rate limiting
      if (i + concurrency < wines.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Complete job
    await completeJob(currentJobId, 'completed');
    
    toast.success(`✅ Backfill complete! Generated ${processed} profiles (${failed} failed)`);
    setProgress(prev => ({ ...prev, isRunning: false, currentWine: null }));
  };

  const completeJob = async (currentJobId: string, status: 'completed' | 'failed') => {
    await supabase
      .from('profile_backfill_jobs')
      .update({ status })
      .eq('id', currentJobId);
    
    setJobId(null);
  };

  const cancelBackfill = async () => {
    if (jobId) {
      await completeJob(jobId, 'failed');
    }
    setProgress({ total: 0, processed: 0, failed: 0, currentWine: null, isRunning: false });
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
    : 0;

  return (
    <div className="mt-8 p-6 rounded-xl" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            🔧 Admin: Wine Profile Backfill
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Generate AI profiles for wines that don't have them
          </p>
        </div>
        
        {!progress.isRunning && (
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
                  {progress.processed} of {progress.total} wines
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
            
            {/* Current wine */}
            {progress.currentWine && (
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Currently processing:{' '}
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {progress.currentWine}
                </span>
              </div>
            )}
            
            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Processed:</span>{' '}
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {progress.processed}
                </span>
              </div>
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
            Last run: Generated {progress.processed} profiles
            {progress.failed > 0 && `, ${progress.failed} failed`}
          </p>
        </div>
      )}
    </div>
  );
}
