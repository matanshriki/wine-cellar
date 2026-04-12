/**
 * Sommi credits — Edge Function Credit Helper (Deno)
 *
 * Shared module for all Supabase Edge Functions that make AI calls.
 * Provides:
 *   - checkCreditAccess()  — pre-flight balance check (fast, fail-open)
 *   - logCreditUsage()     — post-call usage logging via process_ai_credit_usage RPC
 *
 * SECURITY:
 *   - Uses service-role admin client passed in from the calling function
 *   - Never creates its own client — receives the already-authenticated admin client
 *   - Never touches the browser; Deno runtime only
 *
 * ROLLOUT RULES:
 *   - monetization_enabled  → UI visibility only (not checked here)
 *   - credit_enforcement_enabled → controls blocking in checkCreditAccess()
 *   - Missing entitlement row → defaults to enforcement = false (safe, allow-through)
 *   - Failed AI calls → call logCreditUsage with requestStatus = 'failed'
 *     credits_required should be 0 for failed calls (the RPC enforces this when status != 'success')
 *
 * USAGE:
 *   import { checkCreditAccess, logCreditUsage } from '../_shared/creditHelper.ts'
 *
 *   // 1. Pre-flight check (before AI call)
 *   const access = await checkCreditAccess(supabaseAdmin, user.id, 'label_scan', 2)
 *   if (!access.allowed) {
 *     return insufficientCreditsResponse()  // 402
 *   }
 *
 *   // 2. Make AI call...
 *
 *   // 3. Log usage (after AI call, best-effort)
 *   await logCreditUsage(supabaseAdmin, {
 *     userId: user.id,
 *     actionType: 'label_scan',
 *     creditsRequired: 2,
 *     requestStatus: 'success',
 *     modelName: 'gpt-4o-mini',
 *     inputTokens: data.usage?.prompt_tokens,
 *     outputTokens: data.usage?.completion_tokens,
 *     metadata: { ... },
 *   })
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreditAccessResult {
  allowed: boolean;
  reason?: 'insufficient_credits' | 'service_error';
  effectiveBalance?: number;
  required?: number;
  enforcementEnabled: boolean;
}

export interface LogCreditUsageOptions {
  userId: string;
  actionType: string;
  creditsRequired: number;
  requestStatus: 'success' | 'failed' | 'error';
  requestId?: string | null;
  modelName?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  metadata?: Record<string, unknown>;
}

// ── Pre-flight credit check ───────────────────────────────────────────────────

/**
 * Check whether the user can afford the action before making an AI call.
 *
 * Reads user_entitlements and user_ai_credits directly for a fast,
 * low-overhead check. Always fails open (returns allowed=true) on
 * any DB error so that credit system failures never block users.
 *
 * During the dark-launch phase (credit_enforcement_enabled = false for
 * all users), this always returns { allowed: true, enforcementEnabled: false }.
 */
export async function checkCreditAccess(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  userId: string,
  actionType: string,
  creditsRequired: number,
): Promise<CreditAccessResult> {
  try {
    // 1. Check entitlement flags (fail open if row missing)
    const { data: entitlement, error: entErr } = await supabaseAdmin
      .from('user_entitlements')
      .select('credit_enforcement_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (entErr) {
      console.warn(`[CreditHelper] Entitlement fetch error (fail-open): ${entErr.message}`);
      return { allowed: true, enforcementEnabled: false };
    }

    const enforcementEnabled: boolean = entitlement?.credit_enforcement_enabled ?? false;

    // 2. If enforcement is off → allow immediately (most users during dark launch)
    if (!enforcementEnabled) {
      return { allowed: true, enforcementEnabled: false };
    }

    // 3. Fetch credit balance
    const { data: credits, error: credErr } = await supabaseAdmin
      .from('user_ai_credits')
      .select('credit_balance, bonus_credits')
      .eq('user_id', userId)
      .maybeSingle();

    if (credErr) {
      console.warn(`[CreditHelper] Credits fetch error (fail-open): ${credErr.message}`);
      return { allowed: true, enforcementEnabled: true };
    }

    const balance = (credits?.credit_balance ?? 0) + (credits?.bonus_credits ?? 0);

    if (balance < creditsRequired) {
      console.log(`[CreditHelper] Insufficient credits: user=${userId.slice(0, 8)}, ` +
        `action=${actionType}, balance=${balance}, required=${creditsRequired}`);
      return {
        allowed: false,
        reason: 'insufficient_credits',
        effectiveBalance: balance,
        required: creditsRequired,
        enforcementEnabled: true,
      };
    }

    return { allowed: true, effectiveBalance: balance, enforcementEnabled: true };
  } catch (err) {
    // deno-lint-ignore no-explicit-any
    console.warn(`[CreditHelper] checkCreditAccess exception (fail-open): ${(err as any)?.message}`);
    return { allowed: true, enforcementEnabled: false };
  }
}

// ── Post-call usage logging ───────────────────────────────────────────────────

/**
 * Log an AI usage event via the process_ai_credit_usage RPC.
 * Always best-effort — errors are caught and logged but never re-thrown
 * so that credit system failures never degrade the user's AI experience.
 *
 * Handles:
 *   - Atomic credit deduction when enforcement is enabled
 *   - Usage event logging for all users (analytics)
 *   - Auto-upsert of user_ai_credits row if missing
 *
 * Pass requestStatus = 'failed' | 'error' for failed AI calls.
 * The RPC will log with credits_used = 0 for non-success statuses.
 */
export async function logCreditUsage(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  options: LogCreditUsageOptions,
): Promise<void> {
  const {
    userId,
    actionType,
    creditsRequired,
    requestStatus,
    requestId = null,
    modelName = null,
    inputTokens = null,
    outputTokens = null,
    estimatedCostUsd = null,
    metadata = {},
  } = options;

  try {
    const { error } = await supabaseAdmin.rpc('process_ai_credit_usage', {
      p_user_id:            userId,
      p_action_type:        actionType,
      p_credits_required:   creditsRequired,
      p_request_id:         requestId,
      p_model_name:         modelName,
      p_input_tokens:       inputTokens,
      p_output_tokens:      outputTokens,
      p_estimated_cost_usd: estimatedCostUsd,
      p_metadata:           metadata,
      p_request_status:     requestStatus,
    });

    if (error) {
      console.warn(`[CreditHelper] logCreditUsage RPC error (non-fatal): ${error.message}`, {
        userId: userId.slice(0, 8),
        actionType,
      });
    } else {
      console.log(`[CreditHelper] Usage logged: user=${userId.slice(0, 8)}, ` +
        `action=${actionType}, status=${requestStatus}`);
    }
  } catch (err) {
    // deno-lint-ignore no-explicit-any
    console.warn(`[CreditHelper] logCreditUsage exception (non-fatal): ${(err as any)?.message}`);
  }
}

// ── Convenience response builder ─────────────────────────────────────────────

/**
 * Standard 402 response for insufficient credits.
 * Only returned when credit_enforcement_enabled = true for the user.
 */
export function insufficientCreditsResponse(
  effectiveBalance: number,
  required: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'insufficient_credits',
      message: 'You have used all your Sommi credits for this period.',
      effectiveBalance,
      required,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 402,
    },
  );
}
