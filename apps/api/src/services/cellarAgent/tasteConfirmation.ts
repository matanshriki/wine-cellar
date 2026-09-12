/**
 * Phase 2B.1: HE/EN confirmation classification + pending action helpers.
 * Deterministic only — no LLM.
 */

import type { ExplicitTastePreferences, StructuredTasteProfile } from './tasteProfileTypes.js';
import type { ExtractedPreferenceCandidate } from './preferenceExtractRules.js';

export type PendingTasteActionType = 'replace' | 'remove' | 'move_polarity';

export type ConfirmationDecision = 'confirm' | 'reject' | 'ambiguous' | null;

export interface PendingTasteAction {
  action: PendingTasteActionType;
  dimension: 'region' | 'grape' | 'body' | 'style';
  existingValue: string;
  proposedValue?: string;
  proposedPolarity?: 'like' | 'dislike';
  labelEn?: string;
  labelHe?: string;
}

/** Anchored yes/no — avoid substring false positives. */
const CONFIRM_EN =
  /^(yes|yes[,.]?\s*(please|update(\s+it)?|do\s+it|remove(\s+it)?|confirm)|confirm|do\s+it|remove\s+it|update\s+it)\.?$/i;
const CONFIRM_HE =
  /^(כן|כן[,.]?\s*(תעדכן|תעשה(\s+את\s+זה)?|תמחק|תסיר)|מאשר|תעשה\s+את\s+זה|כן\s+תמחק)\.?$/u;

