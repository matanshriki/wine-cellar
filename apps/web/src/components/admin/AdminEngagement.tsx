import { useMemo, useState } from 'react';
import { WineLoader } from '../WineLoader';
import {
  useAdminEngagementOverview,
  useAdminEngagementUserDetail,
  useAdminEngagementUsers,
  type EngagementUserFilters,
  type EngagementUserRow,
} from '../../hooks/admin/useAdminEngagement';
import {
  ENGAGEMENT_DEFINITIONS,
  ENGAGEMENT_RULES,
  RISK_LABELS,
  SEGMENT_LABELS,
  type EngagementRisk,
  type EngagementSegment,
} from '../../lib/admin/engagementRules';

const PAGE_SIZE = 25;

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function StatCard({
  label,
  value,
  sub,
  note,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  note?: string;
  accent?: 'red' | 'amber' | 'green' | 'muted';
}) {
  const accentColor =
    accent === 'red' ? 'var(--color-error)' :
    accent === 'amber' ? 'var(--color-warning)' :
    accent === 'green' ? 'var(--color-success)' :
    'var(--text-primary)';

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-medium)',
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 0,
    }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </span>
      <span style={{ fontSize: '1.55rem', fontWeight: 700, color: accentColor, lineHeight: 1.1 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>{sub}</span>}
      {note && <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{note}</span>}
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
      margin: '22px 0 10px',
    }}>
      {children}
    </h3>
  );
}

function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue';
}) {
  const colors = {
    neutral: { bg: 'var(--bg-muted)', fg: 'var(--text-secondary)' },
    green: { bg: 'color-mix(in srgb, var(--color-success) 16%, transparent)', fg: 'var(--color-success)' },
    amber: { bg: 'color-mix(in srgb, var(--color-warning) 16%, transparent)', fg: 'var(--color-warning)' },
    red: { bg: 'color-mix(in srgb, var(--color-error) 16%, transparent)', fg: 'var(--color-error)' },
    blue: { bg: 'var(--interactive-hover)', fg: 'var(--text-primary)' },
  }[tone];

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 6,
      fontSize: '0.7rem',
      fontWeight: 600,
      background: colors.bg,
      color: colors.fg,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function segmentTone(s: EngagementSegment): 'neutral' | 'green' | 'amber' | 'red' | 'blue' {
  switch (s) {
    case 'power_user': return 'green';
    case 'regular': return 'blue';
    case 'occasional_engaged': return 'neutral';
    case 'new': return 'blue';
    case 'not_activated': return 'amber';
    case 'dormant': return 'red';
    default: return 'neutral';
  }
}

function riskTone(r: EngagementRisk): 'neutral' | 'green' | 'amber' | 'red' | 'blue' {
  switch (r) {
    case 'no_detected_decline': return 'green';
    case 'declining_engagement': return 'amber';
    case 'at_risk_of_disengagement': return 'red';
    case 'prolonged_inactivity': return 'red';
    case 'insufficient_history': return 'neutral';
    default: return 'neutral';
  }
}

function trendGlyph(t: EngagementUserRow['activity_trend']) {
  if (t === 'up') return '↑';
  if (t === 'down') return '↓';
  return '→';
}

const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border-medium)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontSize: '0.8rem',
  minWidth: 0,
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  width: '100%',
};

