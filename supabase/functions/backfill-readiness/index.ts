/**
 * Backfill Readiness Edge Function
 * 
 * Global backfill job for computing readiness/drink-window scores for ALL bottles.
 * Admin-triggered, batched, resumable with progress tracking.
 * 
 * Endpoints:
 * - POST /backfill-readiness - Start or continue backfill job
 * 
 * Request body:
 * {
 *   jobId?: string,           // Resume existing job
 *   mode?: 'missing_only' | 'stale_or_missing' | 'force_all',
 *   batchSize?: number,       // Default 200
 *   maxBatches?: number       // Limit per invocation (default 1)
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const READINESS_VERSION = 2; // Must match drinkWindowService.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function corsResponse(body: any, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

// Map ReadinessStatus to DB enum
function mapReadinessToDBStatus(readiness: string, age: number): string {
  if (readiness === 'HOLD') {
    return age < 2 ? 'TooYoung' : 'Approaching';
  } else if (readiness === 'PEAK_SOON') {
    return 'InWindow';
  } else if (readiness === 'READY') {
    return age > 15 ? 'Peak' : 'InWindow';
  }
  return 'Unknown';
}

// Compute readiness for a bottle (deterministic logic)
function computeReadiness(bottle: any, wine: any, wineProfile: any) {
  const currentYear = new Date().getFullYear();
  const vintage = wine.vintage;
  const color = (wine.color || 'red').toLowerCase();
  const wineName = wine.wine_name || 'Unknown';
  
  // Validate vintage
  if (!vintage || vintage < 1900 || vintage > currentYear + 1) {
    return {
      readiness_score: 50,
      drink_status: 'Unknown',
      drink_from_year: null,
      drink_to_year: null,
      confidence: 'low',
      reasons: ['Invalid or missing vintage'],
    };
  }
  
  const age = Math.max(0, currentYear - vintage);
  
  // Compute based on wine type
  let readiness_score = 50;
  let drink_status = 'Unknown';
  let drink_from_year = vintage;
  let drink_to_year = vintage + 10;
  let confidence: 'low' | 'med' | 'high' = 'med';
  const reasons: string[] = [];
  
  // Sparkling wines
  if (color.includes('sparkling')) {
    if (age < 1) {
      readiness_score = 80;
      drink_status = 'InWindow';
      drink_from_year = vintage;
      drink_to_year = vintage + 5;
      reasons.push('Sparkling wines are best enjoyed young');
    } else if (age <= 5) {
      readiness_score = 85;
      drink_status = 'InWindow';
      drink_from_year = vintage;
      drink_to_year = vintage + 5;
      reasons.push('Still within optimal drinking window');
    } else {
      readiness_score = 60;
      drink_status = 'PastPeak';
      drink_from_year = vintage;
      drink_to_year = vintage + 5;
      reasons.push('May have lost freshness');
    }
    confidence = 'high';
  }
  // White and Rosé wines
  else if (color.includes('white') || color.includes('rose')) {
    if (age < 1) {
      readiness_score = 75;
      drink_status = 'InWindow';
      drink_from_year = vintage;
      drink_to_year = vintage + 3;
      reasons.push('White wines are typically ready soon after release');
    } else if (age <= 3) {
      readiness_score = 85;
      drink_status = 'Peak';
      drink_from_year = vintage;
      drink_to_year = vintage + 3;
      reasons.push('At peak freshness');
    } else if (age <= 7) {
      readiness_score = 70;
      drink_status = 'InWindow';
      drink_from_year = vintage;
      drink_to_year = vintage + 7;
      reasons.push('Still drinking well');
    } else {
      readiness_score = 55;
      drink_status = 'PastPeak';
      drink_from_year = vintage;
      drink_to_year = vintage + 7;
      reasons.push('May have oxidized');
    }
    confidence = 'med';
  }
  // Red wines (use profile if available)
  else {
    // Extract profile-based aging potential
    let agingPotential = 'medium'; // low, medium, high
    
    if (wineProfile && wineProfile.wine_profile) {
      const profile = wineProfile.wine_profile;
      const body = profile.body || 3;
      const tannin = profile.tannin || 3;
      const acidity = profile.acidity || 3;
      const oak = profile.oak || 2;
      const power = profile.power || 3;
      
      const structureScore = body + tannin + acidity + oak + power;
      
      if (structureScore >= 18) {
        agingPotential = 'high';
        confidence = 'high';
      } else if (structureScore <= 12) {
        agingPotential = 'low';
        confidence = 'high';
      } else {
        agingPotential = 'medium';
        confidence = 'med';
      }
      
      reasons.push(`Structure score: ${structureScore} (body ${body}, tannin ${tannin})`);
    } else {
      // Heuristic based on region/grapes
      const regionLower = (wine.region || '').toLowerCase();
      const grapesStr = Array.isArray(wine.grapes) 
        ? wine.grapes.join(' ').toLowerCase() 
        : (wine.grapes || '').toLowerCase();
      
      if (regionLower.includes('bordeaux') || regionLower.includes('barolo') || 
          regionLower.includes('brunello') || grapesStr.includes('cabernet')) {
        agingPotential = 'high';
        reasons.push('Classic aging region/grape');
      } else if (grapesStr.includes('pinot noir') || grapesStr.includes('gamay')) {
        agingPotential = 'low';
        reasons.push('Typically enjoyed younger');
      }
      
      confidence = 'low';
      reasons.push('No wine profile available (heuristic estimate)');
    }
    
    // Set thresholds based on aging potential
    let holdUntil = 2;
    let peakStart = 3;
    let peakEnd = 8;
    let maxAge = 15;
    
    if (agingPotential === 'high') {
      holdUntil = 4;
      peakStart = 6;
      peakEnd = 15;
      maxAge = 25;
    } else if (agingPotential === 'low') {
      holdUntil = 1;
      peakStart = 2;
      peakEnd = 5;
      maxAge = 8;
    }
    
    // Determine status based on age
    if (age < holdUntil) {
      readiness_score = 40;
      drink_status = 'TooYoung';
      drink_from_year = vintage + holdUntil;
      drink_to_year = vintage + maxAge;
      reasons.push('Still developing, needs more time');
    } else if (age < peakStart) {
      readiness_score = 65;
      drink_status = 'Approaching';
      drink_from_year = vintage + holdUntil;
      drink_to_year = vintage + maxAge;
      reasons.push('Approaching drinking window');
    } else if (age <= peakEnd) {
      readiness_score = 90;
      drink_status = 'Peak';
      drink_from_year = vintage + holdUntil;
      drink_to_year = vintage + maxAge;
      reasons.push('At peak maturity');
    } else if (age <= maxAge) {
      readiness_score = 75;
      drink_status = 'InWindow';
      drink_from_year = vintage + holdUntil;
      drink_to_year = vintage + maxAge;
      reasons.push('Still within drinking window');
    } else {
      readiness_score = 50;
      drink_status = 'PastPeak';
      drink_from_year = vintage + holdUntil;
      drink_to_year = vintage + maxAge;
      reasons.push('May be past prime');
    }
  }
  
  // Sanity checks
  if (drink_from_year && drink_to_year && drink_from_year > drink_to_year) {
    drink_to_year = drink_from_year + 5;
    confidence = 'low';
  }
  
  return {
    readiness_score,
    drink_status,
    drink_from_year,
    drink_to_year,
    confidence,
    reasons,
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Missing authorization header' }, 401);
    }

    // Create admin client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return corsResponse({ error: 'Unauthorized' }, 401);
    }

    // Check admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return corsResponse({ error: 'Admin access required' }, 403);
    }

    console.log('[BackfillReadiness] Admin user authenticated:', user.id.substring(0, 8));

    // Parse request
    const { jobId, mode = 'missing_only', batchSize = 200, maxBatches = 1 } = await req.json();

    let job: any;
    let cursor: string | null = null;

    // Resume existing job or create new one
    if (jobId) {
      console.log('[BackfillReadiness] Resuming job:', jobId);
      const { data: existingJob } = await supabase
        .from('readiness_backfill_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!existingJob) {
        return corsResponse({ error: 'Job not found' }, 404);
      }

      job = existingJob;
      cursor = job.cursor;
    } else {
      console.log('[BackfillReadiness] Creating new job, mode:', mode);
      
      // Estimate total
      const { data: countResult } = await supabase
        .rpc('count_bottles_needing_readiness', {
          p_mode: mode,
          p_current_version: READINESS_VERSION,
        });

      const estimatedTotal = countResult || 0;
      console.log('[BackfillReadiness] Estimated total:', estimatedTotal);

      // Create job
      const { data: newJob, error: jobError } = await supabase
        .from('readiness_backfill_jobs')
        .insert({
          mode,
          batch_size: batchSize,
          current_version: READINESS_VERSION,
          status: 'running',
          started_by: user.id,
          started_at: new Date().toISOString(),
          estimated_total: estimatedTotal,
        })
        .select()
        .single();

      if (jobError) throw jobError;
      job = newJob;
    }

    // Process batches
    let totalProcessed = job.processed;
    let totalUpdated = job.updated;
    let totalSkipped = job.skipped;
    let totalFailed = job.failed;
    const failures: any[] = job.failures || [];

    for (let batchNum = 0; batchNum < maxBatches; batchNum++) {
      console.log(`[BackfillReadiness] Processing batch ${batchNum + 1}/${maxBatches}`);

      // Build query based on mode
      let query = supabase
        .from('bottles')
        .select('id, user_id, wine_id, drink_window_start, drink_window_end, readiness_status, readiness_score, readiness_version')
        .order('id', { ascending: true })
        .limit(batchSize);

      if (cursor) {
        query = query.gt('id', cursor);
      }

      if (mode === 'missing_only') {
        query = query.or('readiness_score.is.null,readiness_status.is.null,readiness_updated_at.is.null');
      } else if (mode === 'stale_or_missing') {
        query = query.or(`readiness_score.is.null,readiness_status.is.null,readiness_updated_at.is.null,readiness_version.neq.${READINESS_VERSION}`);
      }
      // force_all: no filter

      const { data: bottles, error: bottlesError } = await query;

      if (bottlesError) throw bottlesError;

      if (!bottles || bottles.length === 0) {
        console.log('[BackfillReadiness] No more bottles to process');
        break;
      }

      console.log('[BackfillReadiness] Processing', bottles.length, 'bottles');

      // Fetch wine data and profiles for this batch
      const wineIds = [...new Set(bottles.map((b: any) => b.wine_id))];
      const { data: wines } = await supabase
        .from('wines')
        .select('id, wine_name, producer, vintage, color, region, country, grapes, wine_profile')
        .in('id', wineIds);

      const wineMap = new Map((wines || []).map((w: any) => [w.id, w]));

      // Process bottles with concurrency
      const concurrency = 5;
      for (let i = 0; i < bottles.length; i += concurrency) {
        const batch = bottles.slice(i, Math.min(i + concurrency, bottles.length));

        await Promise.all(
          batch.map(async (bottle: any) => {
            try {
              const wine = wineMap.get(bottle.wine_id);
              if (!wine) {
                totalSkipped++;
                return;
              }

              // Compute readiness
              const result = computeReadiness(bottle, wine, wine);

              // Update bottle
              const { error: updateError } = await supabase
                .from('bottles')
                .update({
                  readiness_score: result.readiness_score,
                  readiness_status: result.drink_status,
                  drink_window_start: result.drink_from_year,
                  drink_window_end: result.drink_to_year,
                  readiness_confidence: result.confidence,
                  readiness_reasons: result.reasons,
                  readiness_version: READINESS_VERSION,
                  readiness_updated_at: new Date().toISOString(),
                })
                .eq('id', bottle.id);

              if (updateError) {
                console.error('[BackfillReadiness] Update error:', updateError);
                totalFailed++;
                failures.push({ bottle_id: bottle.id, reason: updateError.message });
              } else {
                totalUpdated++;
              }

              totalProcessed++;
              cursor = bottle.id;

            } catch (error: any) {
              console.error('[BackfillReadiness] Error processing bottle:', error);
              totalFailed++;
              failures.push({ bottle_id: bottle.id, reason: error.message });
            }
          })
        );
      }

      // Update job progress
      await supabase
        .from('readiness_backfill_jobs')
        .update({
          cursor,
          processed: totalProcessed,
          updated: totalUpdated,
          skipped: totalSkipped,
          failed: totalFailed,
          failures: failures.slice(-50), // Keep last 50 failures
        })
        .eq('id', job.id);

      // Check if done
      if (bottles.length < batchSize) {
        console.log('[BackfillReadiness] Batch incomplete, job done');
        break;
      }
    }

    // Check if job is complete
    const moreToProcess = cursor !== null;
    const isComplete = !moreToProcess;

    if (isComplete) {
      await supabase
        .from('readiness_backfill_jobs')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }

    const elapsedMs = Date.now() - startTime;

    return corsResponse({
      jobId: job.id,
      processed: totalProcessed,
      updated: totalUpdated,
      skipped: totalSkipped,
      failed: totalFailed,
      failures: failures.slice(-10), // Return last 10
      nextCursor: isComplete ? null : cursor,
      isComplete,
      elapsedMs,
    });

  } catch (error: any) {
    console.error('[BackfillReadiness] Error:', error);
    return corsResponse({ error: error.message || 'Internal error' }, 500);
  }
});
