/**
 * Evening Share Service
 *
 * Host-side: create / retrieve share links, read vote summaries.
 * Guest-side: fetch public share data, submit anonymous votes.
 *
 * Public functions use Supabase Edge Functions (service-role gate),
 * so no RLS tweaks are needed for guests.
 */

import { supabase } from '../lib/supabase';
import type { QueuedWine } from './eveningPlanService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EveningShare {
  id: string;
  evening_plan_id: string;
  created_by: string;
  lineup_snapshot: QueuedWine[];
  occasion: string | null;
  plan_name: string | null;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface GuestShareData {
  share: {
    id: string;
    evening_plan_id: string;
    occasion: string | null;
    plan_name: string | null;
    created_at: string;
    expires_at: string;
  };
  lineup: QueuedWine[];
  vote_counts: Record<string, number>;
  total_votes: number;
  unique_voters: number;
}

export interface VoteSummaryEntry {
  wine_id: string;
  wine_name: string;
  producer: string;
  vote_count: number;
  position: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateShareCode(length = 7): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('');
}

function edgeFunctionUrl(name: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL ?? '';
  return `${base}/functions/v1/${name}`;
}

function anonHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  };
}

// ─── Host-side ────────────────────────────────────────────────────────────────

/**
 * Create a new share (or return an existing active one) for an evening plan.
 * Stores a frozen lineup snapshot so guest page remains stable even if the
 * host modifies the plan later.
 */
export async function createOrGetEveningShare(
  eveningPlanId: string,
  queue: QueuedWine[],
  occasion?: string | null,
  planName?: string | null,
): Promise<EveningShare> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Reuse active share if one exists and has not expired
  // evening_plan_shares is not in the auto-generated Supabase types yet — use `as any`
  const { data: existing } = await (supabase as any)
    .from('evening_plan_shares')
    .select('*')
    .eq('evening_plan_id', eveningPlanId)
    .eq('created_by', user.id)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) return existing as EveningShare;

  // Freeze only the fields guests need (skip stale signed URLs from storage)
  const snapshot = queue.map((w) => ({
    wine_id: w.wine_id,
    bottle_id: w.bottle_id,
    position: w.position,
    wine_name: w.wine_name,
    producer: w.producer,
    vintage: w.vintage,
    color: w.color,
    image_url: w.image_url ?? null,
  }));

  // Try up to 5 times to get a unique short code
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShareCode(7);

    const { data, error } = await (supabase as any)
      .from('evening_plan_shares')
      .insert({
        id: code,
        evening_plan_id: eveningPlanId,
        created_by: user.id,
        lineup_snapshot: snapshot,
        occasion: occasion ?? null,
        plan_name: planName ?? null,
      })
      .select()
      .single();

    if (!error && data) return data as EveningShare;

    // Retry on duplicate key collision only
    if (error?.code !== '23505') throw error;
  }

  throw new Error('Failed to generate unique share code after 5 attempts');
}

/**
 * Deactivate a share link (host can revoke at any time).
 */
export async function deactivateEveningShare(shareId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('evening_plan_shares')
    .update({ is_active: false })
    .eq('id', shareId);

  if (error) throw error;
}

/**
 * Fetch aggregated vote summary for a share (host view).
 * Returns wines sorted by vote count descending.
 */
export async function getVoteSummary(
  shareId: string,
  queue: QueuedWine[],
): Promise<VoteSummaryEntry[]> {
  const { data: votes, error } = await (supabase as any)
    .from('evening_guest_votes')
    .select('wine_id')
    .eq('share_id', shareId);

  if (error) {
    console.error('[eveningShareService] Error fetching vote summary:', (error as any).message);
    return [];
  }

  const counts: Record<string, number> = {};
  for (const v of (votes as Array<{ wine_id: string }>) ?? []) {
    counts[v.wine_id] = (counts[v.wine_id] ?? 0) + 1;
  }

  return queue
    .map((w, i) => ({
      wine_id: w.wine_id,
      wine_name: w.wine_name,
      producer: w.producer,
      vote_count: counts[w.wine_id] ?? 0,
      position: i + 1,
    }))
    .sort((a, b) => b.vote_count - a.vote_count);
}

/**
 * Build the public URL guests will open in their browser.
 */
export function getShareUrl(shareCode: string): string {
  return `${window.location.origin}/share/evening/${shareCode}`;
}

// ─── Guest-side (public, no auth) ────────────────────────────────────────────

/**
 * Fetch share metadata + lineup + aggregated vote counts.
 * Called by the guest page — no Supabase auth required.
 */
export async function fetchGuestShareData(code: string): Promise<GuestShareData> {
  const url = `${edgeFunctionUrl('evening-share-get')}?code=${encodeURIComponent(code)}`;
  const res = await fetch(url, { headers: anonHeaders() });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Failed to load evening share (${res.status})`);
  }

  return res.json() as Promise<GuestShareData>;
}

/**
 * Add or remove a guest vote.
 * Returns the refreshed vote counts for all wines in this share.
 */
export async function submitGuestVote(
  code: string,
  wineId: string,
  sessionId: string,
  action: 'add' | 'remove',
): Promise<Record<string, number>> {
  const res = await fetch(edgeFunctionUrl('evening-vote'), {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ code, wine_id: wineId, session_id: sessionId, action }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Failed to submit vote (${res.status})`);
  }

  const data = await res.json() as { success: boolean; vote_counts: Record<string, number> };
  return data.vote_counts;
}

/**
 * Get or create a stable guest session ID from localStorage.
 * This is the anonymous fingerprint stored per browser.
 */
export function getGuestSessionId(): string {
  const key = 'guest_evening_session_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
