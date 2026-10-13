'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tas/ui';
import { Layers2 } from '@tas/ui/icons';

import type { GroupByOption } from './airtable-grid-logic';

export type { GroupByOption };

/** The radio value standing for "no grouping": the flat reading every table opens on. */
export const GROUP_NONE = '__none__';

export interface GroupByControlProps {
  /**
   * The columns a grouping may use, in the viewer's order — only the ones the grid can bucket
   * (`groupableFields(grid.columns)`), so no choice ever reads "Group: Formats" above a flat grid.
   */
  readonly options: readonly GroupByOption[];
  /** The grouping column's key, or null while the rows read flat. */
  readonly value: string | null;
  readonly onChange: (key: string | null) => void;
  /**
   * Whether "None" heads the list. True (the default) is the grid, where flat is always one click
   * away; false is the Kanban field picker — a board always groups, so the list holds the fields
   * alone and `onChange` never reports null.
   */
  readonly allowNone?: boolean;
  /** The trigger's word, default "Group"; once a column is chosen it reads "<word>: <column>". */
  readonly label?: string;
  /** The heading inside the popover, default "Group rows by". */
  readonly menuLabel?: string;
  /**
   * The trigger's `data-slot`, default `grid-group`. Every option row carries `${slot}-option`
   * and its `data-field`, so one locator pattern reads every flavour of the control.
   */
  readonly slot?: string;
  readonly disabled?: boolean;
}

/**
 * What the trigger prints: the word alone while flat, "<word>: <column label>" once chosen. A
 * stored key the options no longer carry — a stale lens on a column the grid cannot bucket, which
 * it draws flat — prints as its raw key rather than hiding the choice.
 */
export function groupByTriggerText(
  label: string,
  value: string | null,
  options: readonly GroupByOption[],
): string {
  if (value === null) return label;
  return `${label}: ${options.find((option) => option.key === value)?.label ?? value}`;
}

/**
 * The Group popover (AI-32, shared by every table; Ticket 7 made it one primitive with two
 * flavours): which column's values head the grid's rows, or which field a Kanban board's columns
 * come from. One choice, because the grid renders one level of headers — grouping inside a
 * grouping is a different product. The choice persists through the caller (the viewer's active
 * view for the grid, the per-brand preference for the board); this component only renders and
 * reports. A pick keeps the popover open (`onSelect` is prevented) so the viewer sees the radio
 * move before closing it.
 */
export function GroupByControl({
  options,
  value,
  onChange,
  allowNone = true,
  label = 'Group',
  menuLabel = 'Group rows by',
  slot = 'grid-group',
  disabled = false,
}: GroupByControlProps) {
  const optionSlot = `${slot}-option`;
  const keepOpen = (event: Event) => {
    event.preventDefault();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-slot={slot} disabled={disabled}>
          <Layers2 className="size-3.5" strokeWidth={1.8} aria-hidden />
          {groupByTriggerText(label, value, options)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value ?? GROUP_NONE}
          onValueChange={(next) => {
            onChange(next === GROUP_NONE ? null : next);
          }}
        >
          {allowNone ? (
            <DropdownMenuRadioItem
              value={GROUP_NONE}
              data-slot={optionSlot}
              data-field={GROUP_NONE}
              onSelect={keepOpen}
            >
              None
            </DropdownMenuRadioItem>
          ) : null}
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.key}
              value={option.key}
              data-slot={optionSlot}
              data-field={option.key}
              onSelect={keepOpen}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
