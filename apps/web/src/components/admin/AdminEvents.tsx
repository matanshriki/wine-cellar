import { useState } from 'react';
import { useAdminEvents } from '../../hooks/admin/useAdminEvents';
import { WineLoader } from '../WineLoader';

const PAGE_SIZE = 100;

// Known event names to populate the filter dropdown as they accumulate.
// Add entries here as new events are instrumented.
const KNOWN_EVENTS = [
  'user_signed_up',
  'login_completed',
  'bottle_scan_started',
  'bottle_scan_completed',
  'bottle_scan_failed',
  'wine_analysis_started',
  'wine_analysis_completed',
  'wine_analysis_failed',
  'food_pairing_viewed',
  'food_pairing_generated',
  'tonights_selection_opened',
  'language_changed',
];

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function AdminEvents() {
  const [page, setPage] = useState(0);
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const { data, isLoading, error } = useAdminEvents(PAGE_SIZE, page * PAGE_SIZE, eventFilter);

  const events = data ?? [];

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select
          value={eventFilter ?? ''}
          onChange={e => { setEventFilter(e.target.value || null); setPage(0); }}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.8)',
            padding: '7px 12px',
            fontSize: '0.82rem',
          }}
        >
          <option value="">All events</option>
          {KNOWN_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <WineLoader variant="default" size="md" message="Loading events…" />
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#e05c5c' }}>
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      )}

      {!isLoading && !error && events.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '80px 24px',
          color: 'rgba(255,255,255,0.35)',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.4 }}>📊</div>
          <div style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '8px', color: 'rgba(255,255,255,0.55)' }}>
            No events yet
          </div>
          <div style={{ fontSize: '0.82rem', maxWidth: '360px', margin: '0 auto', lineHeight: 1.6 }}>
            Events will appear here as <code style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px', padding: '1px 5px' }}>trackEvent()</code> calls are added to the app.
            Auth events (login, signup) and scan events are already instrumented and will show up after the next user action.
          </div>
        </div>
      )}

      {!isLoading && events.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  {['Event', 'Type', 'User', 'Page', 'Source', 'Session', 'When'].map(h => (
                    <th key={h} style={{
                      padding: '8px 10px', textAlign: 'left',
                      color: 'rgba(255,255,255,0.35)', fontWeight: 500,
                      fontSize: '0.68rem', textTransform: 'uppercase',
                      letterSpacing: '0.07em', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr
                    key={ev.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--text-primary, #fff)', whiteSpace: 'nowrap' }}>
                      {ev.event_name}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.45)' }}>
                      {ev.event_type ?? '—'}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.55)', maxWidth: '160px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {ev.user_email ?? <span style={{ color: 'rgba(255,255,255,0.25)' }}>anon</span>}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.45)', maxWidth: '120px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {ev.page ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.45)' }}>
                      {ev.source ?? '—'}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                      {ev.session_id ? ev.session_id.slice(0, 8) : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                      {formatTs(ev.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: '16px',
            fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)',
          }}>
            <span>Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + events.length}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: page === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}
              >Prev</button>
              <button
                onClick={() => setPage(p => p + 1)} disabled={events.length < PAGE_SIZE}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: events.length < PAGE_SIZE ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)', cursor: events.length < PAGE_SIZE ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}
              >Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
