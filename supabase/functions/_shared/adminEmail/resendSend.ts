const RESEND_API = 'https://api.resend.com/emails';

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
    const errMsg =
      typeof json.message === 'string'
        ? json.message
        : typeof json.name === 'string'
          ? json.name
          : `Resend HTTP ${res.status}`;
    return { ok: false, status: res.status, error: errMsg };
  }

  const id = typeof json.id === 'string' ? json.id : undefined;
  return { ok: true, status: res.status, id };
}
