'use client';

import { useEffect, type ReactNode } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, cn } from '@tas/ui';
import { ChevronLeft, ChevronRight } from '@tas/ui/icons';

/**
 * The shared record sidebar (Ticket 9, part 1). The four data-grid pages — Concepts, Personas,
 * Angles, Copywriting — each ship a hand-rolled `<aside>` panel on a row click; they will swap
 * into this one component, so the header (counter + prev/next), chips row, scrollable body and
 * the keyboard navigation live in one place. The ArrowLeft/ArrowRight rule mirrors the Creative
 * Sheet's Focus Mode: steps the selection UNLESS the active element is a text editor or combobox,
 * otherwise typing would scroll the sidebar off the row the viewer is editing.
 */
export interface RecordSheetNavigation {
  readonly prevId: string | null;
  readonly nextId: string | null;
  readonly counter: string;
}

export interface RecordSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly nav?: RecordSheetNavigation;
  readonly onNavigate?: (id: string) => void;
  readonly title: string;
  readonly titleSlot?: string;
  readonly chips?: ReactNode;
  /** `record` is the 460px read-only sidebar; `form` widens to 60% for the edit forms. */
  readonly width?: 'record' | 'form';
  readonly children: ReactNode;
  readonly description?: string;
}

const NAV_BUTTON =
  'inline-flex size-7 items-center justify-center rounded-input border border-line2 bg-surface2 text-text3 transition-colors hover:text-text focus-visible:ring-[3px] focus-visible:ring-accent-soft focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

/** The active DOM nodes that own the arrow keys: text editors and comboboxes (B1.A1). */
function isEditorActive(): boolean {
  const el = typeof document === 'undefined' ? null : document.activeElement;
  if (el === null) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  return el.getAttribute('role') === 'combobox';
}

export function RecordSheet({
  open,
  onClose,
  nav,
  onNavigate,
  title,
  titleSlot,
  chips,
  width = 'record',
  children,
  description,
}: RecordSheetProps) {
  useEffect(() => {
    if (!open || nav === undefined || onNavigate === undefined) return;
    const handler = (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (isEditorActive()) return;
      const target = event.key === 'ArrowLeft' ? nav.prevId : nav.nextId;
      if (target === null) return;
      event.preventDefault();
      onNavigate(target);
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [open, nav, onNavigate]);

  const widthClass = width === 'form' ? 'sm:max-w-[60%]' : 'sm:max-w-[460px]';
  const steppers = nav
    ? ([
        { slot: 'record-sheet-prev', aria: 'Previous record', id: nav.prevId, Icon: ChevronLeft },
        { slot: 'record-sheet-next', aria: 'Next record', id: nav.nextId, Icon: ChevronRight },
      ] as const)
    : null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        data-slot="record-sheet"
        className={cn('flex flex-col gap-0 p-0', widthClass)}
      >
        <SheetHeader className="gap-2">
          {steppers === null || nav === undefined ? null : (
            <div className="flex items-center gap-2 text-text3">
              {steppers.map(({ slot, aria, id, Icon }) => (
                <button
                  key={slot}
                  type="button"
                  data-slot={slot}
                  aria-label={aria}
                  disabled={id === null}
                  onClick={() => {
                    if (id !== null) onNavigate?.(id);
                  }}
                  className={NAV_BUTTON}
                >
                  <Icon className="size-4" />
                </button>
              ))}
              <span
                data-slot="record-sheet-counter"
                className="font-mono text-[11px] tracking-wide text-text3"
              >
                {nav.counter}
              </span>
            </div>
          )}
          <SheetTitle data-slot={titleSlot ?? 'record-sheet-title'}>{title}</SheetTitle>
          <SheetDescription className="sr-only">{description ?? title}</SheetDescription>
          {chips === undefined ? null : (
            <div
              data-slot="record-sheet-chips"
              className="flex flex-wrap items-center gap-1.5 pt-1"
            >
              {chips}
            </div>
          )}
        </SheetHeader>
        <div data-slot="record-sheet-body" className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
