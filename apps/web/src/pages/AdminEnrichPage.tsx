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

export const AdminEnrichPage: React.FC = () => {
  const { user, session: contextSession } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [limit, setLimit] = useState(100);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

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
    </div>
  );
};

