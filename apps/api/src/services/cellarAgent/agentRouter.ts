/**
 * Explicit routing for the cellar sommelier (reliable over free-form tool spam).
 * Phase 3 can add OpenAI tool_choice here; Phase 2 keeps deterministic rules first.
 */

import type { ActionContext, AgentRoute } from './sommelierTypes.js';

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

export function extractUuidFromMessage(text: string): string | null {
  const m = text.match(UUID_RE);
  return m ? m[0] : null;
}

/**
 * Order matters: more specific routes before generic recommend.
 */
export function classifyAgentRoute(message: string, _ctx?: ActionContext): AgentRoute {
  const t = message.trim();
  const lower = t.toLowerCase();

  if (
    /(opened\s+it|i\s+opened|mark\s+.*opened|just\s+opened|cracked\s+(it|open)|popping\s+this|finish(ed)?\s+the\s+bottle)/i.test(
      lower
    ) ||
    (/^open(\s+this|\s+that|\s+it)?\s*!?\s*$/i.test(lower) && t.length < 40)
  ) {
    return 'open_bottle';
  }

  if (
    /(save\s+(a\s+)?(tasting\s+)?note|draft\s+(a\s+)?note|write\s+(down\s+)?a\s+tasting\s+note)/i.test(
      lower
    )
  ) {
    return 'tasting_draft';
  }

  if (
    /(what\s+else\s+(do\s+i\s+)?have|similar\s+(wines?|bottles?)|more\s+like\s+this|something\s+like\s+that|others\s+like\s+this)/i.test(
      lower
    )
  ) {
    return 'similar';
  }

  if (
    /(remember\s+(that\s+)?|don'?t forget|i\s+prefer|i\s+usually\s+like|^i\s+like\s+(lighter|heavier)|i\s+don'?t\s+like)/i.test(
      lower
    )
  ) {
    return 'memory_update';
  }

  // Short reactions only — avoid stealing pairing / recommendation questions ("perfect with steak")
  const looksLikeQuestion =
    /^(what|how|why|can|could|would|should|is|are|do|does|tell|give|suggest|recommend|pair|find|show)/i.test(
      t.trim()
    ) || /\b(for tonight|with (the |my )?(steak|fish|dinner|pasta)|something for)\b/i.test(lower);

  const shortFeedback =
    /\b(too\s+heavy|too\s+light|too\s+acid|too\s+acidic|not\s+special)\b/i.test(lower) ||
    /^(perfect|loved it|i liked it)\.?$/i.test(t.trim());

  if (t.length < 100 && !looksLikeQuestion && shortFeedback) {
    return 'feedback_inline';
  }

  return 'recommend';
}

export function extractDraftTextFromMessage(message: string): string {
  const m = message.split(/:\s*/);
  if (m.length > 1) return m.slice(1).join(':').trim();
  return message.trim();
}
