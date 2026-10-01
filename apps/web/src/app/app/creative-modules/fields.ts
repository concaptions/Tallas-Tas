import type { ChipTone } from '@tas/domain/state';

import type { CreativeModuleFieldName } from './actions';

/**
 * The two writable Creative Module fields (Airtable "(Internal) Creative Modules": Module Name and
 * Foreplay Link) and the presentation rules the grid, the panel and the Server Actions all read.
 * One module, so a label, a placeholder, the dash an unset value renders as or the way a long URL is
 * shortened cannot drift between them. The two record links ("Concepts" → angles, "(Internal)
 * Creative Design" → briefs) are not fields here: they are the panel's chip pickers, posted as
 * repeated hidden inputs and synced through the junction helpers.
 *
 * `CreativeModuleFieldName` is re-exported from `actions.ts` rather than declared a second time
 * here: the actions own the union their zod schema validates, and two declarations would eventually
 * disagree. A type-only re-export is erased, so this module stays importable from a client component.
 */
export type { CreativeModuleFieldName };

export interface CreativeModuleField {
  readonly name: CreativeModuleFieldName;
  readonly label: string;
  readonly placeholder: string;
  /** Module Name is Airtable's primary field, the only value it guarantees; the board link is optional. */
  readonly required: boolean;
}

/** The panel renders exactly these two, in this order, and nothing else is typed. */
export const CREATIVE_MODULE_FIELDS: readonly CreativeModuleField[] = [
  {
    name: 'moduleName',
    label: 'Module Name',
    placeholder: 'Problem → Solution Hooks',
    required: true,
  },
  {
    name: 'foreplayLink',
    label: 'Foreplay Link',
    placeholder: 'https://app.foreplay.co/board/your-board',
    required: false,
  },
];

/** The dash a null cell shows, so an optional Foreplay link is never an empty gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/**
 * The host of a link, for a grid cell. A Foreplay board URL is long enough to break a five-column
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
 * The two link-count chips. These are COUNTS, not statuses: the Creative Modules table has no status
 * of its own and must not invent one, so nothing here comes from `@tas/domain/state` except the tone
 * union the shared `StatusChip` takes. Zero is rendered, never blanked.
 */
export function angleCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'angle' : 'angles'}`;
}

export function designCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'design' : 'designs'}`;
}

export function linkCountTone(count: number): ChipTone {
  return count > 0 ? 'info' : 'mute';
}
