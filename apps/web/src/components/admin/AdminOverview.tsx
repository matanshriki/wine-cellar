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
    accent === 'red'   ? '#e05c5c' :
    accent === 'amber' ? '#d4a843' :
    accent === 'green' ? '#6db87a' :
    'var(--text-primary, #fff)';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </span>
      <span style={{ fontSize: '1.7rem', fontWeight: 700, color: accentColor, lineHeight: 1.1 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{sub}</span>
      )}
      {note && (
        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.28)', marginTop: '2px', fontStyle: 'italic' }}>{note}</span>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: '0.7rem',
      fontWeight: 600,
      color: 'rgba(255,255,255,0.35)',
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
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#e05c5c' }}>
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
    </div>
  );
}
