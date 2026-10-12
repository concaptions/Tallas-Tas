'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DisabledWrite,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  disabledWriteClassName,
} from '@tas/ui';
import {
  CUSTOM_PAGE_FILTER_OPS,
  CUSTOM_PAGE_FILTER_OP_LABELS,
  CUSTOM_PAGE_SOURCE_TABLE_KEYS,
  CUSTOM_PAGE_SOURCE_TABLE_LABELS,
  filterOpNeedsValue,
  type CustomPageFilterConfig,
  type CustomPageFilterOp,
  type CustomPageSourceTableKey,
} from '@tas/domain';

import { createCustomPageAction, type CustomPageActionResult } from './custom-page-actions';
import { editPageAction, type PageActionResult } from './page-actions';
import type { PageListItem } from './page-list-item';

/**
 * ONE page form behind two dialogs (2026-10-12): "Add custom page" (create) and a row's "Edit"
 * (edit). Both post the same fields through the same `page-schema` rules; the server decides what
 * is accepted and for which brand.
 *
 * Edit mode: title and visibility for every page; the filter and the column picks as well for a
 * custom or module page (a standard tab is a shipped route and has neither). The slug is shown,
 * not editable — it is the page's URL; the source table is fixed once the page exists. A standard
 * tab or module page saves the BRAND's override and never the template (Reset restores it); a
 * brand's own custom page is updated in place. There is no icon column on a page — none is offered.
 *
 * The form is its own exported component (`PageForm`) so a test can render it statically; a Radix
 * dialog's content lives in a portal and never reaches server markup.
 */
export type ResolverColumnsByTable = Readonly<
  Record<CustomPageSourceTableKey, readonly { columnKey: string; displayLabel: string }[]>
>;

type PageDialogProps =
  | {
      readonly mode: 'create';
      readonly resolverColumnsByTable: ResolverColumnsByTable;
      readonly demo: boolean;
      readonly disabled: boolean;
    }
  | {
      readonly mode: 'edit';
      readonly page: PageListItem;
      readonly resolverColumnsByTable: ResolverColumnsByTable;
      readonly open: boolean;
      readonly onOpenChange: (open: boolean) => void;
      /** Called once the server accepted the save (the dialog closes itself). */
      readonly onSaved?: (page: PageListItem) => void;
    };

