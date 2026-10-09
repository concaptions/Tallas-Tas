import { notFound } from 'next/navigation';

import { isClientVisibleColumn } from '@tas/db';
import {
  CUSTOM_PAGE_SOURCE_TABLE_LABELS,
  intersectCustomPageColumns,
  rowMatchesFilter,
  type CustomPageColumnConfig,
  type CustomPageFilterConfig,
  type CustomPageSourceTableKey,
} from '@tas/domain';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';

import { resolveClientBrand } from '@/lib/client-brand-source';
import { loadCustomPageRender } from '@/lib/client-interface-config-source';
import { parentColumnsFor } from '@/lib/resolved-columns-source';

/**
 * The CLIENT-PORTAL custom page route (Oct 6/7 Agent 4). Renders a brand-specific or template-
 * inherited custom page: filtered rows from one source table, in the column_config the admin
 * picked.
 *
 * Non-negotiable 10 is enforced by three things, together:
 *   1. `isVisible = false` and `deleted_at IS NOT NULL` are 404 — a hidden or deleted page cannot
 *      be opened by a guessed URL.
 *   2. The admin UI's zod enum pins `sourceTableKey` to six content tables; `loadCustomPageRows`
 *      refuses any other, so a stored row with an unknown source cannot leak another table.
 *   3. The columns the page draws come from the resolver's own set (`parentColumnsFor`), narrowed
 *      by `column_config` — the resolver's hide-list (which the Oct 5 Gratsi match applies to the
 *      template brand and the overnight runs applied to Gratsi) controls what the client reads.
 *      A column_config pick that names a resolver-hidden column is dropped by
 *      `intersectCustomPageColumns`.
 */

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ brandSlug: string; pageSlug: string }>;
}

export default async function ClientCustomPage({ params }: Props) {
  const { brandSlug, pageSlug } = await params;
  const brand = await resolveClientBrand(brandSlug);
  if (!brand) notFound();
  const render = await loadCustomPageRender(brand.id, pageSlug);
  if (!render) notFound();
  const { page, rows } = render;
  // The resolver's columns, narrowed to what a client may see (`@tas/db` `clientVisibleColumns`,
  // the same allow-list that already projected the rows), then to the page's own picks.
  const resolverColumns = parentColumnsFor(page.sourceTableKey)
    .filter((col) => isClientVisibleColumn(page.sourceTableKey, col.columnKey))
    .map((col) => ({
      columnKey: col.columnKey,
      displayLabel: col.displayLabel,
      displayOrder: col.displayOrder,
    }));
  const columns = intersectCustomPageColumns(
    resolverColumns,
    page.columnConfig satisfies readonly CustomPageColumnConfig[],
  );
  const filter = page.filterConfig satisfies CustomPageFilterConfig;
  const filteredRows = rows.filter((row) => rowMatchesFilter(row, filter));
  const sourceLabel =
    CUSTOM_PAGE_SOURCE_TABLE_LABELS[page.sourceTableKey as CustomPageSourceTableKey];

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Custom page</p>
        <h1 className="text-xl font-semibold text-text">{page.title}</h1>
        <p className="text-sm text-text2" data-slot="custom-page-meta">
          {filteredRows.length === 0
            ? `No ${sourceLabel.toLowerCase()} match this view.`
            : `${String(filteredRows.length)} row${filteredRows.length === 1 ? '' : 's'} — ${sourceLabel}`}
        </p>
      </div>
      {filteredRows.length > 0 ? (
        <div className="overflow-x-auto" data-slot="custom-page-table">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.columnKey} data-column-key={col.columnKey}>
                    {col.displayLabel}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row, rowIndex) => (
                <TableRow
                  // No stable id key across source tables (every table has `id`, but it is `unknown`
                  // after the drop to `Record<string, unknown>`), so the row index is used as the key;
                  // the list is read-only, so React never has to reconcile.
                  key={rowIndex}
                >
                  {columns.map((col) => (
                    <TableCell key={col.columnKey} className="font-mono text-sm">
                      {renderCell(row[col.columnKey])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </>
  );
}

const EM_DASH = '—';

/**
 * Narrow a jsonb-or-primitive cell to a plain string the table can render. Objects fall back to
 * the em-dash — a client cell is read-only, so a cell this component cannot read becomes an
 * explicit "no value" rather than a `[object Object]`.
 */
function renderCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => renderCell(v)).join(', ');
  return EM_DASH;
}
