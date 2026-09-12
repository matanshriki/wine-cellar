import { describe, expect, it, beforeEach } from 'vitest';
import {
  AGENT_ENTRY_TONIGHT_CARD,
  clearTonightCardEntry,
  isTonightCardEntryPending,
  markTonightCardEntry,
  resolveTonightCardEntry,
} from './agentEntry';

describe('agent entry from Tonight card', () => {
  beforeEach(() => {
    clearTonightCardEntry();
  });

  it('uses a stable source token for navigation and analytics', () => {
    expect(AGENT_ENTRY_TONIGHT_CARD).toBe('tonight_card');
  });

  it('keeps Tonight entry pending across a simulated Strict Mode remount', () => {
    markTonightCardEntry();
    expect(isTonightCardEntryPending()).toBe(true);

    // First mount reads pending + location state, then clears router state.
    expect(
      resolveTonightCardEntry({ agentEntry: { source: AGENT_ENTRY_TONIGHT_CARD } })
    ).toBe(true);

    // After location state is consumed, pending marker still identifies entry.
    expect(resolveTonightCardEntry(null)).toBe(true);

    clearTonightCardEntry();
    expect(resolveTonightCardEntry(null)).toBe(false);
  });
});
