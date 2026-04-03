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

/** Phrases that mean “record an open” / inventory — not wine-exploration questions */
const OPEN_BOTTLE_INTENT =
  /(opened\s+it|i\s+opened|mark\s+.*opened|mark\s+(this\s+)?(the\s+)?bottle\s+as\s+open|mark\s+it\s+as\s+open|mark\s+as\s+open|mark\s+.*\s+as\s+opened|just\s+opened|cracked\s+(it|open)|popping\s+this|finish(ed)?\s+the\s+bottle|open\s+this\s+bottle|open\s+that\s+bottle|please\s+open\s+(this|that|it|the\s+bottle)|can\s+you\s+open\s+(this|that|it|the\s+bottle)|record\s+(that\s+)?(i\s+)?opened|log\s+.*\bopen)/i;

/** Hebrew: opened / mark as consumed / update inventory (RTL phrases as typed) */
const OPEN_BOTTLE_INTENT_HE =
  /(פתחתי(\s+את(\s+זה|\s+הבקבוק)?)?|סימנתי\s+כפתוח|סמן(\s+את)?\s+הבקבוק\s+כפתוח|תסמן(\s+את)?\s+הבקבוק\s+כפתוח|סמן\s+כפתוח|תסמן\s+כפתוח|סימון\s+כפתוח|הבקבוק\s+נפתח|בקבוק\s+נפתח|נפתח(\s+את\s+הבקבוק|\s+את\s+זה)?|עדכן(\s+ש)?פתחתי|תעדכן(\s+ש)?פתחתי|תעדכן\s+בקבוק\s+נפתח|סימנתי\s+בקבוק\s+כפתוח|פתח(\s+את)?\s+הבקבוק(\s+הזה)?|פתח\s+את\s+זה|בקשה\s+לסמן\s+כפתוח|אפשר\s+לסמן\s+כפתוח)/;

function looksLikeOpenBottleHebrew(t: string): boolean {
  return OPEN_BOTTLE_INTENT_HE.test(t.trim());
}

/** Hebrew follow-up after a recommendation (short) */
const OPEN_FOLLOWUP_HE =
  /^(פתחתי|פתח\s+את\s+זה|פתח\s+את\s+הבקבוק|סמן\s+כפתוח|תסמן\s+כפתוח|סימנתי\s+כפתוח|זה\s+נפתח|נפתח(\s+את\s+זה)?|בקבוק\s+נפתח|סימנתי)(\s*[!.׳])?\s*$/;

function soundsLikeQuestionHebrew(t: string): boolean {
  const s = t.trim();
  return /^(מה|איך|למה|האם|איזה|איפה|מתי|כמה|תמליץ|תציע|המלצה|בבקשה\s+תמליץ|אפשר|מה\s+לפתוח|מה\s+אפתח|מה\s+לשתות|איזה\s+יין|עם\s+מה|למה\s+לפתוח)/u.test(
    s
  );
}

/** "Buy / purchase / shopping / expand cellar" — user wants wine suggestions to purchase, not from cellar */
const BUY_INTENT_EN =
  /\b(what\s+(wine|bottle)s?\s+should\s+i\s+buy|recommend.{0,30}(to\s+buy|to\s+purchase|for\s+purchase)|wines?\s+to\s+buy|buy\s+new\s+wine|buy\s+something\s+new|expand\s+my\s+(cellar|collection)|add\s+to\s+my\s+(cellar|collection)|new\s+wines?\s+to\s+try|what\s+should\s+i\s+(add|get|purchase)|shopping\s+list|wine\s+shopping|looking\s+to\s+buy|want\s+to\s+buy|next\s+purchase|what\s+to\s+buy|suggest.{0,20}(to\s+buy|new\s+wine))\b/i;

const BUY_INTENT_HE =
  /(מה\s+(כדאי|אפשר|צריך)\s+(לי\s+)?לקנות|המלץ\s+(לי\s+)?על\s+יין\s+לקנייה|יינות?\s+לקנייה|לקנות\s+יין\s+חדש|להרחיב\s+את\s+(המרתף|האוסף)|יין\s+חדש\s+לנסות|מה\s+להוסיף\s+(למרתף|לאוסף)|רשימת\s+קניות|רוצה\s+לקנות|מה\s+לרכוש|קנייה\s+הבאה|איזה\s+יין\s+לקנות|תמליץ\s+(לי\s+)?מה\s+לקנות|מה\s+כדאי\s+לי\s+לקנות|אני\s+רוצה\s+לקנות\s+יינות?\s+חדשים?)/;

