/**
 * Profile Sommi-memory management operation IDs (one logical UI confirm).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isProfileMemoryOperationId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/** Cryptographically random UUID for one Profile management confirmation. */
export function createProfileMemoryOperationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error('Secure UUID generation is unavailable');
}

/**
 * Reuse the in-flight operation ID on retry; mint only on first confirm submit.
 */
export function resolveOperationIdForAttempt(existing: string | null | undefined): string {
  if (existing && isProfileMemoryOperationId(existing)) return existing.trim();
  return createProfileMemoryOperationId();
}

/**
 * After a failed attempt: keep the ID when the server outcome is unknown
 * (network / 5xx) so retries stay idempotent. Clear on definitive client/server rejects.
 */
export function shouldRetainOperationIdAfterFailure(
  status: number | 'network' | 'parse'
): boolean {
  if (status === 'network' || status === 'parse') return true;
  if (status >= 500 && status !== 503) return true;
  return false;
}

/** Deterministic evidence key: scoped by auth.uid() in DB unique index. */
export function profileMemoryIdempotencyKey(operationId: string): string {
  const id = operationId.trim().toLowerCase();
  if (!UUID_RE.test(id)) {
    throw new Error('invalid_operation_id');
  }
  return `profile_memory_action_${id}`;
}
