/**
 * Sommi credits — Server-side Credit Service
 *
 * Centralised path for:
 *   - Usage logging (always, best-effort)
 *   - Credit deduction (atomic via Supabase RPC)
 *   - Entitlement/enforcement checks
 *
 * SECURITY RULES:
 *   - This service must ONLY run server-side (Express API).
 *   - It uses the Supabase service-role key to bypass RLS.
 *   - The service-role key must NEVER reach the browser.
 *   - All balance mutations go through process_ai_credit_usage RPC
 *     which is SECURITY DEFINER — atomic and tamper-proof.
 *
 * ROLLOUT RULES:
 *   - monetization_enabled  → controls UI visibility only (not enforced here)
 *   - credit_enforcement_enabled → controls whether users are blocked
 *   - Missing entitlement row → treated as both flags = false (allow through)
 *   - Failed AI responses → logged with credits_used = 0
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import {
  getCreditsRequired,
  estimateCostUsd,
  type AiActionType,
} from '../config/creditPolicy.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreditCheckResult {
  /** Whether the action is allowed to proceed */
  allowed: boolean;
  /** Reason for denial (only set when allowed = false) */
  reason?: 'insufficient_credits' | 'race_condition' | 'service_unavailable';
  /** Effective credit balance after the operation */
  effectiveBalance?: number;
  /** Credits that were required (for error messages) */
  required?: number;
  /** Whether enforcement is currently active for this user */
  enforcementEnabled: boolean;
  /** DB event id for correlation */
  eventId?: string;
}

export interface LogUsageOptions {
  userId: string;
  actionType: AiActionType | string;
  requestStatus: 'success' | 'failed' | 'error';
  requestId?: string | null;
  modelName?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  metadata?: Record<string, unknown>;
}

// ── Service-role Supabase client ─────────────────────────────────────────────

let _serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient | null {
  if (_serviceClient) return _serviceClient;

  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    console.warn(
      '[CreditService] SUPABASE_SERVICE_ROLE_KEY not set — ' +
      'credit deduction will be skipped. Set the env var to enable enforcement.',
    );
    return null;
  }

  _serviceClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _serviceClient;
}

// ── Core: process credit usage (deduct + log) ────────────────────────────────

/**
 * Centralised credit processing path.
 *
 * Call AFTER a successful AI response (pass requestStatus = 'success').
 * Call with requestStatus = 'failed' / 'error' to log without charging.
 *
 * Returns CreditCheckResult.  When enforcement is OFF, always returns
 * allowed = true regardless of balance — this is intentional for dark launch.
 *
 * This function is best-effort: errors are caught and logged but never
 * propagated to the caller so that a credit system failure never breaks
 * the user's AI experience.
 */
export async function processAiCreditUsage(
  options: LogUsageOptions,
): Promise<CreditCheckResult> {
  const {
    userId,
    actionType,
    requestStatus,
    requestId,
    modelName,
    inputTokens,
    outputTokens,
    metadata = {},
  } = options;

  const creditsRequired = getCreditsRequired(actionType);
  const estimatedCost = estimateCostUsd(modelName, inputTokens, outputTokens);

  const serviceClient = getServiceClient();

  if (!serviceClient) {
    // No service role key — log to console only, allow through
    console.log(
      '[CreditService] No service client — skipping DB log',
      JSON.stringify({
        userId: userId.slice(0, 8),
        actionType,
        requestStatus,
        creditsRequired,
      }),
    );
    return { allowed: true, enforcementEnabled: false };
  }

  try {
    const { data, error } = await serviceClient.rpc('process_ai_credit_usage', {
      p_user_id:            userId,
      p_action_type:        actionType,
      p_credits_required:   creditsRequired,
      p_request_id:         requestId ?? null,
      p_model_name:         modelName ?? null,
      p_input_tokens:       inputTokens ?? null,
      p_output_tokens:      outputTokens ?? null,
      p_estimated_cost_usd: estimatedCost ?? null,
      p_metadata:           metadata,
      p_request_status:     requestStatus,
    });

    if (error) {
      console.error('[CreditService] RPC error:', error.message, {
        userId: userId.slice(0, 8),
        actionType,
      });
      // Fail open: allow the action even if credit logging fails
      return { allowed: true, enforcementEnabled: false };
    }

    const result = data as {
      allowed: boolean;
      reason?: string;
      effective_balance?: number;
      required?: number;
      enforcement?: boolean;
      event_id?: string;
    };

    console.log(
      '[CreditService]',
      JSON.stringify({
        user: userId.slice(0, 8),
        actionType,
        allowed: result.allowed,
        enforcement: result.enforcement ?? false,
        balance: result.effective_balance,
        creditsUsed: result.allowed && result.enforcement ? creditsRequired : 0,
        eventId: result.event_id?.slice(0, 8),
      }),
    );

    return {
      allowed:           result.allowed,
      reason:            result.reason as CreditCheckResult['reason'],
      effectiveBalance:  result.effective_balance,
      required:          result.required ?? creditsRequired,
      enforcementEnabled: result.enforcement ?? false,
      eventId:           result.event_id,
    };
  } catch (err: any) {
    console.error('[CreditService] Unexpected error:', err?.message);
    return { allowed: true, enforcementEnabled: false };
  }
}

/**
 * Pre-flight credit check — call BEFORE starting the AI call when
 * enforcement is enabled and you want to fail fast rather than wasting
 * an OpenAI token budget.
 *
 * For the dark-launch phase this is not required (enforcement is OFF),
 * but the function is here for when Stage 3 rollout begins.
 *
 * Returns { allowed, reason, effectiveBalance, required, enforcementEnabled }.
 */
export async function checkCreditBalance(
  userId: string,
  actionType: AiActionType | string,
): Promise<CreditCheckResult> {
  const serviceClient = getServiceClient();

  if (!serviceClient) {
    return { allowed: true, enforcementEnabled: false };
  }

  try {
    // Check entitlement flags first
    const { data: entitlement } = await serviceClient
      .from('user_entitlements')
      .select('monetization_enabled, credit_enforcement_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    const enforcementEnabled = entitlement?.credit_enforcement_enabled ?? false;

    if (!enforcementEnabled) {
      return { allowed: true, enforcementEnabled: false };
    }

    // Fetch credit balance
    const { data: credits } = await serviceClient
      .from('user_ai_credits')
      .select('credit_balance, bonus_credits')
      .eq('user_id', userId)
      .maybeSingle();

    const balance = (credits?.credit_balance ?? 0) + (credits?.bonus_credits ?? 0);
    const required = getCreditsRequired(actionType);

    if (balance < required) {
      return {
        allowed:           false,
        reason:            'insufficient_credits',
        effectiveBalance:  balance,
        required,
        enforcementEnabled: true,
      };
    }

    return {
      allowed:          true,
      effectiveBalance: balance,
      required,
      enforcementEnabled: true,
    };
  } catch (err: any) {
    console.error('[CreditService] checkCreditBalance error:', err?.message);
    return { allowed: true, enforcementEnabled: false };
  }
}
