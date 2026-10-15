'use client';

import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * ONE chip, as the row renders it. The caller holds the stored key and the human label; the
 * primitive is agnostic — it never knows a `BriefFieldKind`, a status key or a role. The shape
 * mirrors the native `<option>` tuple so a caller can pass the same data a `<select>` would read.
 */
export interface ChipOption {
  readonly value: string;
  readonly label: string;
  /** Optional per-chip disable, for an archived or unavailable choice. */
  readonly disabled?: boolean;
}

export type ChipRowMode = 'single' | 'multi';
export type ChipRowSize = 'sm' | 'md';

export interface ChipRowProps {
  /** Selected values. In `single` mode, length is 0 or 1; in `multi`, any subset. */
  readonly value: readonly string[];
  readonly options: readonly ChipOption[];
  readonly onChange: (next: readonly string[]) => void;
  readonly mode: ChipRowMode;
  /** The whole row refuses interaction; chips render in a muted, read-only state. */
  readonly disabled?: boolean;
  /** `sm` is for grid rows and sidebar inline edits; `md` is for the new-brief dialog. */
  readonly size?: ChipRowSize;
  /** Optional aria-label for the group as a whole — the surface rail that reads "Type" or
   * "Platform". The field's own label is the natural choice. */
  readonly ariaLabel?: string;
  /** Optional className for the group wrapper, so the caller can control gutter and wrapping. */
  readonly className?: string;
  /** Optional data-slot override. Default: `chip-row`. */
  readonly dataSlot?: string;
}

/**
 * A horizontal list of selectable chips (Phase B5 Fix A, 2026-10-15). The primitive the sidebar,
 * the new-brief dialog and the grid cell all read for a `singleSelect` or `multiSelect` field,
 * so a dropdown is never re-implemented from scratch and the look is one place.
 *
 * KEYBOARD AND ARIA, from the shape:
 *
 * - `mode='single'` renders a `role="radiogroup"`; each chip is a `role="radio"` with
 *   `aria-checked`. Arrow keys move the active chip, Enter / Space selects it. Tab enters the
 *   group at the current selection (or the first chip when nothing is selected) and leaves it.
 * - `mode='multi'` renders a `role="group"`; each chip is a `role="checkbox"` with
 *   `aria-checked`. Arrow keys move focus, Enter / Space toggles. Tab visits every chip, so
 *   several can be set by keyboard.
 *
 * Chips are rendered as `<button type="button">` so the primitive stays inside a `<form>` without
 * triggering a submit. Selection is driven by the controlled `value` prop; the primitive owns no
 * state besides which chip is currently focused.
 */
export function ChipRow({
  value,
  options,
  onChange,
  mode,
  disabled = false,
  size = 'sm',
  ariaLabel,
  className,
  dataSlot = 'chip-row',
}: ChipRowProps): React.ReactElement {
  // Normalise selected keys for O(1) lookup during render.
  const selected = React.useMemo(() => new Set(value), [value]);
  const buttonRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const commit = React.useCallback(
    (nextKey: string): void => {
      if (disabled) return;
      const option = options.find((entry) => entry.value === nextKey);
      if (option === undefined || option.disabled === true) return;

      if (mode === 'single') {
        onChange(selected.has(nextKey) ? [] : [nextKey]);
        return;
      }
      // Multi: toggle, order follows the options list to keep writes stable.
      const nextSelected = new Set(selected);
      if (nextSelected.has(nextKey)) {
        nextSelected.delete(nextKey);
      } else {
        nextSelected.add(nextKey);
      }
      onChange(options.map((entry) => entry.value).filter((key) => nextSelected.has(key)));
    },
    [disabled, mode, onChange, options, selected],
  );

  const focusAt = React.useCallback((index: number): void => {
    const node = buttonRefs.current[index];
    if (node !== undefined && node !== null) {
      node.focus();
    }
  }, []);

  const handleKey = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number, option: ChipOption): void => {
      if (disabled) return;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown': {
          event.preventDefault();
          const next = (index + 1) % options.length;
          focusAt(next);
          return;
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          event.preventDefault();
          const prev = (index - 1 + options.length) % options.length;
          focusAt(prev);
          return;
        }
        case 'Home': {
          event.preventDefault();
          focusAt(0);
          return;
        }
        case 'End': {
          event.preventDefault();
          focusAt(options.length - 1);
          return;
        }
        case ' ':
        case 'Enter': {
          event.preventDefault();
          commit(option.value);
          return;
        }
        default:
          return;
      }
    },
    [commit, disabled, focusAt, options.length],
  );

  const padding = size === 'md' ? 'px-3 py-1.5' : 'px-2 py-1';
  const fontSize = size === 'md' ? 'text-sm' : 'text-xs';

  // In single-select mode, the chip that receives Tab is the current selection, else the first.
  const firstTabIndex = React.useMemo((): number => {
    if (mode !== 'single') return -1;
    const idx = options.findIndex((option) => selected.has(option.value));
    return idx === -1 ? 0 : idx;
  }, [mode, options, selected]);

  const groupRole = mode === 'single' ? 'radiogroup' : 'group';

  return (
    <div
      data-slot={dataSlot}
      role={groupRole}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {options.map((option, index) => {
        const isSelected = selected.has(option.value);
        const isDisabled = disabled || option.disabled === true;
        const chipRole = mode === 'single' ? 'radio' : 'checkbox';
        const tabIndex = mode === 'single' ? (index === firstTabIndex ? 0 : -1) : 0;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role={chipRole}
            aria-checked={isSelected}
            aria-disabled={isDisabled || undefined}
            data-slot="chip-row-item"
            data-value={option.value}
            data-selected={isSelected ? 'true' : 'false'}
            tabIndex={isDisabled ? -1 : tabIndex}
            disabled={isDisabled}
            onClick={() => {
              commit(option.value);
            }}
            onKeyDown={(event) => {
              handleKey(event, index, option);
            }}
            className={cn(
              'inline-flex items-center rounded-input border font-mono leading-none whitespace-nowrap',
              'transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-soft',
              padding,
              fontSize,
              isSelected
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-line bg-surface text-text2 hover:bg-surface2',
              isDisabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
