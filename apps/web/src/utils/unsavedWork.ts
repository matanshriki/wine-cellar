/**
 * Unsaved-work registry + heuristics for destructive navigations (SW update reload).
 *
 * Flows that persist drafts (e.g. wishlist) are generally safe; in-progress scans,
 * open dirty dialogs, and explicitly registered blockers are not.
 */

export type UnsavedWorkKind =
  | 'scanning'
  | 'form'
  | 'upload'
  | 'ritual'
  | 'composer'
  | 'custom';

export interface UnsavedWorkStatus {
  hasUnsaved: boolean;
  kind?: UnsavedWorkKind;
  /** Short stable reason key for i18n / logging */
  reason?: string;
}

type Blocker = {
  kind: UnsavedWorkKind;
  reason: string;
  check: () => boolean;
};

const blockers = new Map<string, Blocker>();

/**
 * Register a transient unsaved-work blocker. Returns an unregister function.
 * Prefer calling from useEffect while a critical flow is active.
 */
export function registerUnsavedBlocker(
  id: string,
  check: () => boolean,
  meta: { kind?: UnsavedWorkKind; reason?: string } = {},
): () => void {
  blockers.set(id, {
    kind: meta.kind ?? 'custom',
    reason: meta.reason ?? id,
    check,
  });
  return () => {
    blockers.delete(id);
  };
}

export function clearUnsavedBlockers(): void {
  blockers.clear();
}

function inputLooksDirty(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  if (el.disabled) return false;
  if (el instanceof HTMLInputElement) {
    if (el.readOnly) return false;
    const type = (el.type || 'text').toLowerCase();
    if (['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'hidden', 'range', 'color'].includes(type)) {
      if (type === 'checkbox' || type === 'radio') return el.checked !== el.defaultChecked;
      if (type === 'file') return (el.files?.length ?? 0) > 0;
      return false;
    }
    // Ignore pure search boxes in the chrome
    if (type === 'search' || el.getAttribute('role') === 'searchbox') return false;
    if (el.dataset.sommiIgnoreUnsaved === 'true') return false;
    return el.value !== el.defaultValue && el.value.trim().length > 0;
  }
  if (el instanceof HTMLTextAreaElement) {
    if (el.readOnly) return false;
    if (el.dataset.sommiIgnoreUnsaved === 'true') return false;
    return el.value !== el.defaultValue && el.value.trim().length > 0;
  }
  if (el instanceof HTMLSelectElement) {
    return Array.from(el.options).some((o) => o.selected !== o.defaultSelected);
  }
  return false;
}

/**
 * Heuristic scan of open modal dialogs for dirty fields that are not draft-backed.
 * Wishlist drafts live in sessionStorage and survive reload — still warn if the form
 * is open with content, because the user may expect an explicit save.
 */
function detectDirtyOpenDialogs(): UnsavedWorkStatus | null {
  if (typeof document === 'undefined') return null;
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
  for (const dialog of dialogs) {
    // Update modal itself must not count
    if (dialog.dataset.sommiUpdateDialog === 'true') continue;
    const fields = dialog.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input, textarea, select',
    );
    for (const field of fields) {
      if (inputLooksDirty(field)) {
        return { hasUnsaved: true, kind: 'form', reason: 'open_dialog_form' };
      }
    }
  }
  return null;
}

/**
 * Detect in-progress / unsaved work that would be lost on a hard document reload.
 */
export function detectUnsavedWork(): UnsavedWorkStatus {
  for (const blocker of blockers.values()) {
    try {
      if (blocker.check()) {
        return { hasUnsaved: true, kind: blocker.kind, reason: blocker.reason };
      }
    } catch {
      // ignore broken blockers
    }
  }

  if (typeof document !== 'undefined') {
    const busy = document.body?.dataset?.sommiBusy;
    if (busy === 'scanning') {
      return { hasUnsaved: true, kind: 'scanning', reason: 'scanning' };
    }
    if (busy === 'uploading') {
      return { hasUnsaved: true, kind: 'upload', reason: 'uploading' };
    }
  }

  const dirtyDialog = detectDirtyOpenDialogs();
  if (dirtyDialog) return dirtyDialog;

  return { hasUnsaved: false };
}

/** True when a critical in-progress operation should defer the update dialog. */
export function shouldDeferUpdatePrompt(): boolean {
  const status = detectUnsavedWork();
  if (!status.hasUnsaved) return false;
  return status.kind === 'scanning' || status.kind === 'upload' || status.kind === 'ritual';
}
