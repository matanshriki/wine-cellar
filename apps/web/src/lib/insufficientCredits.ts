/**
 * Typed error when the server rejects an AI action due to Sommi credits (402 / insufficient_credits).
 * UI layers catch this to show NoCreditsModal instead of a generic toast.
 */

export const INSUFFICIENT_CREDITS_CODE = 'insufficient_credits' as const;

export type InsufficientCreditsMeta = {
  /** Credits required for the action that was attempted */
  requiredCredits?: number;
  /** User balance at time of check (credit_balance + bonus) */
  balance?: number;
};

export class InsufficientCreditsError extends Error {
  readonly code = INSUFFICIENT_CREDITS_CODE;
  readonly requiredCredits?: number;
  readonly balance?: number;

  constructor(message?: string, meta?: InsufficientCreditsMeta) {
    const req = meta?.requiredCredits;
    const bal = meta?.balance;
    const auto =
      req != null &&
      bal != null &&
      typeof req === 'number' &&
      typeof bal === 'number'
        ? `This action needs ${req} Sommi credits, but you only have ${bal}.`
        : "You don't have enough Sommi credits to use this feature.";
    super(message?.trim() || auto);
    this.name = 'InsufficientCreditsError';
    this.requiredCredits = req;
    this.balance = bal;
    Object.setPrototypeOf(this, InsufficientCreditsError.prototype);
  }
}

export function isInsufficientCreditsError(e: unknown): e is InsufficientCreditsError {
  return e instanceof InsufficientCreditsError;
}

/** Server JSON body shape from Express + Edge helpers */
export function throwIfInsufficientCreditsResponse(
  status: number,
  body: {
    error?: string;
    message?: string;
    required?: number;
    effectiveBalance?: number;
  } | null | undefined,
): void {
  if (status === 402 || body?.error === INSUFFICIENT_CREDITS_CODE) {
    throw new InsufficientCreditsError(
      typeof body?.message === 'string' ? body.message : undefined,
      {
        requiredCredits: body?.required,
        balance: body?.effectiveBalance,
      },
    );
  }
}

type InvokeErrorBody = {
  error?: string;
  message?: string;
  required?: number;
  effectiveBalance?: number;
  success?: boolean;
};

/**
 * Supabase `functions.invoke` returns `error` when the function responds with non-2xx.
 * For `FunctionsHttpError`, `error.context` is the fetch `Response` (body usually not read yet).
 * The error `message` is the generic string "Edge Function returned a non-2xx status code" — not JSON.
 */
export async function throwIfInsufficientCreditsFromFunctionsInvokeError(
  error: unknown,
): Promise<void> {
  if (error == null || typeof error !== 'object') return;

  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response && ctx.status === 402) {
    let body: InvokeErrorBody = {};
    try {
      body = (await ctx.clone().json()) as InvokeErrorBody;
    } catch {
      throw new InsufficientCreditsError(undefined, undefined);
    }
    throw new InsufficientCreditsError(
      typeof body.message === 'string' ? body.message : undefined,
      {
        requiredCredits: body.required,
        balance: body.effectiveBalance,
      },
    );
  }

  // Legacy/alternate: JSON payload duplicated in error.message (some stacks)
  const raw = (error as { message?: unknown }).message;
  const msg = typeof raw === 'string' ? raw : '';
  let parsed: InvokeErrorBody | null = null;
  try {
    parsed = JSON.parse(msg) as InvokeErrorBody;
  } catch {
    if (msg.includes(INSUFFICIENT_CREDITS_CODE)) {
      throw new InsufficientCreditsError();
    }
    return;
  }
  const ctxStatus =
    ctx instanceof Response ? ctx.status : (error as { context?: { status?: number } }).context?.status;
  if (
    parsed?.error === INSUFFICIENT_CREDITS_CODE ||
    ctxStatus === 402 ||
    msg === INSUFFICIENT_CREDITS_CODE
  ) {
    throw new InsufficientCreditsError(
      typeof parsed?.message === 'string' ? parsed.message : undefined,
      {
        requiredCredits: parsed?.required,
        balance: parsed?.effectiveBalance,
      },
    );
  }
}

export function throwIfInsufficientCreditsInDataPayload(
  data: { success?: boolean; error?: string; message?: string; required?: number; effectiveBalance?: number } | null | undefined,
): void {
  if (!data) return;
  if (data.error === INSUFFICIENT_CREDITS_CODE) {
    throw new InsufficientCreditsError(
      typeof data.message === 'string' ? data.message : undefined,
      {
        requiredCredits: data.required,
        balance: data.effectiveBalance,
      },
    );
  }
}
