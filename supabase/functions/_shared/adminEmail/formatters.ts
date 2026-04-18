import { adminEmailShell, escapeHtml, kvTable } from './html.ts';
import { valueCurrencyFromPaddlePayload } from './paddleTotals.ts';

export interface ProfileRecord {
  id: string;
  display_name?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at?: string | null;
}

export function fullNameFromProfile(p: ProfileRecord): string {
  const fn = (p.first_name ?? '').trim();
  const ln = (p.last_name ?? '').trim();
  const combined = `${fn} ${ln}`.trim();
  if (combined) return combined;
  return (p.display_name ?? '').trim() || '—';
}

export function signupSubject(email: string | null | undefined): string {
  const e = (email ?? 'unknown').trim() || 'unknown';
  return `New user signup - ${e}`;
}

export function signupEmailHtml(
  p: ProfileRecord,
  extras: { provider?: string | null },
): { subject: string; html: string } {
  const email = p.email ?? '—';
  const subject = signupSubject(p.email);
  const rows = [
    { label: 'User ID', value: p.id },
    { label: 'Email', value: email },
    { label: 'Full name', value: fullNameFromProfile(p) },
    { label: 'Display name', value: (p.display_name ?? '—').toString() },
    { label: 'Signup source / provider', value: extras.provider ?? '—' },
    { label: 'created_at', value: (p.created_at ?? '—').toString() },
  ];
  const html = adminEmailShell(
    'New signup',
    `<p style="margin:0 0 16px;">A new user profile was created.</p>${kvTable(rows)}`,
  );
  return { subject, html };
}

/** paddle_events row shape from DB webhook */
export interface PaddleEventRecord {
  event_id?: string | null;
  event_type?: string | null;
  user_id?: string | null;
  payload?: Record<string, unknown> | null;
  processed_at?: string | null;
}

function planKeyFromPaddleData(data: Record<string, unknown> | undefined): string {
  if (!data) return '—';
  const items = data.items as unknown;
  if (Array.isArray(items) && items[0] && typeof items[0] === 'object') {
    const price = (items[0] as Record<string, unknown>).price as Record<string, unknown> | undefined;
    const name = price?.name;
    if (typeof name === 'string' && name.trim()) return name;
    const id = price?.id;
    if (typeof id === 'string' && id.trim()) return id;
  }
  return '—';
}

/**
 * We key off `paddle_events`: every Paddle webhook is persisted here (see apps/api billing route).
 * That is the canonical audit trail for paid actions in this project.
 */
export function shouldNotifyPaddleInsert(record: PaddleEventRecord): boolean {
  const t = (record.event_type ?? '').trim();
  if (!t) return false;
  if (t === 'transaction.completed') return true;
  if (t === 'subscription.activated' || t === 'subscription.created') return true;
  return false;
}

export function purchaseEmailFromPaddle(
  record: PaddleEventRecord,
  userEmail: string | null,
): { subject: string; html: string } | null {
  if (!shouldNotifyPaddleInsert(record)) return null;

  const payload = record.payload ?? {};
  const data = (payload['data'] as Record<string, unknown> | undefined) ?? {};
  const vc = valueCurrencyFromPaddlePayload(data);
  const currency = vc?.currency ?? 'USD';
  const amountStr = vc != null ? `${vc.value} ${currency}` : 'amount n/a';
  const subject = `New purchase - ${amountStr}`;

  const provider = 'Paddle';
  const txnId =
    (typeof data.id === 'string' && data.id) ||
    (typeof record.event_id === 'string' && record.event_id) ||
    '—';

  const rows = [
    { label: 'User ID', value: (record.user_id ?? '—').toString() },
    { label: 'Email', value: (userEmail ?? '—').toString() },
    { label: 'Plan / tier', value: planKeyFromPaddleData(data) },
    { label: 'Amount', value: vc != null ? String(vc.value) : '—' },
    { label: 'Currency', value: currency },
    { label: 'Provider', value: provider },
    { label: 'Transaction / event id', value: txnId },
    { label: 'Paddle event type', value: (record.event_type ?? '—').toString() },
    { label: 'created_at (processed)', value: (record.processed_at ?? '—').toString() },
  ];

  const html = adminEmailShell(
    'New purchase',
    `<p style="margin:0 0 16px;">Paddle billing event recorded in <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px;">paddle_events</code>.</p>${kvTable(rows)}`,
  );
  return { subject, html };
}

export interface ScanSummaryJson {
  scan_count: number;
  distinct_users: number;
  first_scan_at: string | null;
  last_scan_at: string | null;
  top_users: Array<{ user_id: string; scans: number }>;
}

export function dailyScanSubject(total: number): string {
  return `Daily bottle scans summary - ${total} scans`;
}

export function dailyScanEmailHtml(stats: ScanSummaryJson, windowLabel: string): { subject: string; html: string } {
  const subject = dailyScanSubject(stats.scan_count);
  const topRows =
    stats.top_users?.length > 0
      ? stats.top_users
          .map(
            (u, i) =>
              `<tr><td style="padding:6px 8px;">${i + 1}.</td><td style="padding:6px 8px;"><code>${escapeHtml(u.user_id)}</code></td><td style="padding:6px 8px;text-align:right;">${u.scans}</td></tr>`,
          )
          .join('')
      : '<tr><td colspan="3" style="padding:8px;color:#71717a;">No per-user breakdown</td></tr>';

  const inner = `
    <p style="margin:0 0 12px;">Window: <strong>${escapeHtml(windowLabel)}</strong></p>
    ${kvTable([
      { label: 'Total bottle scans', value: String(stats.scan_count) },
      { label: 'Distinct users', value: String(stats.distinct_users) },
      { label: 'First scan (UTC)', value: stats.first_scan_at ?? '—' },
      { label: 'Last scan (UTC)', value: stats.last_scan_at ?? '—' },
    ])}
    <p style="margin:20px 0 8px;font-weight:600;">Top users by scan count</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e4e4e7;border-radius:6px;font-size:14px;">
      <thead><tr style="background:#fafafa;"><th style="text-align:left;padding:8px;width:32px;">#</th><th style="text-align:left;padding:8px;">user_id</th><th style="text-align:right;padding:8px;">Scans</th></tr></thead>
      <tbody>${topRows}</tbody>
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#71717a;">Scans are bottles created in the window where the wine was added via camera (<code>entry_source = ai_scan</code>) or an image path is present on the bottle or wine.</p>
  `;

  return { subject, html: adminEmailShell('Daily bottle scans', inner) };
}
