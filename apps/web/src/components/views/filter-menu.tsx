'use client';

import { useState } from 'react';
import type { UserViewFilter, UserViewFilterOp } from '@tas/domain';
import { USER_VIEW_FILTER_OPS } from '@tas/domain';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
} from '@tas/ui';

import type { FieldOption } from './fields-menu';

/** How each operator reads in a sentence; the stored vocabulary stays `@tas/domain`'s. */
const OP_LABELS: Record<UserViewFilterOp, string> = {
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
  empty: 'is empty',
  not_empty: 'is not empty',
};

/** The operators that compare against a typed value; the other two read the cell alone. */
function takesValue(op: UserViewFilterOp): boolean {
  return op !== 'empty' && op !== 'not_empty';
}

/** The token-dressed `<select>` the dialog uses twice; native, so every key works in a dialog. */
const SELECT_CLASS =
  'h-8 w-full rounded-input border border-line bg-surface px-2 text-sm text-text2';

interface FilterMenuProps {
  /** The page's resolved columns, in the viewer's order — the vocabulary a condition can name. */
  readonly fields: readonly FieldOption[];
  readonly filters: readonly UserViewFilter[];
  readonly onFiltersChange: (filters: readonly UserViewFilter[]) => void;
}

/**
 * The Filter popover (AI-32): the view's field conditions, beside the free-text search they
 * compose with — the search asks "does anything mention sleep", a condition asks "is Status
 * exactly Approved", and the rows must pass both. The popover lists the live conditions (one
 * click removes one) and "Add filter…" opens a small dialog, the same menu-to-dialog step the
 * Views menu takes for a name — because a condition needs a field, an operator and typed text,
 * and a Radix menu owns the keys a text input needs. Everything persists into the viewer's active
 * view through the caller; this component only renders and reports.
 */
export function FilterMenu({ fields, filters, onFiltersChange }: FilterMenuProps) {
  const [adding, setAdding] = useState(false);
  const [field, setField] = useState('');
  const [op, setOp] = useState<UserViewFilterOp>('is');
  const [value, setValue] = useState('');

  const labelOf = (key: string): string =>
    fields.find((candidate) => candidate.key === key)?.label ?? key;

  const openDialog = () => {
    setField(fields[0]?.key ?? '');
    setOp('is');
    setValue('');
    setAdding(true);
  };

  const submit = () => {
    if (field === '') return;
    const next: UserViewFilter = { field, op, value: takesValue(op) ? value : '' };
    onFiltersChange([...filters, next]);
    setAdding(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" data-slot="grid-filter">
            {filters.length === 0 ? 'Filter' : `Filter (${String(filters.length)})`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 min-w-56 overflow-y-auto">
          <DropdownMenuLabel>Filters — every one must match</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {filters.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-text3">No filters yet.</p>
          ) : (
            filters.map((filter, index) => (
              <DropdownMenuItem
                // A condition has no identity beyond its place in the list; the index is it.
                key={`${filter.field}-${String(index)}`}
                data-slot="filter-row"
                data-field={filter.field}
                onSelect={(event) => {
                  event.preventDefault();
                  onFiltersChange(filters.filter((_, at) => at !== index));
                }}
              >
                <span className="flex-1 truncate">
                  {labelOf(filter.field)} {OP_LABELS[filter.op]}
                  {takesValue(filter.op) ? ` “${filter.value}”` : ''}
                </span>
                <span aria-hidden className="text-text4">
                  ✕
                </span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem data-slot="filter-add" onSelect={openDialog}>
            Add filter…
          </DropdownMenuItem>
          {filters.length === 0 ? null : (
            <DropdownMenuItem
              data-slot="filter-clear"
              onSelect={() => {
                onFiltersChange([]);
              }}
            >
              Clear all filters
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent data-slot="filter-dialog">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>Add filter</DialogTitle>
              <DialogDescription>
                Rows must match every filter, on top of anything in the search box. The filter is
                part of your view and changes nobody else&rsquo;s table.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-field">Field</Label>
              {/* Native selects on purpose: inside a dialog every key just works, and the E2E
                  drives them with selectOption instead of a click choreography. */}
              <select
                id="filter-field"
                data-slot="filter-field"
                className={SELECT_CLASS}
                value={field}
                onChange={(event) => {
                  setField(event.target.value);
                }}
              >
                {fields.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-op">Condition</Label>
              <select
                id="filter-op"
                data-slot="filter-op"
                className={SELECT_CLASS}
                value={op}
                onChange={(event) => {
                  const next = event.target.value;
                  const isOp = (candidate: string): candidate is UserViewFilterOp =>
                    (USER_VIEW_FILTER_OPS as readonly string[]).includes(candidate);
                  if (isOp(next)) setOp(next);
                }}
              >
                {USER_VIEW_FILTER_OPS.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {OP_LABELS[candidate]}
                  </option>
                ))}
              </select>
            </div>
            {takesValue(op) ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-value">Value</Label>
                <Input
                  id="filter-value"
                  data-slot="filter-value"
                  value={value}
                  autoFocus
                  onChange={(event) => {
                    setValue(event.target.value);
                  }}
                  placeholder="e.g. Approved"
                />
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAdding(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" data-slot="filter-save">
                Add filter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
