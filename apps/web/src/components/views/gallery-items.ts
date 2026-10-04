import { applyUserView, type GalleryFieldOption } from '@tas/domain';

import type { GridColumn } from './airtable-grid';
import { initialTone, type GalleryItem } from './gallery-view';
import type { ResolvedColumnView } from './resolved-columns';
import { orderColumns } from './resolved-columns';

/** One media column a card can be covered by: the row's URL for it, and how to render it. */
export interface GalleryCover {
  readonly url: string | null;
  readonly mediaType?: 'image' | 'video';
}

export interface GalleryIdentity {
  readonly id: string;
  readonly name: string;
  /** The page's DEFAULT card image; absent or null falls back to the initial tile. */
  readonly imageUrl?: string | null;
  readonly mediaType?: 'image' | 'video';
  readonly subtitle?: string;
  /**
   * Every media column this row could be covered by, keyed by RESOLVER column key — the same keys
   * the table declares in its `galleryFields` (action item 16). A page that offers no choice of
   * cover omits this and keeps `imageUrl`.
   */
  readonly covers?: Readonly<Record<string, GalleryCover>>;
}

export interface GalleryItemsOptions {
  /** The viewer's chosen cover column, or null for the page's own `imageUrl`. */
  readonly coverField?: string | null;
  /**
   * The viewer's `fieldOrder` (action item 16, the reorder half): the card's labelled lines come
   * out in this order, listed keys first and every other column in the table's own order after —
   * the same rule `applyUserView` applies to the grid, so one control reorders both.
   */
  readonly fieldOrder?: readonly string[];
}

/**
 * The cover columns a viewer may choose between on this table (action item 16).
 *
 * Built from the BRAND'S RESOLVED COLUMN SET, intersected with the table's declared
 * `galleryFields`: the registry says which columns are media worth covering a card with, and the
 * resolver says which of them this brand actually has, in what order, under what label. So a column
 * an admin hid is not offered, a relabelled column is offered under the brand's own label, and a
 * table with no media column shows no picker at all.
 *
 * The resolved COLUMN SET is used rather than the grid's built columns on purpose: `profile_pic_url`
 * is the creators gallery's whole default cover and has no grid renderer at all (it draws inside
 * the frozen name cell), so a list taken from the grid would leave out the one cover that is already
 * in use.
 */
export function coverFieldOptions(
  resolved: readonly ResolvedColumnView[],
  galleryFields: readonly GalleryFieldOption[],
): { readonly key: string; readonly label: string }[] {
  const allowed = new Map(galleryFields.map((field) => [field.field, field]));
  return orderColumns(resolved)
    .filter((column) => allowed.has(column.columnKey))
    .map((column) => ({ key: column.columnKey, label: column.displayLabel }));
}

/**
 * The gallery cards of a table, built from the SAME column definitions the grid renders (Sprint 7,
 * VIEWS-01): every column but the name becomes a labelled line under the card's name, so the Fields
 * popover hides a column and a card line with one toggle. A record with no picture gets its initial
 * on a tile coloured stably from its name.
 *
 * THE COVER IS A CHOICE NOW (action item 16). `options.coverField` names one of the row's `covers`;
 * the page's own `imageUrl` is the fallback, and it is also what a row that has no value for the
 * chosen column falls back to — a creator with no video intro keeps their profile picture rather
 * than losing their cover because of a setting made for the table. A `coverField` the row does not
 * carry is likewise ignored, never rendered as an empty card, which is the same "degrade to the
 * default, never to nothing" rule `reconcileViewFields` follows for hidden columns.
 */
export function galleryItemsFrom<Row>(
  rows: readonly Row[],
  columns: readonly GridColumn<Row>[],
  identity: (row: Row) => GalleryIdentity,
  options: GalleryItemsOptions = {},
): GalleryItem[] {
  const coverField = options.coverField ?? null;
  const fieldOrder = options.fieldOrder ?? [];
  const lineColumns = columns.filter((column) => column.key !== 'name');
  const orderedColumns =
    fieldOrder.length === 0
      ? lineColumns
      : applyUserView(lineColumns, { visibleFields: null, fieldOrder, frozenFields: [] });
  return rows.map((row) => {
    const who = identity(row);
    const chosen = coverField === null ? undefined : who.covers?.[coverField];
    const image = chosen?.url ?? who.imageUrl ?? null;
    const mediaType =
      chosen?.url == null ? (who.mediaType ?? 'image') : (chosen.mediaType ?? 'image');
    return {
      id: who.id,
      name: who.name,
      imageUrl: image,
      mediaType,
      subtitle: who.subtitle,
      initial: who.name.trim().charAt(0).toUpperCase() || '?',
      initialTone: initialTone(who.name),
      fields: orderedColumns.map((column) => ({
        key: column.key,
        label: column.header,
        value: column.render(row),
      })),
    };
  });
}
