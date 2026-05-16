import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { AdminHeTranslationsBackfill } from '../components/AdminHeTranslationsBackfill';

interface EnrichWineDetail {
  wine_id: string;
  wine_name: string;
  producer: string;
  vintage: number | null;
  vivino_url: string | null;
  status: 'enriched' | 'skipped' | 'failed';
  skip_reason: string | null;
  fields_updated: string[] | null;
  error: string | null;
}

interface BatchProgress {
  total: number;
  processed: number;
  enriched: number;
  failed: number;
  skipped: number;
  errors: Array<{ wine_id: string; error: string }>;
  details: EnrichWineDetail[];
}

interface AnalysisProgress {
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  fetchedCount: number;
  nextOffset: number;
  isComplete: boolean;
  pipeline?: string;
}

export const AdminEnrichPage: React.FC = () => {
  const { user, session: contextSession } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [vivinoEnrichmentScope, setVivinoEnrichmentScope] = useState<'missing_only' | 'refresh_all'>('missing_only');
  const [limit, setLimit] = useState(100);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [detailFilter, setDetailFilter] = useState<'all' | 'enriched' | 'skipped' | 'failed'>('all');

  // ── Find Missing Vivino IDs state ─────────────────────────────────────────
  const [missingIdsRunning, setMissingIdsRunning] = useState(false);
  const [missingIdsDone, setMissingIdsDone]       = useState(false);
  const [missingIdsDryRun, setMissingIdsDryRun]   = useState(true);
  const [missingIdsLog, setMissingIdsLog]         = useState<string[]>([]);
  const [missingIdsTotals, setMissingIdsTotals]   = useState({ processed: 0, enriched: 0, skipped: 0, failed: 0, pages: 0 });

  // ── Fetch Vivino Images state ──────────────────────────────────────────────
  const [imageRunning,  setImageRunning]  = useState(false);
  const [imageBatch,    setImageBatch]    = useState(10);
  const [imageTotals,   setImageTotals]   = useState({ processed: 0, uploaded: 0, skipped: 0, failed: 0, pages: 0 });
  const [imageLog,      setImageLog]      = useState<string[]>([]);
  const [imageDone,     setImageDone]     = useState(false);
  const [imageDetails,  setImageDetails]  = useState<Array<{
    wine_id: string; wine_name: string; producer: string | null;
    vintage: number | null; user_id: string;
    status: 'uploaded' | 'skipped' | 'failed';
    image_url: string | null; skip_reason: string | null; error: string | null;
  }>>([]);

  // ── Analyze All Cellars state ──────────────────────────────────────────────
  const [analysisRunning, setAnalysisRunning]   = useState(false);
  const [analysisMode,    setAnalysisMode]       = useState<'missing_only' | 'stale_only' | 'force_all'>('missing_only');
  const [analysisBatch,   setAnalysisBatch]      = useState(50);
  const [analysisTotals,  setAnalysisTotals]     = useState({ processed: 0, skipped: 0, failed: 0, pages: 0 });
  const [analysisLog,     setAnalysisLog]        = useState<string[]>([]);
  const [analysisDone,    setAnalysisDone]       = useState(false);

  // ── Queued modern sommelier (barrel + app-aligned prompts, admin only) ────
  const [modernQueueRunning, setModernQueueRunning] = useState(false);
  const [modernQueueDone, setModernQueueDone] = useState(false);
  const [modernQueueMode, setModernQueueMode] = useState<'already_analyzed' | 'stale_only' | 'force_all'>('already_analyzed');
  const [modernQueueBatch, setModernQueueBatch] = useState(25);
  const [modernQueuePauseMs, setModernQueuePauseMs] = useState(2000);
  const [modernQueueLang, setModernQueueLang] = useState<'en' | 'he'>('en');
  const [modernQueueLog, setModernQueueLog] = useState<string[]>([]);
  const [modernQueueTotals, setModernQueueTotals] = useState({ processed: 0, skipped: 0, failed: 0, pages: 0 });

  // ── Admin: missing analysis_data locale slices (no user credits) ─────────────
  const [localeBfLang, setLocaleBfLang] = useState<'he' | 'en'>('he');
  const [localeBfLimit, setLocaleBfLimit] = useState(25);
  const [localeBfDryRun, setLocaleBfDryRun] = useState(true);
  const [localeBfAfter, setLocaleBfAfter] = useState<string>('');
  const [localeBfRunning, setLocaleBfRunning] = useState(false);
  const [localeBfLog, setLocaleBfLog] = useState<string[]>([]);
  const [localeBfLast, setLocaleBfLast] = useState<Record<string, unknown> | null>(null);

  // ── AI food pairing (wines.food_pairing backfill) ───────────────────────────
  const [fpRunning, setFpRunning] = useState(false);
  const [fpDone, setFpDone] = useState(false);
  const [fpBatch, setFpBatch] = useState(5);
  const [fpForce, setFpForce] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);
  const [fpTotals, setFpTotals] = useState({ en: { processed: 0, skipped: 0, failed: 0 }, he: { processed: 0, skipped: 0, failed: 0 }, pages: 0 });
  const [fpLog, setFpLog] = useState<string[]>([]);
  const fpAbortRef = React.useRef(false);

  // ── Rule-based wine metadata (internal, no Vivino) ─────────────────────────
  const [rulesDryRun, setRulesDryRun] = useState(true);
  const [rulesFilter, setRulesFilter] = useState<'candidates' | 'missing_grapes' | 'suspicious'>('candidates');
  const [rulesBatch, setRulesBatch] = useState(40);
  const [rulesRunning, setRulesRunning] = useState(false);
  const [rulesLog, setRulesLog] = useState<string[]>([]);
  const [rulesTotals, setRulesTotals] = useState({
    fetched: 0,
    examined: 0,
    mutations: 0,
    noChange: 0,
    pages: 0,
  });
  const [rulesDetails, setRulesDetails] = useState<Array<{
    wine_id: string;
    wine_name: string;
    producer: string;
    vintage: number | null;
    region: string | null;
    country: string | null;
    appellation: string | null;
    color: string;
    entry_source: string | null;
    status: string;
    mode: string | null;
    rule_id: string | null;
    confidence: number;
    before_grapes: string[] | null;
    after_grapes: string[] | null;
    before_style: string | null;
    after_style: string | null;
    suspicion_reasons: string[];
    suspicion_fix_tags: string[];
    log_lines: string[];
    mechanism_lines: string[];
  }>>([]);
  const [rulesNoChangeDetails, setRulesNoChangeDetails] = useState<Array<{
    wine_id: string;
    wine_name: string;
    producer: string;
    vintage: number | null;
    region: string | null;
    country: string | null;
    appellation: string | null;
    color: string;
    grapes_current: string[];
    suspicion_flagged: boolean;
    suspicion_reasons: string[];
    diagnostic_lines: string[];
  }>>([]);
  const [rulesDone, setRulesDone] = useState(false);

  // Check if user is admin
  React.useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase.rpc('is_admin', { check_user_id: user.id });
        if (error) throw error;
        setIsAdmin(data);
        if (!data) {
          setAdminError('You do not have admin privileges to access this page.');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setAdminError('Unable to verify admin status. Please contact support.');
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [user]);

  // Helper: get a fresh (non-expired) session token
  const getFreshToken = async (): Promise<string> => {
    let session = contextSession;

    if (!session) {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error('Session expired. Please refresh the page and try again.');
      session = data.session;
    }

    const now = Math.floor(Date.now() / 1000);
    if ((session.expires_at ?? 0) - now < 60) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) throw new Error('Failed to refresh session. Please refresh the page.');
      session = data.session;
    }

    return session.access_token;
  };

  // Helper: call the Edge Function once for a specific page of wines
  const callEnrichOnce = async (token: string, offset: number): Promise<{ data: any; hasMore: boolean }> => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-enrich-vivino`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          dryRun: isDryRun,
          limit: 10,
          offset,
          enrichment_scope: vivinoEnrichmentScope,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      let msg = `HTTP ${response.status}: ${text}`;
      try { msg = JSON.parse(text).message || msg; } catch {}
      throw new Error(msg);
    }

    const data = await response.json();
    return { data, hasMore: !!data.has_more };
  };

  const runBatchEnrich = async () => {
    if (!user) { alert('You must be logged in to run batch enrichment'); return; }

    const totalWanted = limit;
    const scopeHint =
      vivinoEnrichmentScope === 'refresh_all'
        ? 'Scope: ALL wines with a Vivino URL (refreshes ratings, region, grapes, etc. from Vivino).\n\n'
        : 'Scope: Only wines missing at least one of rating / region / country / grapes / style.\n\n';
    if (!isDryRun && !confirm(
      `⚠️ This will fetch Vivino data for up to ${totalWanted} wines.\n\n` +
      scopeHint +
      `Processed in chunks of 10 wines (~15s each) to stay within server limits.\n\nContinue?`
    )) return;

    setIsRunning(true);
    setProgress(null);
    setResult(null);
    setDetailFilter('all');

    // Accumulated totals across all chunks
    const accumulated: BatchProgress = {
      total: 0, processed: 0, enriched: 0, failed: 0, skipped: 0, errors: [], details: [],
    };

    try {
      let offset = 0;        // advances by 10 every round — moves past skipped wines too
      let totalProcessed = 0;
      let round = 0;

      while (totalProcessed < totalWanted) {
        round++;
        console.log(`[Admin Enrich] Round ${round}, offset: ${offset}, processed so far: ${totalProcessed}`);

        const token = await getFreshToken();
        const { data, hasMore } = await callEnrichOnce(token, offset);

        const p: BatchProgress = data.progress;

        // Always advance offset by how many wines were fetched this round
        // (even if all were skipped — this is the key fix)
        offset += p.total;
        totalProcessed += p.total;

        accumulated.total      += p.total;
        accumulated.processed  += p.processed;
        accumulated.enriched   += p.enriched;
        accumulated.failed     += p.failed;
        accumulated.skipped    += p.skipped;
        accumulated.errors     = [...accumulated.errors, ...p.errors];
        accumulated.details    = [...accumulated.details, ...p.details];

        setProgress({ ...accumulated });
        setResult({ ...data, progress: accumulated });

        // Stop when there are no more wines in the queue
        if (!hasMore || p.total === 0) {
          console.log('[Admin Enrich] ✅ All wines processed');
          break;
        }

        // Brief pause between chunks so the browser stays responsive
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      console.error('[Admin Enrich] Error:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runMissingVivinoIds = async () => {
    if (!user) { alert('You must be logged in'); return; }
    if (!missingIdsDryRun && !confirm(
      `This will call search-vivino-wine for all wines that still have no vivino_wine_id.\n\n` +
      `Rate-limited to ~1 request/second. Runs in chunks of 10.\n\nContinue?`
    )) return;

    setMissingIdsRunning(true);
    setMissingIdsDone(false);
    setMissingIdsLog([`[${new Date().toLocaleTimeString()}] Starting — dryRun=${missingIdsDryRun}`]);
    setMissingIdsTotals({ processed: 0, enriched: 0, skipped: 0, failed: 0, pages: 0 });

    let offset = 0;
    let totalProcessed = 0, totalEnriched = 0, totalSkipped = 0, totalFailed = 0, pages = 0;

    try {
      while (true) {
        const token = await getFreshToken();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-enrich-vivino`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              dryRun: missingIdsDryRun,
              limit: 10,
              offset,
              enrichment_scope: 'search_missing_ids',
            }),
          }
        );

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt}`);
        }

        const data = await res.json();
        pages++;
        const p = data.progress;
        offset += p.total;
        totalProcessed += p.processed;
        totalEnriched  += p.enriched;
        totalSkipped   += p.skipped;
        totalFailed    += p.failed;

        const ts = new Date().toLocaleTimeString();
        setMissingIdsLog(prev => [
          ...prev,
          `[${ts}] page ${pages} offset=${offset} | ✅ ${p.enriched} · ⏭ ${p.skipped} · ❌ ${p.failed}`,
        ]);
        setMissingIdsTotals({ processed: totalProcessed, enriched: totalEnriched, skipped: totalSkipped, failed: totalFailed, pages });

        if (!data.has_more || p.total === 0) break;
        await new Promise(r => setTimeout(r, 500));
      }

      setMissingIdsLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ COMPLETE — ${totalEnriched} IDs found, ${totalSkipped} skipped, ${totalFailed} failed`]);
      setMissingIdsDone(true);
    } catch (err: any) {
      setMissingIdsLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ ERROR: ${err.message}`]);
      alert(`Error: ${err.message}`);
    } finally {
      setMissingIdsRunning(false);
    }
  };

  const runRulesBackfill = async () => {
    if (!rulesDryRun && !confirm(
      'Apply rule-based grape / style updates to the wines table?\n\n' +
      'Only rows that match the filter and have a planned change are written.\n\nContinue?',
    )) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session ?? contextSession;
    if (!session) {
      alert('Session expired — please refresh the page.');
      return;
    }

    setRulesRunning(true);
    setRulesDone(false);
    setRulesLog([`[${new Date().toLocaleTimeString()}] start dryRun=${rulesDryRun} filter=${rulesFilter} batch=${rulesBatch}`]);
    setRulesDetails([]);
    setRulesNoChangeDetails([]);

    let offset = 0;
    let totalFetched = 0;
    let totalExamined = 0;
    let totalMutations = 0;
    let totalNoChange = 0;
    let pages = 0;

    try {
      while (true) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-enrich-wine-rules`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              dryRun: rulesDryRun,
              offset,
              batchSize: rulesBatch,
              filterMode: rulesFilter,
            }),
          },
        );

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt}`);
        }

        const data = await res.json();
        pages += 1;
        totalFetched += data.rowsFetched ?? 0;
        totalExamined += data.examined ?? 0;
        totalMutations += data.updatedOrWouldUpdate ?? 0;
        totalNoChange += data.noChange ?? 0;
        offset = data.nextOffset ?? 0;

        if (Array.isArray(data.details) && data.details.length) {
          setRulesDetails((prev) => [...prev, ...data.details]);
        }

        if (Array.isArray(data.noChangeDetails) && data.noChangeDetails.length) {
          setRulesNoChangeDetails((prev) => [...prev, ...data.noChangeDetails]);
        }

        const label = rulesDryRun ? 'would_update' : 'updated';
        const ts = new Date().toLocaleTimeString();
        const perWineLines: string[] = [];
        for (const row of data.noChangeDetails ?? []) {
          perWineLines.push(
            `[${ts}] EXAMINED_NO_CHANGE wine_id=${row.wine_id}`,
            `  label: ${row.producer} — ${row.wine_name}  vintage=${row.vintage ?? '—'}`,
            `  location: ${[row.region, row.appellation, row.country].filter(Boolean).join(' · ') || '—'}`,
            `  color=${row.color ?? '—'}  grapes_now: ${(row.grapes_current ?? []).join(', ') || '(none)'}`,
          );
          if (row.suspicion_flagged && row.suspicion_reasons?.length) {
            perWineLines.push(`  suspicion: ${row.suspicion_reasons.join('; ')}`);
          }
          perWineLines.push('  — why no DB change —');
          for (const dl of row.diagnostic_lines ?? []) {
            perWineLines.push(`    ${dl}`);
          }
          perWineLines.push('');
        }
        for (const row of data.details ?? []) {
          const tag = rulesDryRun ? 'DRY-RUN' : 'APPLY';
          perWineLines.push(
            `[${ts}] ${tag} wine_id=${row.wine_id}`,
            `  label: ${row.producer} — ${row.wine_name}  vintage=${row.vintage ?? '—'}`,
            `  location: ${[row.region, row.appellation, row.country].filter(Boolean).join(' · ') || '—'}`,
            `  color=${row.color ?? '—'} entry_source=${row.entry_source ?? '—'}`,
            `  mode=${row.mode ?? '—'} rule=${row.rule_id ?? '—'} confidence=${row.confidence ?? '—'}`,
          );
          if (row.suspicion_reasons?.length) {
            perWineLines.push(`  suspicion: ${row.suspicion_reasons.join('; ')}`);
          }
          if (row.suspicion_fix_tags?.length) {
            perWineLines.push(`  suspicion_fix_tags: [${row.suspicion_fix_tags.join(', ')}]`);
          }
          perWineLines.push(
            `  grapes: "${(row.before_grapes ?? []).join(', ') || '(none)'}" → "${(row.after_grapes ?? []).join(', ') || '(none)'}"`,
          );
          if (row.before_style !== row.after_style && (row.before_style || row.after_style)) {
            perWineLines.push(
              `  regional_wine_style: "${row.before_style ?? '(empty)'}" → "${row.after_style ?? '(empty)'}"`,
            );
          }
          perWineLines.push('  — mechanism —');
          for (const ml of row.mechanism_lines ?? []) {
            perWineLines.push(`    ${ml}`);
          }
          perWineLines.push('');
        }

        setRulesLog((prev) => [
          ...prev,
          `[${ts}] page ${pages} rows=${data.rowsFetched} examined=${data.examined} ${label}=${data.updatedOrWouldUpdate} no_change=${data.noChange ?? 0} next=${offset}`,
          ...perWineLines,
        ]);
        setRulesTotals({
          fetched: totalFetched,
          examined: totalExamined,
          mutations: totalMutations,
          noChange: totalNoChange,
          pages,
        });

        if (data.isComplete) break;
        await new Promise((r) => setTimeout(r, 200));
      }

      setRulesLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] complete`]);
      setRulesDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setRulesLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ERROR ${msg}`]);
      alert(`Error: ${msg}`);
    } finally {
      setRulesRunning(false);
    }
  };

  // ── Fetch Vivino Images handler (chunks of imageBatch, loops until done) ──
  const runImageEnrich = async () => {
    if (!confirm(
      `This will download wine label images from Vivino and store them in Supabase Storage.\n\n` +
      `Only wines with a Vivino URL and NO existing image will be processed.\n` +
      `Batch size: ${imageBatch} wines per chunk (~${imageBatch * 4} seconds per chunk)\n\n` +
      `Continue?`
    )) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session ?? contextSession;
    if (!session) { alert('Session expired — please refresh the page.'); return; }

    setImageRunning(true);
    setImageDone(false);
    setImageTotals({ processed: 0, uploaded: 0, skipped: 0, failed: 0, pages: 0 });
    setImageLog([`[${new Date().toLocaleTimeString()}] Starting — batch size: ${imageBatch} wines per chunk`]);
    setImageDetails([]);

    let offset = 0;
    let totalProcessed = 0, totalUploaded = 0, totalSkipped = 0, totalFailed = 0, pages = 0;

    try {
      while (true) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-enrich-images`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ offset, batchSize: imageBatch }),
          }
        );

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt}`);
        }

        const data = await res.json();
        pages++;
        totalProcessed += data.processed ?? 0;
        totalUploaded  += data.uploaded  ?? 0;
        totalSkipped   += data.skipped   ?? 0;
        totalFailed    += data.failed    ?? 0;
        offset          = data.nextOffset ?? (offset + imageBatch);

        if (data.details?.length) {
          setImageDetails(prev => [...prev, ...data.details]);
        }

        const logLine = `[${new Date().toLocaleTimeString()}] Chunk ${pages} (offset ${offset}) | 🖼 ${data.uploaded} uploaded, ⏭ ${data.skipped} skipped, ❌ ${data.failed} failed`;
        setImageLog(prev => [...prev, logLine]);
        setImageTotals({ processed: totalProcessed, uploaded: totalUploaded, skipped: totalSkipped, failed: totalFailed, pages });

        if (data.isComplete) break;

        // Brief pause between chunks
        await new Promise(r => setTimeout(r, 500));
      }

      setImageLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ COMPLETE — ${totalUploaded} images uploaded, ${totalSkipped} skipped, ${totalFailed} failed across ${pages} chunks`]);
      setImageDone(true);
    } catch (err: any) {
      setImageLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ ERROR: ${err.message}`]);
      alert(`Error: ${err.message}`);
    } finally {
      setImageRunning(false);
    }
  };

  // ── Analyze All Cellars handler (loops until complete) ────────────────────
  const runAnalysisBackfill = async () => {
    if (!confirm(
      `This will run AI sommelier analysis for ALL bottles across ALL users.\n\n` +
      `Mode: ${analysisMode}\nBatch size: ${analysisBatch} bottles per page\n\n` +
      `This consumes OpenAI tokens. Continue?`
    )) return;

    // Always get a fresh session to ensure access_token is not expired
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session ?? contextSession;
    if (!session) { alert('Session expired — please refresh the page.'); return; }

    setAnalysisRunning(true);
    setAnalysisDone(false);
    setAnalysisTotals({ processed: 0, skipped: 0, failed: 0, pages: 0 });
    setAnalysisLog([`[${new Date().toLocaleTimeString()}] Starting — mode: ${analysisMode}, batch: ${analysisBatch}`]);

    let offset = 0;
    let totalProcessed = 0, totalSkipped = 0, totalFailed = 0, pages = 0;

    try {
      while (true) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backfill-analysis`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ mode: analysisMode, batchSize: analysisBatch, offset }),
          }
        );

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt}`);
        }

        const data: AnalysisProgress = await res.json();
        pages++;
        totalProcessed += data.processedCount;
        totalSkipped   += data.skippedCount;
        totalFailed    += data.failedCount;
        offset          = data.nextOffset;

        const logLine = `[${new Date().toLocaleTimeString()}] Page ${pages} — offset ${offset} | ✅ ${data.processedCount} processed, ⏭ ${data.skippedCount} skipped, ❌ ${data.failedCount} failed`;
        setAnalysisLog(prev => [...prev, logLine]);
        setAnalysisTotals({ processed: totalProcessed, skipped: totalSkipped, failed: totalFailed, pages });

        if (data.isComplete) break;

        // Small pause between pages to avoid hammering OpenAI
        await new Promise(r => setTimeout(r, 1000));
      }

      setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ COMPLETE — ${totalProcessed} analyzed, ${totalSkipped} skipped, ${totalFailed} failed across ${pages} pages`]);
      setAnalysisDone(true);
    } catch (err: any) {
      setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ ERROR: ${err.message}`]);
      alert(`Error: ${err.message}`);
    } finally {
      setAnalysisRunning(false);
    }
  };

  /** Batched modern pipeline (shared prompts + barrel on wines). Throttled client-side. */
  const runModernSommelierQueue = async () => {
    const modeLabel =
      modernQueueMode === 'already_analyzed'
        ? 'only bottles that already have sommelier analysis (recommended rollout)'
        : modernQueueMode === 'stale_only'
          ? 'bottles whose analysis is older than 30 days'
          : 'every bottle in the cellar (expensive)';
    if (
      !confirm(
        `Run QUEUED modern sommelier re-analysis?\n\n` +
          `Scope: ${modeLabel}\n` +
          `Batch: ${modernQueueBatch} bottles per page\n` +
          `Pause: ${modernQueuePauseMs} ms between pages\n` +
          `Language: ${modernQueueLang}\n\n` +
          `Uses the same AI pipeline as the app (including barrel aging on wines).\n` +
          `Leaves this tab open until complete. Continue?`,
      )
    ) {
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session ?? contextSession;
    if (!session) {
      alert('Session expired — please refresh the page.');
      return;
    }

    setModernQueueRunning(true);
    setModernQueueDone(false);
    setModernQueueTotals({ processed: 0, skipped: 0, failed: 0, pages: 0 });
    setModernQueueLog([
      `[${new Date().toLocaleTimeString()}] Starting modern queue — mode: ${modernQueueMode}, batch: ${modernQueueBatch}, pause: ${modernQueuePauseMs}ms`,
    ]);

    let offset = 0;
    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let pages = 0;

    try {
      while (true) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backfill-analysis`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              mode: modernQueueMode,
              pipeline: 'modern',
              batchSize: modernQueueBatch,
              offset,
              language: modernQueueLang,
            }),
          },
        );

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt}`);
        }

        const data: AnalysisProgress = await res.json();
        pages++;
        totalProcessed += data.processedCount;
        totalSkipped += data.skippedCount;
        totalFailed += data.failedCount;
        offset = data.nextOffset;

        const logLine =
          `[${new Date().toLocaleTimeString()}] Page ${pages} — next offset ${offset} | ` +
          `✅ ${data.processedCount} processed, ⏭ ${data.skippedCount} skipped, ❌ ${data.failedCount} failed` +
          (data.pipeline ? ` [${data.pipeline}]` : '');
        setModernQueueLog((prev) => [...prev, logLine]);
        setModernQueueTotals({
          processed: totalProcessed,
          skipped: totalSkipped,
          failed: totalFailed,
          pages,
        });

        if (data.isComplete) break;

        await new Promise((r) => setTimeout(r, modernQueuePauseMs));
      }

      setModernQueueLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ✅ COMPLETE — ${totalProcessed} processed, ${totalSkipped} skipped, ${totalFailed} failed (${pages} pages)`,
      ]);
      setModernQueueDone(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setModernQueueLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ ERROR: ${message}`]);
      alert(`Error: ${message}`);
    } finally {
      setModernQueueRunning(false);
    }
  };

  /** One batch: fill missing `bottles.analysis_data.he` or `.en` only (Edge, no user credits). */
  const runLocaleAnalysisBackfillOnce = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session ?? contextSession;
    if (!session) {
      alert('Session expired — please refresh the page.');
      return;
    }

    if (!localeBfDryRun) {
      const ok = confirm(
        `Run locale analysis backfill?\n\n` +
          `Target: analysis_data.${localeBfLang}\n` +
          `Limit: ${localeBfLimit} bottles\n` +
          `Uses OpenAI (platform cost only). Does NOT charge user credits.\n` +
          `Only updates analysis_data — legacy columns unchanged.\n\nContinue?`,
      );
      if (!ok) return;
    }

    setLocaleBfRunning(true);
    setLocaleBfLog((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Calling admin-backfill-analysis-locales (dry_run=${localeBfDryRun})…`,
    ]);

    try {
      const afterTrim = localeBfAfter.trim();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-backfill-analysis-locales`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            target_language: localeBfLang,
            limit: localeBfLimit,
            dry_run: localeBfDryRun,
            after: afterTrim || null,
          }),
        },
      );

      const raw = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        throw new Error(`HTTP ${res.status}: ${raw.slice(0, 300)}`);
      }

      if (!res.ok) {
        throw new Error((data.error as string) || `HTTP ${res.status}: ${raw.slice(0, 300)}`);
      }

      setLocaleBfLast(data);
      const line =
        `[${new Date().toLocaleTimeString()}] ` +
        `candidates=${data.candidate_count ?? '?'} processed=${data.processed_count ?? 0} ` +
        `skipped=${data.skipped_count ?? 0} failed=${data.failed_count ?? 0} has_more=${String(data.has_more)} ` +
        `next_after=${data.next_after ?? 'null'}`;
      setLocaleBfLog((prev) => [...prev, line]);

      if (typeof data.next_after === 'string' && data.next_after) {
        setLocaleBfAfter(data.next_after);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setLocaleBfLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ ${message}`]);
      alert(`Error: ${message}`);
    } finally {
      setLocaleBfRunning(false);
    }
  };

  /** Call the Edge Function once for a given language + offset. */
  const callFpOnce = async (token: string, language: string, offset: number) => {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backfill-food-pairing`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({ batchSize: fpBatch, offset, force: fpForce, language }),
      },
    );
    if (!res.ok) { const txt = await res.text(); throw new Error(`HTTP ${res.status}: ${txt}`); }
    const data = await res.json();
    if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    return data as { processedCount: number; skippedCount: number; failedCount: number; fetchedCount: number; nextOffset: number; isComplete: boolean };
  };

  /** Loop through ALL wines for a given language until isComplete. */
  const runLanguagePass = async (token: string, lang: string) => {
    let offset = 0;
    let processed = 0; let skipped = 0; let failed = 0; let pages = 0;
    while (!fpAbortRef.current) {
      const data = await callFpOnce(token, lang, offset);
      pages++;
      processed += data.processedCount;
      skipped   += data.skippedCount;
      failed    += data.failedCount;
      offset     = data.nextOffset;
      const ts = new Date().toLocaleTimeString();
      setFpLog(prev => [...prev, `[${ts}] ${lang.toUpperCase()} page ${pages} offset=${offset} | ✅ ${data.processedCount} · ⏭ ${data.skippedCount} · ❌ ${data.failedCount}`]);
      setFpTotals(prev => ({ ...prev, [lang]: { processed, skipped, failed }, pages: prev.pages + 1 }));
      if (data.isComplete) break;
      await new Promise(r => setTimeout(r, 1500)); // pause between pages to avoid compute limits
    }
    return { processed, skipped, failed, pages };
  };

  /** Run English backfill then Hebrew backfill for ALL wines. */
  const runFoodPairingBackfill = async () => {
    if (!confirm(
      `This will generate food pairing for every wine in ${fpForce ? 'ALL' : 'missing-only'} mode.\n` +
      `Runs English first, then Hebrew. Keep this tab open.\n\nContinue?`
    )) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session ?? contextSession;
    if (!session) { alert('Session expired — please refresh the page.'); return; }

    fpAbortRef.current = false;
    setFpRunning(true);
    setFpDone(false);
    setFpError(null);
    setFpTotals({ en: { processed: 0, skipped: 0, failed: 0 }, he: { processed: 0, skipped: 0, failed: 0 }, pages: 0 });
    setFpLog([`[${new Date().toLocaleTimeString()}] Starting — English pass…`]);

    try {
      const token = await getFreshToken();
      await runLanguagePass(token, 'en');
      if (fpAbortRef.current) { setFpLog(prev => [...prev, '⚠️ Aborted.']); return; }
      setFpLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ English done. Starting Hebrew pass…`]);
      await runLanguagePass(token, 'he');
      setFpLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ All languages complete!`]);
      setFpDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFpLog(prev => [...prev, `❌ ERROR: ${msg}`]);
      setFpError(msg);
    } finally {
      setFpRunning(false);
    }
  };

  // Loading state
  if (isAdmin === null) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h1>🍷 Admin enrichment</h1>
        <p style={{ color: '#666', marginTop: '2rem' }}>Checking admin privileges...</p>
      </div>
    );
  }

  // Not admin - show error
  if (isAdmin === false) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1>🍷 Admin enrichment</h1>
        <div style={{
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          padding: '1.5rem',
          marginTop: '2rem',
          color: '#721c24'
        }}>
          <h3 style={{ marginTop: 0 }}>🚫 Access Denied</h3>
          <p>{adminError}</p>
          <p style={{ fontSize: '0.875rem', marginBottom: 0 }}>
            <strong>Your User ID:</strong> <code style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '3px' }}>{user?.id}</code>
          </p>
          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '1rem' }}>
            To become an admin, run this SQL in Supabase:
          </p>
          <pre style={{
            backgroundColor: '#2d2d2d',
            color: '#fff',
            padding: '1rem',
            borderRadius: '6px',
            fontSize: '0.75rem',
            overflow: 'auto'
          }}>
{`INSERT INTO public.admins (user_id) 
VALUES ('${user?.id}');`}
          </pre>
        </div>
      </div>
    );
  }

  // Admin user - show full interface
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🍷 Admin enrichment tools</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Internal batch jobs (admin only). Rule-based fixes run locally; Vivino jobs call external scrapers.
      </p>

      <div style={{
        backgroundColor: '#e7f3ff',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        border: '1px solid #b8daff',
      }}>
        <h2 style={{ marginTop: 0, fontSize: '1.15rem' }}>Rule-based wine metadata (grapes / style)</h2>
        <p style={{ color: '#444', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Heuristic corrections (e.g. Bordeaux vs wrong Italian varieties). Paginates the entire <code>wines</code> table.
          Dry-run first; review details, then apply.
          Rows that match the filter but get <strong>no</strong> rule-based update appear under <em>Examined, no change</em> with reasons (e.g. missing region keywords).
        </p>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
          <input
            type="checkbox"
            checked={rulesDryRun}
            onChange={(e) => setRulesDryRun(e.target.checked)}
            style={{ marginRight: '0.5rem' }}
          />
          <strong>Dry run</strong>
          <span style={{ marginLeft: '0.35rem', color: '#666', fontSize: '0.85rem' }}>(no DB writes)</span>
        </label>
        <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
          <strong>Filter</strong>{' '}
          <select
            value={rulesFilter}
            onChange={(e) => setRulesFilter(e.target.value as typeof rulesFilter)}
            style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem' }}
          >
            <option value="candidates">Candidates (missing/generic grapes OR suspicious)</option>
            <option value="missing_grapes">Missing or generic grapes only</option>
            <option value="suspicious">Suspicious grape vs region only</option>
          </select>
        </label>
        <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.9rem' }}>
          <strong>Rows per page</strong>{' '}
          <input
            type="number"
            min={5}
            max={80}
            value={rulesBatch}
            onChange={(e) => setRulesBatch(parseInt(e.target.value, 10) || 40)}
            style={{ width: '4rem', marginLeft: '0.5rem', padding: '0.25rem' }}
          />
        </label>
        <button
          type="button"
          onClick={runRulesBackfill}
          disabled={rulesRunning}
          style={{
            backgroundColor: rulesDryRun ? '#6c757d' : '#c82333',
            color: '#fff',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 'bold',
            cursor: rulesRunning ? 'not-allowed' : 'pointer',
            opacity: rulesRunning ? 0.65 : 1,
          }}
        >
          {rulesRunning ? 'Running…' : rulesDryRun ? 'Run dry-run (all pages)' : 'Apply updates (all pages)'}
        </button>
        {rulesTotals.pages > 0 && (
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#333' }}>
            Pages {rulesTotals.pages} · rows scanned {rulesTotals.fetched} · examined {rulesTotals.examined} ·{' '}
            {rulesDryRun ? 'would change' : 'changed'} {rulesTotals.mutations} · examined no change {rulesTotals.noChange}
            {rulesDone ? ' · ✅ finished' : ''}
          </p>
        )}
        {rulesLog.length > 0 && (
          <details style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Server log</summary>
            <pre style={{ fontSize: '0.72rem', maxHeight: 420, overflow: 'auto', background: '#fff', padding: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {rulesLog.join('\n')}
            </pre>
          </details>
        )}
        {rulesNoChangeDetails.length > 0 && (
          <details open style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Examined, no change ({rulesNoChangeDetails.length}) — why the engine skipped a write
            </summary>
            <div style={{ overflowX: 'auto', maxHeight: 360, marginTop: '0.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                <thead>
                  <tr style={{ background: '#856404', color: '#fff' }}>
                    <th style={{ padding: '0.35rem', textAlign: 'left' }}>Wine / id</th>
                    <th style={{ padding: '0.35rem', textAlign: 'left' }}>Grapes now</th>
                    <th style={{ padding: '0.35rem', textAlign: 'left' }}>Diagnostics</th>
                  </tr>
                </thead>
                <tbody>
                  {rulesNoChangeDetails.map((row, ri) => (
                    <tr key={`${row.wine_id}-nc-${ri}`} style={{ borderBottom: '1px solid #dee2e6', background: ri % 2 ? '#fffbf0' : '#fff' }}>
                      <td style={{ padding: '0.35rem', maxWidth: 200, verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600 }}>{row.wine_name}</div>
                        <div style={{ color: '#666' }}>{row.producer}</div>
                        <code style={{ fontSize: '0.62rem', display: 'block', wordBreak: 'break-all' }}>{row.wine_id}</code>
                      </td>
                      <td style={{ padding: '0.35rem', verticalAlign: 'top', maxWidth: 140 }}>
                        {(row.grapes_current ?? []).join(', ') || '(none)'}
                        {row.suspicion_flagged ? (
                          <div style={{ color: '#721c24', marginTop: '0.25rem' }}>⚠ {row.suspicion_reasons.join('; ')}</div>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.35rem', verticalAlign: 'top', color: '#333' }}>
                        {(row.diagnostic_lines ?? []).map((l, i) => (
                          <div key={i} style={{ marginBottom: '0.2rem' }}>{l}</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
        {rulesDetails.length > 0 && (
          <details open style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Would update / updated ({rulesDetails.length})
            </summary>
            <div style={{ overflowX: 'auto', maxHeight: 320, marginTop: '0.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                <thead>
                  <tr style={{ background: '#343a40', color: '#fff' }}>
                    <th style={{ padding: '0.35rem', textAlign: 'left' }}>Wine / id</th>
                    <th style={{ padding: '0.35rem', textAlign: 'left' }}>Mode / rule</th>
                    <th style={{ padding: '0.35rem', textAlign: 'left' }}>Grapes before → after</th>
                    <th style={{ padding: '0.35rem', textAlign: 'left' }}>Suspicion / mechanism</th>
                  </tr>
                </thead>
                <tbody>
                  {rulesDetails.map((row, ri) => (
                    <tr key={`${row.wine_id}-${ri}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '0.35rem', maxWidth: 180 }}>
                        <div style={{ fontWeight: 600 }}>{row.wine_name}</div>
                        <div style={{ color: '#666' }}>{row.producer}</div>
                        <code style={{ fontSize: '0.65rem', display: 'block', wordBreak: 'break-all' }} title="Full wine UUID — click log line to copy">{row.wine_id}</code>
                      </td>
                      <td style={{ padding: '0.35rem' }}>
                        <span style={{ fontSize: '0.65rem', color: '#555' }}>{row.mode ?? '—'}</span>
                        <br />
                        <span style={{ whiteSpace: 'nowrap' }}>{row.rule_id ?? '—'}</span>
                        <br />
                        <span style={{ fontSize: '0.65rem' }}>conf {row.confidence ?? '—'}</span>
                      </td>
                      <td style={{ padding: '0.35rem' }}>
                        <span style={{ color: '#999' }}>{(row.before_grapes ?? []).join(', ') || '—'}</span>
                        {' → '}
                        <span style={{ color: '#155724' }}>{(row.after_grapes ?? []).join(', ') || '—'}</span>
                      </td>
                      <td style={{ padding: '0.35rem', maxWidth: 280, fontSize: '0.68rem' }}>
                        {(row.suspicion_reasons ?? []).length ? (
                          <div style={{ marginBottom: '0.35rem', color: '#721c24' }}>{row.suspicion_reasons.join('; ')}</div>
                        ) : null}
                        {(row.mechanism_lines ?? []).slice(0, 2).map((l, i) => (
                          <div key={i} style={{ color: '#444' }}>{l}</div>
                        ))}
                        {(row.mechanism_lines ?? []).length > 2 ? <div style={{ color: '#888' }}>…see Server log</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #dee2e6' }} />

      <h2 style={{ fontSize: '1.15rem' }}>Batch Vivino enrichment</h2>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Fetch Vivino data for wines that have a Vivino URL. Choose whether to fill only missing fields or
        refresh everyone (e.g. updated ratings).
      </p>

      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '2rem',
      }}>
        <h3 style={{ marginTop: 0 }}>Settings</h3>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <strong>Scope:</strong>
          <select
            value={vivinoEnrichmentScope}
            onChange={(e) => setVivinoEnrichmentScope(e.target.value as 'missing_only' | 'refresh_all')}
            style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd', maxWidth: '100%' }}
          >
            <option value="missing_only">
              Missing data only — skip wines that already have rating, region, country, grapes, and style
            </option>
            <option value="refresh_all">
              Refresh all with Vivino URL — re-fetch and overwrite mapped fields (use for updated Vivino ratings)
            </option>
          </select>
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={isDryRun}
            onChange={(e) => setIsDryRun(e.target.checked)}
            style={{ marginRight: '0.5rem' }}
          />
          <span>
            <strong>Dry Run</strong> (Preview only - no data changes)
          </span>
        </label>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <strong>Max wines to process:</strong>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
            min="1"
            max="10000"
            style={{
              marginLeft: '0.5rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid #ddd',
            }}
          />
        </label>

        <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>
          ⏱️ Estimated time: <strong>{Math.ceil(limit / 60)} minutes</strong> (1 second per wine, 10 per chunk)
        </p>
      </div>

      <button
        onClick={runBatchEnrich}
        disabled={isRunning}
        style={{
          backgroundColor: isDryRun ? '#6c757d' : '#dc3545',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '8px',
          border: 'none',
          fontSize: '1rem',
          fontWeight: 'bold',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          opacity: isRunning ? 0.6 : 1,
          width: '100%',
          marginBottom: '2rem',
        }}
      >
        {isRunning ? '⏳ Processing...' : isDryRun ? '🔍 Preview (Dry Run)' : '🚀 Start Batch Enrichment'}
      </button>

      {isRunning && (
        <div style={{
          backgroundColor: '#fff3cd',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          textAlign: 'center',
        }}>
          <strong>⏳ Processing...</strong>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
            This will take several minutes. Don't close this page.
          </p>
        </div>
      )}

      {progress && (
        <div style={{
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem',
        }}>
          <h3 style={{ marginTop: 0, color: '#155724' }}>
            {isDryRun ? '🔍 Preview Results' : '✅ Enrichment Complete!'}
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem',
          }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{progress.total}</div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>Total Wines</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>
                {progress.enriched}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>Enriched</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6c757d' }}>
                {progress.skipped}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>Skipped</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc3545' }}>
                {progress.failed}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>Failed</div>
            </div>
          </div>

          {result?.summary && (
            <p style={{ margin: 0, fontSize: '0.875rem' }}>
              <strong>Success Rate:</strong> {result.summary.successRate}
            </p>
          )}

          {progress.errors && progress.errors.length > 0 && (
            <details style={{ marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                View Errors ({progress.errors.length})
              </summary>
              <div style={{
                marginTop: '0.5rem',
                maxHeight: '200px',
                overflow: 'auto',
                fontSize: '0.75rem',
              }}>
                {progress.errors.map((err, idx) => (
                  <div key={idx} style={{ padding: '0.25rem', borderBottom: '1px solid #eee' }}>
                    <strong>{err.wine_id}:</strong> {err.error}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Per-wine detail table for batch enrichment */}
      {progress?.details && progress.details.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>
            📋 Wine-by-Wine Breakdown ({progress.details.length} wines)
          </h3>
          <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            Click a DB Wine ID to copy it. Use the Vivino URL to verify the data on Vivino directly.
          </p>

          {/* Filter tabs */}
          {(['all', 'enriched', 'skipped', 'failed'] as const).map(filter => {
            const count = filter === 'all'
              ? progress.details.length
              : progress.details.filter(d => d.status === filter).length;
            return (
              <button
                key={filter}
                onClick={() => setDetailFilter(filter)}
                style={{
                  marginRight: '0.5rem',
                  marginBottom: '0.75rem',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  border: '1px solid #dee2e6',
                  cursor: 'pointer',
                  fontWeight: detailFilter === filter ? 'bold' : 'normal',
                  backgroundColor: detailFilter === filter
                    ? (filter === 'enriched' ? '#d4edda' : filter === 'skipped' ? '#e2e3e5' : filter === 'failed' ? '#f8d7da' : '#343a40')
                    : '#fff',
                  color: detailFilter === filter
                    ? (filter === 'enriched' ? '#155724' : filter === 'skipped' ? '#383d41' : filter === 'failed' ? '#721c24' : '#fff')
                    : '#495057',
                }}
              >
                {filter === 'all' ? '🔢' : filter === 'enriched' ? '✅' : filter === 'skipped' ? '⏭' : '❌'}{' '}
                {filter.charAt(0).toUpperCase() + filter.slice(1)} ({count})
              </button>
            );
          })}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#343a40', color: '#fff' }}>
                  {['Status', 'Wine Name', 'Producer', 'Vintage', 'DB Wine ID', 'Vivino URL', 'Info'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {progress.details
                  .filter(row => detailFilter === 'all' || row.status === detailFilter)
                  .map((row, i) => {
                    const statusIcon = row.status === 'enriched' ? '✅' : row.status === 'failed' ? '❌' : '⏭';
                    const rowBg = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
                    const info = row.status === 'enriched'
                      ? <span style={{ color: '#28a745' }}>Updated: {row.fields_updated?.join(', ') ?? '—'}</span>
                      : row.status === 'failed'
                      ? <span style={{ color: '#dc3545' }}>{row.error}</span>
                      : <span style={{ color: '#6c757d' }}>{row.skip_reason}</span>;
                    return (
                      <tr key={row.wine_id} style={{ backgroundColor: rowBg, borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '0.4rem 0.75rem', whiteSpace: 'nowrap' }}>{statusIcon} {row.status}</td>
                        <td style={{ padding: '0.4rem 0.75rem', fontWeight: 500 }}>{row.wine_name}</td>
                        <td style={{ padding: '0.4rem 0.75rem' }}>{row.producer || '—'}</td>
                        <td style={{ padding: '0.4rem 0.75rem', whiteSpace: 'nowrap' }}>{row.vintage ?? '—'}</td>
                        <td
                          style={{ padding: '0.4rem 0.75rem', fontFamily: 'monospace', fontSize: '0.68rem', whiteSpace: 'nowrap', cursor: 'pointer', color: '#0066cc' }}
                          title="Click to copy"
                          onClick={() => navigator.clipboard?.writeText(row.wine_id)}
                        >
                          {row.wine_id.slice(0, 8)}…
                        </td>
                        <td style={{ padding: '0.4rem 0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.vivino_url
                            ? <a href={row.vivino_url} target="_blank" rel="noreferrer" style={{ color: '#007bff' }} title={row.vivino_url}>
                                {row.vivino_url.replace('https://www.vivino.com', '…')}
                              </a>
                            : <span style={{ color: '#999' }}>—</span>
                          }
                        </td>
                        <td style={{ padding: '0.4rem 0.75rem', minWidth: '200px' }}>{info}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '1rem',
        borderRadius: '8px',
        fontSize: '0.875rem',
      }}>
        <h4 style={{ marginTop: 0 }}>ℹ️ How it works:</h4>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li>
            <strong>Missing data only</strong>: wines with a Vivino URL and at least one empty field among
            rating, region, country, grapes, regional style
          </li>
          <li>
            <strong>Refresh all</strong>: every wine with a Vivino URL; writes current Vivino values for those
            fields (more API calls — use occasionally)
          </li>
          <li>Fetches details via the <code>fetch-vivino-data</code> function</li>
          <li>
            Requires admin (<code>is_admin</code>). Deploy <code>batch-enrich-vivino</code> after pulling this code.
          </li>
          <li>~1 second delay between each Vivino fetch inside a chunk (stays within edge time limits)</li>
        </ul>
        <p style={{ fontSize: '0.875rem', color: '#856404', backgroundColor: '#fff3cd', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
          <strong>💡 Tip:</strong> This only enriches wines with existing Vivino URLs. 
          Use the "Fetch Data" button in the bottle form to add Vivino URLs first.
        </p>
      </div>

      {/* ── Find Missing Vivino IDs ──────────────────────────────────────────── */}
      <hr style={{ margin: '2rem 0', borderColor: '#dee2e6' }} />
      <h2 style={{ fontSize: '1.15rem' }}>Find Missing Vivino IDs</h2>
      <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        For wines that have no <code>vivino_wine_id</code> yet (e.g. added before auto-match, or with a
        search-only URL), this job calls <code>search-vivino-wine</code> for each one and saves the discovered
        wine ID + a canonical <code>/w/&#123;id&#125;</code> URL back to the database.
        Run the SQL migration first to handle easy cases automatically, then use this for the rest.
      </p>

      <div style={{ backgroundColor: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0' }}>
          <input
            type="checkbox"
            checked={missingIdsDryRun}
            onChange={e => setMissingIdsDryRun(e.target.checked)}
            style={{ marginRight: '0.5rem' }}
          />
          <strong>Dry run</strong>
          <span style={{ marginLeft: '0.35rem', color: '#666', fontSize: '0.85rem' }}>(preview only — no DB writes)</span>
        </label>
      </div>

      <button
        type="button"
        onClick={runMissingVivinoIds}
        disabled={missingIdsRunning}
        style={{
          backgroundColor: missingIdsRunning ? '#6c757d' : missingIdsDryRun ? '#6c757d' : '#8b1a1a',
          color: '#fff',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          border: 'none',
          fontWeight: 'bold',
          fontSize: '0.95rem',
          cursor: missingIdsRunning ? 'not-allowed' : 'pointer',
          opacity: missingIdsRunning ? 0.65 : 1,
          marginBottom: '1.5rem',
        }}
      >
        {missingIdsRunning ? '⏳ Running…' : missingIdsDryRun ? '🔍 Preview (Dry Run)' : '🔎 Find Missing Vivino IDs'}
      </button>

      {(missingIdsRunning || missingIdsDone) && (
        <div style={{
          backgroundColor: missingIdsDone ? '#d4edda' : '#fff3cd',
          border: `1px solid ${missingIdsDone ? '#c3e6cb' : '#ffc107'}`,
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <strong>{missingIdsDone ? '✅ Complete!' : '⏳ In progress…'}</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginTop: '0.75rem' }}>
            {[
              { label: 'Pages',     value: missingIdsTotals.pages,     color: '#495057' },
              { label: 'Processed', value: missingIdsTotals.processed,  color: '#495057' },
              { label: 'Found',     value: missingIdsTotals.enriched,   color: '#28a745' },
              { label: 'Skipped',   value: missingIdsTotals.skipped,    color: '#6c757d' },
              { label: 'Failed',    value: missingIdsTotals.failed,     color: '#dc3545' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color }}>{value}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {missingIdsLog.length > 0 && (
        <pre style={{
          backgroundColor: '#1e1e1e', color: '#d4d4d4', padding: '1rem',
          borderRadius: '8px', fontSize: '0.75rem', maxHeight: '200px',
          overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: '1rem',
        }}>
          {missingIdsLog.join('\n')}
        </pre>
      )}

      {/* ── Fetch Vivino Images ──────────────────────────────────────────────── */}
      <hr style={{ margin: '3rem 0', borderColor: '#dee2e6' }} />

      <h1>🖼️ Fetch Vivino Images</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Download wine label images from Vivino and store them permanently in Supabase Storage.
        Only processes wines that already have a Vivino URL but <strong>no existing image</strong> —
        never overwrites user-uploaded photos.
        Runs in small chunks to avoid timeouts.
      </p>

      <div style={{ backgroundColor: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0 }}>Settings</h3>
        <label style={{ display: 'block', marginBottom: '0' }}>
          <strong>Wines per chunk:</strong>
          <input
            type="number"
            value={imageBatch}
            onChange={e => setImageBatch(Math.min(15, Math.max(1, parseInt(e.target.value) || 10)))}
            min="1" max="15"
            style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd', width: '60px' }}
          />
          <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.875rem' }}>max 15 (recommended: 10)</span>
        </label>
        <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.75rem 0 0 0' }}>
          ⏱️ Each chunk takes ~<strong>{imageBatch * 4} seconds</strong> ({imageBatch} wines × ~4s each).
          The frontend loops automatically until all wines are done.
        </p>
      </div>

      <button
        onClick={runImageEnrich}
        disabled={imageRunning}
        style={{
          backgroundColor: imageRunning ? '#6c757d' : '#e67e22',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '8px',
          border: 'none',
          fontSize: '1rem',
          fontWeight: 'bold',
          cursor: imageRunning ? 'not-allowed' : 'pointer',
          opacity: imageRunning ? 0.7 : 1,
          width: '100%',
          marginBottom: '2rem',
        }}
      >
        {imageRunning ? '⏳ Fetching images… (do not close this tab)' : '🖼️ Start Vivino Image Fetch'}
      </button>

      {/* Image enrich totals */}
      {(imageRunning || imageDone) && (
        <div style={{
          backgroundColor: imageDone ? '#d4edda' : '#fff3cd',
          border: `1px solid ${imageDone ? '#c3e6cb' : '#ffc107'}`,
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ marginTop: 0 }}>{imageDone ? '✅ Complete!' : '⏳ In progress…'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
            {[
              { label: 'Chunks',    value: imageTotals.pages,     color: '#495057' },
              { label: 'Processed', value: imageTotals.processed,  color: '#495057' },
              { label: 'Uploaded',  value: imageTotals.uploaded,   color: '#28a745' },
              { label: 'Skipped',   value: imageTotals.skipped,    color: '#6c757d' },
              { label: 'Failed',    value: imageTotals.failed,     color: '#dc3545' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color }}>{value}</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image enrich live log */}
      {imageLog.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>📋 Log</h4>
          <pre style={{
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            padding: '1rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            maxHeight: '250px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {imageLog.join('\n')}
          </pre>
        </div>
      )}

      {/* Per-wine detail table */}
      {imageDetails.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>
            📋 Wine Details ({imageDetails.length} processed)
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#343a40', color: '#fff' }}>
                  {['Status', 'Wine', 'Producer', 'Vintage', 'User ID', 'Info'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imageDetails.map((row, i) => {
                  const statusIcon = row.status === 'uploaded' ? '✅' : row.status === 'failed' ? '❌' : '⏭';
                  const rowBg = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
                  const info = row.status === 'uploaded'
                    ? <a href={row.image_url!} target="_blank" rel="noreferrer" style={{ color: '#007bff', wordBreak: 'break-all' }}>View image</a>
                    : row.status === 'failed'
                    ? <span style={{ color: '#dc3545' }}>{row.error}</span>
                    : <span style={{ color: '#6c757d' }}>{row.skip_reason}</span>;
                  return (
                    <tr key={row.wine_id} style={{ backgroundColor: rowBg, borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '0.4rem 0.75rem', whiteSpace: 'nowrap' }}>{statusIcon} {row.status}</td>
                      <td style={{ padding: '0.4rem 0.75rem' }}>{row.wine_name}</td>
                      <td style={{ padding: '0.4rem 0.75rem' }}>{row.producer ?? '—'}</td>
                      <td style={{ padding: '0.4rem 0.75rem', whiteSpace: 'nowrap' }}>{row.vintage ?? '—'}</td>
                      <td style={{ padding: '0.4rem 0.75rem', fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{row.user_id}</td>
                      <td style={{ padding: '0.4rem 0.75rem' }}>{info}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1rem' }}>
        <h4 style={{ marginTop: 0 }}>ℹ️ How it works</h4>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li>Finds wines with a Vivino URL that have <strong>no image at all</strong> (image_path, label_image_path, and image_url all null)</li>
          <li>Scrapes the Vivino page to find the label image CDN URL</li>
          <li>Downloads the image binary and uploads it to Supabase Storage (<code>labels/vivino/</code>)</li>
          <li>Stores the permanent public URL back in the <code>wines</code> table</li>
          <li>Processes {imageBatch} wines per chunk — the frontend loops automatically</li>
          <li>Safe to re-run: already-imaged wines are automatically skipped</li>
        </ul>
      </div>

      {/* ── Analyze All Cellars ─────────────────────────────────────────────── */}
      <hr style={{ margin: '3rem 0', borderColor: '#dee2e6' }} />

      <h1>🤖 Analyze All Cellars (AI Sommelier)</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Run GPT-4o-mini sommelier analysis for every bottle across all users.
        Processes in pages — you can leave this running; progress is logged below.
      </p>

      <div style={{ backgroundColor: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0 }}>Settings</h3>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <strong>Mode:</strong>
          <select
            value={analysisMode}
            onChange={e => setAnalysisMode(e.target.value as any)}
            style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="missing_only">missing_only — only bottles without any analysis (recommended)</option>
            <option value="stale_only">stale_only — re-analyze bottles older than 30 days</option>
            <option value="force_all">force_all — re-analyze everything (expensive!)</option>
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: '0' }}>
          <strong>Batch size (bottles per page):</strong>
          <input
            type="number"
            value={analysisBatch}
            onChange={e => setAnalysisBatch(Math.min(100, Math.max(1, parseInt(e.target.value) || 50)))}
            min="1" max="100"
            style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd', width: '70px' }}
          />
          <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.875rem' }}>max 100</span>
        </label>
      </div>

      <button
        onClick={runAnalysisBackfill}
        disabled={analysisRunning}
        style={{
          backgroundColor: analysisRunning ? '#6c757d' : '#7c3aed',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '8px',
          border: 'none',
          fontSize: '1rem',
          fontWeight: 'bold',
          cursor: analysisRunning ? 'not-allowed' : 'pointer',
          opacity: analysisRunning ? 0.7 : 1,
          width: '100%',
          marginBottom: '2rem',
        }}
      >
        {analysisRunning ? '⏳ Running… (do not close this tab)' : '🚀 Start Analysis Backfill'}
      </button>

      {/* Totals */}
      {(analysisRunning || analysisDone) && (
        <div style={{
          backgroundColor: analysisDone ? '#d4edda' : '#fff3cd',
          border: `1px solid ${analysisDone ? '#c3e6cb' : '#ffc107'}`,
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ marginTop: 0 }}>{analysisDone ? '✅ Complete!' : '⏳ In progress…'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              { label: 'Pages',     value: analysisTotals.pages,     color: '#495057' },
              { label: 'Analyzed',  value: analysisTotals.processed, color: '#28a745' },
              { label: 'Skipped',   value: analysisTotals.skipped,   color: '#6c757d' },
              { label: 'Failed',    value: analysisTotals.failed,    color: '#dc3545' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color }}>{value}</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live log */}
      {analysisLog.length > 0 && (
        <div>
          <h4 style={{ marginBottom: '0.5rem' }}>📋 Log</h4>
          <pre style={{
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            padding: '1rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            maxHeight: '300px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {analysisLog.join('\n')}
          </pre>
        </div>
      )}

      <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', fontSize: '0.875rem', marginTop: '1.5rem' }}>
        <h4 style={{ marginTop: 0 }}>ℹ️ Notes</h4>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li><strong>missing_only</strong> is cheapest — skips bottles that already have analysis</li>
          <li>Each bottle costs ~1 OpenAI API call (gpt-4o-mini, very cheap)</li>
          <li>Processing pauses 1 second between pages to avoid rate limits</li>
          <li>Safe to stop and re-run — already-analyzed bottles are skipped automatically in missing_only mode</li>
          <li>Results appear in the user's cellar immediately after each page</li>
        </ul>
      </div>

      {/* ── Queued modern re-analysis (barrel + current app prompts) ─────────── */}
      <hr style={{ margin: '3rem 0', borderColor: '#dee2e6' }} />

      <h1>🔄 Queued modern sommelier refresh</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        For users who already had analysis before barrel aging and newer prompts existed. Runs the{' '}
        <strong>same pipeline as bulk analyze in the app</strong> (including <code>wines.barrel_aging_*</code>
        ), in small pages with pauses so OpenAI and the database are not overwhelmed.
      </p>

      <div style={{ backgroundColor: '#e8f4fd', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #b8daff' }}>
        <h3 style={{ marginTop: 0 }}>Settings</h3>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <strong>Scope:</strong>
          <select
            value={modernQueueMode}
            onChange={(e) => setModernQueueMode(e.target.value as typeof modernQueueMode)}
            style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="already_analyzed">
              Already analyzed only — bottles with existing sommelier notes (rollout default)
            </option>
            <option value="stale_only">Stale only — analysis older than 30 days</option>
            <option value="force_all">All bottles — re-run everyone (very expensive)</option>
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <strong>Bottles per page:</strong>
          <input
            type="number"
            value={modernQueueBatch}
            onChange={(e) =>
              setModernQueueBatch(Math.min(50, Math.max(5, parseInt(e.target.value, 10) || 25)))
            }
            min={5}
            max={50}
            style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd', width: '70px' }}
          />
          <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.875rem' }}>5–50 (lower = gentler)</span>
        </label>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <strong>Pause between pages (ms):</strong>
          <input
            type="number"
            value={modernQueuePauseMs}
            onChange={(e) =>
              setModernQueuePauseMs(Math.min(10000, Math.max(500, parseInt(e.target.value, 10) || 2000)))
            }
            min={500}
            max={10000}
            step={100}
            style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd', width: '90px' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '0' }}>
          <strong>Analysis language:</strong>
          <select
            value={modernQueueLang}
            onChange={(e) => setModernQueueLang(e.target.value as 'en' | 'he')}
            style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="en">English</option>
            <option value="he">Hebrew</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={runModernSommelierQueue}
        disabled={modernQueueRunning}
        style={{
          backgroundColor: modernQueueRunning ? '#6c757d' : '#0d6efd',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '8px',
          border: 'none',
          fontSize: '1rem',
          fontWeight: 'bold',
          cursor: modernQueueRunning ? 'not-allowed' : 'pointer',
          opacity: modernQueueRunning ? 0.7 : 1,
          width: '100%',
          marginBottom: '2rem',
        }}
      >
        {modernQueueRunning ? '⏳ Queue running… (keep this tab open)' : '🚀 Start queued modern refresh'}
      </button>

      {(modernQueueRunning || modernQueueDone) && (
        <div
          style={{
            backgroundColor: modernQueueDone ? '#d4edda' : '#fff3cd',
            border: `1px solid ${modernQueueDone ? '#c3e6cb' : '#ffc107'}`,
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0 }}>{modernQueueDone ? '✅ Queue finished' : '⏳ In progress…'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              { label: 'Pages', value: modernQueueTotals.pages, color: '#495057' },
              { label: 'Processed', value: modernQueueTotals.processed, color: '#28a745' },
              { label: 'Skipped', value: modernQueueTotals.skipped, color: '#6c757d' },
              { label: 'Failed', value: modernQueueTotals.failed, color: '#dc3545' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color }}>{value}</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modernQueueLog.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>📋 Modern queue log</h4>
          <pre
            style={{
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              padding: '1rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              maxHeight: '320px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {modernQueueLog.join('\n')}
          </pre>
        </div>
      )}

      <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '2rem' }}>
        <h4 style={{ marginTop: 0 }}>ℹ️ How the queue behaves</h4>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li>Server runs up to <strong>2 bottles in parallel</strong> per page (modern pipeline).</li>
          <li>Your browser waits between pages — tune pause if you hit rate limits.</li>
          <li>
            <strong>Already analyzed only</strong> skips bottles that never had a summary; use this to add barrel
            data without paying for untouched inventory.
          </li>
          <li>Deploy <code>backfill-analysis</code> after pulling this code.</li>
        </ul>
      </div>

      {/* ── Missing analysis_data locale (admin, no user credits) ───────────── */}
      <hr style={{ margin: '3rem 0', borderColor: '#dee2e6' }} />

      <h1>🌐 Missing localized analysis (analysis_data)</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Fills only <code>bottles.analysis_data.en</code> or <code>.he</code> for bottles that already have analysis
        elsewhere but are missing that locale slice. Does <strong>not</strong> charge user credits, does{' '}
        <strong>not</strong> update legacy flat columns. Requires an <code>admins</code> row, migration{' '}
        <code>20260517_admin_pick_bottles_missing_analysis_locale.sql</code>, and deployed Edge{' '}
        <code>admin-backfill-analysis-locales</code>.
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'flex-end',
          marginBottom: '1rem',
        }}
      >
        <label>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Target locale</div>
          <select
            value={localeBfLang}
            onChange={(e) => setLocaleBfLang(e.target.value as 'he' | 'en')}
            disabled={localeBfRunning}
          >
            <option value="he">analysis_data.he</option>
            <option value="en">analysis_data.en</option>
          </select>
        </label>
        <label>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Limit (max 50)</div>
          <input
            type="number"
            min={1}
            max={50}
            value={localeBfLimit}
            onChange={(e) => setLocaleBfLimit(Math.min(50, Math.max(1, Number(e.target.value) || 25)))}
            disabled={localeBfRunning}
            style={{ width: '5rem' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <input
            type="checkbox"
            checked={localeBfDryRun}
            onChange={(e) => setLocaleBfDryRun(e.target.checked)}
            disabled={localeBfRunning}
          />
          <span>Dry run (no OpenAI / no DB writes)</span>
        </label>
        <label style={{ flex: '1 1 220px' }}>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Resume cursor (next_after UUID, optional)</div>
          <input
            type="text"
            value={localeBfAfter}
            onChange={(e) => setLocaleBfAfter(e.target.value)}
            placeholder="Leave empty to start from beginning"
            disabled={localeBfRunning}
            style={{ width: '100%' }}
          />
        </label>
        <button
          type="button"
          onClick={() => void runLocaleAnalysisBackfillOnce()}
          disabled={localeBfRunning || isAdmin !== true}
          style={{
            padding: '0.6rem 1rem',
            backgroundColor: localeBfRunning ? '#6c757d' : '#198754',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: localeBfRunning ? 'not-allowed' : 'pointer',
          }}
        >
          {localeBfRunning ? 'Running…' : localeBfDryRun ? 'Preview batch (dry run)' : 'Run one batch'}
        </button>
      </div>

      <pre
        style={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          padding: '1rem',
          borderRadius: '8px',
          fontSize: '0.72rem',
          overflowX: 'auto',
          marginBottom: '1rem',
        }}
      >{`-- Count missing Hebrew slice (SQL editor)
SELECT count(*) AS missing_he
FROM public.bottles b
WHERE b.quantity > 0 AND NOT (b.id::text LIKE 'demo-%') AND b.readiness_label IS NOT NULL
  AND (
    (b.analysis_summary IS NOT NULL AND trim(b.analysis_summary) <> '')
    OR (b.analysis_data IS NOT NULL AND (
      (b.analysis_data ? 'en' AND length(trim(b.analysis_data->'en'->>'summary')) > 0)
      OR (b.analysis_data ? 'he' AND length(trim(b.analysis_data->'he'->>'summary')) > 0)
    ))
  )
  AND (
    b.analysis_data IS NULL OR NOT (b.analysis_data ? 'he')
    OR length(trim(coalesce(b.analysis_data->'he'->>'summary', ''))) = 0
  );

-- Count missing English: repeat the last AND block with 'en' instead of 'he'.

-- Fully localized (both summaries non-empty):
SELECT count(*) AS fully_localized
FROM public.bottles b
WHERE b.quantity > 0 AND NOT (b.id::text LIKE 'demo-%')
  AND b.analysis_data IS NOT NULL
  AND b.analysis_data ? 'en' AND length(trim(b.analysis_data->'en'->>'summary')) > 0
  AND b.analysis_data ? 'he' AND length(trim(b.analysis_data->'he'->>'summary')) > 0;`}
      </pre>

      {localeBfLog.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Locale backfill log</h4>
          <pre
            style={{
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              padding: '1rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              maxHeight: '240px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {localeBfLog.join('\n')}
          </pre>
        </div>
      )}

      {localeBfLast && (
        <details style={{ marginBottom: '2rem' }}>
          <summary style={{ cursor: 'pointer' }}>Last response (JSON)</summary>
          <pre
            style={{
              backgroundColor: '#f8f9fa',
              padding: '1rem',
              borderRadius: '6px',
              fontSize: '0.7rem',
              overflowX: 'auto',
              maxHeight: '320px',
              overflowY: 'auto',
            }}
          >
            {JSON.stringify(localeBfLast, null, 2)}
          </pre>
        </details>
      )}

      {/* ── Food pairing backfill (wines.food_pairing) ─────────────────────── */}
      <hr style={{ margin: '3rem 0', borderColor: '#dee2e6' }} />

      <h1>🍽️ Food pairing backfill</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Generates <code>food_pairing</code> JSON for <strong>every wine, in every language</strong> (English + Hebrew).
        Click the button below — it loops through the entire wines table automatically, English first then Hebrew.
        No browser loop needed after setup; pg_cron handles ongoing new wines.
      </p>

      {/* ── Step 1: pg_cron setup ─────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: '#e8f4fd',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          border: '1px solid #b8daff',
        }}
      >
        <h3 style={{ marginTop: 0 }}>🕒 Step 1 — Set up automatic queue (pg_cron)</h3>
        <p style={{ fontSize: '0.9rem', color: '#444', marginBottom: '1rem' }}>
          Run <strong>once</strong> in the{' '}
          <a href="https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/editor" target="_blank" rel="noreferrer">
            Supabase SQL editor
          </a>
          . After this, Supabase will automatically process ~15 wines every 5 minutes until all are done.
          When the backlog is clear, each run completes instantly (no wines to process).
        </p>
        <ol style={{ fontSize: '0.9rem', color: '#444', marginBottom: '1rem', paddingLeft: '1.5rem' }}>
          <li>
            Copy your <strong>anon / publishable</strong> key from{' '}
            <a href="https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/settings/api" target="_blank" rel="noreferrer">
              Settings → API
            </a>
            . Supabase requires <code>Authorization: Bearer &lt;anon key&gt;</code> on every Edge Function call (
            <a href="https://supabase.com/docs/guides/functions/schedule-functions" target="_blank" rel="noreferrer">
              docs
            </a>
            ).
          </li>
          <li>
            Pick a random secret for <code>BACKFILL_CRON_SECRET</code> (e.g. <code>openssl rand -hex 20</code>).
          </li>
          <li>
            Add it as an Edge Function secret in the{' '}
            <a href="https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/functions" target="_blank" rel="noreferrer">
              Supabase dashboard
            </a>{' '}
            → Edge Functions → <code>backfill-food-pairing</code> → Secrets → <code>BACKFILL_CRON_SECRET</code>.
          </li>
          <li>
            Run the SQL below — replace <code>YOUR_ANON_KEY</code>, <code>YOUR_CRON_SECRET</code>, and double-check the URL uses{' '}
            <code>pktelrzyllbwrmcfgocx</code> (with <strong>te</strong>, not <strong>tl</strong>).
          </li>
        </ol>
        <pre
          style={{
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            padding: '1rem',
            borderRadius: '6px',
            fontSize: '0.75rem',
            overflowX: 'auto',
            whiteSpace: 'pre',
            marginBottom: '1rem',
          }}
        >{`SELECT cron.schedule(
  'food-pairing-backfill',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://pktelrzyllbwrmcfgocx.supabase.co/functions/v1/backfill-food-pairing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY',
      'apikey', 'YOUR_ANON_KEY',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body    := '{"batchSize": 15}'::jsonb
  );
  $$
);`}
        </pre>
        <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.75rem' }}>
          After a one-off <code>net.http_post</code>, the number it returns is only the <strong>request queue id</strong> — wait a few seconds, then inspect the real HTTP result:{' '}
          <code style={{ fontSize: '0.78rem' }}>
            SELECT id, status_code, left(content::text, 500) FROM net._http_response ORDER BY id DESC LIMIT 5;
          </code>
        </p>
        <p style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}>
          To pause once done:{' '}
          <code>SELECT cron.unschedule(&apos;food-pairing-backfill&apos;);</code>
          &nbsp;· To check progress:{' '}
          <code>SELECT COUNT(*) FROM public.wines WHERE food_pairing IS NULL;</code>
        </p>
      </div>

      {/* ── Run full backfill (all languages, all wines) ─────────────────── */}
      <div
        style={{
          backgroundColor: '#fff8f0',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          border: '1px solid #ffd8b8',
        }}
      >
        <h3 style={{ marginTop: 0 }}>🌍 Run full backfill — English + Hebrew for all wines</h3>
        <p style={{ fontSize: '0.9rem', color: '#444', marginBottom: '1rem' }}>
          Loops through <strong>all wines</strong>, generating English first then Hebrew. Already-generated
          pairings are skipped unless "Force regenerate" is checked. Keep this tab open.
        </p>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.9rem' }}>
            <strong>Wines per page:</strong>
            <input
              type="number"
              value={fpBatch}
              onChange={(e) => setFpBatch(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 5)))}
              min={1}
              max={10}
              style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd', width: '65px' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={fpForce} onChange={(e) => setFpForce(e.target.checked)} />
            <span>Force regenerate (re-run even if already set — expensive)</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={runFoodPairingBackfill}
            disabled={fpRunning}
            style={{
              backgroundColor: fpRunning ? '#6c757d' : '#c45c26',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.95rem',
              fontWeight: 'bold',
              cursor: fpRunning ? 'not-allowed' : 'pointer',
              opacity: fpRunning ? 0.7 : 1,
            }}
          >
            {fpRunning ? '⏳ Running… (keep tab open)' : '🚀 Start backfill — all wines, all languages'}
          </button>
          {fpRunning && (
            <button
              type="button"
              onClick={() => { fpAbortRef.current = true; }}
              style={{ backgroundColor: '#dc3545', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ⏹ Stop
            </button>
          )}
        </div>

        {fpError && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8d7da', borderRadius: '6px', color: '#721c24', fontSize: '0.875rem' }}>
            ❌ {fpError}
          </div>
        )}

        {/* Progress per language */}
        {(fpRunning || fpDone) && (
          <div style={{
            backgroundColor: fpDone ? '#d4edda' : '#fff3cd',
            border: `1px solid ${fpDone ? '#c3e6cb' : '#ffc107'}`,
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
          }}>
            <strong>{fpDone ? '✅ All done!' : '⏳ In progress…'}</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.75rem' }}>
              {(['en', 'he'] as const).map(lang => (
                <div key={lang} style={{ background: 'rgba(255,255,255,0.6)', borderRadius: '6px', padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#555', marginBottom: '0.25rem' }}>
                    {lang === 'en' ? '🇬🇧 English' : '🇮🇱 Hebrew'}
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#28a745' }}>{fpTotals[lang].processed}</div>
                  <div style={{ fontSize: '0.7rem', color: '#666' }}>
                    paired · {fpTotals[lang].skipped} skipped · {fpTotals[lang].failed} failed
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live log */}
        {fpLog.length > 0 && (
          <pre style={{
            backgroundColor: '#1e1e1e', color: '#d4d4d4', padding: '1rem',
            borderRadius: '8px', fontSize: '0.72rem', maxHeight: '250px',
            overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 0,
          }}>
            {fpLog.join('\n')}
          </pre>
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <AdminHeTranslationsBackfill />
      </div>
    </div>
  );
};

