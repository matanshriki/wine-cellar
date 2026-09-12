/** Navigation state / pending entry markers for attributed `/agent` opens. */

export const AGENT_ENTRY_TONIGHT_CARD = 'tonight_card' as const;

export type AgentEntrySource = typeof AGENT_ENTRY_TONIGHT_CARD | string;

export type AgentLocationState = {
  agentEntry?: {
    source: AgentEntrySource;
  };
};

/**
 * Module-level pending flag survives React Strict Mode remounts after
 * location state is consumed. Cleared when leaving the agent page (not on
 * the transient Strict Mode unmount while still on /agent).
 */
let pendingTonightCardEntry = false;

export function markTonightCardEntry(): void {
  pendingTonightCardEntry = true;
}

export function isTonightCardEntryPending(): boolean {
  return pendingTonightCardEntry;
}

export function clearTonightCardEntry(): void {
  pendingTonightCardEntry = false;
}

/** Resolve Tonight-card entry from router state and/or the pending marker. */
export function resolveTonightCardEntry(
  locationState: AgentLocationState | null | undefined
): boolean {
  return (
    locationState?.agentEntry?.source === AGENT_ENTRY_TONIGHT_CARD ||
    pendingTonightCardEntry
  );
}
