import type { CSSProperties } from 'react';
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
    severity === 'high'   ? 'var(--color-error)' :
    severity === 'medium' ? 'var(--color-warning)' :
    severity === 'low'      ? 'var(--text-secondary)' :
    severity === 'ok'       ? 'var(--color-success)' :
    'var(--text-secondary)';

  const severityBg =
    severity === 'high'   ? 'var(--color-error-light)' :
    severity === 'medium' ? 'var(--color-warning-light)' :
    severity === 'ok'       ? 'var(--color-success-light)' :
    'var(--bg-muted)';

  const borderColor =
    severity === 'high'   ? 'var(--color-error)' :
    severity === 'medium' ? 'var(--color-warning)' :
    severity === 'ok'     ? 'var(--color-success)' :
    'var(--border-medium)';

  return (
    <div style={{
      background: severityBg,
      border: `1px solid ${borderColor}`,
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
          color: noDataYet ? 'var(--text-tertiary)' : severityColor,
          fontStyle: noDataYet ? 'italic' : 'normal',
        }}>
          {noDataYet ? 'no data' : (value === null ? '—' : value)}
        </span>
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-heading)', marginBottom: '3px' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {description}
          {noDataYet && (
            <span style={{ display: 'block', marginTop: '4px', color: 'var(--text-tertiary)', fontSize: '0.7rem', fontStyle: 'italic' }}>
              Requires app_events data — will populate once trackEvent() fires.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const sectionH3: CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  margin: '8px 0 4px',
};

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
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-error)' }}>
        {error instanceof Error ? error.message : 'Failed to load insights'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      <h3 style={{ ...sectionH3, margin: '8px 0 4px' }}>
        User engagement
      </h3>

      <InsightRow
        label="Users with no bottles"
        value={data.users_no_bottles}
        description="Signed up but never added a bottle. High-priority onboarding opportunity."
        severity={data.users_no_bottles > 5 ? 'high' : data.users_no_bottles > 0 ? 'medium' : 'ok'}
      />

      <h3 style={{ ...sectionH3, margin: '16px 0 4px' }}>
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

      <h3 style={{ ...sectionH3, margin: '16px 0 4px' }}>
        AI health
      </h3>

      <InsightRow
        label="AI failure rate (7 days)"
        value={`${data.ai_failure_rate_7d_pct}%`}
        description={`${data.top_failing_ai_action ? `Highest failure rate on: ${data.top_failing_ai_action}` : 'No failed AI calls in the last 7 days.'}`}
        severity={data.ai_failure_rate_7d_pct > 10 ? 'high' : data.ai_failure_rate_7d_pct > 2 ? 'medium' : 'ok'}
      />

      <h3 style={{ ...sectionH3, margin: '16px 0 4px' }}>
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

      {data.top_events_7d.length > 0 && (
        <>
          <h3 style={{ ...sectionH3, margin: '16px 0 4px' }}>
            Most-used features (7 days, by event count)
          </h3>
          <div style={{
            background: 'var(--bg-muted)',
            border: '1px solid var(--border-medium)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}>
            {data.top_events_7d.map((ev, i) => (
              <div key={ev.event_name} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: i < data.top_events_7d.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{ev.event_name}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ev.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
