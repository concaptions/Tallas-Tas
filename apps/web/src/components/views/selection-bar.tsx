'use client';

import type { ReactNode } from 'react';
import { Button, cn, DisabledWrite, disabledWriteClassName } from '@tas/ui';

/**
 * The floating action bar over a multi-selected grid (Oct 12 scope 3): the count, the actions
 * the page offers over the selection, and Clear. Fixed to the bottom centre, above the grid's
 * scrollport, so it is reachable from any scroll position. Every action is a plain Button; the
 * page decides what each does and whether it is disabled (demo mode, a running write).
 *
 * THE NOTICE OUTLIVES THE SELECTION (B3.A29). Duplicate and Delete clear the selection before they
 * report, so a bar that unmounted at count 0 never painted "2 copies created." — the toolbar alone
 * hides at zero; the notice line stays until the page clears it on its next action.
 */
export interface SelectionAction {
  readonly label: string;
  readonly onSelect: () => void;
  readonly icon?: ReactNode;
  readonly tone?: 'default' | 'bad';
  readonly disabled?: boolean;
  /** Why the action is disabled, as the tooltip. */
  readonly hint?: string;
  readonly slot?: string;
}

export interface SelectionBarProps {
  readonly count: number;
  /** Singular noun for the count line, e.g. `brief` → "2 briefs selected". */
  readonly noun: string;
  /** Irregular plural (Ticket 8): `copy` pluralises to "copys" without it — pass `copies`. */
  readonly plural?: string;
  readonly actions: readonly SelectionAction[];
  readonly onClear: () => void;
  /** An inline control the page opens beside the actions, e.g. the Change status picker. */
  readonly children?: ReactNode;
  /** A line under the bar: the last outcome, a refusal. */
  readonly notice?: ReactNode;
}

export function selectionCountLabel(count: number, noun: string, plural?: string): string {
  return `${count === 1 ? noun : (plural ?? `${noun}s`)} selected`;
}

export function SelectionBar({
  count,
  noun,
  plural,
  actions,
  onClear,
  children,
  notice,
}: SelectionBarProps) {
  const hasNotice = notice !== undefined && notice !== null;
  if (count === 0 && !hasNotice) return null;
  return (
    <div className="fixed bottom-7 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
      {count === 0 ? null : (
        <div
          data-slot="selection-bar"
          role="toolbar"
          aria-label={`${String(count)} ${selectionCountLabel(count, noun, plural)}`}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-line2 bg-surface2 py-2 pr-2.5 pl-3.5 shadow-float"
        >
          <span className="mr-1 flex items-center gap-2 border-r border-line2 pr-3">
            <span
              data-slot="selection-count"
              className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-input bg-accent bg-brand-gradient px-1.5 text-[11px] font-bold text-on-accent"
            >
              {count}
            </span>
            <span className="text-xs text-text2 whitespace-nowrap">
              {selectionCountLabel(count, noun, plural)}
            </span>
          </span>
          {actions.map((action) => (
            <DisabledWrite
              key={action.label}
              active={action.disabled === true}
              hint={action.hint ?? ''}
            >
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={action.disabled === true}
                data-slot={action.slot ?? 'selection-action'}
                onClick={action.onSelect}
                // The board's action chrome (B3.V7) and its red-tinted Delete (B3.V6), passed
                // from here so the shared `Button` variants stay product-wide.
                className={cn(
                  'border border-line2 text-xs text-text2 hover:text-text',
                  action.disabled === true && disabledWriteClassName,
                  action.tone === 'bad' &&
                    'border-bad/40 bg-bad/10 text-bad hover:bg-bad/15 hover:text-bad',
                )}
              >
                {action.icon}
                {action.label}
              </Button>
            </DisabledWrite>
          ))}
          {children}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClear}
            data-slot="selection-clear"
            className="text-xs text-text4"
          >
            Clear
          </Button>
        </div>
      )}
      {hasNotice ? (
        <div
          role="status"
          className="rounded-card border border-line bg-surface px-3 py-1.5 text-xs text-text2 shadow-float"
          data-slot="selection-notice"
        >
          {notice}
        </div>
      ) : null}
    </div>
  );
}