/** Normalise a user-typed title to a kebab-case slug: lowercase, dash-separated, alnum only. */
export function toKebab(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Result = CustomPageActionResult | PageActionResult;

/** Whether the filter and column picks apply: a custom or module page, never a standard tab. */
export function pageHasStructure(page: PageListItem | null): boolean {
  return page === null || page.kind !== 'standard';
}

export function PageDialog(props: PageDialogProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const open = props.mode === 'create' ? createOpen : props.open;
  const setOpen = props.mode === 'create' ? setCreateOpen : props.onOpenChange;
  const page = props.mode === 'edit' ? props.page : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === 'create' ? (
        // The hint wraps the trigger and the trigger wraps the button (the other way round drops
        // Radix's onClick on `DisabledWrite`, and the button does nothing).
        <DisabledWrite active={props.demo || props.disabled}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-slot="add-custom-page"
              disabled={props.demo || props.disabled}
              className={disabledWriteClassName}
            >
              Add custom page
            </Button>
          </DialogTrigger>
        </DisabledWrite>
      ) : null}
      <DialogContent data-slot="page-dialog" data-mode={props.mode}>
        <DialogHeader>
          <DialogTitle>{page === null ? 'Add custom page' : `Edit ${page.title}`}</DialogTitle>
          <DialogDescription>
            {page === null
              ? 'A custom page renders a filtered view of one source table into the client portal.'
              : page.isTemplate
                ? 'Saved for this brand only — the template keeps its own values, and Reset restores them.'
                : 'Changes this page for this brand.'}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <PageForm
            key={page?.slug ?? 'create'}
            page={page}
            resolverColumnsByTable={props.resolverColumnsByTable}
            onSaved={() => {
              setOpen(false);
              if (props.mode === 'edit') props.onSaved?.(props.page);
            }}
            onCancel={() => {
              setOpen(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface PageFormProps {
  /** Null creates a custom page; a page edits it. */
  readonly page: PageListItem | null;
  readonly resolverColumnsByTable: ResolverColumnsByTable;
  readonly onSaved?: () => void;
  /** Cancel: the dialog closes itself (the form has no dialog context of its own). */
  readonly onCancel?: () => void;
}

/** The one form. Pre-filled from `page` in edit mode; empty in create mode. */
export function PageForm({ page, resolverColumnsByTable, onSaved, onCancel }: PageFormProps) {
  const editing = page !== null;
  const structure = pageHasStructure(page);
  const initialFilter: CustomPageFilterConfig = page?.filterConfig ?? {};
  const [title, setTitle] = useState(page?.title ?? '');
  const [slug, setSlug] = useState(page?.slug ?? '');
  const [source, setSource] = useState<CustomPageSourceTableKey>(
    (page?.sourceTableKey as CustomPageSourceTableKey | null | undefined) ?? 'creative_briefs',
  );
  const [filterOp, setFilterOp] = useState<CustomPageFilterOp | 'none'>(
    'op' in initialFilter ? initialFilter.op : 'none',
  );
  const [filterColumn, setFilterColumn] = useState(
    'column' in initialFilter ? initialFilter.column : '',
  );
  const [filterValue, setFilterValue] = useState(
    'value' in initialFilter ? initialFilter.value : '',
  );
  const [visible, setVisible] = useState(page?.isVisible ?? true);
  const [columns, setColumns] = useState<readonly ColumnRow[]>(() =>
    columnRowsFor(page, resolverColumnsByTable[initialSource(page)]),
  );
  const titleId = useId();
  const slugId = useId();
  const [state, action, pending] = useActionState<Result | null, FormData>(
    editing ? editPageAction : createCustomPageAction,
    null,
  );
  useEffect(() => {
    if (state !== null && state.ok) onSaved?.();
  }, [state, onSaved]);

  const resolverColumns = resolverColumnsByTable[source];

  const onTitleChange = (next: string) => {
    setTitle(next);
    if (!editing && (slug === '' || slug === toKebab(title))) setSlug(toKebab(next));
  };

  const toggleColumn = (key: string) => {
    setColumns((current) =>
      current.map((row) => (row.columnKey === key ? { ...row, picked: !row.picked } : row)),
    );
  };
  const relabelColumn = (key: string, label: string) => {
    setColumns((current) =>
      current.map((row) => (row.columnKey === key ? { ...row, label } : row)),
    );
  };
  const moveColumn = (key: string, direction: 'up' | 'down') => {
    setColumns((current) => moveRow(current, key, direction));
  };

  const buildFormData = (): FormData => {
    const fd = new FormData();
    fd.append('title', title);
    fd.append('slug', slug);
    fd.append('isVisible', String(visible));
    if (!editing) fd.append('sourceTableKey', source);
    if (structure) {
      let filterConfig: CustomPageFilterConfig = {};
      if (filterOp !== 'none') {
        filterConfig =
          filterOp === 'is' || filterOp === 'is_not' || filterOp === 'contains'
            ? { column: filterColumn, op: filterOp, value: filterValue }
            : { column: filterColumn, op: filterOp };
      }
      fd.append('filterConfig', JSON.stringify(filterConfig));
      fd.append('columnConfig', JSON.stringify(pickedColumnConfig(columns)));
    }
    return fd;
  };

  return (
    <form
      action={() => {
        action(buildFormData());
      }}
      className="flex flex-col gap-3"
      data-slot="page-form"
      data-editing={String(editing)}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor={titleId}>Title</Label>
        <Input
          id={titleId}
          name="title"
          value={title}
          onChange={(e) => {
            onTitleChange(e.target.value);
          }}
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={slugId}>Slug</Label>
        <Input
          id={slugId}
          name="slug"
          value={slug}
          readOnly={editing}
          onChange={(e) => {
            setSlug(toKebab(e.target.value));
          }}
          required
        />
        <p className="font-mono text-[11px] text-text3">
          {editing && page.kind === 'standard'
            ? `A shipped tab: /client/[brand]/${slug}`
            : `URL: /client/[brand]/custom/${slug || 'kebab-case-slug'}`}
        </p>
      </div>
      {!editing ? (
        <div className="flex flex-col gap-1">
          <Label>Source table</Label>
          <Select
            value={source}
            onValueChange={(next) => {
              setSource(next as CustomPageSourceTableKey);
              setColumns(
                columnRowsFor(null, resolverColumnsByTable[next as CustomPageSourceTableKey]),
              );
              setFilterColumn('');
            }}
          >
            <SelectTrigger data-slot="source-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOM_PAGE_SOURCE_TABLE_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {CUSTOM_PAGE_SOURCE_TABLE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {structure ? (
        <>
          <div className="flex flex-col gap-1">
            <Label>Filter</Label>
            <div className="flex flex-wrap gap-2">
              <Select
                value={filterColumn}
                onValueChange={(next) => {
                  setFilterColumn(next);
                }}
                disabled={resolverColumns.length === 0}
              >
                <SelectTrigger className="min-w-[8rem]" data-slot="filter-column-select">
                  <SelectValue placeholder="Column…" />
                </SelectTrigger>
                <SelectContent>
                  {resolverColumns.map((c) => (
                    <SelectItem key={c.columnKey} value={c.columnKey}>
                      {c.displayLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterOp}
                onValueChange={(next) => {
                  setFilterOp(next as CustomPageFilterOp | 'none');
                }}
              >
                <SelectTrigger className="min-w-[8rem]" data-slot="filter-op-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No filter</SelectItem>
                  {CUSTOM_PAGE_FILTER_OPS.map((op) => (
                    <SelectItem key={op} value={op}>
                      {CUSTOM_PAGE_FILTER_OP_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filterOp !== 'none' && filterOpNeedsValue(filterOp) ? (
                <Input
                  value={filterValue}
                  onChange={(e) => {
                    setFilterValue(e.target.value);
                  }}
                  placeholder="Value"
                  data-slot="filter-value"
                />
              ) : null}
            </div>
          </div>
          <fieldset className="flex flex-col gap-1" data-slot="page-form-columns">
            <legend className="text-sm font-medium text-text2">Columns</legend>
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-input border border-line bg-surface2 p-2">
              {columns.length === 0 ? (
                <p className="text-xs text-text3">
                  No client-visible columns are configured for this source table.
                </p>
              ) : (
                columns.map((row, index) => (
                  <div
                    key={row.columnKey}
                    data-slot="column-row"
                    data-column-key={row.columnKey}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      data-slot="column-pick"
                      data-column-key={row.columnKey}
                      aria-label={`Show ${row.resolverLabel}`}
                      checked={row.picked}
                      onChange={() => {
                        toggleColumn(row.columnKey);
                      }}
                    />
                    <Input
                      data-slot="column-label"
                      data-column-key={row.columnKey}
                      aria-label={`Label for ${row.resolverLabel}`}
                      value={row.label}
                      onChange={(e) => {
                        relabelColumn(row.columnKey, e.target.value);
                      }}
                      className="h-7 flex-1 text-xs"
                    />
                    <span className="font-mono text-[10px] text-text4">{row.columnKey}</span>
                    {(['up', 'down'] as const).map((direction) => (
                      <Button
                        key={direction}
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-slot="column-move"
                        data-direction={direction}
                        data-column-key={row.columnKey}
                        aria-label={`Move ${row.resolverLabel} ${direction}`}
                        disabled={direction === 'up' ? index === 0 : index === columns.length - 1}
                        onClick={() => {
                          moveColumn(row.columnKey, direction);
                        }}
                      >
                        {direction === 'up' ? '↑' : '↓'}
                      </Button>
                    ))}
                  </div>
                ))
              )}
            </div>
            <p className="text-[11px] text-text3">
              Tick what the client sees, name it as the client should read it, order it with the
              arrows. At least one column is required.
            </p>
          </fieldset>
        </>
      ) : null}
      <div className="flex items-center gap-2">
        <Switch
          checked={visible}
          onCheckedChange={(next) => {
            setVisible(next);
          }}
          data-slot="page-form-visible"
          aria-label="Visible in the client portal"
        />
        <span className="text-sm text-text2">Visible in the client portal</span>
      </div>
      {state !== null && !state.ok ? (
        <p data-slot="page-form-error" className="text-xs text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending} data-slot="page-form-save">
          {pending ? 'Saving…' : editing ? 'Save' : 'Add page'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** One row of the Columns section: a client-visible column, picked or not, under the page's label. */
export interface ColumnRow {
  readonly columnKey: string;
  /** The resolver's own label — what the client sees when the page keeps no label of its own. */
  readonly resolverLabel: string;
  readonly label: string;
  readonly picked: boolean;
}

function initialSource(page: PageListItem | null): CustomPageSourceTableKey {
  return (page?.sourceTableKey as CustomPageSourceTableKey | null | undefined) ?? 'creative_briefs';
}

/**
 * The Columns section's rows: the page's picks first, in the page's order and under the page's
 * labels, then every other client-visible column of the table, unticked under the resolver's label.
 */
export function columnRowsFor(
  page: PageListItem | null,
  resolverColumns: readonly { columnKey: string; displayLabel: string }[] | undefined,
): readonly ColumnRow[] {
  const resolver = resolverColumns ?? [];
  const resolverByKey = new Map(resolver.map((column) => [column.columnKey, column] as const));
  const picks = (page?.columnConfig ?? [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .flatMap((pick) => {
      const resolved = resolverByKey.get(pick.columnKey);
      if (resolved === undefined) return [];
      return [
        {
          columnKey: pick.columnKey,
          resolverLabel: resolved.displayLabel,
          label: pick.displayLabel.trim() === '' ? resolved.displayLabel : pick.displayLabel,
          picked: true,
        },
      ];
    });
  const pickedKeys = new Set(picks.map((row) => row.columnKey));
  const rest = resolver
    .filter((column) => !pickedKeys.has(column.columnKey))
    .map((column) => ({
      columnKey: column.columnKey,
      resolverLabel: column.displayLabel,
      label: column.displayLabel,
      picked: false,
    }));
  return [...picks, ...rest];
}

/** Swaps the row with its neighbour; the edges stay put. */
export function moveRow(
  rows: readonly ColumnRow[],
  columnKey: string,
  direction: 'up' | 'down',
): readonly ColumnRow[] {
  const index = rows.findIndex((row) => row.columnKey === columnKey);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return rows;
  const next = rows.slice();
  const [row] = next.splice(index, 1);
  if (row === undefined) return rows;
  next.splice(target, 0, row);
  return next;
}

/** What the page stores: the picked rows, in their order, under their labels. */
export function pickedColumnConfig(
  rows: readonly ColumnRow[],
): { columnKey: string; displayLabel: string; displayOrder: number }[] {
  return rows
    .filter((row) => row.picked)
    .map((row, index) => ({
      columnKey: row.columnKey,
      displayLabel: row.label.trim() === '' ? row.resolverLabel : row.label.trim(),
      displayOrder: index,
    }));
}
