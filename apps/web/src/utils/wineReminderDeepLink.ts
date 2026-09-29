/**
 * Deep-link builders for Web Push taps → /cellar?reminder=…
 * Keep dispatcher (Deno) payload URLs in sync with this format.
 */

export type WineReminderType = 'decant' | 'rate' | 'keep';

export function buildWineReminderPath(opts: {
  reminderType: WineReminderType;
  historyId?: string | null;
  bottleId?: string | null;
  wineName?: string | null;
  producer?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set('reminder', opts.reminderType);
  if (opts.historyId) params.set('historyId', opts.historyId);
  if (opts.bottleId) params.set('bottleId', opts.bottleId);
  if (opts.wineName) params.set('wineName', opts.wineName);
  if (opts.producer) params.set('producer', opts.producer);
  return `/cellar?${params.toString()}`;
}

export function parseKeepReminderBottleId(search: string): string | null {
  const params = new URLSearchParams(search);
  if (params.get('reminder') !== 'keep') return null;
  return params.get('bottleId');
}
