/**
 * Shared Profile memory operation-id helpers (web + API-compatible validation).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isProfileMemoryOperationId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

export function profileMemoryIdempotencyKey(operationId: string): string {
  const id = operationId.trim().toLowerCase();
  if (!UUID_RE.test(id)) {
    throw new Error('invalid_operation_id');
  }
  return `profile_memory_action_${id}`;
}

export function parseProfileMemoryOperationId(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const raw =
    typeof o.operationId === 'string'
      ? o.operationId
      : typeof o.operation_id === 'string'
        ? o.operation_id
        : null;
  if (!raw || !isProfileMemoryOperationId(raw)) return null;
  return raw.trim().toLowerCase();
}
