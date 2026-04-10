/**
 * Admin: Hebrew Translations Backfill
 *
 * Three modes:
 *  - "missing"  — wines with no translations.he (original behaviour)
 *  - "7days"    — all wines added in the last 7 days (re-translate even if already translated)
 *  - "30days"   — all wines added in the last 30 days
 *
 * The "recent days" modes are useful when a wine was scanned before Vivino enrichment
 * ran, leaving the translation with incomplete / missing data.
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

type Mode = 'missing' | '7days' | '30days';

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

const MODE_CONFIG: Record<Mode, { label: string; description: string; daysSince?: number }> = {
  missing: {
    label: 'No translation',
    description: 'Wines that have no Hebrew translation yet.',
  },
  '7days': {
    label: 'Last 7 days',
    description: 'All wines scanned in the past 7 days — re-translates even if already translated, so recently-enriched Vivino data is picked up.',
    daysSince: 7,
  },
  '30days': {
    label: 'Last 30 days',
    description: 'All wines scanned in the past 30 days — useful for a broader refresh after Vivino enrichment.',
    daysSince: 30,
  },
};

export function AdminHeTranslationsBackfill() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<Mode>('missing');
  const [totalTarget, setTotalTarget] = useState<number | null>(null);
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

  // Reset count whenever the mode changes
  useEffect(() => {
    setTotalTarget(null);
    setProcessed(0);
    setFailed(0);
    setLog([]);
    setDone(false);
  }, [mode]);

  async function callEdgeFunction(offset: number, dryRun = false): Promise<BatchResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const cfg = MODE_CONFIG[mode];
    const apiUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
    const res = await fetch(`${apiUrl}/functions/v1/backfill-he-translations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        batchSize: BATCH_SIZE,
        offset,
        dryRun,
        ...(cfg.daysSince !== undefined ? { daysSince: cfg.daysSince } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function checkCount() {
    try {
      const data = await callEdgeFunction(0, true);
      setTotalTarget(data.totalMissing);
      if (data.totalMissing === 0) {
        toast.success(
          mode === 'missing'
            ? 'All wines already have Hebrew translations!'
            : 'No wines found in that date range.'
        );
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
    let total = totalTarget ?? 0;

    try {
      while (!abortRef.current) {
        const data = await callEdgeFunction(offset);
        if (total === 0) { total = data.totalMissing; setTotalTarget(data.totalMissing); }

        setProcessed(p => p + data.processed);
        setFailed(f => f + data.failed);
        setLog(l => [...l, ...data.results]);

        if (!data.hasMore || data.results.length === 0) break;
        offset = data.nextOffset;

        await new Promise(r => setTimeout(r, 600));
      }
      setDone(true);
      if (!abortRef.current) toast.success('Hebrew translations complete!');
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

  const progressPct = totalTarget && totalTarget > 0
    ? Math.round(((processed + failed) / totalTarget) * 100)
    : 0;

  const cfg = MODE_CONFIG[mode];

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
        Generates Hebrew translations via GPT-4o-mini and saves them to{' '}
        <code>wines.translations.he</code>.
      </p>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {(Object.keys(MODE_CONFIG) as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => { if (!isRunning) setMode(m); }}
            disabled={isRunning}
            style={{
              padding: '7px 14px',
              fontSize: '13px',
              borderRadius: '20px',
              border: `1.5px solid ${mode === m ? '#7c3030' : '#ddd'}`,
              backgroundColor: mode === m ? '#7c3030' : '#f8f9fa',
              color: mode === m ? 'white' : '#555',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontWeight: mode === m ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {MODE_CONFIG[m].label}
          </button>
        ))}
      </div>

      <p style={{
        fontSize: '12px', color: '#888', marginBottom: '16px',
        padding: '8px 12px', backgroundColor: '#f8f9fa',
        borderRadius: '6px', lineHeight: '1.5',
      }}>
        {cfg.description}
      </p>

      {/* Status row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={checkCount}
          disabled={isRunning}
          style={{
            padding: '8px 16px', fontSize: '13px', borderRadius: '8px',
            border: '1px solid #ddd', backgroundColor: '#f8f9fa',
            cursor: isRunning ? 'not-allowed' : 'pointer', color: '#333',
          }}
        >
          Check count
        </button>

        {totalTarget !== null && (
          <span style={{
            padding: '8px 14px', fontSize: '13px', borderRadius: '8px',
            backgroundColor: totalTarget === 0 ? '#d4edda' : '#fff3cd',
            color: totalTarget === 0 ? '#155724' : '#856404',
            border: `1px solid ${totalTarget === 0 ? '#c3e6cb' : '#ffc107'}`,
          }}>
            {totalTarget === 0
              ? '✓ Nothing to translate'
              : `${totalTarget} wine${totalTarget !== 1 ? 's' : ''} to translate`}
          </span>
        )}
      </div>

      {/* Action buttons */}
      {totalTarget !== null && totalTarget > 0 && (
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
            {isRunning ? 'Running…' : done ? 'Run again' : 'Start'}
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
      {(isRunning || done) && totalTarget !== null && totalTarget > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            <span>{processed + failed} / {totalTarget} processed</span>
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
