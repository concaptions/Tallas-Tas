'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@tas/ui';

/**
 * The right-click menu on a grid row (Oct 12 scope 3). Rendered at the pointer, kept inside the
 * viewport, closed by Escape, a click or a press anywhere outside, or a scroll — the three ways
 * a native context menu goes away. The items are plain buttons in a `role="menu"`, keyboard
 * reachable with Tab and the arrow keys. Tones come from the token classes only.
 */
export interface ContextMenuItem {
  readonly label: string;
  readonly onSelect: () => void;
  readonly icon?: ReactNode;
  /** A keyboard hint drawn at the right, e.g. `⌘D`; cosmetic, the row's shortcut is the grid's. */
  readonly shortcut?: string;
  readonly tone?: 'default' | 'bad';
  readonly disabled?: boolean;
  /** A separator above this item. */
  readonly divider?: boolean;
  readonly slot?: string;
}

export interface RowContextMenuProps {
  readonly position: { readonly x: number; readonly y: number };
  readonly items: readonly ContextMenuItem[];
  readonly onClose: () => void;
  /** The record's name, for the menu's accessible label. */
  readonly label: string;
}

const MARGIN = 8;

export function RowContextMenu({ position, items, onClose, label }: RowContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState(position);

  // Keep the menu on screen: a right-click near the bottom or the right edge opens it upwards /
  // leftwards, as a native menu does. Measured after layout, before paint.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu === null) return;
    const { width, height } = menu.getBoundingClientRect();
    const x = Math.max(MARGIN, Math.min(position.x, window.innerWidth - width - MARGIN));
    const y = Math.max(MARGIN, Math.min(position.y, window.innerHeight - height - MARGIN));
    setPlace({ x, y });
    menu.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }, [position]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const buttons = [
          ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []),
        ];
        if (buttons.length === 0) return;
        event.preventDefault();
        const index = buttons.findIndex((button) => button === document.activeElement);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const next = buttons[(index + step + buttons.length) % buttons.length];
        next?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target) === true) return;
      onClose();
    };
    const onScroll = () => {
      onClose();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Actions for ${label}`}
      data-slot="row-context-menu"
      style={{ left: place.x, top: place.y }}
      className="fixed z-50 min-w-[218px] rounded-card border border-line2 bg-surface2 p-1 text-text2 shadow-lg"
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(item.divider === true && 'mt-1 border-t border-line pt-1')}
        >
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled === true}
            data-slot={item.slot ?? 'row-context-menu-item'}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-input px-2.5 py-2 text-left text-xs',
              'hover:bg-surface4 hover:text-text focus-visible:bg-surface4 focus-visible:text-text focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:text-text4 disabled:hover:bg-transparent',
              item.tone === 'bad' && 'text-bad hover:text-bad focus-visible:text-bad',
            )}
          >
            {item.icon === undefined ? null : (
              <span aria-hidden className="inline-flex size-4 shrink-0 items-center justify-center">
                {item.icon}
              </span>
            )}
            <span className="flex-1">{item.label}</span>
            {item.shortcut === undefined ? null : (
              <span aria-hidden className="font-mono text-[10px] text-text4">
                {item.shortcut}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
