import { useState } from 'react';
import { useAdminUsers } from '../../hooks/admin/useAdminUsers';
import { WineLoader } from '../WineLoader';

const PAGE_SIZE = 50;

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AdminUsers() {
  const [page, setPage] = useState(0);
  const { data, isLoading, error } = useAdminUsers(PAGE_SIZE, page * PAGE_SIZE);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <WineLoader variant="default" size="md" message="Loading users…" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#e05c5c' }}>
        Failed to load: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const users = data ?? [];

  if (users.length === 0 && page === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.4)' }}>
        No users found.
      </div>
    );
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {['Email', 'Signed up', 'Last active', 'Bottles', 'Wines', 'AI calls (7d)', 'Events (7d)', 'Admin'].map(h => (
                <th key={h} style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  color: 'rgba(255,255,255,0.4)',
                  fontWeight: 500,
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} style={{
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '10px 12px', color: 'var(--text-primary, #fff)' }}>
                  {u.email ?? <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
                  {formatDate(u.created_at)}
                </td>
                <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
                  {u.last_active_at
                    ? formatDate(u.last_active_at)
                    : <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem' }}>not tracked yet</span>
                  }
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-primary, #fff)', textAlign: 'center' }}>
                  {u.bottle_count}
                </td>
                <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                  {u.wine_count}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{
                    color: u.ai_calls_7d > 0 ? '#6db87a' : 'rgba(255,255,255,0.4)',
                    fontWeight: u.ai_calls_7d > 0 ? 600 : 400,
                  }}>
                    {u.ai_calls_7d}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                  {u.events_7d > 0
                    ? <span style={{ color: '#6db87a', fontWeight: 600 }}>{u.events_7d}</span>
                    : <span>—</span>
                  }
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {u.is_admin && (
                    <span style={{
                      background: 'rgba(212,168,67,0.2)',
                      color: '#d4a843',
                      border: '1px solid rgba(212,168,67,0.4)',
                      borderRadius: '4px',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      padding: '2px 6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      admin
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '16px',
        fontSize: '0.8rem',
        color: 'rgba(255,255,255,0.4)',
      }}>
        <span>Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + users.length}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: page === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
            }}
          >
            Prev
          </button>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={users.length < PAGE_SIZE}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: users.length < PAGE_SIZE ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
              cursor: users.length < PAGE_SIZE ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
