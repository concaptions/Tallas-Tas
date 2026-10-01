import type { GridColumn } from './airtable-grid';
import { initialTone, type GalleryItem } from './gallery-view';

export interface GalleryIdentity {
  readonly id: string;
  readonly name: string;
  /** The card image; absent or null falls back to the initial tile. */
  readonly imageUrl?: string | null;
  readonly mediaType?: 'image' | 'video';
  readonly subtitle?: string;
}

/**
 * The gallery cards of a table, built from the SAME column definitions the grid renders (Sprint 7,
 * VIEWS-01): every column but the name becomes a labelled line under the card's name, so the Fields
 * popover hides a column and a card line with one toggle. A record with no picture gets its initial
 * on a tile coloured stably from its name.
 */
export function galleryItemsFrom<Row>(
  rows: readonly Row[],
  columns: readonly GridColumn<Row>[],
  identity: (row: Row) => GalleryIdentity,
): GalleryItem[] {
  return rows.map((row) => {
    const who = identity(row);
    const image = who.imageUrl ?? null;
    return {
      id: who.id,
      name: who.name,
      imageUrl: image,
      mediaType: who.mediaType ?? 'image',
      subtitle: who.subtitle,
      initial: who.name.trim().charAt(0).toUpperCase() || '?',
      initialTone: initialTone(who.name),
      fields: columns
        .filter((column) => column.key !== 'name')
        .map((column) => ({ key: column.key, label: column.header, value: column.render(row) })),
    };
  });
}
