import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import {
  closeModalLayer,
  isTopmostModalLayer,
  openModalLayer,
  subscribeModalStack,
} from '../../lib/modalStack';

export type ModalLevel = 'dialog' | 'nested';

const LEVEL_Z: Record<ModalLevel, string> = {
  dialog: 'var(--z-modal)',
  nested: 'var(--z-modal-nested)',
};

/**
 * Registers an open layer on the modal stack (inert app root + scroll lock)
 * and reports whether it is the topmost one.
 */
export function useModalLayer(open: boolean): boolean {
  const [id, setId] = useState<symbol | null>(null);
  useEffect(() => {
    if (!open) return;
    const layer = openModalLayer();
    setId(layer);
    return () => {
      closeModalLayer(layer);
      setId(null);
    };
  }, [open]);
  return useSyncExternalStore(subscribeModalStack, () => isTopmostModalLayer(id));
}

/**
 * Renders overlay content at the end of <body>, outside every card stacking
 * context, on a named layer. For legacy overlays that manage their own markup.
 */
export function ModalPortal({ open, level = 'dialog', children }: { open: boolean; level?: ModalLevel; children: ReactNode }) {
  useModalLayer(open);
  return <PortalRoot level={level}>{children}</PortalRoot>;
}

/** Portal target only; the caller registers the layer with `useModalLayer`. */
export function PortalRoot({ level = 'dialog', children }: { level?: ModalLevel; children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="modal-portal" data-level={level} style={{ zIndex: LEVEL_Z[level] }}>
      {children}
    </div>,
    document.body,
  );
}

interface ModalLayerProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  level?: ModalLevel;
  size?: 'md' | 'lg';
  initialFocusRef?: RefObject<HTMLElement>;
  closeOnBackdrop?: boolean;
  /** When false, Escape does not dismiss. Default true. */
  closeOnEscape?: boolean;
  /** Stable hook for tests and diagnostics. */
  testId?: string;
  /** Marks the panel so unsaved-work heuristics ignore this dialog. */
  ignoreUnsavedScan?: boolean;
  children: ReactNode;
}

/**
 * Shared dialog shell: portal + backdrop + panel. Bottom sheet on phones,
 * centered and bounded from `sm` up. Children supply `.modal-header`,
 * `.modal-body` (the only scroll area) and an optional `.modal-footer`.
 */
export function ModalLayer({
  open,
  onClose,
  labelledBy,
  describedBy,
  level = 'dialog',
  size = 'lg',
  initialFocusRef,
  closeOnBackdrop = true,
  closeOnEscape = true,
  testId,
  ignoreUnsavedScan = false,
  children,
}: ModalLayerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isTopmost = useModalLayer(open);
  const reduceMotion = useReducedMotion();
  useDialogA11y(panelRef, open, onClose, { initialFocusRef, isTopmost, closeOnEscape });

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-layer"
          className="modal-layer"
          data-level={level}
          data-testid={testId}
          style={{ zIndex: LEVEL_Z[level] }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
        >
          <div
            className="modal-backdrop"
            aria-hidden="true"
            onClick={closeOnBackdrop && isTopmost ? onClose : undefined}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            tabIndex={-1}
            className={`modal-panel modal-panel--${size}`}
            data-sommi-update-dialog={ignoreUnsavedScan ? 'true' : undefined}
            initial={reduceMotion ? false : { y: 16 }}
            animate={{ y: 0 }}
            exit={reduceMotion ? undefined : { y: 16 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
