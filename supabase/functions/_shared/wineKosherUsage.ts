/**
 * Cost-control helpers for Kosher enrichment via Perplexity.
 *
 * Exports:
 *   checkAndRecordPerplexityCall  — daily limit gate (read + optional increment)
 *   peekDailyUsage                — read-only count for reporting / dry-run
 *   findDuplicateKosherData       — cross-wine deduplication to avoid repeat calls
 *
 * Design principles:
 *   - Fails CLOSED: any error → skip Perplexity, not run unchecked.
 *   - Low-concurrency safe: a slight over-limit (±1) is acceptable for the
 *     fire-and-forget use case; the limit is a soft cost guardrail, not a hard
 *     billing cutoff.
 *   - Deduplication is cross-user because Kosher status is wine metadata,
 *     not user-specific personal data.
 */

import type { KosherResult } from './wineKosherDetection.ts';

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

// ── Daily limit ───────────────────────────────────────────────────────────────

export interface UsageStatus {
  /** Whether the caller is allowed to make a Perplexity call. */
  allowed: boolean;
  /** Current call count for today BEFORE any increment (-1 on error). */
  currentCount: number;
  /** The configured daily limit. */
  limit: number;
}

/**
 * Check today's Perplexity call count against the daily limit.
 * If within limit and not a dry-run, atomically increments the counter.
 *
 * Fails closed: returns { allowed: false } on any read or write error.
 *
 * @param supabaseAdmin Service-role Supabase client
 * @param dailyLimit    Maximum calls allowed per day
 * @param isDryRun      If true, reads count but does NOT increment
 */
export async function checkAndRecordPerplexityCall(
  supabaseAdmin: SupabaseAdmin,
  dailyLimit: number,
  isDryRun = false,
): Promise<UsageStatus> {
  try {
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD' UTC

    const { data: usage, error: readError } = await supabaseAdmin
      .from('kosher_enrichment_usage')
      .select('call_count')
      .eq('usage_date', today)
      .eq('provider', 'perplexity')
      .maybeSingle();

    if (readError) {
      console.warn('[kosherUsage] Daily-limit read error — failing closed:', readError.message);
      return { allowed: false, currentCount: -1, limit: dailyLimit };
    }

    const currentCount: number = usage?.call_count ?? 0;

    if (currentCount >= dailyLimit) {
      return { allowed: false, currentCount, limit: dailyLimit };
    }

    if (!isDryRun) {
      // Write currentCount+1. On conflict, overwrite with this explicit value.
      // Race condition: two concurrent calls could each read N and both write N+1,
      // producing one overage. This is acceptable for the low-concurrency
      // fire-and-forget use case; the limit is a soft guardrail.
      const { error: upsertError } = await supabaseAdmin
        .from('kosher_enrichment_usage')
        .upsert(
          {
            usage_date: today,
            provider: 'perplexity',
            call_count: currentCount + 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'usage_date,provider' },
        );

      if (upsertError) {
        console.warn('[kosherUsage] Daily-limit increment error — failing closed:', upsertError.message);
        return { allowed: false, currentCount, limit: dailyLimit };
      }
    }

    return { allowed: true, currentCount, limit: dailyLimit };
  } catch (err) {
    console.warn('[kosherUsage] Unexpected daily-limit error — failing closed:', err);
    return { allowed: false, currentCount: -1, limit: dailyLimit };
  }
}

/**
 * Read today's Perplexity usage without any side effects.
 * Used by dry-run reporting.
 */
export async function peekDailyUsage(
  supabaseAdmin: SupabaseAdmin,
  dailyLimit: number,
): Promise<{ used: number; limit: number }> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabaseAdmin
      .from('kosher_enrichment_usage')
      .select('call_count')
      .eq('usage_date', today)
      .eq('provider', 'perplexity')
      .maybeSingle();
    return { used: data?.call_count ?? 0, limit: dailyLimit };
  } catch {
    return { used: 0, limit: dailyLimit };
  }
}

// ── Per-wine deduplication ────────────────────────────────────────────────────

/**
 * Look for any wine row (across ALL users) that:
 *   - has the same producer + wine_name (case-insensitive)
 *   - was enriched by Perplexity at med or high confidence
 *   - has a kosher_source_url (source-backed, not inferred)
 *   - is not the current wine row itself
 *
 * If found, returns the KosherResult so it can be copied to the current wine
 * without calling Perplexity again.
 *
 * Kosher status is wine-level metadata — not user-private data — so cross-user
 * reuse is intentional and safe.
 *
 * Returns null if no suitable existing data is found.
 */
export async function findDuplicateKosherData(
  supabaseAdmin: SupabaseAdmin,
  wine_id: string,
  producer: string,
  wine_name: string,
): Promise<KosherResult | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('wines')
      .select(
        'is_kosher, kosher_for_passover, mevushal, kosher_certification,' +
        ' kosher_confidence, kosher_source_url, kosher_source_name, kosher_notes',
      )
      .neq('id', wine_id)
      // Case-insensitive exact-match via ILIKE without wildcards
      .ilike('producer', producer)
      .ilike('wine_name', wine_name)
      .eq('kosher_enrichment_method', 'perplexity')
      .in('kosher_confidence', ['med', 'high'])
      .not('kosher_source_url', 'is', null)
      .order('kosher_updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      is_kosher: data.is_kosher,
      kosher_for_passover: data.kosher_for_passover,
      mevushal: data.mevushal,
      kosher_certification: data.kosher_certification,
      kosher_confidence: data.kosher_confidence,
      kosher_source_url: data.kosher_source_url,
      kosher_source_name: data.kosher_source_name,
      kosher_notes: data.kosher_notes,
    };
  } catch (err) {
    console.warn('[kosherUsage] Dedup query failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}
