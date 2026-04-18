const RESEND_API = 'https://api.resend.com/emails';

function formatResendApiError(json: Record<string, unknown>, status: number): string {
  const m = json.message;
  if (typeof m === 'string' && m.trim()) return m.trim();
  if (Array.isArray(m) && m.length) {
    const parts = m.filter((x): x is string => typeof x === 'string');
    if (parts.length) return parts.join('; ');
  }
  if (typeof json.name === 'string' && json.name.trim()) return json.name.trim();
  return `Resend HTTP ${status}`;
}

export interface SendEmailParams {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  status: number;
  id?: string;
  error?: string;
}

/** Extra console context when Resend rejects the request (common: unverified sender domain). */
export function logResendFailure(logTag: string, result: SendEmailResult): void {
  if (result.ok) return;
  console.error(`[${logTag}] Resend error:`, result.status, result.error);
  if (result.status === 403) {
    console.error(
      `[${logTag}] Resend 403: the "from" domain must be verified in Resend, or use ` +
        `"Sommi <onboarding@resend.dev>" for testing. ADMIN_EMAIL can still be a personal Gmail address.`,
    );
  }
}

/**
 * Sends one email via Resend HTTP API (no Node SDK required on Edge).
 */
export async function sendResendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const errMsg = formatResendApiError(json, res.status);
    return { ok: false, status: res.status, error: errMsg };
  }

  const id = typeof json.id === 'string' ? json.id : undefined;
  return { ok: true, status: res.status, id };
}
