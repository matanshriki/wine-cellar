/**
 * Typed error when the server rejects an AI action due to Sommi credits (402 / insufficient_credits).
 * UI layers catch this to show NoCreditsModal instead of a generic toast.
 */

export const INSUFFICIENT_CREDITS_CODE = 'insufficient_credits' as const;

export class InsufficientCreditsError extends Error {
  readonly code = INSUFFICIENT_CREDITS_CODE;

  constructor(message?: string) {
    super(
      message?.trim() ||
        "You don't have enough Sommi credits to use this feature.",
    );
    this.name = 'InsufficientCreditsError';
    Object.setPrototypeOf(this, InsufficientCreditsError.prototype);
  }
}

export function isInsufficientCreditsError(e: unknown): e is InsufficientCreditsError {
  return e instanceof InsufficientCreditsError;
}

/** Server JSON body shape from Express + Edge helpers */
export function throwIfInsufficientCreditsResponse(
  status: number,
  body: { error?: string; message?: string } | null | undefined,
): void {
  if (status === 402 || body?.error === INSUFFICIENT_CREDITS_CODE) {
    throw new InsufficientCreditsError(
      typeof body?.message === 'string' ? body.message : undefined,
    );
  }
}

/**
 * Supabase `functions.invoke` sets `error` when the Edge Function response is not 2xx.
 * The Functions error message often contains JSON: `{ "error": "insufficient_credits", "message": "..." }`.
 */
export function throwIfInsufficientCreditsFromFunctionsInvokeError(error: unknown): void {
  if (error == null || typeof error !== 'object') return;
  const raw = (error as { message?: unknown }).message;
  const msg = typeof raw === 'string' ? raw : '';
  let parsed: { error?: string; message?: string } | null = null;
  try {
    parsed = JSON.parse(msg) as { error?: string; message?: string };
  } catch {
    if (msg.includes(INSUFFICIENT_CREDITS_CODE)) {
      throw new InsufficientCreditsError();
    }
    return;
  }
  const status = (error as { context?: { response?: { status?: number } } }).context?.response
    ?.status;
  if (
    parsed?.error === INSUFFICIENT_CREDITS_CODE ||
    status === 402 ||
    msg === INSUFFICIENT_CREDITS_CODE
  ) {
    throw new InsufficientCreditsError(
      typeof parsed?.message === 'string' ? parsed.message : undefined,
    );
  }
}

export function throwIfInsufficientCreditsInDataPayload(
  data: { success?: boolean; error?: string; message?: string } | null | undefined,
): void {
  if (!data) return;
  if (data.error === INSUFFICIENT_CREDITS_CODE) {
    throw new InsufficientCreditsError(
      typeof data.message === 'string' ? data.message : undefined,
    );
  }
}