/**
 * Order matters: more specific routes before generic recommend.
 * Uses optional `actionContext` so follow-ups after a recommendation (“open it”) route correctly.
 */
export function classifyAgentRoute(message: string, ctx?: ActionContext): AgentRoute {
  const t = message.trim();
  const lower = t.toLowerCase();

  if (
    OPEN_BOTTLE_INTENT.test(lower) ||
    looksLikeOpenBottleHebrew(t) ||
    (/^open(\s+this|\s+that|\s+it)?\s*!?\s*$/i.test(lower) && t.length < 40)
  ) {
    return 'open_bottle';
  }

  // After a recommendation, short “open this / mark as open” without repeating the wine name
  if (ctx?.lastRecommendationBottleId) {
    const short = t.length <= 160;
    const soundsLikeQuestion =
      /^(what|which|why|how|should|would|could|recommend|suggest|pair|find|show|give|tell|best|is|are|do|does)\b/i.test(
        t
      ) || soundsLikeQuestionHebrew(t);
    if (short && !soundsLikeQuestion) {
      if (
        /\b(open(\s+it|\s+this|\s+that)?|mark\s+it\s+open|mark\s+this\s+open|mark\s+as\s+open|i\s+opened|cracked\s+it)\b/i.test(
          lower
        ) ||
        OPEN_FOLLOWUP_HE.test(t.trim())
      ) {
        return 'open_bottle';
      }
    }
  }

  if (
    /(save\s+(a\s+)?(tasting\s+)?note|draft\s+(a\s+)?note|write\s+(down\s+)?a\s+tasting\s+note)/i.test(
      lower
    ) ||
    /(שמור(\s+לי)?\s+הערת\s+טעימה|טיוטת\s+הערה|שמור\s+הערה|כתוב\s+הערת\s+טעימה)/u.test(
      t
    )
  ) {
    return 'tasting_draft';
  }

  if (
    /(what\s+else\s+(do\s+i\s+)?have|similar\s+(wines?|bottles?)|more\s+like\s+this|something\s+like\s+that|others\s+like\s+this)/i.test(
      lower
    ) ||
    /(מה\s+עוד\s+יש|עוד\s+כמו|דומה\s+לזה|משהו\s+דומה|בדומה\s+ל|עוד\s+בקבוקים\s+כמו|עוד\s+יינות\s+כמו|דומה\s+ל)/u.test(
      t
    )
  ) {
    return 'similar';
  }

  if (
    /(remember\s+(that\s+)?|don'?t forget|i\s+prefer|i\s+usually\s+like|^i\s+like\s+(lighter|heavier)|i\s+don'?t\s+like)/i.test(
      lower
    ) ||
    /(תזכור(\s+ש)?|אל\s+תשכח|אני\s+מעדיף|אני\s+לא\s+אוהב|אני\s+בדרך\s+כלל\s+אוהב|אני\s+אוהב\s+בדרך\s+כלל)/u.test(
      t
    )
  ) {
    return 'memory_update';
  }

  // Short reactions only — avoid stealing pairing / recommendation questions ("perfect with steak")
  const looksLikeQuestion =
    /^(what|how|why|can|could|would|should|is|are|do|does|tell|give|suggest|recommend|pair|find|show)/i.test(
      t.trim()
    ) ||
    /\b(for tonight|with (the |my )?(steak|fish|dinner|pasta)|something for)\b/i.test(lower) ||
    soundsLikeQuestionHebrew(t);

  const shortFeedback =
    /\b(too\s+heavy|too\s+light|too\s+acid|too\s+acidic|not\s+special)\b/i.test(lower) ||
    /^(perfect|loved it|i liked it)\.?$/i.test(t.trim()) ||
    /^(מושלם|מצוין|אהבתי|לא\s+מיוחד|חמוץ\s+מדי|כבד\s+מדי)\.?$/u.test(t.trim());

  if (t.length < 100 && !looksLikeQuestion && shortFeedback) {
    return 'feedback_inline';
  }

  if (BUY_INTENT_EN.test(lower) || BUY_INTENT_HE.test(t)) {
    return 'buy_recommendation';
  }

  return 'recommend';
}

export function extractDraftTextFromMessage(message: string): string {
  const m = message.split(/:\s*/);
  if (m.length > 1) return m.slice(1).join(':').trim();
  return message.trim();
}
