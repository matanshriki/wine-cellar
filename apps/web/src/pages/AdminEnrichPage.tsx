import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/SupabaseAuthContext';

interface BatchProgress {
  total: number;
  processed: number;
  enriched: number;
  failed: number;
  skipped: number;
  errors: Array<{ wine_id: string; error: string }>;
}

interface AnalysisProgress {
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  fetchedCount: number;
  nextOffset: number;
  isComplete: boolean;
}

export const AdminEnrichPage: React.FC = () => {
  const { user, session: contextSession } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [limit, setLimit] = useState(100);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  // ── Analyze All Cellars state ──────────────────────────────────────────────
  const [analysisRunning, setAnalysisRunning]   = useState(false);
  const [analysisMode,    setAnalysisMode]       = useState<'missing_only' | 'stale_only' | 'force_all'>('missing_only');
  const [analysisBatch,   setAnalysisBatch]      = useState(50);
  const [analysisTotals,  setAnalysisTotals]     = useState({ processed: 0, skipped: 0, failed: 0, pages: 0 });
  const [analysisLog,     setAnalysisLog]        = useState<string[]>([]);
  const [analysisDone,    setAnalysisDone]       = useState(false);

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

  const runBatchEnrich = async () => {
    if (!user) {
      alert('You must be logged in to run batch enrichment');
      return;
    }

    if (!isDryRun && !confirm(
      `⚠️ This will fetch Vivino data for up to ${limit} wines.\n\n` +
      `It will take approximately ${Math.ceil((limit * 2) / 60)} minutes.\n\n` +
      `Continue?`
    )) {
      return;
    }

    setIsRunning(true);
    setProgress(null);
    setResult(null);

    try {
      console.log('[Admin Enrich] ========== STARTING REQUEST ==========');
      console.log('[Admin Enrich] User:', user?.id);
      console.log('[Admin Enrich] Dry run:', isDryRun);
      console.log('[Admin Enrich] Limit:', limit);
      
      // Use session from context (more reliable than getSession)
      console.log('[Admin Enrich] Step 1: Checking session from context...');
      let session = contextSession;
      
      console.log('[Admin Enrich] Session from context:', !!session);
      console.log('[Admin Enrich] Session expires at:', session?.expires_at);
      
      if (!session) {
        console.log('[Admin Enrich] No session in context, fetching fresh...');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !sessionData.session) {
          console.error('[Admin Enrich] ❌ Failed to get session:', sessionError);
          throw new Error('Session expired. Please refresh the page and try again.');
        }
        
        session = sessionData.session;
        console.log('[Admin Enrich] ✅ Got fresh session');
      }

      // Check if session is expired or about to expire
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;
      const timeUntilExpiry = expiresAt - now;
      
      console.log('[Admin Enrich] Time until token expiry:', timeUntilExpiry, 'seconds');
      
      if (timeUntilExpiry < 60) {
        console.log('[Admin Enrich] Token expiring soon, refreshing...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          console.error('[Admin Enrich] ❌ Refresh failed:', refreshError);
          throw new Error('Failed to refresh session. Please refresh the page and try again.');
        }
        
        session = refreshData.session;
        console.log('[Admin Enrich] ✅ Session refreshed');
      }

      console.log('[Admin Enrich] Step 2: Calling Edge Function...');
      console.log('[Admin Enrich] Token length:', session.access_token.length);
      console.log('[Admin Enrich] Token prefix:', session.access_token.substring(0, 30) + '...');
      console.log('[Admin Enrich] Token suffix:', '...' + session.access_token.substring(session.access_token.length - 30));
      console.log('[Admin Enrich] URL:', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-enrich-vivino`);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-enrich-vivino`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ dryRun: isDryRun, limit }),
        }
      );

      console.log('[Admin Enrich] Step 3: Response received');
      console.log('[Admin Enrich] Status:', response.status);
      console.log('[Admin Enrich] OK:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Admin Enrich] Error response:', errorText);
        
        // Try to parse JSON error
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || errorJson.message || `HTTP ${response.status}`);
        } catch {
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('[Admin Enrich] Success:', data);
      setResult(data);
      setProgress(data.progress);
    } catch (error) {
      console.error('[Admin Enrich] Error:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  // ── Analyze All Cellars handler (loops until complete) ────────────────────
  const runAnalysisBackfill = async () => {
    if (!confirm(
      `This will run AI sommelier analysis for ALL bottles across ALL users.\n\n` +
      `Mode: ${analysisMode}\nBatch size: ${analysisBatch} bottles per page\n\n` +
      `This consumes OpenAI tokens. Continue?`
    )) return;

    let session = contextSession;
    if (!session) {
      const { data } = await supabase.auth.getSession();
      session = data.session;
    }
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

  // Loading state
  if (isAdmin === null) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h1>🍷 Batch Vivino Enrichment</h1>
        <p style={{ color: '#666', marginTop: '2rem' }}>Checking admin privileges...</p>
      </div>
    );
  }

  // Not admin - show error
  if (isAdmin === false) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1>🍷 Batch Vivino Enrichment</h1>
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
      <h1>🍷 Batch Vivino Enrichment</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Automatically fetch and populate Vivino data for all wines in the database.
      </p>

      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '2rem',
      }}>
        <h3 style={{ marginTop: 0 }}>Settings</h3>
        
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
          ⏱️ Estimated time: <strong>{Math.ceil((limit * 2) / 60)} minutes</strong> (2 seconds per wine)
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

      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '1rem',
        borderRadius: '8px',
        fontSize: '0.875rem',
      }}>
        <h4 style={{ marginTop: 0 }}>ℹ️ How it works:</h4>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li>Finds wines that <strong>already have Vivino URLs</strong> but missing other data</li>
          <li>Fetches full wine details from Vivino (rating, region, grapes, etc.)</li>
          <li>Updates only empty/missing fields (won't overwrite existing data)</li>
          <li>Rate limited: 2 seconds between requests (30 wines/minute)</li>
          <li>Safe to run multiple times - idempotent operation</li>
        </ul>
        <p style={{ fontSize: '0.875rem', color: '#856404', backgroundColor: '#fff3cd', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
          <strong>💡 Tip:</strong> This only enriches wines with existing Vivino URLs. 
          Use the "Fetch Data" button in the bottle form to add Vivino URLs first.
        </p>
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
    </div>
  );
};

