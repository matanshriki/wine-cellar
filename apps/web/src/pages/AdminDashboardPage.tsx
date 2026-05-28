import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { WineLoader } from '../components/WineLoader';
import { captureAppError } from '../lib/monitoring';
import { isSentryInitialized } from '../lib/sentry';
import { AdminOverview }           from '../components/admin/AdminOverview';
import { AdminUsers }              from '../components/admin/AdminUsers';
import { AdminWineDataQuality }    from '../components/admin/AdminWineDataQuality';
import { AdminEvents }             from '../components/admin/AdminEvents';
import { AdminAiUsage }            from '../components/admin/AdminAiUsage';
import { AdminInsights }           from '../components/admin/AdminInsights';
import { AdminGoogleAnalytics }    from '../components/admin/AdminGoogleAnalytics';

type Tab = 'overview' | 'users' | 'wine-data' | 'events' | 'ai' | 'insights' | 'traffic' | 'monitoring';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',   label: 'Overview'   },
  { id: 'users',      label: 'Users'      },
  { id: 'wine-data',  label: 'Wine Data'  },
  { id: 'events',     label: 'Events'     },
  { id: 'ai',         label: 'AI & Usage' },
  { id: 'insights',   label: 'Insights'   },
  { id: 'traffic',    label: 'Traffic'    },
  { id: 'monitoring', label: 'Monitoring' },
];

function AdminMonitoringPanel() {
  const [sent, setSent] = useState(false);
  const active = isSentryInitialized();

  const handleTestError = () => {
    captureAppError(new Error('Sentry Test Error — Sommi Admin'), {
      test: true,
      triggered_by: 'admin_dashboard',
      timestamp: new Date().toISOString(),
    });
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 8 }}>
        Sentry Monitoring
      </h2>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
        Status: <strong style={{ color: active ? '#22c55e' : '#ef4444' }}>{active ? 'Active' : 'Not configured (no VITE_SENTRY_DSN)'}</strong>
      </p>
      <button
        onClick={handleTestError}
        disabled={!active || sent}
        style={{
          padding: '8px 20px',
          borderRadius: 8,
          border: '1px solid var(--border-medium)',
          background: sent ? 'var(--bg-muted)' : 'var(--interactive-hover)',
          color: 'var(--text-primary)',
          fontWeight: 600,
          fontSize: '0.85rem',
          cursor: active && !sent ? 'pointer' : 'not-allowed',
          opacity: active ? 1 : 0.5,
          transition: 'all 0.15s',
        }}
      >
        {sent ? 'Test error sent — check Sentry' : 'Send test error to Sentry'}
      </button>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.5 }}>
        Admin-only. Sends a tagged test exception to verify Sentry ingestion and source maps.
        Check the Sentry dashboard for a new issue in ~30s.
      </p>
    </div>
  );
}

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [isAdmin,       setIsAdmin]       = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [activeTab,     setActiveTab]     = useState<Tab>('overview');

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setCheckingAdmin(false);
      return;
    }

    supabase
      .rpc('is_admin', { check_user_id: user.id })
      .then(({ data, error }) => {
        setIsAdmin(error ? false : (data as boolean));
        setCheckingAdmin(false);
      })
      .catch(() => {
        setIsAdmin(false);
        setCheckingAdmin(false);
      });
  }, [user]);

  // ── Loading admin check ──────────────────────────────────────────────────
  if (checkingAdmin) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}>
        <WineLoader variant="default" size="md" message="Verifying access…" />
      </div>
    );
  }

  // ── Not authorized ───────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '24px',
      }}>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: '16px',
          padding: '40px 32px',
          textAlign: 'center',
          maxWidth: '360px',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px', opacity: 0.6 }}>🔒</div>
          <h2 style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--text-heading)',
            marginBottom: '10px',
          }}>
            Not authorized
          </h2>
          <p style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}>
            This page requires admin access.
            Contact the account owner to enable <code style={{ background: 'var(--bg-muted)', borderRadius: '4px', padding: '1px 5px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>profiles.is_admin = true</code>.
          </p>
        </div>
      </div>
    );
  }

  // ── Admin dashboard ──────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 0 60px' }}>
      {/* Header */}
      <div style={{
        padding: '24px 0 20px',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '0',
      }}>
        <h1 style={{
          fontSize: '1.3rem',
          fontWeight: 700,
          color: 'var(--text-heading)',
          margin: '0 0 4px',
          letterSpacing: '-0.01em',
        }}>
          Intelligence Dashboard
        </h1>
        <p style={{
          fontSize: '0.8rem',
          color: 'var(--text-tertiary)',
          margin: 0,
        }}>
          Read-only. Data from Supabase only — no mocks.
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '2px',
        overflowX: 'auto',
        padding: '16px 0',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '24px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab.id
                ? 'var(--interactive-hover)'
                : 'transparent',
              color: activeTab === tab.id
                ? 'var(--text-primary)'
                : 'var(--text-tertiary)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview'    && <AdminOverview />}
        {activeTab === 'users'       && <AdminUsers />}
        {activeTab === 'wine-data'   && <AdminWineDataQuality />}
        {activeTab === 'events'      && <AdminEvents />}
        {activeTab === 'ai'          && <AdminAiUsage />}
        {activeTab === 'insights'    && <AdminInsights />}
        {activeTab === 'traffic'     && <AdminGoogleAnalytics />}
        {activeTab === 'monitoring'  && <AdminMonitoringPanel />}
      </div>
    </div>
  );
}
