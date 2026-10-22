import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface OverflowMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

interface OverflowMenuProps {
  /** Accessible name for the trigger, e.g. "More actions for Tignanello 2019" */
  label: string;
  items: OverflowMenuItem[];
  className?: string;
}

/**
 * Menu-button pattern: Enter/Space/ArrowDown opens, arrows move, Escape/Tab close,
 * focus returns to the trigger. Clicks never bubble to a clickable parent card.
 */
export function OverflowMenu({ label, items, className = '' }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const enabled = items.filter((i) => !i.disabled);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const focusItem = (index: number) => {
    const list = itemRefs.current.filter((el): el is HTMLButtonElement => !!el && !el.disabled);
    if (list.length === 0) return;
    list[(index + list.length) % list.length].focus();
  };

  useEffect(() => {
    if (!open) return;
    focusItem(0);
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, close]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const list = itemRefs.current.filter((el): el is HTMLButtonElement => !!el && !el.disabled);
    const current = list.indexOf(document.activeElement as HTMLButtonElement);
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focusItem(current + 1); break;
      case 'ArrowUp': e.preventDefault(); focusItem(current - 1); break;
      case 'Home': e.preventDefault(); focusItem(0); break;
      case 'End': e.preventDefault(); focusItem(list.length - 1); break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); close(); break;
      case 'Tab': close(false); break;
    }
  };

  if (enabled.length === 0) return null;

  return (
    <div className={`relative ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className="app-icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="app-menu absolute end-0 bottom-full mb-2 z-40 min-w-[11rem] py-1.5"
        >
          {items.map((item, i) => (
            <button
              key={item.key}
              ref={(el) => { itemRefs.current[i] = el; }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              data-tone={item.tone ?? 'default'}
              className="app-menu-item"
              onClick={() => {
                close();
                item.onSelect();
              }}
            >
              {item.icon && <span className="app-menu-icon" aria-hidden>{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
