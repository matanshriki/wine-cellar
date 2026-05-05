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
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-error)' }}>
        Failed to load: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const users = data ?? [];

  if (users.length === 0 && page === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>
        No users found.
      </div>
    );
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-medium)' }}>
              {['Email', 'Signed up', 'Last active', 'Bottles', 'Wines', 'AI calls (7d)', 'Events (7d)', 'Admin'].map(h => (
                <th key={h} style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  color: 'var(--text-tertiary)',
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
                borderBottom: '1px solid var(--border-subtle)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--interactive-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                  {u.email ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {formatDate(u.created_at)}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {u.last_active_at
                    ? formatDate(u.last_active_at)
                    : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>not tracked yet</span>
                  }
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-primary)', textAlign: 'center' }}>
                  {u.bottle_count}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  {u.wine_count}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{
                    color: u.ai_calls_7d > 0 ? 'var(--color-success)' : 'var(--text-tertiary)',
                    fontWeight: u.ai_calls_7d > 0 ? 600 : 400,
                  }}>
                    {u.ai_calls_7d}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                  {u.events_7d > 0
                    ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{u.events_7d}</span>
                    : <span>—</span>
                  }
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {u.is_admin && (
                    <span style={{
                      background: 'var(--color-warning-light)',
                      color: 'var(--color-orange-600)',
                      border: '1px solid var(--color-amber-500)',
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

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '16px',
        fontSize: '0.8rem',
        color: 'var(--text-tertiary)',
      }}>
        <span>Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + users.length}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-medium)',
              background: 'transparent',
              color: page === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)',
              opacity: page === 0 ? 0.45 : 1,
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
            }}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage(p => p + 1)}
            disabled={users.length < PAGE_SIZE}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-medium)',
              background: 'transparent',
              color: users.length < PAGE_SIZE ? 'var(--text-tertiary)' : 'var(--text-primary)',
              opacity: users.length < PAGE_SIZE ? 0.45 : 1,
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
