'use client';

import { useActionState, useId, useMemo, useState, useTransition } from 'react';
import {
  Button,
  Dialog,
  DialogClose,
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
  mergeCustomPages,
  type CustomInterfacePageView,
  type CustomPageFilterConfig,
  type CustomPageFilterOp,
  type CustomPageSourceTableKey,
} from '@tas/domain';

import {
  createCustomPageAction,
  deleteCustomPageAction,
  type CustomPageActionResult,
} from './custom-page-actions';
import {
  requestCustomPagePromotionAction,
  type CustomPagePromotionActionResult,
} from './custom-page-propagation-actions';

/**
 * Custom-pages admin section (Oct 6/7 Agent 4). Three sub-surfaces:
 *
 *   1. The list of pages this brand sees (its own rows and the template rows it inherits), with
 *      "customised" / "inherited" chips, a visibility pill and a soft-delete control.
 *   2. "Add Custom Page" dialog — slug / title / source table / filter / column pick.
 *   3. "Push to all clients" — turns the current (template-scoped) page into a propagation request
 *      that an Admin approves on `/app/propagation`.
 *
 * The dialog is small on purpose: V0 ships ONE filter condition and the column pick is
 * checkbox-based because reordering a 20-item list in a modal would need a drag library.
 *
 * No business logic lives here. The vocabularies are from `@tas/domain`; the server actions decide
 * whether a submission is accepted.
 */

export type CustomPageSummary = CustomInterfacePageView;

interface CustomPagesSectionProps {
  readonly brandId: string | null;
  readonly templatePages: readonly CustomPageSummary[];
  readonly brandPages: readonly CustomPageSummary[];
  readonly resolverColumnsByTable: Readonly<
    Record<CustomPageSourceTableKey, readonly { columnKey: string; displayLabel: string }[]>
  >;
  readonly demo: boolean;
  readonly disabled: boolean;
}

