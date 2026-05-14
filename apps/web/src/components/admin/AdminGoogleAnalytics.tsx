import { useState } from 'react';
import { useAdminGoogleAnalytics, GA4OverviewPeriod } from '../../hooks/admin/useAdminGoogleAnalytics';
import { WineLoader } from '../WineLoader';

// ── tiny shared primitives ───────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: '0.7rem',
      fontWeight: 600,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      margin: '28px 0 10px',
    }}>
      {children}
    </h3>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'green' | 'amber' | 'red' | 'blue' | 'none';
}) {
  const color =
    accent === 'green' ? 'var(--color-success)' :
    accent === 'amber' ? 'var(--color-warning)' :
    accent === 'red'   ? 'var(--color-error)' :
    accent === 'blue'  ? '#60a5fa' :
    'var(--text-primary)';

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-medium)',
      borderRadius: '12px',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
    }}>
      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </span>
      <span style={{ fontSize: '1.55rem', fontWeight: 700, color, lineHeight: 1.1 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{sub}</span>
      )}
    </div>
  );
}

// ── mini bar chart ───────────────────────────────────────────────────────────

function BarList({
  items,
  valueLabel,
}: {
  items: { label: string; value: number; pct?: number; sub?: string }[];
  valueLabel?: string;
}) {
  if (items.length === 0) return <EmptyState />;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-medium)',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      {items.map((item, i) => {
        const barPct = (item.value / max) * 100;
        return (
          <div
            key={item.label + i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              position: 'relative',
            }}
          >
            {/* background bar */}
            <div style={{
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              width: `${barPct}%`,
              background: 'var(--interactive-hover)',
              opacity: 0.45,
              borderRadius: i === 0 ? '12px 0 0 0' : i === items.length - 1 ? '0 0 0 12px' : '0',
              transition: 'width 0.4s ease',
            }} />

            <span style={{
              flex: 1,
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
              position: 'relative',
              zIndex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.label}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1, flexShrink: 0 }}>
              {item.sub && (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{item.sub}</span>
              )}
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-heading)', minWidth: '40px', textAlign: 'right' }}>
                {item.value.toLocaleString()}
              </span>
              {item.pct !== undefined && (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', minWidth: '36px', textAlign: 'right' }}>
                  {item.pct.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        );
      })}
      {valueLabel && (
        <div style={{ padding: '6px 14px 8px', fontSize: '0.65rem', color: 'var(--text-tertiary)', textAlign: 'right', borderTop: '1px solid var(--border-subtle)' }}>
          {valueLabel}
        </div>
      )}
    </div>
  );
}

// ── sparkline / trend chart (SVG) ────────────────────────────────────────────

function TrendChart({
  data,
  metric,
}: {
  data: { date: string; sessions: number; users: number; pageViews: number }[];
  metric: 'sessions' | 'users' | 'pageViews';
}) {
  if (data.length < 2) return <EmptyState />;

  const values = data.map(d => d[metric]);
  const max = Math.max(...values, 1);
  const W = 600;
  const H = 80;
  const pad = 4;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v / max) * (H - pad * 2));
    return `${x},${y}`;
  });

  const polyline = points.join(' ');
  const area = `${pad},${H - pad} ${points.join(' ')} ${W - pad},${H - pad}`;

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-medium)',
      borderRadius: '12px',
      padding: '14px 16px',
    }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80, display: 'block' }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-wine, #9b2247)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-wine, #9b2247)" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#trendGrad)" />
        <polyline points={polyline} fill="none" stroke="var(--color-wine, #9b2247)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
          {formatDate(data[0].date)}
        </span>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          peak: {Math.max(...values).toLocaleString()}
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
          {formatDate(data[data.length - 1].date)}
        </span>
      </div>
    </div>
  );
}

// ── device doughnut (CSS-based) ──────────────────────────────────────────────

const DEVICE_COLORS: Record<string, string> = {
  mobile:  '#e07b6e',
  desktop: '#60a5fa',
  tablet:  '#a78bfa',
};

