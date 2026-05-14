import { useAdminOverview } from '../../hooks/admin/useAdminOverview';
import { WineLoader } from '../WineLoader';

function StatCard({
  label,
  value,
  sub,
  accent,
  note,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'red' | 'amber' | 'green' | 'muted';
  note?: string;
}) {
  const accentColor =
    accent === 'red'   ? 'var(--color-error)' :
    accent === 'amber' ? 'var(--color-warning)' :
    accent === 'green' ? 'var(--color-success)' :
    'var(--text-primary)';

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-medium)',
      borderRadius: '12px',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </span>
      <span style={{ fontSize: '1.7rem', fontWeight: 700, color: accentColor, lineHeight: 1.1 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{sub}</span>
      )}
      {note && (
        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '2px', fontStyle: 'italic' }}>{note}</span>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: '0.7rem',
      fontWeight: 600,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      margin: '24px 0 10px',
    }}>
      {children}
    </h3>
  );
}

export function AdminOverview() {
  const { data, isLoading, error } = useAdminOverview();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <WineLoader variant="default" size="md" message="Loading metrics…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-error)' }}>
        Failed to load metrics: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const aiFailRate = data.ai_calls_7d > 0
    ? Math.round((data.ai_failed_7d / data.ai_calls_7d) * 100)
    : 0;

  return (
    <div>
      <SectionTitle>Users</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
        <StatCard label="Total users"         value={data.total_users} />
        <StatCard label="New (7 days)"        value={data.new_users_7d} accent="green" />
        <StatCard label="With bottles"        value={data.users_with_bottles} />
        <StatCard label="Zero bottles"        value={data.users_with_zero_bottles} accent={data.users_with_zero_bottles > 0 ? 'amber' : undefined} />
      </div>

      <SectionTitle>Cellar</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
        <StatCard label="Total bottles (qty)" value={data.total_bottles} />
        <StatCard label="Bottles added (7d)"  value={data.bottles_added_7d} accent="green" />
        <StatCard label="Total wines"         value={data.total_wines} />
        <StatCard label="Not analyzed"        value={data.bottles_not_analyzed}
          accent={data.bottles_not_analyzed > 0 ? 'amber' : undefined} />
        <StatCard label="No drink window"     value={data.bottles_no_drink_window}
          accent={data.bottles_no_drink_window > 10 ? 'amber' : undefined} />
      </div>

      <SectionTitle>Wine data quality</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
        <StatCard label="Missing food pairing" value={data.wines_missing_food_pairing}
          accent={data.wines_missing_food_pairing > 0 ? 'amber' : 'green'} />
        <StatCard label="Missing image"        value={data.wines_missing_image}
          accent={data.wines_missing_image > 0 ? 'amber' : 'green'} />
        <StatCard label="Missing region/country" value={data.wines_missing_region}
          accent={data.wines_missing_region > 0 ? 'amber' : 'green'} />
        <StatCard label="Missing grapes"       value={data.wines_missing_grapes}
          accent={data.wines_missing_grapes > 0 ? 'amber' : 'green'} />
        <StatCard label="Low confidence"       value={data.wines_low_confidence}
          accent={data.wines_low_confidence > 0 ? 'amber' : 'green'} />
      </div>

      <SectionTitle>AI usage (last 7 days)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
        <StatCard label="AI calls"     value={data.ai_calls_7d} />
        <StatCard label="Failed calls" value={data.ai_failed_7d}
          accent={data.ai_failed_7d > 0 ? 'red' : 'green'} sub={`${aiFailRate}% fail rate`} />
        <StatCard label="Est. cost"    value={`$${data.ai_cost_7d_usd.toFixed(4)}`}
          accent={data.ai_cost_7d_usd > 1 ? 'amber' : undefined} />
        <StatCard label="AI-active users" value={data.ai_active_users_7d} />
      </div>

      <SectionTitle>Event tracking (last 7 days)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
        <StatCard label="Events logged" value={data.events_7d}
          note={data.events_7d === 0 ? 'Populates once trackEvent() fires' : undefined} />
        <StatCard label="Active users (events)" value={data.event_active_users_7d}
          note={data.event_active_users_7d === 0 ? 'Populates once trackEvent() fires' : undefined} />
      </div>

      <SectionTitle>User acquisition (all time)</SectionTitle>
      {(!data.acquisition_by_medium || data.acquisition_by_medium.every(r => r.medium === 'unknown')) ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 0 }}>
          No attribution data yet — populates for users who sign up after this feature is deployed.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>

          {/* By medium */}
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
              By channel
            </p>
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}>
              {data.acquisition_by_medium.map((row, i) => {
                const total = data.acquisition_by_medium.reduce((s, r) => s + r.users, 0);
                const pct = total > 0 ? Math.round((row.users / total) * 100) : 0;
                return (
                  <div key={row.medium} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 14px',
                    borderBottom: i < data.acquisition_by_medium.length - 1
                      ? '1px solid var(--border-subtle)' : 'none',
                    position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${pct}%`,
                      background: 'var(--interactive-hover)',
                      opacity: 0.5,
                    }} />
                    <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-primary)', position: 'relative', zIndex: 1, textTransform: 'capitalize' }}>
                      {row.medium}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-heading)', position: 'relative', zIndex: 1 }}>
                      {row.users}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', minWidth: 30, textAlign: 'right', position: 'relative', zIndex: 1 }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top sources */}
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
              Top sources
            </p>
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}>
              {data.acquisition_by_source.filter(r => r.source !== 'unknown').slice(0, 8).map((row, i, arr) => {
                const total = data.acquisition_by_source.reduce((s, r) => s + r.users, 0);
                const pct = total > 0 ? Math.round((row.users / total) * 100) : 0;
                return (
                  <div key={row.source + row.medium} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 14px',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${pct}%`,
                      background: 'var(--interactive-hover)',
                      opacity: 0.5,
                    }} />
                    <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{row.source}</span>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', marginLeft: 6 }}>{row.medium}</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-heading)', position: 'relative', zIndex: 1 }}>
                      {row.users}
                    </span>
                  </div>
                );
              })}
              {data.acquisition_by_source.filter(r => r.source !== 'unknown').length === 0 && (
                <div style={{ padding: '14px', fontSize: '0.78rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  No source data yet
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* New users by source — last 7 days */}
      {data.new_users_by_source_7d && data.new_users_by_source_7d.length > 0 &&
        !data.new_users_by_source_7d.every(r => r.source === 'unknown') && (
        <>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '14px 0 8px' }}>
            New signups by source — last 7 days
          </p>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '12px',
            overflow: 'hidden',
            maxWidth: 400,
          }}>
            {data.new_users_by_source_7d.map((row, i) => (
              <div key={row.source} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 14px',
                borderBottom: i < data.new_users_by_source_7d.length - 1
                  ? '1px solid var(--border-subtle)' : 'none',
                fontSize: '0.8rem',
              }}>
                <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{row.source}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{row.users}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
