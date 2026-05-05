import { useState } from 'react';
import { useAdminAiSummary, useAdminAiCalls } from '../../hooks/admin/useAdminAiUsage';
import { WineLoader } from '../WineLoader';

const PAGE_SIZE = 100;

function StatusBadge({ status }: { status: string }) {
  const isOk = status === 'success';
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '0.7rem',
      fontWeight: 600,
      background: isOk ? 'rgba(109,184,122,0.15)' : 'rgba(224,92,92,0.15)',
      color: isOk ? '#6db87a' : '#e05c5c',
      border: `1px solid ${isOk ? 'rgba(109,184,122,0.3)' : 'rgba(224,92,92,0.3)'}`,
    }}>
      {status}
    </span>
  );
}

function formatCost(n: number | null) {
  if (n == null || n === 0) return '—';
  return `$${n.toFixed(5)}`;
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function AdminAiUsage() {
  const [view, setView]         = useState<'summary' | 'calls' | 'errors'>('summary');
  const [page, setPage]         = useState(0);

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useAdminAiSummary();
  const { data: calls,   isLoading: callsLoading,   error: callsError   } = useAdminAiCalls(
    PAGE_SIZE, page * PAGE_SIZE,
    view === 'errors' ? 'failed' : null,
  );

  const Tab = ({ id, label }: { id: typeof view; label: string }) => (
    <button
      onClick={() => { setView(id); setPage(0); }}
      style={{
        padding: '6px 16px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: view === id ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: view === id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: view === id ? 600 : 400,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <Tab id="summary" label="By feature" />
        <Tab id="calls"   label="Recent calls" />
        <Tab id="errors"  label="Errors only" />
      </div>

      {/* ── Summary view ── */}
      {view === 'summary' && (
        <>
          {summaryLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <WineLoader variant="default" size="md" message="Loading AI summary…" />
            </div>
          )}
          {summaryError && (
            <div style={{ color: '#e05c5c', padding: '20px 0' }}>
              {summaryError instanceof Error ? summaryError.message : 'Failed to load'}
            </div>
          )}
          {!summaryLoading && (summary ?? []).length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.35)' }}>
              No AI calls logged yet.
            </div>
          )}
          {!summaryLoading && (summary ?? []).length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {['Feature', 'Model', 'Total', 'Success', 'Failed', 'Fail %', 'Tokens (in+out)', 'Total cost', 'Calls 7d', 'Cost 7d'].map(h => (
                      <th key={h} style={{
                        padding: '8px 10px', textAlign: 'left',
                        color: 'rgba(255,255,255,0.35)', fontWeight: 500,
                        fontSize: '0.68rem', textTransform: 'uppercase',
                        letterSpacing: '0.07em', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(summary ?? []).map((row, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--text-primary,#fff)', whiteSpace: 'nowrap' }}>{row.action_type}</td>
                      <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.5)' }}>{row.model_name ?? '—'}</td>
                      <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{row.total_calls}</td>
                      <td style={{ padding: '8px 10px', color: '#6db87a' }}>{row.success_count}</td>
                      <td style={{ padding: '8px 10px', color: row.failure_count > 0 ? '#e05c5c' : 'rgba(255,255,255,0.4)' }}>{row.failure_count}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: row.failure_rate > 5 ? '#e05c5c' : row.failure_rate > 0 ? '#d4a843' : '#6db87a' }}>
                        {row.failure_rate}%
                      </td>
                      <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {(row.total_input_tokens + row.total_output_tokens).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', color: row.total_cost_usd > 0.5 ? '#d4a843' : 'rgba(255,255,255,0.55)' }}>
                        {formatCost(row.total_cost_usd)}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.6)' }}>{row.calls_7d}</td>
                      <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.55)' }}>{formatCost(row.cost_7d_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Calls / Errors view ── */}
      {(view === 'calls' || view === 'errors') && (
        <>
          {callsLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <WineLoader variant="default" size="md" message="Loading AI calls…" />
            </div>
          )}
          {callsError && (
            <div style={{ color: '#e05c5c', padding: '20px 0' }}>
              {callsError instanceof Error ? callsError.message : 'Failed to load'}
            </div>
          )}
          {!callsLoading && (calls ?? []).length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.35)' }}>
              {view === 'errors' ? 'No failed AI calls — everything is healthy.' : 'No AI calls found.'}
            </div>
          )}
          {!callsLoading && (calls ?? []).length > 0 && (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {['Feature', 'Model', 'Status', 'User', 'In tokens', 'Out tokens', 'Cost', 'When'].map(h => (
                        <th key={h} style={{
                          padding: '8px 10px', textAlign: 'left',
                          color: 'rgba(255,255,255,0.35)', fontWeight: 500,
                          fontSize: '0.68rem', textTransform: 'uppercase',
                          letterSpacing: '0.07em', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(calls ?? []).map(c => (
                      <tr
                        key={c.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '8px 10px', color: 'var(--text-primary,#fff)', whiteSpace: 'nowrap' }}>{c.action_type}</td>
                        <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.5)' }}>{c.model_name ?? '—'}</td>
                        <td style={{ padding: '8px 10px' }}><StatusBadge status={c.request_status} /></td>
                        <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.55)', maxWidth: '140px' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {c.user_email ?? '—'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.input_tokens ?? '—'}</td>
                        <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.output_tokens ?? '—'}</td>
                        <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.55)' }}>{formatCost(c.estimated_cost_usd)}</td>
                        <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>{formatTs(c.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: '16px',
                fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)',
              }}>
                <span>Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + (calls ?? []).length}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: page === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>Prev</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={(calls ?? []).length < PAGE_SIZE} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: (calls ?? []).length < PAGE_SIZE ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)', cursor: (calls ?? []).length < PAGE_SIZE ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>Next</button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
