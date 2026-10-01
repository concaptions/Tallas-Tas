import type { LinkedCopy } from '@tas/db';
import { copyTitle } from '@tas/domain/copy';
import type { ChipTone } from '@tas/domain/state';

import type { CopyTypeFieldName } from './actions';

/**
 * The two writable Copy Type fields (Airtable "(Internal) Copy Type": Name and Description) and the
 * presentation rules the grid, the panel and the Server Actions all read. One module, so a label, a
 * placeholder, the dash an unset value renders as or the way a linked copy is named cannot drift
 * between them. The two record links ("Ads Copywriting copy" → Meta copy, "Copywriting" → YouTube
 * copy) are not fields here: they are the inverse sides of links the copy tables own, read-only
 * lists in the panel and counts in the grid.
 *
 * `CopyTypeFieldName` is re-exported from `actions.ts` rather than declared a second time here: the
 * actions own the union their zod schema validates, and two declarations would eventually disagree.
 * A type-only re-export is erased, so this module stays importable from a client component.
 */
export type { CopyTypeFieldName };

export interface CopyTypeField {
  readonly name: CopyTypeFieldName;
  readonly label: string;
  readonly placeholder: string;
  /** Name is Airtable's primary field, the only value it guarantees; the description is optional. */
  readonly required: boolean;
  /** Description is multilineText in Airtable, so it gets a textarea, not a single-line input. */
  readonly kind: 'input' | 'textarea';
}

/** The panel renders exactly these two, in this order, and nothing else is typed. */
export const COPY_TYPE_FIELDS: readonly CopyTypeField[] = [
  {
    name: 'name',
    label: 'Name',
    placeholder: 'Testimonial',
    required: true,
    kind: 'input',
  },
  {
    name: 'description',
    label: 'Description',
    placeholder: 'When this kind of copy is the right one, and what it has to open with.',
    required: false,
    kind: 'textarea',
  },
];

/** The dash a null cell shows, so an optional description is never an empty gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/**
 * One linked copy as the panel lists it. The headline is the name a strategist knows the copy by;
 * when a copy has none yet, the auto-generated `Copy #N` title stands in (CLAUDE.md non-negotiable
 * 6: built by `copyTitle` in `@tas/domain/copy`, the one place that string lives, never typed) and
 * `generated` says so, because system output renders in `font-mono`.
 */
export interface LinkedCopyLabel {
  readonly id: string;
  readonly label: string;
  readonly generated: boolean;
}

export function linkedCopyLabel(copy: LinkedCopy): LinkedCopyLabel {
  const headline = copy.headline?.trim() ?? '';
  return headline === ''
    ? { id: copy.id, label: copyTitle(copy.copyNumber), generated: true }
    : { id: copy.id, label: headline, generated: false };
}

/** How much of a description the grid shows before the cell title takes over. */
export const DESCRIPTION_PREVIEW_LENGTH = 72;

/**
 * The first line of a description, shortened for a grid cell. A multiline description is long enough
 * to break a five-column layout on a phone, so the cell shows its first line and carries the full
 * text in its `title`. Null, blank and whitespace-only values are null, so the cell renders the dash.
 */
export function descriptionPreview(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const [firstLine = ''] = value.trim().split(/\r?\n/);
  if (firstLine === '') {
    return null;
  }
  return firstLine.length > DESCRIPTION_PREVIEW_LENGTH
    ? `${firstLine.slice(0, DESCRIPTION_PREVIEW_LENGTH - 1).trimEnd()}…`
    : firstLine;
}

/**
 * The two link-count chips. These are COUNTS, not statuses: the Copy Types table has no status of
 * its own and must not invent one, so nothing here comes from `@tas/domain/state` except the tone
 * union the shared `StatusChip` takes. Zero is rendered, never blanked.
 */
export function metaCopyCountLabel(count: number): string {
  return `${String(count)} Meta ${count === 1 ? 'copy' : 'copies'}`;
}

export function youtubeCopyCountLabel(count: number): string {
  return `${String(count)} YouTube ${count === 1 ? 'copy' : 'copies'}`;
}

export function linkCountTone(count: number): ChipTone {
  return count > 0 ? 'info' : 'mute';
}
