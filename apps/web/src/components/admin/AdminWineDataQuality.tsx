import { useState } from 'react';
import { useAdminWineDataQuality } from '../../hooks/admin/useAdminWineDataQuality';
import { WineLoader } from '../WineLoader';

const PAGE_SIZE = 100;

function GapBadge({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: ok ? 'var(--color-success)' : 'var(--color-error)',
    }} />
  );
}

function ConfidenceBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>—</span>;
  const color =
    value === 'high' ? 'var(--color-success)' :
    value === 'med' ? 'var(--color-warning)' :
    'var(--color-error)';
  return <span style={{ color, fontSize: '0.75rem', fontWeight: 600 }}>{value}</span>;
}

export function AdminWineDataQuality() {
  const [page, setPage] = useState(0);
  const { data, isLoading, error } = useAdminWineDataQuality(PAGE_SIZE, page * PAGE_SIZE);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <WineLoader variant="default" size="md" message="Loading wine data…" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-error)' }}>
        {error instanceof Error ? error.message : 'Failed to load'}
      </div>
    );
  }

  const wines = data ?? [];

  if (wines.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>
        No wines found.
      </div>
    );
  }

  const missingFoodPairing = wines.filter(w => !w.has_food_pairing).length;
  const missingImage       = wines.filter(w => !w.has_image).length;
  const missingProfile     = wines.filter(w => !w.has_wine_profile).length;
  const missingGrapes      = wines.filter(w => !w.has_grapes).length;
  const missingDrinkWindow = wines.filter(w => !w.has_drink_window).length;
  const lowConfidence      = wines.filter(w => w.wine_profile_confidence === 'low' || w.food_pairing_confidence === 'low').length;

  return (
    <div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '20px',
      }}>
        {[
          { label: 'Missing food pairing', count: missingFoodPairing },
          { label: 'Missing image',        count: missingImage },
          { label: 'Missing wine profile', count: missingProfile },
          { label: 'Missing grapes',       count: missingGrapes },
          { label: 'No drink window',      count: missingDrinkWindow },
          { label: 'Low confidence',       count: lowConfidence },
        ].map(({ label, count }) => (
          <div key={label} style={{
            background: count > 0 ? 'var(--color-error-light)' : 'var(--color-success-light)',
            border: `1px solid ${count > 0 ? 'var(--color-error)' : 'var(--color-success)'}`,
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.78rem',
            color: count > 0 ? 'var(--color-error)' : 'var(--color-success)',
          }}>
            {count} {label}
          </div>
        ))}
        <div style={{
          background: 'var(--bg-muted)',
          border: '1px solid var(--border-medium)',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
        }}>
          {wines.length} wines shown
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-medium)' }}>
              {['Wine', 'Vintage', 'Color', 'Image', 'Food', 'Profile', 'Grapes', 'Drink win.', 'FP conf.', 'WP conf.', 'Gaps'].map(h => (
                <th key={h} style={{
                  padding: '8px 10px',
                  textAlign: 'left',
                  color: 'var(--text-tertiary)',
                  fontWeight: 500,
                  fontSize: '0.68rem',
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
            {wines.map(w => (
              <tr
                key={w.wine_id}
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--interactive-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td style={{ padding: '8px 10px', color: 'var(--text-primary)', maxWidth: '220px' }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.wine_name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.producer} · {w.country ?? w.region ?? '—'}
                  </div>
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                  {w.vintage ?? '—'}
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {w.color}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}><GapBadge ok={w.has_image} /></td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}><GapBadge ok={w.has_food_pairing} /></td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}><GapBadge ok={w.has_wine_profile} /></td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}><GapBadge ok={w.has_grapes} /></td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}><GapBadge ok={w.has_drink_window} /></td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}><ConfidenceBadge value={w.food_pairing_confidence} /></td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}><ConfidenceBadge value={w.wine_profile_confidence} /></td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <span style={{
                    color: w.gap_count > 2 ? 'var(--color-error)' : w.gap_count > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                    fontWeight: 600,
                  }}>
                    {w.gap_count}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '16px',
        fontSize: '0.8rem',
        color: 'var(--text-tertiary)',
      }}>
        <span>Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + wines.length}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '6px 14px', borderRadius: '8px',
              border: '1px solid var(--border-medium)', background: 'transparent',
              color: page === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)',
              opacity: page === 0 ? 0.45 : 1,
              cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
            }}
          >Prev</button>
          <button
            type="button"
            onClick={() => setPage(p => p + 1)}
            disabled={wines.length < PAGE_SIZE}
            style={{
              padding: '6px 14px', borderRadius: '8px',
              border: '1px solid var(--border-medium)', background: 'transparent',
              color: wines.length < PAGE_SIZE ? 'var(--text-tertiary)' : 'var(--text-primary)',
              opacity: wines.length < PAGE_SIZE ? 0.45 : 1,
              cursor: wines.length < PAGE_SIZE ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
            }}
          >Next</button>
        </div>
      </div>
    </div>
  );
}
