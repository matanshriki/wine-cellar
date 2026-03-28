/**
 * Single place for sommelier structured logs — production-safe, low noise.
 * No raw user messages; userId is truncated.
 */

const PREFIX = '[Sommelier]';

export type SommelierLogPhase =
  | 'request'
  | 'route'
  | 'orchestration'
  | 'llm'
  | 'fallback'
  | 'persist'
  | 'action';

function shortUser(userId: string | undefined): string {
  if (!userId) return '—';
  return userId.length <= 8 ? userId : `${userId.slice(0, 8)}…`;
}

export function logSommelier(
  phase: SommelierLogPhase,
  payload: Record<string, string | number | boolean | null | undefined>
): void {
  console.log(
    PREFIX,
    JSON.stringify({
      phase,
      ...payload,
    })
  );
}

export function logSommelierWarn(message: string, detail?: Record<string, string | number | boolean>): void {
  if (detail) {
    console.warn(PREFIX, message, JSON.stringify(detail));
  } else {
    console.warn(PREFIX, message);
  }
}

export function logSommelierError(
  phase: SommelierLogPhase,
  err: unknown,
  extra?: Record<string, string | number | boolean>
): void {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : 'Error';
  console.error(
    PREFIX,
    JSON.stringify({
      phase,
      errName: name,
      errMessage: msg.slice(0, 200),
      ...extra,
    })
  );
}

export { shortUser };
