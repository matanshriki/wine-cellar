/**
 * Detects errors that usually mean the device has no usable network path
 * (offline, airplane mode, ERR_INTERNET_DISCONNECTED, etc.).
 *
 * Browsers often keep navigator.onLine === true while requests still fail;
 * this complements useOnlineStatus for DevTools "Offline" and flaky networks.
 *
 * iOS Safari / PWA WebKit often uses different wording than Chromium's
 * "TypeError: Failed to fetch".
 *
 * Note: Some server-side outages also surface as "Failed to fetch"; we only
 * use this together with an empty cellar + initial load in CellarPage.
 */

const CONNECTIVITY_HINTS = [
  'failed to fetch',
  'load failed',
  'networkerror',
  'network error',
  'network request failed',
  'err_internet_disconnected',
  'internet disconnected',
  'internet connection appears to be offline',
  'the network connection was lost',
  'network connection was lost',
  'could not connect',
  'could not connect to the server',
  'connection lost',
  'a server with the specified hostname could not be found',
  'hostname could not be found',
  'nsurlerrordomain',
  'operation could not be completed',
  'webkit encountered',
  'load request failed',
  'fetch failed',
  'unable to reach',
];

function messageLooksDisconnected(msg: string): boolean {
  const m = msg.toLowerCase();
  return CONNECTIVITY_HINTS.some((h) => m.includes(h));
}

export function isConnectivityFetchFailure(error: unknown): boolean {
  // Stack + message often carry WebKit / NSURL wording that the cause chain omits
  if (error instanceof Error) {
    const blob = `${error.message}\n${error.stack || ''}`;
    if (messageLooksDisconnected(blob)) {
      return true;
    }
  }

  const seen = new Set<unknown>();
  let current: unknown = error;
  let depth = 0;

  while (current != null && depth < 10 && !seen.has(current)) {
    seen.add(current);

    if (typeof DOMException !== 'undefined' && current instanceof DOMException) {
      if (current.name === 'NetworkError' || messageLooksDisconnected(String(current.message || ''))) {
        return true;
      }
    }

    if (current instanceof TypeError) {
      const m = String(current.message || '');
      if (messageLooksDisconnected(m)) {
        return true;
      }
    }

    if (typeof current === 'object') {
      const o = current as Record<string, unknown>;
      const msg = typeof o.message === 'string' ? o.message : '';
      if (msg && messageLooksDisconnected(msg)) {
        return true;
      }
      // PostgREST / Supabase client: empty code + fetch-related message often means transport failure
      const code = o.code;
      const rawMsg = typeof o.message === 'string' ? o.message.toLowerCase() : '';
      if (
        (code === '' || code == null) &&
        rawMsg &&
        /failed to fetch|load failed|network error|network request|could not connect|internet connection/i.test(
          rawMsg
        )
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
