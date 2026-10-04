import type { ReactNode } from 'react';

import type { GridColumn } from './airtable-grid';

/**
 * One column as the resolver returned it. Structural on purpose — declared here rather than imported
 * from `@tas/db` so a client component can take it without pulling the database package into the
 * browser bundle, the same reason `ConceptAngleItem` is structural on the concepts page.
 */
export interface ResolvedColumnView {
  readonly columnKey: string;
  readonly displayLabel: string;
  readonly displayOrder: number;
}

/**
 * How one column's CELL is drawn. The resolver owns the label, the order and whether the column
 * appears at all; this owns only the rendering, which is the part that cannot be expressed as data —
 * a chip whose tone comes from a vocabulary, a link that needs an href, a formatted date.
 */
export interface ColumnRenderer<Row> {
  readonly render: (row: Row) => ReactNode;
  readonly sortValue?: (row: Row) => string | number | null;
  readonly cellTitle?: (row: Row) => string | undefined;
  readonly align?: 'left' | 'right' | 'center';
  readonly minWidth?: number;
}

/** A page's renderers, keyed by the resolver's `columnKey`. */
export type ColumnRegistry<Row> = Readonly<Record<string, ColumnRenderer<Row>>>;

export interface GridColumnsFromResult<Row> {
  readonly columns: readonly GridColumn<Row>[];
  /**
   * Column keys the resolver returned that this page has no renderer for. Reported rather than
   * silently dropped: a column configured by an admin and then not drawn is exactly the failure the
   * self-QA loop checks for, and a silent omission would make the page quietly lie about the config.
   */
  readonly missing: readonly string[];
}

export interface GridColumnsFromOptions {
  /**
   * Freeze the first resolved column — the name column on every one of these pages. This is the
   * TABLE's default, not the last word: `applyUserView` runs after this and a viewer's own
   * `frozenFields` replaces it (action item 22). An empty `frozenFields` means "keep the default",
   * so the two never contend for the same state.
   */
  readonly freezeFirst?: boolean;
  /** Width for the frozen column, matching the hand-written grids it replaces. */
  readonly frozenMinWidth?: number;
}

/**
 * THE ordering of resolved columns, defined once.
 *
 * `resolveColumns` already sorts its own output this way; the order is re-applied here because an
 * array that reaches a page has crossed a serialization boundary and a caller may hand over a
 * subset it assembled itself. `displayOrder` first, `columnKey` as the tie-break, so two columns
 * that share an order come out stable rather than insertion-ordered.
 *
 * Both consumers of a resolved set call this — the grid through `gridColumnsFrom`, an editing form
 * through its own layout function (`personaPanelFrom`) — so a header and its field label cannot
 * drift apart, and the next page inherits the helper instead of a fourth copy of the comparator.
 */
export function orderColumns<Column extends ResolvedColumnView>(
  resolved: readonly Column[],
): Column[] {
  return [...resolved].sort(
    (left, right) =>
      left.displayOrder - right.displayOrder || left.columnKey.localeCompare(right.columnKey),
  );
}

/**
 * THE adapter between the column resolver and `<AirtableGrid>`: label, order and visibility come
 * from the database as DATA; rendering stays code in the page's registry.
 *
 * This is the single place that join happens, so no page re-implements it and no two pages disagree
 * about what a resolved column means. A page's hard-coded column array is replaced by a registry
 * plus a call to this.
 */
export function gridColumnsFrom<Row>(
  resolved: readonly ResolvedColumnView[],
  registry: ColumnRegistry<Row>,
  options: GridColumnsFromOptions = {},
): GridColumnsFromResult<Row> {
  const ordered = orderColumns(resolved);
  const columns: GridColumn<Row>[] = [];
  const missing: string[] = [];

  for (const [index, column] of ordered.entries()) {
    const renderer = registry[column.columnKey];
    if (renderer === undefined) {
      missing.push(column.columnKey);
      continue;
    }
    const frozen = options.freezeFirst === true && index === 0;
    columns.push({
      key: column.columnKey,
      // The LABEL is the resolver's, never the registry's: that is what makes a relabel a data edit.
      header: column.displayLabel,
      ...(frozen ? { frozen: true, minWidth: options.frozenMinWidth ?? 200 } : {}),
      ...(renderer.minWidth !== undefined && !frozen ? { minWidth: renderer.minWidth } : {}),
      ...(renderer.align !== undefined ? { align: renderer.align } : {}),
      ...(renderer.sortValue !== undefined ? { sortValue: renderer.sortValue } : {}),
      ...(renderer.cellTitle !== undefined ? { cellTitle: renderer.cellTitle } : {}),
      render: renderer.render,
    });
  }

  return { columns, missing };
}
