import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { WineLoader } from '../components/WineLoader';
import { AdminOverview }         from '../components/admin/AdminOverview';
import { AdminUsers }            from '../components/admin/AdminUsers';
import { AdminWineDataQuality }  from '../components/admin/AdminWineDataQuality';
import { AdminEvents }           from '../components/admin/AdminEvents';
import { AdminAiUsage }          from '../components/admin/AdminAiUsage';
import { AdminInsights }         from '../components/admin/AdminInsights';

type Tab = 'overview' | 'users' | 'wine-data' | 'events' | 'ai' | 'insights';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',  label: 'Overview'   },
  { id: 'users',     label: 'Users'      },
  { id: 'wine-data', label: 'Wine Data'  },
  { id: 'events',    label: 'Events'     },
  { id: 'ai',        label: 'AI & Usage' },
  { id: 'insights',  label: 'Insights'   },
];

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
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(224,92,92,0.25)',
          borderRadius: '16px',
          padding: '40px 32px',
          textAlign: 'center',
          maxWidth: '360px',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px', opacity: 0.6 }}>🔒</div>
          <h2 style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--text-primary, #fff)',
            marginBottom: '10px',
          }}>
            Not authorized
          </h2>
          <p style={{
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.6,
          }}>
            This page requires admin access.
            Contact the account owner to enable <code style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px', padding: '1px 5px', fontSize: '0.8rem' }}>profiles.is_admin = true</code>.
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
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        marginBottom: '0',
      }}>
        <h1 style={{
          fontSize: '1.3rem',
          fontWeight: 700,
          color: 'var(--text-primary, #fff)',
          margin: '0 0 4px',
          letterSpacing: '-0.01em',
        }}>
          Intelligence Dashboard
        </h1>
        <p style={{
          fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.35)',
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
        borderBottom: '1px solid rgba(255,255,255,0.07)',
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
                ? 'rgba(255,255,255,0.1)'
                : 'transparent',
              color: activeTab === tab.id
                ? 'rgba(255,255,255,0.95)'
                : 'rgba(255,255,255,0.4)',
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
        {activeTab === 'overview'  && <AdminOverview />}
        {activeTab === 'users'     && <AdminUsers />}
        {activeTab === 'wine-data' && <AdminWineDataQuality />}
        {activeTab === 'events'    && <AdminEvents />}
        {activeTab === 'ai'        && <AdminAiUsage />}
        {activeTab === 'insights'  && <AdminInsights />}
      </div>
    </div>
  );
}
