'use client';

import { useActionState, useMemo, useTransition } from 'react';
import { Button, DisabledWrite, disabledWriteClassName } from '@tas/ui';
import {
  CUSTOM_PAGE_SOURCE_TABLE_LABELS,
  mergeCustomPages,
  type CustomInterfacePageView,
  type CustomPageSourceTableKey,
} from '@tas/domain';

import { deleteCustomPageAction, type CustomPageActionResult } from './custom-page-actions';
import {
  requestCustomPagePromotionAction,
  type CustomPagePromotionActionResult,
} from './custom-page-propagation-actions';
import { PageDialog } from './page-dialog';

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
        <PageDialog
          mode="create"
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
