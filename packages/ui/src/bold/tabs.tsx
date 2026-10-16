'use client';

import { cn } from '../lib/cn';

import { useRovingTablist } from './tablist';

/** One tab: a stable key, its label, and the optional record count badge (spec §3.7). */
export interface BoldTabItem {
  readonly key: string;
  readonly label: string;
  readonly count?: number;
}

export interface BoldTabsProps {
  readonly items: readonly BoldTabItem[];
  /** The selected item's key. Controlled: the page owns the state. */
  readonly value: string;
  readonly onChange: (key: string) => void;
  /** The tablist's accessible name, e.g. "UGC views". */
  readonly label: string;
  readonly className?: string;
}

/**
 * Bold tabs (redesign commit 3b, spec §3.7): the solid-accent selected tab with its count badge.
 * A real `tablist` — roving focus on Arrow/Home/End, manual activation — mounted only by Bold
 * surfaces (commits 4–8), styled exclusively through tokens so both themes hold. Panels live with
 * the page; it only switches the key.
 */
export function BoldTabs({ items, value, onChange, label, className }: BoldTabsProps) {
  const { setTabRef, onTabKeyDown } = useRovingTablist(items.length);
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {items.map((item, index) => {
        const selected = item.key === value;
        return (
          <button
            key={item.key}
            ref={setTabRef(index)}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            data-slot="bold-tab"
            onKeyDown={onTabKeyDown(index)}
            onClick={() => {
              onChange(item.key);
            }}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3.5 text-sm font-semibold whitespace-nowrap transition-colors',
              selected
                ? 'bg-accent text-on-accent'
                : 'text-text2 hover:bg-surface2 hover:text-text',
            )}
          >
            {item.label}
            {item.count === undefined ? null : (
              <span
                className={cn(
                  'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[99px] px-1 font-mono text-[10.5px]',
                  selected ? 'bg-on-accent/20 text-on-accent' : 'bg-surface3 text-text3',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Bold subnav (spec §3.7): the underline flavour of the same tablist — the settings sections, the
 * drawer's section switch. Identical semantics to `BoldTabs`; only the paint differs.
 */
export function BoldSubnav({ items, value, onChange, label, className }: BoldTabsProps) {
  const { setTabRef, onTabKeyDown } = useRovingTablist(items.length);
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex items-center gap-5 border-b border-line', className)}
    >
      {items.map((item, index) => {
        const selected = item.key === value;
        return (
          <button
            key={item.key}
            ref={setTabRef(index)}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            data-slot="bold-subnav-tab"
            onKeyDown={onTabKeyDown(index)}
            onClick={() => {
              onChange(item.key);
            }}
            className={cn(
              '-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-0.5 text-sm font-semibold whitespace-nowrap transition-colors',
              selected
                ? 'border-accent text-text'
                : 'border-transparent text-text3 hover:text-text',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