export function CustomPagesSection({
  brandId,
  templatePages,
  brandPages,
  resolverColumnsByTable,
  demo,
  disabled,
}: CustomPagesSectionProps) {
  const merged = useMemo(
    () => mergeCustomPages(templatePages, brandPages),
    [templatePages, brandPages],
  );
  return (
    <section
      data-slot="custom-pages"
      aria-labelledby="custom-pages-heading"
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="custom-pages-heading" className="text-sm font-medium text-text2">
            Custom pages
          </h2>
          <p className="max-w-prose text-[12px] leading-snug text-text3">
            Add a brand-specific page that renders a filtered view of any content table. The
            Internal and Client queues (
            <span className="font-mono text-[11px]">/app/queue/internal</span>,{' '}
            <span className="font-mono text-[11px]">/app/queue/client</span>) are the shipped
            surface — the two default custom pages seeded here are their mirrors in the client
            portal.
          </p>
        </div>
        <AddPageDialog
          resolverColumnsByTable={resolverColumnsByTable}
          demo={demo}
          disabled={disabled}
        />
      </div>
      {merged.length === 0 ? (
        <p className="rounded-input border border-line bg-surface2 p-4 text-sm text-text3">
          No custom pages yet. Add one above to make it appear in every client&rsquo;s portal, or
          add a brand-scoped page to make it appear only here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-slot="custom-pages-list">
          {merged.map((page) => (
            <CustomPageRow
              key={page.id}
              page={page}
              brandId={brandId}
              demo={demo}
              disabled={disabled}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface CustomPageRowProps {
  readonly page: CustomPageSummary;
  readonly brandId: string | null;
  readonly demo: boolean;
  readonly disabled: boolean;
}

function CustomPageRow({ page, brandId, demo, disabled }: CustomPageRowProps) {
  const [, deleteAction, deletePending] = useActionState<CustomPageActionResult | null, FormData>(
    deleteCustomPageAction,
    null,
  );
  const [promotionState, promoteAction, promotionPending] = useActionState<
    CustomPagePromotionActionResult | null,
    FormData
  >(requestCustomPagePromotionAction, null);
  const [, startTransition] = useTransition();
  const inheritedForThisBrand = page.brandId === null && brandId !== null;
  const isTemplateRow = page.brandId === null;
  return (
    <li
      className="flex flex-col gap-2 rounded-input border border-line bg-surface2 px-3 py-2"
      data-slot="custom-page-row"
      data-page-id={page.id}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text">{page.title}</span>
            <span className="font-mono text-[10px] tracking-wide text-text3 uppercase">
              {inheritedForThisBrand ? 'inherited' : 'customised'}
            </span>
            {!page.isVisible ? (
              <span className="font-mono text-[10px] tracking-wide text-text4 uppercase">
                hidden
              </span>
            ) : null}
          </div>
          <p className="font-mono text-[11px] text-text3">
            /{page.slug} — {CUSTOM_PAGE_SOURCE_TABLE_LABELS[page.sourceTableKey]}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {isTemplateRow ? (
            <DisabledWrite active={demo || disabled}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-slot="push-to-clients"
                disabled={demo || disabled || promotionPending}
                onClick={() => {
                  const fd = new FormData();
                  fd.append('id', page.id);
                  startTransition(() => {
                    promoteAction(fd);
                  });
                }}
                className={disabledWriteClassName}
              >
                Push to all clients
              </Button>
            </DisabledWrite>
          ) : null}
          {!inheritedForThisBrand ? (
            <DisabledWrite active={demo || disabled}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-slot="custom-page-delete"
                disabled={demo || disabled || deletePending}
                onClick={() => {
                  const fd = new FormData();
                  fd.append('id', page.id);
                  startTransition(() => {
                    deleteAction(fd);
                  });
                }}
                className={disabledWriteClassName}
              >
                Delete
              </Button>
            </DisabledWrite>
          ) : null}
        </div>
      </div>
      {promotionState !== null && !promotionState.ok ? (
        <p data-slot="custom-page-error" className="text-xs text-bad" role="alert">
          {promotionState.error}
        </p>
      ) : null}
      {promotionState !== null && promotionState.ok ? (
        <p data-slot="custom-page-promoted" className="text-xs text-ok" role="status">
          Sent to the Propagation page for an Admin to approve.
        </p>
      ) : null}
    </li>
  );
}

interface AddPageDialogProps {
  readonly resolverColumnsByTable: Readonly<
    Record<CustomPageSourceTableKey, readonly { columnKey: string; displayLabel: string }[]>
  >;
  readonly demo: boolean;
  readonly disabled: boolean;
}

function AddPageDialog({ resolverColumnsByTable, demo, disabled }: AddPageDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [source, setSource] = useState<CustomPageSourceTableKey>('creative_briefs');
  const [filterOp, setFilterOp] = useState<CustomPageFilterOp | 'none'>('none');
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [visible, setVisible] = useState(true);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const titleId = useId();
  const slugId = useId();
  const [state, action, pending] = useActionState<CustomPageActionResult | null, FormData>(
    createCustomPageAction,
    null,
  );

  const resolverColumns = resolverColumnsByTable[source];

  const onTitleChange = (next: string) => {
    setTitle(next);
    if (slug === '' || slug === toKebab(title)) {
      setSlug(toKebab(next));
    }
  };

  const toggleColumn = (key: string) => {
    setPicked((current) =>
      current.includes(key) ? current.filter((c) => c !== key) : [...current, key],
    );
  };

  const buildFormData = (): FormData => {
    const fd = new FormData();
    fd.append('title', title);
    fd.append('slug', slug);
    fd.append('sourceTableKey', source);
    let filterConfig: CustomPageFilterConfig = {};
    if (filterOp !== 'none') {
      if (filterOp === 'is' || filterOp === 'is_not' || filterOp === 'contains') {
        filterConfig = { column: filterColumn, op: filterOp, value: filterValue };
      } else {
        filterConfig = { column: filterColumn, op: filterOp };
      }
    }
    fd.append('filterConfig', JSON.stringify(filterConfig));
    fd.append(
      'columnConfig',
      JSON.stringify(
        picked.map((columnKey, index) => {
          const match = resolverColumns.find((c) => c.columnKey === columnKey);
          return {
            columnKey,
            displayLabel: match?.displayLabel ?? columnKey,
            displayOrder: index,
          };
        }),
      ),
    );
    fd.append('isVisible', String(visible));
    return fd;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTitle('');
          setSlug('');
          setFilterOp('none');
          setFilterColumn('');
          setFilterValue('');
          setPicked([]);
        }
      }}
    >
      <DialogTrigger asChild>
        <DisabledWrite active={demo || disabled}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-slot="add-custom-page"
            disabled={demo || disabled}
            className={disabledWriteClassName}
          >
            Add custom page
          </Button>
        </DisabledWrite>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add custom page</DialogTitle>
          <DialogDescription>
            A custom page renders a filtered view of one source table into the client portal.
          </DialogDescription>
        </DialogHeader>
        <form
          action={() => {
            action(buildFormData());
          }}
          className="flex flex-col gap-3"
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
              onChange={(e) => {
                setSlug(toKebab(e.target.value));
              }}
              required
            />
            <p className="font-mono text-[11px] text-text3">
              URL: /client/[brand]/custom/{slug || 'kebab-case-slug'}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Source table</Label>
            <Select
              value={source}
              onValueChange={(next) => {
                setSource(next as CustomPageSourceTableKey);
                setPicked([]);
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
          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-medium text-text2">Columns</legend>
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-input border border-line bg-surface2 p-2">
              {resolverColumns.length === 0 ? (
                <p className="text-xs text-text3">
                  No resolver columns configured for this source table.
                </p>
              ) : (
                resolverColumns.map((c) => (
                  <label key={c.columnKey} className="flex items-center gap-2 text-xs text-text2">
                    <input
                      type="checkbox"
                      data-slot="column-pick"
                      data-column-key={c.columnKey}
                      checked={picked.includes(c.columnKey)}
                      onChange={() => {
                        toggleColumn(c.columnKey);
                      }}
                    />
                    <span>{c.displayLabel}</span>
                    <span className="font-mono text-[10px] text-text4">{c.columnKey}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-[11px] text-text3">
              Leave empty to show every resolver column. Order follows pick order.
            </p>
          </fieldset>
          <div className="flex items-center gap-2">
            <Switch
              checked={visible}
              onCheckedChange={(next) => {
                setVisible(next);
              }}
            />
            <span className="text-sm text-text2">Visible in the client portal</span>
          </div>
          {state !== null && !state.ok ? (
            <p data-slot="create-error" className="text-xs text-bad" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Saving…' : 'Add page'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Normalise a user-typed title to a kebab-case slug: lowercase, dash-separated, alnum only. */
function toKebab(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