function DeviceChart({ devices }: { devices: { device: string; pct: number }[] }) {
  if (devices.length === 0) return <EmptyState />;
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-medium)',
      borderRadius: '12px',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {devices.map(d => {
        const color = DEVICE_COLORS[d.device.toLowerCase()] ?? 'var(--text-tertiary)';
        return (
          <div key={d.device} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {d.device}
            </span>
            <div style={{
              flex: 3,
              height: 8,
              background: 'var(--bg-muted)',
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${d.pct}%`,
                background: color,
                borderRadius: 4,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-heading)', minWidth: 36, textAlign: 'right' }}>
              {d.pct.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-medium)',
      borderRadius: '12px',
      padding: '24px',
      textAlign: 'center',
      color: 'var(--text-tertiary)',
      fontSize: '0.8rem',
    }}>
      No data available
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return yyyymmdd;
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return `${parseInt(m)}/${parseInt(d)}`;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      background: 'var(--bg-muted)',
      padding: '1px 6px',
      borderRadius: 4,
      fontSize: '0.76rem',
      fontFamily: 'monospace',
      color: 'var(--text-primary)',
    }}>
      {children}
    </code>
  );
}

function StepBlock({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
      <div style={{
        flexShrink: 0,
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: 'var(--interactive-hover)',
        border: '1px solid var(--border-medium)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.68rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginTop: 2,
      }}>
        {n}
      </div>
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '3px' }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{children}</div>
      </div>
    </div>
  );
}

function MethodCard({ badge, title, recommended, children }: {
  badge: string;
  title: string;
  recommended?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--bg-muted)',
      border: `1px solid ${recommended ? 'var(--color-success, #22c55e)' : 'var(--border-medium)'}`,
      borderRadius: '10px',
      padding: '16px 18px',
      marginBottom: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          background: recommended ? 'var(--color-success, #22c55e)' : 'var(--border-medium)',
          color: recommended ? '#fff' : 'var(--text-secondary)',
          padding: '2px 8px',
          borderRadius: 20,
        }}>
          {badge}
        </span>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-heading)' }}>{title}</span>
        {recommended && (
          <span style={{ fontSize: '0.68rem', color: 'var(--color-success, #22c55e)', marginLeft: 'auto' }}>
            ← recommended
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Not_Configured() {
  return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ fontSize: '1.6rem', marginBottom: '10px' }}>📊</div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>
        GA4 reporting not configured
      </h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
        Set <Code>GA4_PROPERTY_ID</Code> plus one auth method on the <strong>API server</strong> (Railway env vars).
        Choose the method that works for your account:
      </p>

      {/* ── Method A: OAuth2 (recommended) ── */}
      <MethodCard badge="Method A" title="OAuth 2.0 — your Google account" recommended>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
          Uses your own Google account which already has GA4 access.
          No GA4 UI permission changes needed.
        </p>
        <StepBlock n={1} title="Create OAuth client ID in GCP">
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-wine, #9b2247)' }}
          >
            GCP Console → APIs &amp; Services → Credentials
          </a>
          {' → '}Create OAuth client ID → Application type: <strong>Desktop app</strong>.
          Copy the Client ID and Client Secret.
        </StepBlock>
        <StepBlock n={2} title="Enable the GA4 Data API">
          In the same GCP project, enable:{' '}
          <a
            href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-wine, #9b2247)' }}
          >
            Google Analytics Data API v1
          </a>.
        </StepBlock>
        <StepBlock n={3} title="Generate your refresh token (run once, locally)">
          <Code>npx tsx apps/api/scripts/ga4-get-refresh-token.ts</Code>
          <br />
          Follow the printed URL, sign in, paste the code → your refresh token is printed.
        </StepBlock>
        <StepBlock n={4} title="Set these 4 Railway env vars">
          <Code>GA4_PROPERTY_ID</Code>{'  '}
          <Code>GA4_OAUTH_CLIENT_ID</Code>{'  '}
          <Code>GA4_OAUTH_CLIENT_SECRET</Code>{'  '}
          <Code>GA4_OAUTH_REFRESH_TOKEN</Code>
        </StepBlock>
      </MethodCard>

      {/* ── Method B: Service account ── */}
      <MethodCard badge="Method B" title="Service account (if allowed by your org)">
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
          Some Google Workspace organizations block adding service account emails
          in the GA4 UI. If you see "This email doesn't match a Google Account", use Method A instead.
        </p>
        <StepBlock n={1} title="Create a service account in GCP">
          GCP Console → IAM → Service Accounts → Create → download JSON key.
        </StepBlock>
        <StepBlock n={2} title="Grant GA4 access">
          GA4 Admin → Property Access Management → Add users → paste the{' '}
          <Code>client_email</Code> from the JSON → role: <strong>Viewer</strong>.
        </StepBlock>
        <StepBlock n={3} title="Set these 2 Railway env vars">
          <Code>GA4_PROPERTY_ID</Code>{'  '}
          <Code>GA4_SERVICE_ACCOUNT_JSON</Code>{' '}(paste entire JSON as one line)
        </StepBlock>
      </MethodCard>

      <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        Full instructions in <Code>apps/api/.env.example</Code>.
        Property ID: GA4 Admin → Property Settings → Property ID (numeric, e.g. 123456789).
      </p>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

type Period = '7d' | '30d';
type TrendMetric = 'sessions' | 'users' | 'pageViews';

export function AdminGoogleAnalytics() {
  const { data, isLoading, error } = useAdminGoogleAnalytics();
  const [period, setPeriod] = useState<Period>('7d');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('sessions');

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <WineLoader variant="default" size="md" message="Fetching GA4 data…" />
      </div>
    );
  }

  if (error) {
    const msg = error instanceof Error ? error.message : String(error);

    // "Not configured" state — show the full setup guide
    if (
      msg.toLowerCase().includes('not configured') ||
      msg.toLowerCase().includes('no auth credentials') ||
      msg.toLowerCase().includes('ga4_property_id is not set')
    ) {
      return <Not_Configured />;
    }

    // Specific actionable error from the API — show in a clear card
    return (
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--color-error)',
        borderRadius: '12px',
        padding: '20px 22px',
        maxWidth: 600,
      }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-error)', marginBottom: '8px' }}>
          GA4 error
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: '0 0 12px' }}>
          {msg}
        </p>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: 0 }}>
          Check Railway logs (filter: <code style={{ fontSize: '0.7rem' }}>[Analytics]</code>) for the full Google error message.
          Then visit <code style={{ fontSize: '0.7rem' }}>{(import.meta.env.VITE_API_URL || '') + '/api/analytics/ga4/status'}</code> in your browser for a config health check.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const overview: GA4OverviewPeriod | null = data.overview[period];
  const bounceAccent = !overview ? 'none' : overview.bounceRate > 70 ? 'red' : overview.bounceRate > 50 ? 'amber' : 'green';

  // Build source items for BarList
  const totalSourceSessions = data.sources.reduce((s, r) => s + r.sessions, 0);
  const sourceItems = data.sources.map(s => ({
    label: s.channel,
    value: s.sessions,
    pct: totalSourceSessions > 0 ? (s.sessions / totalSourceSessions) * 100 : 0,
    sub: `${s.users.toLocaleString()} users`,
  }));

  const countryItems = data.countries.map(c => ({
    label: c.country,
    value: c.users,
    sub: `${c.sessions.toLocaleString()} sessions`,
  }));

  const pageItems = data.pages.map(p => ({
    label: p.path,
    value: p.views,
    sub: `${p.users.toLocaleString()} users · ${formatDuration(p.avgDuration)}`,
  }));

  const landingItems = data.landingPages.map(p => ({
    label: p.path === '/' ? '/ (home)' : p.path,
    value: p.sessions,
    sub: `${p.bounceRate.toFixed(0)}% bounce`,
  }));

  const fetchedLabel = data.fetchedAt
    ? `Last fetched ${new Date(data.fetchedAt).toLocaleTimeString()}`
    : undefined;

  return (
    <div>
      {/* ── Header strip ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '4px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Realtime pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--color-success-light, rgba(34,197,94,0.1))',
            border: '1px solid var(--color-success, #22c55e)',
            borderRadius: '20px',
            padding: '4px 12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-success, #22c55e)',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--color-success, #22c55e)',
              animation: 'pulse 2s infinite',
            }} />
            {data.realtimeUsers} active now
          </div>

          {fetchedLabel && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{fetchedLabel}</span>
          )}
        </div>

        {/* Period toggle */}
        <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-muted)', borderRadius: 8, padding: 2 }}>
          {(['7d', '30d'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '4px 14px',
                borderRadius: 6,
                border: 'none',
                background: period === p ? 'var(--bg-surface)' : 'transparent',
                color: period === p ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontWeight: period === p ? 600 : 400,
                fontSize: '0.78rem',
                cursor: 'pointer',
                boxShadow: period === p ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {p === '7d' ? 'Last 7 days' : 'Last 30 days'}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI grid ─────────────────────────────────────────────────────── */}
      <SectionTitle>Overview — {period === '7d' ? 'last 7 days' : 'last 30 days'}</SectionTitle>
      {overview ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: '10px' }}>
          <KpiCard
            label="Active users"
            value={overview.activeUsers.toLocaleString()}
            sub={`${overview.newUsers.toLocaleString()} new`}
            accent="blue"
          />
          <KpiCard
            label="Sessions"
            value={overview.sessions.toLocaleString()}
          />
          <KpiCard
            label="Page views"
            value={overview.pageViews.toLocaleString()}
          />
          <KpiCard
            label="Avg. session"
            value={formatDuration(overview.avgSessionDuration)}
          />
          <KpiCard
            label="Bounce rate"
            value={`${overview.bounceRate.toFixed(1)}%`}
            accent={bounceAccent}
          />
          <KpiCard
            label="Engagement rate"
            value={`${overview.engagementRate.toFixed(1)}%`}
            accent={overview.engagementRate > 50 ? 'green' : 'amber'}
          />
          <KpiCard
            label="New users"
            value={overview.newUsers.toLocaleString()}
            sub={overview.activeUsers > 0
              ? `${((overview.newUsers / overview.activeUsers) * 100).toFixed(0)}% of active`
              : undefined}
            accent="green"
          />
        </div>
      ) : (
        <EmptyState />
      )}

      {/* ── Session trend ─────────────────────────────────────────────────── */}
      <SectionTitle>30-day trend</SectionTitle>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {(['sessions', 'users', 'pageViews'] as TrendMetric[]).map(m => (
          <button
            key={m}
            onClick={() => setTrendMetric(m)}
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-medium)',
              background: trendMetric === m ? 'var(--interactive-hover)' : 'transparent',
              color: trendMetric === m ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: trendMetric === m ? 600 : 400,
              fontSize: '0.72rem',
              cursor: 'pointer',
            }}
          >
            {m === 'pageViews' ? 'Page views' : m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      <TrendChart data={data.dailyTrend} metric={trendMetric} />

      {/* ── Two-column below ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '4px' }}>

        <div>
          <SectionTitle>Traffic channels (30 days)</SectionTitle>
          <BarList items={sourceItems} valueLabel="Sessions" />
        </div>

        <div>
          <SectionTitle>Devices (30 days)</SectionTitle>
          <DeviceChart devices={data.devices} />
        </div>

      </div>

      {/* ── Countries ────────────────────────────────────────────────────── */}
      <SectionTitle>Top countries (30 days)</SectionTitle>
      <BarList items={countryItems} valueLabel="Active users" />

      {/* ── Pages ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '4px' }}>

        <div>
          <SectionTitle>Top pages (30 days)</SectionTitle>
          <BarList items={pageItems} valueLabel="Page views" />
        </div>

        <div>
          <SectionTitle>Top landing pages (30 days)</SectionTitle>
          <BarList items={landingItems} valueLabel="Sessions" />
        </div>

      </div>

      {/* footer note */}
      <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '20px' }}>
        Data from GA4 property <code style={{ fontSize: '0.65rem' }}>{data.propertyId}</code>.
        Cached 5 min per tab load. All dates in UTC.
      </p>
    </div>
  );
}