function UserDetailPanel({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useAdminEngagementUserDetail(userId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="User engagement detail"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(520px, 100%)',
          height: '100%',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-medium)',
          overflowY: 'auto',
          padding: '20px 18px 48px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-heading)' }}>User detail</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid var(--border-medium)',
              background: 'transparent',
              borderRadius: 8,
              padding: '6px 12px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            Close
          </button>
        </div>

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <WineLoader variant="default" size="md" message="Loading detail…" />
          </div>
        )}

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: '0.85rem' }}>
            {error instanceof Error ? error.message : 'Failed to load'}
          </p>
        )}

        {data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {data.user.email ?? data.user.user_id}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                Signed up {formatDate(data.user.created_at)} · {data.user.account_age_days}d old · times UTC
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <Badge tone={segmentTone(data.classification.segment)}>
                  {SEGMENT_LABELS[data.classification.segment]}
                </Badge>
                <Badge tone={riskTone(data.classification.risk)}>
                  {RISK_LABELS[data.classification.risk]}
                </Badge>
                {data.user.is_excluded && <Badge tone="amber">Excluded from metrics</Badge>}
              </div>
            </div>

            <section>
              <SectionTitle>Classification explanation</SectionTitle>
              <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {data.classification.segment_reason}
              </p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {data.classification.risk_reason}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                Data sufficiency: {data.classification.data_sufficiency}
              </p>
            </section>

            <section>
              <SectionTitle>Observed evidence</SectionTitle>
              <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {data.classification.observed_evidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>

            <section>
              <SectionTitle>Comparable periods (28d)</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <StatCard
                  label="Current 28d"
                  value={data.comparable_periods.current_28d.active_days}
                  sub={`${data.comparable_periods.current_28d.actions ?? 0} actions`}
                />
                <StatCard
                  label="Previous 28d"
                  value={data.comparable_periods.previous_28d.active_days}
                  sub={`${data.comparable_periods.previous_28d.actions ?? 0} actions`}
                />
              </div>
            </section>

            <section>
              <SectionTitle>Feature breakdown (lifetime)</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.78rem' }}>
                {Object.entries(data.feature_breakdown).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--text-secondary)' }}>
                    <span>{k.replace(/_/g, ' ')}</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{v}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle>Technical failures (90d)</SectionTitle>
              <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                {data.technical_failures.scan_failures_coverage}
              </p>
              {data.technical_failures.ai_failures_90d.length === 0 &&
               data.technical_failures.scan_failures_90d.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                  No recorded AI/scan failures in range (or insufficient tracking history).
                </p>
              ) : (
                <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {data.technical_failures.ai_failures_90d.slice(0, 8).map((f, i) => (
                    <li key={`ai-${i}`}>
                      AI {String(f.action_type)} · {String(f.request_status)} · {formatDate(String(f.created_at))}
                    </li>
                  ))}
                  {data.technical_failures.scan_failures_90d.slice(0, 8).map((f, i) => (
                    <li key={`scan-${i}`}>
                      Scan failed · {formatDate(String(f.created_at))}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <SectionTitle>Possible explanations (to investigate)</SectionTitle>
              <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {data.classification.possible_explanations.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <SectionTitle>Unknown / do not infer</SectionTitle>
              <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: '0.78rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                {data.classification.unknown_causes.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>

            <section>
              <SectionTitle>Suggested investigation</SectionTitle>
              {(data.suggested_actions?.length ?? 0) === 0 ? (
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>No specific follow-up flagged.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.suggested_actions.map((s) => (
                    <div key={s.title} style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      padding: '12px 14px',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{s.title}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4 }}>{s.evidence}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{s.action}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionTitle>Activity history (90d)</SectionTitle>
              {(data.timeline?.length ?? 0) === 0 ? (
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>No meaningful events in range.</p>
              ) : (
                <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.55, maxHeight: 280, overflow: 'auto' }}>
                  {data.timeline.map((ev, i) => (
                    <li key={`${ev.at}-${ev.kind}-${i}`}>
                      {formatDate(ev.at)} · {ev.kind.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminEngagement() {
  const [page, setPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filters, setFilters] = useState<EngagementUserFilters>({
    search: '',
    segment: '',
    risk: '',
    feature: '',
    activityWindow: '',
    sort: 'last_meaningful_at',
    sortDir: 'desc',
    includeExcluded: false,
  });

  const overview = useAdminEngagementOverview();
  const usersQuery = useAdminEngagementUsers(PAGE_SIZE, page * PAGE_SIZE, filters);

  const filterControls = useMemo(() => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: 8,
      marginBottom: 14,
    }}>
      <input
        aria-label="Search users"
        placeholder="Search email / name"
        value={filters.search ?? ''}
        onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, search: e.target.value })); }}
        style={inputStyle}
      />
      <select
        aria-label="Segment filter"
        value={filters.segment ?? ''}
        onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, segment: e.target.value as EngagementSegment | '' })); }}
        style={selectStyle}
      >
        <option value="">All segments</option>
        {(Object.keys(SEGMENT_LABELS) as EngagementSegment[]).map((k) => (
          <option key={k} value={k}>{SEGMENT_LABELS[k]}</option>
        ))}
      </select>
      <select
        aria-label="Risk filter"
        value={filters.risk ?? ''}
        onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, risk: e.target.value as EngagementRisk | '' })); }}
        style={selectStyle}
      >
        <option value="">All risk</option>
        {(Object.keys(RISK_LABELS) as EngagementRisk[]).map((k) => (
          <option key={k} value={k}>{RISK_LABELS[k]}</option>
        ))}
      </select>
      <select
        aria-label="Feature usage filter"
        value={filters.feature ?? ''}
        onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, feature: e.target.value })); }}
        style={selectStyle}
      >
        <option value="">Any feature</option>
        <option value="bottles">Has bottles</option>
        <option value="scans">Has scans</option>
        <option value="recommendations">Has recommendations</option>
        <option value="sommelier">Has Sommi chat</option>
        <option value="consumption">Has consumption</option>
        <option value="evening_plans">Has evening plans</option>
        <option value="reminders">Has reminders</option>
        <option value="ai">Has AI calls</option>
        <option value="errors_28d">Errors in 28d</option>
      </select>
      <select
        aria-label="Activity window filter"
        value={filters.activityWindow ?? ''}
        onChange={(e) => {
          setPage(0);
          setFilters((f) => ({
            ...f,
            activityWindow: e.target.value as EngagementUserFilters['activityWindow'],
          }));
        }}
        style={selectStyle}
      >
        <option value="">Any activity</option>
        <option value="7d">Active in 7d</option>
        <option value="28d">Active in 28d</option>
        <option value="none_28d">No activity in 28d</option>
      </select>
      <select
        aria-label="Account age filter"
        value={
          filters.maxAccountAgeDays === ENGAGEMENT_RULES.onboardingDays - 1 ? 'new' :
          filters.minAccountAgeDays === ENGAGEMENT_RULES.onboardingDays ? 'mature' :
          ''
        }
        onChange={(e) => {
          setPage(0);
          const v = e.target.value;
          if (v === 'new') {
            setFilters((f) => ({ ...f, minAccountAgeDays: null, maxAccountAgeDays: ENGAGEMENT_RULES.onboardingDays - 1 }));
          } else if (v === 'mature') {
            setFilters((f) => ({ ...f, minAccountAgeDays: ENGAGEMENT_RULES.onboardingDays, maxAccountAgeDays: null }));
          } else {
            setFilters((f) => ({ ...f, minAccountAgeDays: null, maxAccountAgeDays: null }));
          }
        }}
        style={selectStyle}
      >
        <option value="">Any account age</option>
        <option value="new">Onboarding (&lt;14d)</option>
        <option value="mature">Past onboarding (≥14d)</option>
      </select>
      <select
        aria-label="Sort by"
        value={`${filters.sort}:${filters.sortDir}`}
        onChange={(e) => {
          const [sort, sortDir] = e.target.value.split(':');
          setFilters((f) => ({ ...f, sort, sortDir: sortDir as 'asc' | 'desc' }));
        }}
        style={selectStyle}
      >
        <option value="last_meaningful_at:desc">Last activity ↓</option>
        <option value="last_meaningful_at:asc">Last activity ↑</option>
        <option value="created_at:desc">Signup ↓</option>
        <option value="created_at:asc">Signup ↑</option>
        <option value="active_days_28d:desc">Active days 28d ↓</option>
        <option value="bottle_count:desc">Bottles ↓</option>
        <option value="account_age_days:desc">Account age ↓</option>
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        <input
          type="checkbox"
          checked={!!filters.includeExcluded}
          onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, includeExcluded: e.target.checked })); }}
        />
        Include excluded
      </label>
    </div>
  ), [filters]);

  if (overview.isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <WineLoader variant="default" size="md" message="Loading engagement…" />
      </div>
    );
  }

  if (overview.error || !overview.data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-error)' }}>
        Failed to load engagement: {overview.error instanceof Error ? overview.error.message : 'Unknown error'}
      </div>
    );
  }

  const d = overview.data;
  const t = d.totals;

  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {ENGAGEMENT_DEFINITIONS.heuristicsNote} Reporting timezone: <strong>{d.reporting_timezone}</strong>.
      </p>
      <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        Active = {ENGAGEMENT_DEFINITIONS.active}
      </p>
      <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        Activated = {ENGAGEMENT_DEFINITIONS.activated}
      </p>
      <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        {ENGAGEMENT_DEFINITIONS.comparableWindows}
      </p>
      <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        {ENGAGEMENT_DEFINITIONS.sourceCoverage}
      </p>
      <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        {ENGAGEMENT_DEFINITIONS.durableComparableMeaning}
      </p>
      <p style={{ margin: '0 0 14px', fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        {ENGAGEMENT_DEFINITIONS.activationDurability}
      </p>

      <SectionTitle>Overview</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        <StatCard label="Total users" value={t.total_users} sub={`excl. ${d.exclusions.excluded_count} internal/test`} />
        <StatCard label="New signups (7d)" value={t.new_signups_7d} accent="green" />
        <StatCard label="Meaningful active (7d)" value={t.meaningfully_active_7d} />
        <StatCard label="Meaningful active (28d)" value={t.meaningfully_active_28d} />
        <StatCard
          label="Lifetime activation (≥14d age)"
          value={d.activation_rate == null ? 'n/a' : `${d.activation_rate}%`}
          sub={`${t.activation_numerator} / ${t.activation_denominator}`}
          note={
            (d as { activation_rate_note?: string }).activation_rate_note
            ?? ENGAGEMENT_DEFINITIONS.activationMetric
          }
        />
      </div>

      <SectionTitle>Segments</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
        <StatCard label="New" value={t.seg_new} />
        <StatCard label="Not activated" value={t.seg_not_activated} accent={t.seg_not_activated > 0 ? 'amber' : undefined} />
        <StatCard label="Occasional" value={t.seg_occasional} />
        <StatCard label="Regular" value={t.seg_regular} />
        <StatCard label="Power" value={t.seg_power} accent="green" />
        <StatCard label="Dormant" value={t.seg_dormant} accent={t.seg_dormant > 0 ? 'red' : undefined} />
      </div>

      <SectionTitle>Engagement risk</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        <StatCard label="No decline" value={t.risk_none} accent="green" />
        <StatCard label="Declining" value={t.risk_declining} accent={t.risk_declining > 0 ? 'amber' : undefined} />
        <StatCard label="At risk" value={t.risk_at_risk} accent={t.risk_at_risk > 0 ? 'red' : undefined} />
        <StatCard
          label="Prolonged inactivity"
          value={t.risk_prolonged ?? 0}
          accent={(t.risk_prolonged ?? 0) > 0 ? 'red' : undefined}
          note="Not “no decline”"
        />
        <StatCard label="Insufficient history" value={t.risk_insufficient} note="Age &lt;56d or empty windows" />
      </div>

      <SectionTitle>Feature adoption (lifetime, users)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
        {Object.entries(d.feature_adoption).map(([k, v]) => (
          <StatCard key={k} label={k.replace(/_/g, ' ')} value={v} />
        ))}
      </div>

      <SectionTitle>Error signals (28d)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
        <StatCard label="Users w/ AI failures" value={d.error_signals_28d.users_with_ai_failures} accent={d.error_signals_28d.users_with_ai_failures > 0 ? 'amber' : undefined} />
        <StatCard
          label="Users w/ scan failures"
          value={d.error_signals_28d.users_with_scan_failures}
          note={d.error_signals_28d.scan_failures_note}
        />
      </div>

      <SectionTitle>Data coverage & exclusions</SectionTitle>
      <div style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: '14px 16px',
        fontSize: '0.76rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.55,
      }}>
        <div><strong style={{ color: 'var(--text-primary)' }}>Excluded:</strong> {d.exclusions.rule} ({d.exclusions.excluded_count} users)</div>
        <div style={{ marginTop: 6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>last_active_at:</strong> {d.data_coverage.last_active_at_note}
        </div>
        <div style={{ marginTop: 6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>app_events since:</strong>{' '}
          {d.data_coverage.app_events_tracking_since
            ? formatDate(d.data_coverage.app_events_tracking_since)
            : 'insufficient history — not shown as zero activity'}
        </div>
        <ul style={{ margin: '8px 0 0', paddingInlineStart: 18 }}>
          {d.data_coverage.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>

      <SectionTitle>Users</SectionTitle>
      {filterControls}

      {usersQuery.isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <WineLoader variant="default" size="md" message="Loading users…" />
        </div>
      )}

      {usersQuery.error && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-error)' }}>
          {usersQuery.error instanceof Error ? usersQuery.error.message : 'Failed to load users'}
        </div>
      )}

      {usersQuery.data && usersQuery.data.users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
          No users match these filters.
        </div>
      )}

      {usersQuery.data && usersQuery.data.users.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-medium)' }}>
                  {['User', 'Signed up', 'Last meaningful', 'Segment', 'Risk', 'Active 28d', 'Trend', 'Key actions', 'Reason', 'Errors'].map((h) => (
                    <th key={h} style={{
                      padding: '10px 10px',
                      textAlign: 'left',
                      color: 'var(--text-tertiary)',
                      fontWeight: 500,
                      fontSize: '0.68rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.users.map((u) => (
                  <tr
                    key={u.user_id}
                    onClick={() => setSelectedUserId(u.user_id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedUserId(u.user_id); }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open engagement detail for ${u.email ?? u.user_id}`}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--interactive-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '10px', color: 'var(--text-primary)', maxWidth: 180 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email ?? '—'}</div>
                      {u.is_excluded && <Badge tone="amber">excluded</Badge>}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(u.created_at)}</td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {u.last_meaningful_at
                        ? formatDate(u.last_meaningful_at)
                        : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>none recorded</span>}
                    </td>
                    <td style={{ padding: '10px' }}><Badge tone={segmentTone(u.segment)}>{SEGMENT_LABELS[u.segment]}</Badge></td>
                    <td style={{ padding: '10px' }}><Badge tone={riskTone(u.risk)}>{RISK_LABELS[u.risk]}</Badge></td>
                    <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-primary)' }}>
                      {u.active_days_28d}
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}> /prev {u.active_days_prev_28d}</span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{trendGlyph(u.activity_trend)}</td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                      B{u.bottle_count} · S{u.scan_wine_count} · R{u.recommendation_count} · C{u.conversation_count}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-tertiary)', fontSize: '0.72rem', maxWidth: 220 }}>
                      <span style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {u.segment_reason}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontSize: '0.72rem', color: (u.ai_failed_28d + u.scan_failed_28d) > 0 ? 'var(--color-warning)' : 'var(--text-tertiary)' }}>
                      {(u.ai_failed_28d + u.scan_failed_28d) > 0
                        ? `AI ${u.ai_failed_28d} · scan ${u.scan_failed_28d}`
                        : '—'}
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
            marginTop: 14,
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              {usersQuery.data.total} users · page {page + 1} of {Math.max(1, Math.ceil(usersQuery.data.total / PAGE_SIZE))}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                style={{ ...selectStyle, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={(page + 1) * PAGE_SIZE >= usersQuery.data.total}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  ...selectStyle,
                  cursor: (page + 1) * PAGE_SIZE >= usersQuery.data.total ? 'not-allowed' : 'pointer',
                  opacity: (page + 1) * PAGE_SIZE >= usersQuery.data.total ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {selectedUserId && (
        <UserDetailPanel userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
}
