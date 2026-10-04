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

import type { FieldOption } from './fields-menu';

/** The value the radio group uses for "whatever the table pins by default" (its name column). */
const DEFAULT_VALUE = '__default__';

interface FreezeMenuProps {
  /** The grid's columns in the viewer's own order — what the freeze is a prefix of. */
  readonly fields: readonly FieldOption[];
  /** The last frozen column, or null while the table's default freeze is in force. */
  readonly frozenUpTo: string | null;
  /** Reports the column to freeze up to and including, or null for the table's default. */
  readonly onFreezeChange: (key: string | null) => void;
}

/**
 * The Freeze popover (action item 22): which columns stay pinned while the grid scrolls sideways.
 *
 * A freeze is a prefix, so the control is a single choice rather than a checkbox per column —
 * "freeze up to and including Batch" pins Name and Batch, and there is no way to ask for a frozen
 * column with a scrolling one to its left, which would read as a bug rather than a setting. The
 * choice persists into the viewer's active view through the caller, exactly as the Fields popover
 * does; this component only renders and reports.
 *
 * The first entry hands the table its own default back (one pinned name column), which is what an
 * empty `frozenFields` has always meant — so clearing a freeze never leaves a grid with nothing
 * pinned at all.
 */
export function FreezeMenu({ fields, frozenUpTo, onFreezeChange }: FreezeMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-slot="grid-freeze">
          Freeze
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Freeze up to and including</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={frozenUpTo ?? DEFAULT_VALUE}
          onValueChange={(value) => {
            onFreezeChange(value === DEFAULT_VALUE ? null : value);
          }}
        >
          <DropdownMenuRadioItem
            value={DEFAULT_VALUE}
            data-slot="grid-freeze-option"
            data-field={DEFAULT_VALUE}
            onSelect={(event) => {
              event.preventDefault();
            }}
          >
            Table default
          </DropdownMenuRadioItem>
          {fields.map((field) => (
            <DropdownMenuRadioItem
              key={field.key}
              value={field.key}
              data-slot="grid-freeze-option"
              data-field={field.key}
              onSelect={(event) => {
                event.preventDefault();
              }}
            >
              {field.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
