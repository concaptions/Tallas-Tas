'use client';

import { cn } from '../lib/cn';

import type { ReactNode } from 'react';

import type { BoldTabItem } from './tabs';

export interface BoldPillsProps {
  readonly items: readonly BoldTabItem[];
  /** The active filter's key. */
  readonly value: string;
  readonly onChange: (key: string) => void;
  /** The group's accessible name, e.g. "Filter angles". */
  readonly label: string;
  readonly className?: string;
}

/**
 * Bold filter pills (redesign commit 3b, spec §3.7): the quick-filter row with counts — All /
 * Winning / the four angle types. Toggle buttons, not tabs: each carries `aria-pressed` and the
 * active one is solid accent. Bold-only; mounted by the pages commits. The keys and counts come
 * from the page's own data — this component holds no vocabulary.
 */
export function BoldPills({ items, value, onChange, label, className }: BoldPillsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {items.map((item) => {
        const pressed = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={pressed}
            data-slot="bold-pill"
            onClick={() => {
              onChange(item.key);
            }}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-[99px] border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors',
              pressed
                ? 'border-transparent bg-accent text-on-accent'
                : 'border-line2 bg-surface text-text2 hover:text-text',
            )}
          >
            {item.label}
            {item.count === undefined ? null : (
              <span
                className={cn(
                  'font-mono text-[10.5px]',
                  pressed ? 'text-on-accent/80' : 'text-text3',
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

export interface BoldSegItem {
  readonly key: string;
  readonly label: string;
  /** An optional leading 18px-grid glyph. */
  readonly icon?: ReactNode;
}

export interface BoldSegProps {
  readonly items: readonly BoldSegItem[];
  readonly value: string;
  readonly onChange: (key: string) => void;
  /** The group's accessible name, e.g. "Sheet layout". */
  readonly label: string;
  readonly className?: string;
}

/**
 * Bold seg (spec §3.7): the inset two-to-three-way switcher — Grid/Gallery on the Creative Sheet.
 * Same `aria-pressed` semantics as the pills; the raised white (panel) segment is the active one.
 */
export function BoldSeg({ items, value, onChange, label, className }: BoldSegProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="bold-seg"
      className={cn('inline-flex items-center gap-1 rounded-input bg-surface2 p-1', className)}
    >
      {items.map((item) => {
        const pressed = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={pressed}
            data-slot="bold-seg-button"
            onClick={() => {
              onChange(item.key);
            }}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-[11px] px-3 text-[13px] font-semibold whitespace-nowrap transition-colors [&_svg]:size-4',
              pressed ? 'bg-surface text-text shadow-xs' : 'text-text3 hover:text-text',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
