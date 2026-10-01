import type { ChipTone } from '@tas/domain/state';

import type { ClientAssetFolderFieldName } from './actions';

/**
 * The three typed Client Assets fields (Airtable "Client Assets Organisation": Name [Folder],
 * Description and Location) and the presentation rules the grid, the panel and the Server Actions
 * all read. One module, so a label, a placeholder, the dash an unset value renders as or the way a
 * long URL is shortened cannot drift between them. The one record link ("(Internal) Creative
 * Design" → briefs) is not a field here: it is the panel's chip picker, posted as repeated hidden
 * inputs and synced through `syncFolderBriefs`.
 *
 * `ClientAssetFolderFieldName` is re-exported from `actions.ts` rather than declared a second time
 * here: the actions own the union their zod schema validates, and two declarations would eventually
 * disagree. A type-only re-export is erased, so this module stays importable from a client component.
 */
export type { ClientAssetFolderFieldName };

export interface ClientAssetFolderField {
  readonly name: ClientAssetFolderFieldName;
  readonly label: string;
  readonly placeholder: string;
  /** Name [Folder] is Airtable's primary field, the only value it guarantees; the rest is optional. */
  readonly required: boolean;
  /** A single-line input for the name and the link; the description is a multi-line text area. */
  readonly control: 'input' | 'textarea';
}

/** The panel renders exactly these three, in this order, and nothing else is typed. */
export const CLIENT_ASSET_FOLDER_FIELDS: readonly ClientAssetFolderField[] = [
  {
    name: 'name',
    label: 'Folder Name',
    placeholder: 'Brand Kit — Logos, Fonts & Colour',
    required: true,
    control: 'input',
  },
  {
    name: 'description',
    label: 'Description',
    placeholder: 'What lives in this folder and which designs start from it',
    required: false,
    control: 'textarea',
  },
  {
    name: 'locationUrl',
    label: 'Location',
    placeholder: 'https://drive.google.com/drive/folders/…',
    required: false,
    control: 'input',
  },
];

/** The dash a null cell shows, so an optional description or location is never an empty gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/**
 * The host of a link, for a grid cell. A Drive or Dropbox share URL is long enough to break a
 * five-column layout on a phone, so the cell shows the host and carries the full URL in its `title`.
 * A value that is not a parseable URL is returned untouched rather than hidden — the strategist
 * typed it, and the panel is where it gets corrected.
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
 * The linked-designs chip. This is a COUNT, not a status: the Client Assets table has no status of
 * its own and must not invent one, so nothing here comes from `@tas/domain/state` except the tone
 * union the shared `StatusChip` takes. Zero is rendered, never blanked.
 */
export function designCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'design' : 'designs'}`;
}

export function linkCountTone(count: number): ChipTone {
  return count > 0 ? 'info' : 'mute';
}
