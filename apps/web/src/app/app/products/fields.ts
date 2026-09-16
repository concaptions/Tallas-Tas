import type { ChipTone } from '@tas/domain/state';

import type { ProductFieldName } from './actions';

/**
 * The three writable PRD §5.1 product fields and the presentation rules the table, the panel and the
 * Server Actions all read. One module, so a label, a placeholder, the dash an unset value renders as
 * or the way a long URL is shortened cannot drift between them.
 *
 * `ProductFieldName` is re-exported from `actions.ts` rather than declared a second time here: the
 * actions own the union their zod schema validates, and two declarations would eventually disagree.
 * A type-only re-export is erased, so this module stays importable from a client component.
 */
export type { ProductFieldName };

export interface ProductField {
  readonly name: ProductFieldName;
  readonly label: string;
  readonly placeholder: string;
  /** PRD §5.1: a product needs a name and a landing page link; the collection link is optional. */
  readonly required: boolean;
}

/** The panel renders exactly these three, in this order, and nothing else is editable. */
export const PRODUCT_FIELDS: readonly ProductField[] = [
  {
    name: 'name',
    label: 'Product Name',
    placeholder: 'Niagara Deep Sleep Weighted Blanket',
    required: true,
  },
  {
    name: 'link',
    label: 'Landing Page URL',
    placeholder: 'https://niagarasleep.example/products/deep-sleep-weighted-blanket',
    required: true,
  },
  {
    name: 'collectionLink',
    label: 'Collection Link',
    placeholder: 'https://niagarasleep.example/collections/sleep-essentials',
    required: false,
  },
];

/** The dash a null cell shows, so an optional collection link is never an empty gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/**
 * The host of a link, for a table cell. A landing page URL is long enough to break a four-column
 * layout on a phone, so the cell shows the host and carries the full URL in its `title`. A value
 * that is not a parseable URL is returned untouched rather than hidden — the strategist typed it,
 * and the panel is where it gets corrected.
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
 * The linked-concepts chip. This is a COUNT, not a status: the Products table has no status of its
 * own (ticket criterion 11) and must not invent one, so nothing here comes from `@tas/domain/state`
 * except the tone union the shared `StatusChip` takes. Zero is rendered, never blanked.
 */
export function conceptCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'concept' : 'concepts'}`;
}

export function conceptCountTone(count: number): ChipTone {
  return count > 0 ? 'info' : 'mute';
}
