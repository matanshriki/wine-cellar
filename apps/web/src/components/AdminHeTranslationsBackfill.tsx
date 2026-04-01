/**
 * Admin: Hebrew Translations Backfill
 *
 * Finds all wines that don't have translations.he in the DB and adds them
 * using the backfill-he-translations Edge Function. Admin-only.
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

interface BatchResult {
  wine_id: string;
  wine_name: string;
  status: 'ok' | 'failed' | 'preview';
  error?: string;
}

interface BatchResponse {
  processed: number;
  failed: number;
  skipped: number;
  hasMore: boolean;
  nextOffset: number;
  totalMissing: number;
  results: BatchResult[];
}

const BATCH_SIZE = 10;

export function AdminHeTranslationsBackfill() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [totalMissing, setTotalMissing] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [failed, setFailed] = useState(0);
  const [log, setLog] = useState<BatchResult[]>([]);
  const [done, setDone] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChecking(false); return; }
      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single();
      setIsAdmin(profile?.is_admin === true);
      setChecking(false);
    })();
  }, []);

  async function callEdgeFunction(offset: number, dryRun = false): Promise<BatchResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const apiUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
    const res = await fetch(`${apiUrl}/functions/v1/backfill-he-translations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ batchSize: BATCH_SIZE, offset, dryRun }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function checkMissing() {
    try {
      const data = await callEdgeFunction(0, true);
      setTotalMissing(data.totalMissing);
      if (data.totalMissing === 0) {
        toast.success('All wines already have Hebrew translations!');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function runBackfill() {
    setIsRunning(true);
    setDone(false);
    setProcessed(0);
    setFailed(0);
    setLog([]);
    abortRef.current = false;

    let offset = 0;
    let total = totalMissing ?? 0;

    try {
      while (!abortRef.current) {
        const data = await callEdgeFunction(offset);
        if (total === 0) { total = data.totalMissing; setTotalMissing(data.totalMissing); }

        setProcessed(p => p + data.processed);
        setFailed(f => f + data.failed);
        setLog(l => [...l, ...data.results]);

        if (!data.hasMore || data.results.length === 0) break;
        offset = data.nextOffset;

        // Small delay between batches to avoid rate limiting
        await new Promise(r => setTimeout(r, 600));
      }
      setDone(true);
      if (!abortRef.current) toast.success('Hebrew translations backfill complete!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsRunning(false);
    }
  }

  function stopBackfill() {
    abortRef.current = true;
    setIsRunning(false);
    toast.info('Backfill stopped. You can resume by running it again.');
  }

  if (checking) return null;
  if (!isAdmin) return null;

  const progressPct = totalMissing && totalMissing > 0
    ? Math.round(((processed + failed) / totalMissing) * 100)
    : 0;

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
    }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', color: '#1a1a1a' }}>
        Hebrew Translations Backfill
      </h3>
      <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
        Finds all wines missing <code>translations.he</code> in the database and generates
        Hebrew translations using GPT-4o-mini. Only runs on wines that don't already have
        translations — safe to re-run.
      </p>

      {/* Status row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          onClick={checkMissing}
          disabled={isRunning}
          style={{
            padding: '8px 16px', fontSize: '13px', borderRadius: '8px',
            border: '1px solid #ddd', backgroundColor: '#f8f9fa',
            cursor: isRunning ? 'not-allowed' : 'pointer', color: '#333',
          }}
        >
          Check missing
        </button>

        {totalMissing !== null && (
          <span style={{
            padding: '8px 14px', fontSize: '13px', borderRadius: '8px',
            backgroundColor: totalMissing === 0 ? '#d4edda' : '#fff3cd',
            color: totalMissing === 0 ? '#155724' : '#856404',
            border: `1px solid ${totalMissing === 0 ? '#c3e6cb' : '#ffc107'}`,
          }}>
            {totalMissing === 0
              ? '✓ All wines have Hebrew translations'
              : `${totalMissing} wine${totalMissing !== 1 ? 's' : ''} missing translations`}
          </span>
        )}
      </div>

      {/* Action buttons */}
      {totalMissing !== null && totalMissing > 0 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button
            onClick={runBackfill}
            disabled={isRunning}
            style={{
              padding: '10px 20px', fontSize: '14px', fontWeight: 600,
              borderRadius: '8px', border: 'none',
              backgroundColor: isRunning ? '#ccc' : '#7c3030',
              color: 'white', cursor: isRunning ? 'not-allowed' : 'pointer',
            }}
          >
            {isRunning ? 'Running…' : done ? 'Run again' : 'Start backfill'}
          </button>

          {isRunning && (
            <button
              onClick={stopBackfill}
              style={{
                padding: '10px 16px', fontSize: '14px', borderRadius: '8px',
                border: '1px solid #dc3545', backgroundColor: 'white',
                color: '#dc3545', cursor: 'pointer',
              }}
            >
              Stop
            </button>
          )}
        </div>
      )}

      {/* Progress bar */}
      {(isRunning || done) && totalMissing !== null && totalMissing > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            <span>{processed + failed} / {totalMissing} processed</span>
            <span>{progressPct}%</span>
          </div>
          <div style={{ height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progressPct}%`,
              backgroundColor: failed > 0 ? '#fd7e14' : '#28a745',
              borderRadius: '4px', transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            ✓ {processed} translated &nbsp;·&nbsp; ✗ {failed} failed
            {done && ' · Complete!'}
          </div>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div style={{
          maxHeight: '200px', overflowY: 'auto',
          border: '1px solid #e0e0e0', borderRadius: '8px',
          fontSize: '12px', fontFamily: 'monospace',
        }}>
          {log.map((r, i) => (
            <div key={i} style={{
              padding: '4px 10px',
              backgroundColor: r.status === 'failed' ? '#fff5f5' : i % 2 === 0 ? '#fafafa' : 'white',
              color: r.status === 'failed' ? '#c0392b' : '#333',
              borderBottom: i < log.length - 1 ? '1px solid #f0f0f0' : 'none',
            }}>
              {r.status === 'ok' ? '✓' : '✗'} {r.wine_name}
              {r.error && <span style={{ color: '#c0392b' }}> — {r.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
