import type { ChipTone } from '@tas/domain/state';
import type { CollectionListRow } from '@tas/db';

import type { CollectionFieldName } from './actions';

/**
 * Field metadata and presentation helpers for the Collections table and panel. One module, so a
 * label, a placeholder or the dash an unset value renders as cannot drift between the table, the
 * panel and the Server Actions — the same shape `products/fields.ts` uses.
 *
 * `CollectionFieldName` is re-exported from `actions.ts` rather than declared a second time: the
 * actions own the union their zod schema validates, and a type-only re-export is erased at build
 * time, so this module stays importable from a client component.
 */
export type { CollectionFieldName };

export interface CollectionField {
  readonly name: CollectionFieldName;
  readonly label: string;
  readonly placeholder: string;
  /** Collections need only a name (CLAUDE.md §5 mirrors: statics can exist without a concept). */
  readonly required: boolean;
}

/** The panel renders exactly these, in this order. Relation fields take a uuid, not a name. */
export const COLLECTION_FIELDS: readonly CollectionField[] = [
  {
    name: 'name',
    label: 'Collection Name',
    placeholder: 'BFCM 2026 Collection',
    required: true,
  },
  {
    name: 'url',
    label: 'URL',
    placeholder: 'https://niagarasleep.com/collections/bfcm',
    required: false,
  },
  {
    name: 'campaignId',
    label: 'Campaign ID',
    placeholder: 'Campaign UUID',
    required: false,
  },
  {
    name: 'angleId',
    label: 'Angle ID',
    placeholder: 'Angle UUID',
    required: false,
  },
  {
    name: 'productId',
    label: 'Product ID',
    placeholder: 'Product UUID',
    required: false,
  },
  {
    name: 'creativeDesignNote',
    label: 'Creative Design Note',
    placeholder: 'High-energy reels with before/after footage',
    required: false,
  },
  {
    name: 'copywritingId',
    label: 'Copywriting ID',
    placeholder: 'Copywriting UUID',
    required: false,
  },
  {
    name: 'creativeDesign2Id',
    label: 'Creative Design 2 ID',
    placeholder: 'Creative brief UUID',
    required: false,
  },
];

/** The dash a null cell shows, so an optional relation or note is never an empty gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/** What the empty state says when there are no collections at all versus a search with no hits. */
export const NO_COLLECTIONS_HINT =
  'No collections yet. Group the campaign, angle and product a set of creatives is built around.';
export const NO_MATCHES_HINT_PREFIX = 'Nothing matches';

/** Why Upload CSV is inert: the import phase for this table has not shipped yet. */
export const UPLOAD_SOON_HINT = 'Bulk upload arrives with the CSV import phase.';

/**
 * The host of a link, for a table cell. A collection URL is long enough to break a compact column
 * on a phone, so the cell shows the host and carries the full URL in its `title`. A value that is
 * not a parseable URL is returned untouched — the strategist typed it, and the panel is where it
 * gets corrected.
 */
export function hostLabel(value: string | null): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  try {
    return new URL(value).host.replace(/^www\./, '');
  } catch {
    return value;
  }
}

/**
 * Whether a collection matches a search term. Matches on the collection's own name and URL plus the
 * resolved relation names, never on raw ids — a strategist searches "BFCM" or "Reset Bundle", not a
 * uuid.
 */
export function matchesSearch(row: CollectionListRow, query: string): boolean {
  const haystack = [
    row.name,
    row.url ?? '',
    row.campaignName ?? '',
    row.angleName ?? '',
    row.productName ?? '',
  ];
  return haystack.some((value) => value.toLowerCase().includes(query));
}

/** The header/count line: "N collections" or "M of N collections" once a search narrows the list. */
export function countLabel(visible: number, total: number): string {
  if (visible === total) {
    return `${String(total)} ${total === 1 ? 'collection' : 'collections'}`;
  }
  return `${String(visible)} of ${String(total)} collections`;
}

/** Tone for a relation chip when a table cell wants to signal "linked" vs "not linked". */
export function relationTone(value: string | null): ChipTone {
  return value !== null ? 'info' : 'mute';
}
