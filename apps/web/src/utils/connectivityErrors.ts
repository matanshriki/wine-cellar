/**
 * Detects errors that usually mean the device has no usable network path
 * (offline, airplane mode, ERR_INTERNET_DISCONNECTED, etc.).
 *
 * Browsers often keep navigator.onLine === true while requests still fail;
 * this complements useOnlineStatus for DevTools "Offline" and flaky networks.
 *
 * Note: Some server-side outages also surface as "Failed to fetch"; we only
 * use this together with an empty cellar + initial load in CellarPage.
 */

export function isConnectivityFetchFailure(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  let depth = 0;

  while (current != null && depth < 10 && !seen.has(current)) {
    seen.add(current);

    if (current instanceof TypeError) {
      const m = String(current.message || '').toLowerCase();
      if (
        m.includes('failed to fetch') ||
        m.includes('load failed') ||
        m.includes('networkerror') ||
        m.includes('network error')
      ) {
        return true;
      }
    }

    if (typeof current === 'object') {
      const o = current as Record<string, unknown>;
      const msg = typeof o.message === 'string' ? o.message.toLowerCase() : '';
      if (
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed') ||
        msg.includes('err_internet_disconnected') ||
        msg.includes('internet disconnected')
      ) {
        return true;
      }
    }

    const next =
      typeof current === 'object' && current !== null && 'cause' in current
        ? (current as { cause?: unknown }).cause
        : undefined;
    current = next;
    depth++;
  }

  return false;
}
