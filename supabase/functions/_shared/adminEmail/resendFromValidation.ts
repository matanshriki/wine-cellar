/**
 * Resend only allows sending *from* addresses on domains you have verified in their dashboard,
 * or their built-in sandbox sender. Using @gmail.com / @yahoo.com as "from" always fails with 403.
 * Recipients (ADMIN_EMAIL) can still be Gmail — this check is only for RESEND_FROM_EMAIL.
 */

const BLOCKED_FROM_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
]);

/** Extract domain from `Name <addr@host>` or `addr@host`. */
export function domainFromResendFromHeader(from: string): string | null {
  const trimmed = from.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : trimmed).trim().toLowerCase();
  const at = addr.lastIndexOf('@');
  if (at < 0 || at === addr.length - 1) return null;
  return addr.slice(at + 1);
}

/**
 * If non-null, do not call Resend — the request will always fail until the operator fixes the secret.
 */
export function resendFromMisconfigurationMessage(from: string): string | null {
  const domain = domainFromResendFromHeader(from);
  if (!domain) {
    return 'RESEND_FROM_EMAIL must be a valid address, e.g. "Sommi <onboarding@resend.dev>".';
  }
  if (BLOCKED_FROM_DOMAINS.has(domain)) {
    return (
      `RESEND_FROM_EMAIL uses @${domain}, which Resend does not allow as a sender domain. ` +
      `Add a domain at https://resend.com/domains and use e.g. "Sommi <noreply@yourdomain.com>", ` +
      `or for quick tests use "Sommi <onboarding@resend.dev>". ` +
      `(ADMIN_EMAIL can stay on Gmail — only the "from" address must change.)`
    );
  }
  return null;
}
