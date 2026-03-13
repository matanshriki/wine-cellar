import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/SupabaseAuthContext';

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
  const [detailFilter, setDetailFilter] = useState<'all' | 'enriched' | 'skipped' | 'failed'>('all');

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
    setDetailFilter('all');

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
    </div>
  );
};

