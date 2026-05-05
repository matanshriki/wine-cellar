import { useAdminInsights } from '../../hooks/admin/useAdminInsights';
import { WineLoader } from '../WineLoader';

interface InsightRowProps {
  label: string;
  value: number | string | null;
  description: string;
  severity?: 'high' | 'medium' | 'low' | 'ok' | 'info';
  noDataYet?: boolean;
}

function InsightRow({ label, value, description, severity = 'info', noDataYet = false }: InsightRowProps) {
  const severityColor =
    severity === 'high'   ? '#e05c5c' :
    severity === 'medium' ? '#d4a843' :
    severity === 'low'    ? '#a0c8a8' :
    severity === 'ok'     ? '#6db87a' :
    'rgba(255,255,255,0.6)';

  const severityBg =
    severity === 'high'   ? 'rgba(224,92,92,0.08)' :
    severity === 'medium' ? 'rgba(212,168,67,0.08)' :
    severity === 'ok'     ? 'rgba(109,184,122,0.08)' :
    'rgba(255,255,255,0.03)';

  return (
    <div style={{
      background: severityBg,
      border: `1px solid ${severity === 'high' ? 'rgba(224,92,92,0.2)' : severity === 'medium' ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '10px',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
    }}>
      <div style={{ minWidth: '64px', textAlign: 'right' }}>
        <span style={{
          fontSize: noDataYet ? '0.72rem' : '1.5rem',
          fontWeight: 700,
          color: noDataYet ? 'rgba(255,255,255,0.25)' : severityColor,
          fontStyle: noDataYet ? 'italic' : 'normal',
        }}>
          {noDataYet ? 'no data' : (value === null ? '—' : value)}
        </span>
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary,#fff)', marginBottom: '3px' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
          {description}
          {noDataYet && (
            <span style={{ display: 'block', marginTop: '4px', color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem', fontStyle: 'italic' }}>
              Requires app_events data — will populate once trackEvent() fires.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminInsights() {
  const { data, isLoading, error } = useAdminInsights();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <WineLoader variant="default" size="md" message="Loading insights…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#e05c5c' }}>
        {error instanceof Error ? error.message : 'Failed to load insights'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* ── User engagement ── */}
      <h3 style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '8px 0 4px' }}>
        User engagement
      </h3>

      <InsightRow
        label="Users with no bottles"
        value={data.users_no_bottles}
        description="Signed up but never added a bottle. High-priority onboarding opportunity."
        severity={data.users_no_bottles > 5 ? 'high' : data.users_no_bottles > 0 ? 'medium' : 'ok'}
      />

      {/* ── Wine data quality ── */}
      <h3 style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 4px' }}>
        Wine data quality
      </h3>

      <InsightRow
        label="Wines missing food pairing"
        value={data.wines_missing_food_pairing}
        description="Run the food pairing backfill to fill these gaps."
        severity={data.wines_missing_food_pairing > 20 ? 'high' : data.wines_missing_food_pairing > 0 ? 'medium' : 'ok'}
      />
      <InsightRow
        label="Wines missing image"
        value={data.wines_missing_image}
        description="Wines without a label image. Run Vivino image backfill."
        severity={data.wines_missing_image > 20 ? 'medium' : data.wines_missing_image > 0 ? 'low' : 'ok'}
      />
      <InsightRow
        label="Wines missing region or country"
        value={data.wines_missing_region_or_country}
        description="Affects recommendation relevance and regional filters."
        severity={data.wines_missing_region_or_country > 10 ? 'medium' : data.wines_missing_region_or_country > 0 ? 'low' : 'ok'}
      />
      <InsightRow
        label="Low-confidence analyses"
        value={data.low_confidence_wines}
        description="Wines with wine_profile_confidence or food_pairing_confidence = low. Consider re-running analysis with better data."
        severity={data.low_confidence_wines > 10 ? 'medium' : data.low_confidence_wines > 0 ? 'low' : 'ok'}
      />
      <InsightRow
        label="Bottles not analyzed"
        value={data.bottles_not_analyzed}
        description="Bottles added to cellar but never analyzed. May need backfill."
        severity={data.bottles_not_analyzed > 20 ? 'medium' : data.bottles_not_analyzed > 0 ? 'low' : 'ok'}
      />
      <InsightRow
        label="Bottles without drink window"
        value={data.bottles_no_drink_window}
        description="Bottles missing peak drinking window estimate. Affects Tonight's Selection quality."
        severity={data.bottles_no_drink_window > 20 ? 'medium' : data.bottles_no_drink_window > 0 ? 'low' : 'ok'}
      />

      {/* ── AI health ── */}
      <h3 style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 4px' }}>
        AI health
      </h3>

      <InsightRow
        label="AI failure rate (7 days)"
        value={`${data.ai_failure_rate_7d_pct}%`}
        description={`${data.top_failing_ai_action ? `Highest failure rate on: ${data.top_failing_ai_action}` : 'No failed AI calls in the last 7 days.'}`}
        severity={data.ai_failure_rate_7d_pct > 10 ? 'high' : data.ai_failure_rate_7d_pct > 2 ? 'medium' : 'ok'}
      />

      {/* ── Event-based signals (no data yet) ── */}
      <h3 style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 4px' }}>
        Scan & analysis funnel (requires event tracking)
      </h3>

      <InsightRow
        label="Scan starts (7 days)"
        value={data.scan_starts_7d}
        description="Users who started a bottle scan. First step of the add-bottle funnel."
        noDataYet={data.scan_starts_7d === 0}
        severity="info"
      />
      <InsightRow
        label="Scan failures (7 days)"
        value={data.scan_failures_7d}
        description="Scans that returned an error. Divide by scan starts for failure rate."
        noDataYet={data.scan_starts_7d === 0}
        severity={data.scan_failures_7d > 0 ? 'medium' : 'ok'}
      />
      <InsightRow
        label="Analysis failures (7 days)"
        value={data.analysis_failures_7d}
        description="Wine analysis events that failed (from app_events)."
        noDataYet={data.scan_starts_7d === 0}
        severity={data.analysis_failures_7d > 0 ? 'medium' : 'ok'}
      />

      {/* Top events */}
      {data.top_events_7d.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 4px' }}>
            Most-used features (7 days, by event count)
          </h3>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}>
            {data.top_events_7d.map((ev, i) => (
              <div key={ev.event_name} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: i < data.top_events_7d.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>{ev.event_name}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary,#fff)' }}>{ev.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