const REJECT_EN =
  /^(no|no[,.]?\s*(thanks|thank\s+you)?|cancel|keep\s+it|never\s*mind|dont|don'?t)\.?$/i;
const REJECT_HE =
  /^(לא|לא[,.]?\s*(תודה)?|בטל|תשאיר|לא\s+משנה|תשאיר\s+ככה)\.?$/u;

export function classifyConfirmationDecision(raw: string): ConfirmationDecision {
  const t = (raw || '').trim();
  if (!t || t.length > 80) return null;
  if (CONFIRM_EN.test(t) || CONFIRM_HE.test(t)) return 'confirm';
  if (REJECT_EN.test(t) || REJECT_HE.test(t)) return 'reject';
  // Ambiguous short replies that look like soft confirmation attempts
  if (/^(maybe|ok\?|sure\?|אולי|טוב\?)$/i.test(t)) return 'ambiguous';
  return null;
}

function listHas(
  list: ExplicitTastePreferences['regions_liked'] | undefined,
  id: string
): boolean {
  return (list || []).some((x) => x.id.toLowerCase() === id.toLowerCase());
}

/**
 * Decide whether an extracted preference requires confirmation vs immediate apply / no-op.
 */
export function detectPendingTasteAction(
  candidate: ExtractedPreferenceCandidate,
  profile: StructuredTasteProfile | null
):
  | { kind: 'none' }
  | { kind: 'apply_direct' }
  | { kind: 'not_found' }
  | { kind: 'pending'; action: PendingTasteAction }
  | { kind: 'reaffirm' } {
  const explicit = profile?.explicit;
  if (!candidate) return { kind: 'none' };

  // Forget / retract
  if (candidate.class === 'retraction' || candidate.polarity === 'retract') {
    if (!explicit) return { kind: 'not_found' };
    const id = candidate.valueId;
    if (candidate.dimension === 'body') {
      if (!explicit.body?.value) return { kind: 'not_found' };
      if (id !== 'unknown' && explicit.body.value !== id && id !== 'body') {
        // forget specific body that doesn't match
        if (id === 'light' || id === 'medium' || id === 'full') {
          if (explicit.body.value !== id) return { kind: 'not_found' };
        }
      }
      return {
        kind: 'pending',
        action: {
          action: 'remove',
          dimension: 'body',
          existingValue: explicit.body.value,
          labelEn: candidate.labelEn,
          labelHe: candidate.labelHe,
        },
      };
    }
    if (candidate.dimension === 'region') {
      if (listHas(explicit.regions_liked, id)) {
        return {
          kind: 'pending',
          action: {
            action: 'remove',
            dimension: 'region',
            existingValue: id,
            labelEn: candidate.labelEn,
            labelHe: candidate.labelHe,
          },
        };
      }
      if (listHas(explicit.regions_disliked, id)) {
        return {
          kind: 'pending',
          action: {
            action: 'remove',
            dimension: 'region',
            existingValue: id,
            labelEn: candidate.labelEn,
            labelHe: candidate.labelHe,
          },
        };
      }
      return { kind: 'not_found' };
    }
    if (candidate.dimension === 'grape') {
      if (listHas(explicit.grapes_liked, id)) {
        return {
          kind: 'pending',
          action: {
            action: 'remove',
            dimension: 'grape',
            existingValue: id,
            labelEn: candidate.labelEn,
            labelHe: candidate.labelHe,
          },
        };
      }
      if (listHas(explicit.grapes_disliked, id)) {
        return {
          kind: 'pending',
          action: {
            action: 'remove',
            dimension: 'grape',
            existingValue: id,
            labelEn: candidate.labelEn,
            labelHe: candidate.labelHe,
          },
        };
      }
      return { kind: 'not_found' };
    }
    if (candidate.dimension === 'style') {
      if (listHas(explicit.styles_liked, id)) {
        return {
          kind: 'pending',
          action: {
            action: 'remove',
            dimension: 'style',
            existingValue: id,
            labelEn: candidate.labelEn,
            labelHe: candidate.labelHe,
          },
        };
      }
      if (listHas(explicit.styles_disliked, id)) {
        return {
          kind: 'pending',
          action: {
            action: 'remove',
            dimension: 'style',
            existingValue: id,
            labelEn: candidate.labelEn,
            labelHe: candidate.labelHe,
          },
        };
      }
      return { kind: 'not_found' };
    }
    return { kind: 'not_found' };
  }

  // Explicit remember / store
  if (candidate.class === 'stable_remember' && candidate.applyCanonical) {
    if (candidate.dimension === 'body' && candidate.polarity === 'like') {
      const cur = explicit?.body?.value;
      if (!cur) return { kind: 'apply_direct' };
      if (cur === candidate.valueId) return { kind: 'reaffirm' };
      return {
        kind: 'pending',
        action: {
          action: 'replace',
          dimension: 'body',
          existingValue: cur,
          proposedValue: candidate.valueId,
          labelEn: candidate.labelEn,
          labelHe: candidate.labelHe,
        },
      };
    }

    if (
      (candidate.dimension === 'region' ||
        candidate.dimension === 'grape' ||
        candidate.dimension === 'style') &&
      candidate.polarity === 'like'
    ) {
      const liked =
        candidate.dimension === 'region'
          ? explicit?.regions_liked
          : candidate.dimension === 'grape'
            ? explicit?.grapes_liked
            : explicit?.styles_liked;
      const disliked =
        candidate.dimension === 'region'
          ? explicit?.regions_disliked
          : candidate.dimension === 'grape'
            ? explicit?.grapes_disliked
            : explicit?.styles_disliked;
      if (listHas(liked, candidate.valueId)) return { kind: 'reaffirm' };
      if (listHas(disliked, candidate.valueId)) {
        return {
          kind: 'pending',
          action: {
            action: 'move_polarity',
            dimension: candidate.dimension,
            existingValue: candidate.valueId,
            proposedValue: candidate.valueId,
            proposedPolarity: 'like',
            labelEn: candidate.labelEn,
            labelHe: candidate.labelHe,
          },
        };
      }
      return { kind: 'apply_direct' };
    }

  if (
    (candidate.dimension === 'region' ||
      candidate.dimension === 'grape' ||
      candidate.dimension === 'style') &&
    candidate.polarity === 'dislike'
  ) {
    const liked =
      candidate.dimension === 'region'
        ? explicit?.regions_liked
        : candidate.dimension === 'grape'
          ? explicit?.grapes_liked
          : explicit?.styles_liked;
    const disliked =
      candidate.dimension === 'region'
        ? explicit?.regions_disliked
        : candidate.dimension === 'grape'
          ? explicit?.grapes_disliked
          : explicit?.styles_disliked;
    if (listHas(disliked, candidate.valueId)) return { kind: 'reaffirm' };
    if (listHas(liked, candidate.valueId)) {
      return {
        kind: 'pending',
        action: {
          action: 'move_polarity',
          dimension: candidate.dimension,
          existingValue: candidate.valueId,
          proposedValue: candidate.valueId,
          proposedPolarity: 'dislike',
          labelEn: candidate.labelEn,
          labelHe: candidate.labelHe,
        },
      };
    }
    // First-time remember-dislike: apply without confirmation (handled in writer)
    return { kind: 'apply_direct' };
  }
  }

  // Remember dislike without remember verb is stable_general — no pending
  return { kind: 'none' };
}

export function bodyLabel(value: string, language: 'en' | 'he'): string {
  if (language === 'he') {
    if (value === 'full') return 'מלאים';
    if (value === 'light') return 'קלילים';
    if (value === 'medium') return 'בינוניים';
  }
  if (value === 'full') return 'full-bodied';
  if (value === 'light') return 'lighter-bodied';
  if (value === 'medium') return 'medium-bodied';
  return value;
}

export function pendingPromptMessage(
  action: PendingTasteAction,
  language: 'en' | 'he'
): string {
  const label =
    language === 'he'
      ? action.labelHe || action.labelEn || action.existingValue
      : action.labelEn || action.existingValue;

  if (action.action === 'replace' && action.dimension === 'body') {
    const oldL = bodyLabel(action.existingValue, language);
    const newL = bodyLabel(action.proposedValue || '', language);
    if (language === 'he') {
      return `כרגע שמור שאתה מעדיף יינות ${oldL}. לעדכן את ההעדפה ליינות ${newL} יותר?`;
    }
    return `I currently have you preferring ${oldL} wines. Update that preference to ${newL} wines?`;
  }

  if (action.action === 'remove') {
    if (language === 'he') {
      if (action.dimension === 'body') {
        return `להסיר את ההעדפה ליינות ${bodyLabel(action.existingValue, 'he')} מההעדפות השמורות שלך?`;
      }
      return `להסיר את ${label} מההעדפות השמורות שלך?`;
    }
    if (action.dimension === 'body') {
      return `Remove your saved preference for ${bodyLabel(action.existingValue, 'en')} wines?`;
    }
    return `Remove ${label} from your saved wine preferences?`;
  }

  if (action.action === 'move_polarity') {
    if (action.proposedPolarity === 'dislike') {
      return language === 'he'
        ? `כרגע ${label} שמור כהעדפה חיובית. לעדכן לכך שאינך אוהב את זה?`
        : `I currently have ${label} as a liked preference. Update that to a dislike?`;
    }
    return language === 'he'
      ? `כרגע ${label} שמור כהעדפה שלילית. לעדכן לכך שאתה אוהב את זה?`
      : `I currently have ${label} as a dislike. Update that to a like?`;
  }

  return language === 'he' ? 'לאשר את עדכון ההעדפה?' : 'Confirm this preference update?';
}

export function resolveAckMessage(
  reason: string,
  action: PendingTasteAction | null,
  language: 'en' | 'he'
): string {
  const label = action
    ? language === 'he'
      ? action.labelHe || action.labelEn || action.existingValue
      : action.labelEn || action.existingValue
    : '';

  if (reason === 'applied' && action) {
    if (action.action === 'replace' && action.dimension === 'body') {
      const newL = bodyLabel(action.proposedValue || '', language);
      return language === 'he'
        ? `עדכנתי — מעכשיו אזכור שאתה מעדיף יינות ${newL} יותר.`
        : `Updated — I'll remember that you prefer ${newL} wines from now on.`;
    }
    if (action.action === 'remove') {
      return language === 'he'
        ? `הסרתי את ${label} מההעדפות השמורות שלך.`
        : `Removed ${label} from your saved preferences.`;
    }
    if (action.action === 'move_polarity') {
      return language === 'he'
        ? `עדכנתי את ההעדפה לגבי ${label}.`
        : `Updated your preference for ${label}.`;
    }
  }

  if (reason === 'rejected' && action) {
    if (action.action === 'replace' && action.dimension === 'body') {
      const oldL = bodyLabel(action.existingValue, language);
      return language === 'he'
        ? `לא שיניתי את ההעדפה שלך. אשאיר את ההעדפה ליינות ${oldL}.`
        : `No change — I'll keep your preference for ${oldL} wines.`;
    }
    return language === 'he'
      ? 'לא שיניתי את ההעדפה שלך.'
      : "No change — I left your saved preference as it is.";
  }

  if (reason === 'expired') {
    return language === 'he'
      ? 'בקשת השינוי פגה. שלח שוב את בקשת העדכון או המחיקה.'
      : 'That confirmation expired. Please send the preference change request again.';
  }

  if (reason === 'conflict' || reason === 'superseded') {
    return language === 'he'
      ? 'ההעדפה השמורה השתנתה מאז השאלה. שלח שוב את הבקשה.'
      : 'Your saved preference changed since that question. Please send the request again.';
  }

  if (reason === 'wrong_conversation') {
    return language === 'he'
      ? 'לא מצאתי בקשת אישור פעילה בשיחה הזו.'
      : "I couldn't find an active confirmation request in this conversation.";
  }

  if (reason === 'not_found') {
    return language === 'he'
      ? 'אין בקשת שינוי ממתינה לאישור כרגע.'
      : "There's no preference change waiting for confirmation right now.";
  }

  if (reason === 'stale_null_pending') {
    return language === 'he'
      ? 'יש בקשת שינוי ישנה משיחה אחרת. שלח שוב את בקשת העדכון בשיחה הזו.'
      : 'There was an older preference-change request from another chat. Please send the preference change again in this conversation.';
  }

  return language === 'he'
    ? 'אפשר לענות ב״כן״ או ״לא״ לגבי שינוי ההעדפה.'
    : 'Please answer yes or no about the preference change.';
}
