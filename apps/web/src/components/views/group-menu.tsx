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

/** The radio value standing for "no grouping": the flat reading every table opens on. */
const NONE_VALUE = '__none__';

interface GroupMenuProps {
  /** The page's resolved columns, in the viewer's order — the vocabulary a grouping can use. */
  readonly fields: readonly FieldOption[];
  /** The grouping column, or null while the grid reads flat. */
  readonly groupBy: string | null;
  readonly onGroupChange: (key: string | null) => void;
}

/**
 * The Group popover (AI-32): which column's values head the grid's rows. One choice, because the
 * grid renders one level of headers — grouping inside a grouping is a different product. The
 * choice persists into the viewer's active view through the caller, exactly as the Fields and
 * Freeze popovers do; this component only renders and reports. "None" is always first, so a
 * grouping is always one click from flat again.
 */
export function GroupMenu({ fields, groupBy, onGroupChange }: GroupMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-slot="grid-group">
          {groupBy === null
            ? 'Group'
            : `Group: ${fields.find((field) => field.key === groupBy)?.label ?? groupBy}`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Group rows by</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={groupBy ?? NONE_VALUE}
          onValueChange={(value) => {
            onGroupChange(value === NONE_VALUE ? null : value);
          }}
        >
          <DropdownMenuRadioItem
            value={NONE_VALUE}
            data-slot="grid-group-option"
            data-field={NONE_VALUE}
            onSelect={(event) => {
              event.preventDefault();
            }}
          >
            None
          </DropdownMenuRadioItem>
          {fields.map((field) => (
            <DropdownMenuRadioItem
              key={field.key}
              value={field.key}
              data-slot="grid-group-option"
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
